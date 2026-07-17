import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/StoreContext.jsx';
import { computeNextAt, CADENCES } from '../lib/cleanup.js';
import { ensureNotifyPermission, enableBackgroundChecks } from '../lib/reminders.js';

// Cleanup schedule settings: pick a cadence + time of day, or start a review
// right now. When the schedule fires you get a notification + an in-app
// banner; the review walks the board one task at a time.
export default function CleanupSheet({ onClose, onStart }) {
  const { state, actions } = useStore();
  const [everyDays, setEveryDays] = useState(state.cleanup?.everyDays ?? null);
  const [time, setTime] = useState(state.cleanup?.time || '18:00');

  const save = async () => {
    if (everyDays) {
      const p = await ensureNotifyPermission();
      if (p === 'granted') enableBackgroundChecks();
      actions.setCleanup({ everyDays, time, nextAt: computeNextAt(everyDays, time) });
    } else {
      actions.setCleanup({ everyDays: null, nextAt: null });
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-t-2xl border border-ink/10 bg-paper p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <h3 className="text-sm font-semibold">Cleanup schedule</h3>
        <p className="mt-1 text-xs leading-relaxed text-ink/60">
          A recurring nudge to keep the board honest: at the scheduled time you get a
          notification, and the review shows each task one at a time — complete it,
          reschedule it, or move on.
        </p>

        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink/70">Repeat</span>
            <select
              value={everyDays ?? ''}
              onChange={(e) => setEveryDays(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 w-full rounded-lg border border-ink/15 bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
            >
              {CADENCES.map(([v, label]) => (
                <option key={label} value={v ?? ''}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={everyDays ? '' : 'pointer-events-none opacity-40'}>
            <span className="block text-xs font-medium text-ink/70">At</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 rounded-lg border border-ink/15 bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        {state.cleanup?.nextAt && state.cleanup?.everyDays && (
          <p className="mt-2 text-[11px] text-ink/45">
            Next scheduled: {state.cleanup.nextAt.replace('T', ' at ')}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStart();
            }}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
          >
            🧹 Start cleanup now
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
