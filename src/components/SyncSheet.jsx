import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  generateSyncKey,
} from '../lib/sync.js';

// Device-sync settings. The mental model shown to the user: one secret key =
// one board; enter the same key on every device. No accounts.
export default function SyncSheet({ onClose }) {
  const [cfg, setCfg] = useState(getSyncConfig());
  const [pasting, setPasting] = useState(false);
  const [pasteVal, setPasteVal] = useState('');
  const [status, setStatus] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const f = (e) => {
      setStatus(e.detail);
      setCfg(getSyncConfig());
    };
    window.addEventListener('prodlog-sync-done', f);
    return () => window.removeEventListener('prodlog-sync-done', f);
  }, []);

  const requestSync = () => window.dispatchEvent(new Event('prodlog-sync-request'));

  const enable = (key) => {
    saveSyncConfig({ key: key.trim(), lastSyncAt: null });
    setCfg(getSyncConfig());
    setPasting(false);
    requestSync();
  };

  const disconnect = () => {
    if (window.confirm('Turn off sync on this device? Your local board stays; the key is forgotten here.')) {
      clearSyncConfig();
      setCfg(null);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(cfg.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-2xl border border-ink/10 bg-paper p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <h3 className="text-sm font-semibold">Sync across devices</h3>

        {!cfg?.key ? (
          <>
            <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
              One secret key = one board. Create a key here, then enter the same key on
              your other device — both stay in sync (free, no account). Keep the key
              private: anyone who has it can read and edit this board.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => enable(generateSyncKey())}
                className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
              >
                Create a new sync key
              </button>
              {pasting ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={pasteVal}
                    onChange={(e) => setPasteVal(e.target.value)}
                    placeholder="plog_…"
                    className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-2.5 py-2 font-mono text-xs outline-none focus:border-accent"
                    onKeyDown={(e) => e.key === 'Enter' && pasteVal.trim().length >= 16 && enable(pasteVal)}
                  />
                  <button
                    type="button"
                    disabled={pasteVal.trim().length < 16}
                    onClick={() => enable(pasteVal)}
                    className="rounded-lg border border-ink/15 px-3 py-2 text-sm font-medium disabled:opacity-30"
                  >
                    Connect
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPasting(true)}
                  className="rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
                >
                  I already have a key
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-xs text-ink/60">
              Enter this key on your other device (Menu → Sync devices) to link it:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-ink/5 px-2.5 py-2 font-mono text-xs">
                {cfg.key}
              </code>
              <button
                type="button"
                onClick={copyKey}
                className="shrink-0 rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium hover:bg-ink/5"
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink/45">
              {cfg.lastSyncAt
                ? `Last synced ${new Date(cfg.lastSyncAt).toLocaleString()}`
                : 'Not synced yet'}
              {status?.status === 'error' && (
                <span className="text-red-600"> · last attempt failed ({status.detail})</span>
              )}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={disconnect}
                className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
              >
                Turn off sync
              </button>
              <button
                type="button"
                onClick={requestSync}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90"
              >
                Sync now
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
