import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PROVIDERS,
  MODEL_SUGGESTIONS,
  DEFAULT_MODEL,
  getAiSettings,
  saveAiSettings,
  clearAiSettings,
} from '../lib/ai.js';
import AiLogSheet from './AiLogSheet.jsx';

// BYOK AI settings (ThreadPatrol-style BYOM): pick a provider, paste that
// provider's key, optionally type ANY model id. Stored ONLY in this browser —
// deliberately NOT in the synced blob, so your API key never leaves the device.
export default function AiSettingsSheet({ onClose, onSaved }) {
  const [cfg, setCfg] = useState(getAiSettings());
  const [logOpen, setLogOpen] = useState(false);

  const save = () => {
    saveAiSettings(cfg);
    onSaved?.();
    onClose();
  };

  const disable = () => {
    if (window.confirm('Remove the AI key from this device and hide the assistant?')) {
      clearAiSettings();
      onSaved?.();
      onClose();
    }
  };

  const setKey = (v) =>
    setCfg((c) => ({ ...c, keys: { ...c.keys, [c.provider]: v.trim() } }));
  const provider = PROVIDERS.find((p) => p.id === cfg.provider);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-2xl border border-ink/10 bg-paper p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <h3 className="text-sm font-semibold">AI assistant</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">
          Bring your own key. The assistant can create, complete, delete and annotate
          tasks by chat or voice. Your key is stored <b>only in this browser</b> — it
          never syncs and never touches our worker.
        </p>

        <label className="mt-3 block text-xs font-medium text-ink/70">Provider</label>
        <select
          value={cfg.provider}
          onChange={(e) => setCfg((c) => ({ ...c, provider: e.target.value, model: '' }))}
          className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="mt-3 block text-xs font-medium text-ink/70">API key</label>
        <input
          type="password"
          value={cfg.keys[cfg.provider] || ''}
          onChange={(e) => setKey(e.target.value)}
          placeholder={provider?.keyHint}
          className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2.5 py-2 font-mono text-sm outline-none focus:border-accent"
        />

        <label className="mt-3 block text-xs font-medium text-ink/70">
          Model <span className="font-normal text-ink/45">(any id — blank = {DEFAULT_MODEL[cfg.provider]})</span>
        </label>
        <input
          list="prodlog-models"
          value={cfg.model}
          onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
          placeholder={DEFAULT_MODEL[cfg.provider]}
          className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2.5 py-2 font-mono text-sm outline-none focus:border-accent"
        />
        <datalist id="prodlog-models">
          {(MODEL_SUGGESTIONS[cfg.provider] || []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
          Suggestions are ordered cheapest first — this app mostly reads a small board
          snapshot and picks an action, which the cheap/fast tier handles well. Type any
          other model id if you'd rather use a pricier one.
        </p>

        <button
          type="button"
          onClick={() => setLogOpen(true)}
          className="mt-3 text-xs font-medium text-ink/50 underline-offset-2 hover:text-accent hover:underline"
        >
          View recent AI activity (debug log) →
        </button>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={disable}
            className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
          >
            Remove key
          </button>
          <button
            type="button"
            disabled={!(cfg.keys[cfg.provider] || '').trim()}
            onClick={save}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-30"
          >
            Save
          </button>
        </div>
      </div>

      {logOpen && <AiLogSheet onClose={() => setLogOpen(false)} />}
    </div>,
    document.body,
  );
}
