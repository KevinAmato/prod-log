import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { generateSyncKey } from '../lib/sync.js';
import {
  getRegistry,
  addWorkspace,
  setActiveWorkspace,
  removeWorkspace,
  updateWorkspace,
  inviteLink,
  findBySyncKey,
  MAX_WORKSPACES,
} from '../lib/workspaces.js';

// Workspaces & sharing. One sheet covers the whole story: switch between
// boards, create one, share the ACTIVE one (with your other devices or with
// people — same mechanism, same link), and leave it. Replaces the old
// device-sync sheet: multi-device sync is just "invite yourself".
//
// Honest security model, stated in the copy: the link IS the credential.
// Anyone holding it can read and edit that one workspace (and nothing else).
// Revocation = "Reset link": the key rotates, every current member falls off,
// and you re-invite the people you still want.
export default function WorkspacesSheet({ onClose }) {
  const [reg, setReg] = useState(getRegistry());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinVal, setJoinVal] = useState('');
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(null);

  const refresh = () => setReg(getRegistry());
  const active = reg.list.find((w) => w.id === reg.active) || reg.list[0];
  const link = inviteLink(active);

  useEffect(() => {
    const f = (e) => {
      setStatus(e.detail);
      refresh();
    };
    window.addEventListener('prodlog-sync-done', f);
    return () => window.removeEventListener('prodlog-sync-done', f);
  }, []);

  // Switching (and joining/creating/leaving) reloads: the store loads its
  // workspace's blob once at boot, and a reload keeps that dead simple.
  const switchTo = (id) => {
    if (id === reg.active) return;
    setActiveWorkspace(id);
    window.location.reload();
  };

  const create = () => {
    if (!addWorkspace(newName || 'Workspace')) return;
    window.location.reload();
  };

  // Accepts a full invite link OR a bare plog_… key (in case a messenger
  // mangles the URL). Joining a key you already have just switches to it.
  const join = () => {
    const raw = joinVal.trim();
    let key = raw.startsWith('plog_') ? raw : null;
    let name = 'Shared board';
    const m = raw.match(/#join=([^&\s]+)(?:&n=([^&\s]+))?/);
    if (m) {
      key = decodeURIComponent(m[1]);
      if (m[2]) name = decodeURIComponent(m[2]);
    }
    if (!key || key.length < 16) return;
    const existing = findBySyncKey(key);
    if (existing) return switchTo(existing.id);
    if (!addWorkspace(name, key)) return;
    window.location.reload();
  };

  const share = () => {
    updateWorkspace(active.id, { syncKey: generateSyncKey() });
    refresh();
  };

  const resetLink = () => {
    if (
      window.confirm(
        'Reset the share link? Everyone currently in this workspace (including your other devices) loses access until you send them the new link. They keep their local copy.',
      )
    ) {
      updateWorkspace(active.id, { syncKey: generateSyncKey(), lastSyncAt: null });
      refresh();
    }
  };

  const stopSharing = () => {
    if (
      window.confirm(
        'Stop sharing this workspace? It becomes local to this device; other members keep their copies but stop receiving changes.',
      )
    ) {
      updateWorkspace(active.id, { syncKey: null, lastSyncAt: null });
      refresh();
    }
  };

  const leave = () => {
    if (
      window.confirm(
        `Leave “${active.name}”? Its copy on this device is removed. ${
          active.syncKey ? 'The shared board lives on — rejoin any time with the link.' : 'This is the only copy — it will be gone.'
        }`,
      )
    ) {
      removeWorkspace(active.id);
      window.location.reload();
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const rename = () => {
    const name = window.prompt('Workspace name', active.name);
    if (name?.trim()) {
      updateWorkspace(active.id, { name: name.trim() });
      refresh();
    }
  };

  const btn = 'rounded-lg border border-ink/15 px-3 py-2 text-xs font-medium hover:bg-ink/5';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 cursor-pointer bg-black/40" onClick={onClose} />
      <div
        className="relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-ink/10 bg-paper p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <h3 className="text-sm font-semibold">Workspaces</h3>

        {/* ── Workspace list ─────────────────────────────────────────────── */}
        <div className="mt-2 flex flex-col gap-1">
          {reg.list.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => switchTo(w.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                w.id === reg.active
                  ? 'bg-accent/10 font-medium text-ink'
                  : 'text-ink/70 hover:bg-ink/5'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.syncKey && <span className="shrink-0 text-[11px] text-ink/40">shared</span>}
              {w.id === reg.active && <span className="shrink-0 text-accent">✓</span>}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          {creating ? (
            <>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Workspace name"
                className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
              />
              <button type="button" onClick={create} className={btn}>
                Create
              </button>
            </>
          ) : joining ? (
            <>
              <input
                autoFocus
                value={joinVal}
                onChange={(e) => setJoinVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                placeholder="Paste invite link or key"
                className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-2.5 py-2 font-mono text-xs outline-none focus:border-accent"
              />
              <button type="button" onClick={join} className={btn}>
                Join
              </button>
            </>
          ) : (
            <>
              {reg.list.length < MAX_WORKSPACES && (
                <button type="button" onClick={() => setCreating(true)} className={btn}>
                  + New workspace
                </button>
              )}
              <button type="button" onClick={() => setJoining(true)} className={btn}>
                Join with a link…
              </button>
            </>
          )}
        </div>

        {/* ── Sharing the active workspace ───────────────────────────────── */}
        <div className="mt-4 border-t border-ink/10 pt-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-ink/70">
              Sharing “{active.name}”
            </h4>
            <button
              type="button"
              onClick={rename}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-ink/50 hover:bg-ink/5"
            >
              Rename
            </button>
          </div>

          {!active.syncKey ? (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
                Create a share link to sync this board with your other devices or
                invite people. Anyone who has the link can view and edit this
                workspace (and nothing else) — share it only with people you trust,
                and only you should forward it.
              </p>
              <button
                type="button"
                onClick={share}
                className="mt-2 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper hover:bg-ink/90"
              >
                Create share link
              </button>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
                Send this link to a device or person you want in this workspace.
                The link is the key — anyone holding it can view and edit, so only
                you should pass it on. AI stays personal: each member brings their
                own key (Menu → AI assistant), never shared through the board.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-ink/5 px-2.5 py-2 font-mono text-[11px]">
                  {link}
                </code>
                <button type="button" onClick={copyLink} className={`shrink-0 ${btn}`}>
                  {copied ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-ink/45">
                {active.lastSyncAt
                  ? `Last synced ${new Date(active.lastSyncAt).toLocaleString()}`
                  : 'Not synced yet'}
                {status?.status === 'error' && (
                  <span className="text-red-600"> · last attempt failed ({status.detail})</span>
                )}
                {status?.status === 'limited' && (
                  <span className="text-amber-600"> · daily sync limit reached, resumes tomorrow</span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('prodlog-sync-request'))}
                  className={btn}
                >
                  Sync now
                </button>
                <button type="button" onClick={resetLink} className={btn}>
                  Reset link (revoke access)
                </button>
                <button
                  type="button"
                  onClick={stopSharing}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10"
                >
                  Stop sharing
                </button>
              </div>
            </>
          )}

          {reg.list.length > 1 && (
            <button
              type="button"
              onClick={leave}
              className="mt-3 rounded-lg px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10"
            >
              Leave this workspace
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
