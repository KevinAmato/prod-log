import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/StoreContext.jsx';
import { numberCards } from '../lib/assistant.js';
import { computeNextAt } from '../lib/cleanup.js';
import TaskCard from './TaskCard.jsx';

// The cleanup review: one task at a time, centered, everything else faded
// out. The queue is every live card in column order (first column top-to-
// bottom, then the next), snapshotted when the review starts. The card is the
// real TaskCard in spotlight mode — checkbox, subtasks, menus all work — so
// completing it here IS completing it, and the review auto-advances when the
// task leaves the board.
export default function CleanupMode({ onClose }) {
  const { state, actions } = useStore();
  const numbers = useMemo(() => numberCards(state), [state]);

  // Snapshot the queue once — edits during review don't reshuffle it.
  const [queue] = useState(() => {
    const ids = [];
    for (const col of state.columns) {
      for (const c of state.cards) {
        if (c.status === 'live' && c.columnId === col.id) ids.push(c.id);
      }
    }
    return ids;
  });
  const [idx, setIdx] = useState(0);

  const current = idx < queue.length ? state.cards.find((c) => c.id === queue[idx]) : null;
  const currentGone = idx < queue.length && (!current || current.status !== 'live');

  // Auto-advance when the current task is completed/deleted (with a beat so
  // the check animation lands), or instantly if it vanished entirely.
  useEffect(() => {
    if (!currentGone) return undefined;
    const t = setTimeout(() => setIdx((i) => i + 1), current ? 350 : 0);
    return () => clearTimeout(t);
  }, [currentGone, current, idx]);

  const finished = idx >= queue.length;
  const completedDuring = queue.filter(
    (id) => state.cards.find((c) => c.id === id)?.status === 'done',
  ).length;
  const colName = current
    ? state.columns.find((c) => c.id === current.columnId)?.name
    : null;

  // Leaving the review — by finishing OR exiting — counts as this cycle's
  // cleanup: advance the schedule so the banner stands down.
  const finish = () => {
    if (state.cleanup?.everyDays) {
      actions.setCleanup({
        nextAt: computeNextAt(state.cleanup.everyDays, state.cleanup.time),
      });
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-paper/95 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
        <span className="text-base">🧹</span>
        <p className="flex-1 text-sm font-semibold">Cleanup</p>
        {!finished && (
          <span className="rounded-full bg-ink/5 px-2.5 py-1 font-mono text-xs text-ink/55">
            {Math.min(idx + 1, queue.length)} / {queue.length}
          </span>
        )}
        <button
          type="button"
          title="Exit cleanup"
          onClick={finish}
          className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
        >
          ✕
        </button>
      </div>

      {/* Progress track */}
      <div className="mx-4 mt-2 h-1 shrink-0 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${queue.length ? (Math.min(idx, queue.length) / queue.length) * 100 : 100}%` }}
        />
      </div>

      {/* Spotlight */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-4 py-4">
        {finished ? (
          <div className="text-center">
            <p className="text-4xl">✨</p>
            <h2 className="mt-3 text-lg font-bold">Board reviewed</h2>
            <p className="mt-1 text-sm text-ink/55">
              {queue.length} task{queue.length === 1 ? '' : 's'} checked
              {completedDuring > 0 && ` · ${completedDuring} completed`}
            </p>
          </div>
        ) : current ? (
          <>
            <div className="text-center">
              <h2 className="text-lg font-bold">Is this task up to date?</h2>
              <p className="mt-1 text-xs text-ink/50">
                {colName} · complete it, tweak it, or move on
              </p>
            </div>
            <div className="w-full max-w-sm">
              <TaskCard
                spotlight
                card={current}
                number={numbers.get(current.id)}
                index={0}
                columnCount={1}
                columns={state.columns}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-ink/40">…</p>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex shrink-0 items-center gap-3 px-4 pb-4 pt-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <button
          type="button"
          onClick={finish}
          className="rounded-xl px-4 py-3 text-sm font-medium text-ink/55 hover:bg-ink/5"
        >
          Exit cleanup
        </button>
        <button
          type="button"
          onClick={() => (finished ? finish() : setIdx((i) => i + 1))}
          className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98]"
        >
          {finished ? 'Finish' : 'Next task →'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
