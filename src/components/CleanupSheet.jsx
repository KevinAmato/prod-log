import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/StoreContext.jsx';
import { computeNextAt, CADENCES } from '../lib/cleanup.js';
import { newId } from '../lib/storage.js';
import { ensureNotifyPermission, enableBackgroundChecks } from '../lib/reminders.js';

// Cleanup schedules: several can coexist, each with a cadence, a time of day
// and an optional category scope (no colors selected = all tasks). Example:
// daily at 9:00 for Urgent, weekly at 18:00 for everything. Each row also has
// its own ▶ to run that review immediately.
export default function CleanupSheet({ onClose, onStart }) {
  const { state, actions } = useStore();
  const [rows, setRows] = useState(() => (state.cleanups || []).map((c) => ({ ...c })));

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { id: newId(), everyDays: 1, time: '18:00', nextAt: null, categoryIds: [] },
    ]);

  const patchRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggleCat = (row, catId) =>
    patchRow(row.id, {
      categoryIds: row.categoryIds.includes(catId)
        ? row.categoryIds.filter((x) => x !== catId)
        : [...row.categoryIds, catId],
    });

  const save = async () => {
    if (rows.length) {
      const p = await ensureNotifyPermission();
      if (p === 'granted') enableBackgroundChecks();
    }
    // Keep an unchanged row's nextAt (don't reset a pending occurrence);
    // recompute when cadence/time changed or the row is new.
    const prev = new Map((state.cleanups || []).map((c) => [c.id, c]));
    actions.setCleanups(
      rows.map((r) => {
        const old = prev.get(r.id);
        const unchanged = old && old.everyDays === r.everyDays && old.time === r.time;
        return {
          ...r,
          nextAt: unchanged && old.nextAt ? old.nextAt : computeNextAt(r.everyDays, r.time),
        };
      }),
    );
    onClose();
  };

  const startScoped = (row) => {
    onClose();
    onStart({
      categoryIds: row.categoryIds.length ? row.categoryIds : null,
      scheduleIds: [row.id],
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border border-ink/10 bg-paper shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="shrink-0 px-4 pt-4">
          <h3 className="text-sm font-semibold">Cleanup schedule</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink/60">
            Recurring nudges to keep the board honest. Each schedule can cover everything
            or just certain colors — e.g. Urgent daily, the whole board weekly.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          {rows.length === 0 && (
            <p className="py-3 text-center text-xs text-ink/40">No schedules yet</p>
          )}
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-ink/10 bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <select
                  value={row.everyDays}
                  onChange={(e) => patchRow(row.id, { everyDays: Number(e.target.value) })}
                  className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent"
                >
                  {CADENCES.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={row.time}
                  onChange={(e) => patchRow(row.id, { time: e.target.value })}
                  className="rounded-lg border border-ink/15 bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="button"
                  title="Run this review now"
                  onClick={() => startScoped(row)}
                  className="shrink-0 rounded-lg bg-accent/10 p-2 text-accent hover:bg-accent/20"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2.5 1.5v9l8-4.5-8-4.5Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Remove schedule"
                  onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                  className="shrink-0 rounded-lg p-2 text-ink/35 hover:bg-ink/5 hover:text-accent"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {state.categories.map((cat) => {
                  const on = row.categoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      title={cat.name}
                      onClick={() => toggleCat(row, cat.id)}
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        on ? 'text-ink/85' : 'border-ink/10 text-ink/40'
                      }`}
                      style={on ? { borderColor: cat.color, background: `${cat.color}1a` } : {}}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                      {cat.name}
                    </button>
                  );
                })}
                <span className="text-[10px] text-ink/35">
                  {row.categoryIds.length ? '' : 'all tasks'}
                </span>
              </div>
              {row.nextAt && (
                <p className="mt-1.5 text-[10px] text-ink/35">
                  Next: {row.nextAt.replace('T', ' at ')}
                </p>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="w-full rounded-xl border-2 border-dashed border-ink/15 py-2 text-sm font-medium text-ink/40 hover:border-ink/30 hover:text-ink/70"
          >
            + Add schedule
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose();
              onStart({ categoryIds: null, scheduleIds: [] });
            }}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
          >
            🧹 Start full cleanup
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
