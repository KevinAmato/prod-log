import { useState } from 'react';
import { createPortal } from 'react-dom';
import { newId } from '../lib/storage.js';
import {
  ensureNotifyPermission,
  enableBackgroundChecks,
  toLocalInput,
} from '../lib/reminders.js';

// Bottom sheet (mobile) / centered modal (desktop) for reminders — works for a
// card OR a subtask: caller passes the current list and receives the edited
// list via onSave. Adding the first reminder requests notification permission
// and registers background checks.
export default function ReminderSheet({ title, reminders, onSave, onClose }) {
  const [rows, setRows] = useState(reminders || []);
  const [perm, setPerm] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  const add = async () => {
    const p = await ensureNotifyPermission();
    setPerm(p);
    if (p === 'granted') enableBackgroundChecks();
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    setRows((rs) => [...rs, { id: newId(), at: toLocalInput(d), fired: false }]);
  };

  const save = () => {
    onSave(rows.filter((r) => r.at));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={save} />
      <div
        className="relative w-full max-w-md rounded-t-2xl border border-ink/10 bg-paper p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <h3 className="text-sm font-semibold">Reminders</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-ink/50">{title}</p>

        {perm === 'denied' && (
          <p className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-800">
            Notifications are blocked for this site — reminders will only show inside the
            app. Enable them in your browser's site settings for real notifications.
          </p>
        )}
        {perm === 'unsupported' && (
          <p className="mt-2 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs text-amber-800">
            This browser doesn't support notifications — reminders will show inside the app.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {rows.length === 0 && (
            <p className="py-2 text-center text-xs text-ink/40">No reminders set</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={r.at}
                disabled={r.fired}
                onChange={(e) =>
                  setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, at: e.target.value } : x)))
                }
                className={`min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent ${
                  r.fired ? 'opacity-40' : ''
                }`}
              />
              {r.fired && <span className="shrink-0 text-[11px] text-ink/40">sent</span>}
              <button
                type="button"
                title="Remove reminder"
                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                className="shrink-0 rounded-lg p-2 text-ink/40 hover:bg-ink/5 hover:text-accent"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={add}
            className="rounded-lg px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
          >
            + Add reminder
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
