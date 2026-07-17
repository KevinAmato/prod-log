import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { dueCleanups, computeNextAt, scopeLabel } from '../lib/cleanup.js';
import { fireNotification } from '../lib/reminders.js';

// Renders the "cleanup due" banner and fires one in-app notification per
// occurrence per schedule (the service worker covers the app-closed case via
// the reminder mirror). Always mounted so the due-check keeps ticking.
export default function CleanupBanner({ onStart }) {
  const { state, actions } = useStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  const due = dueCleanups(state.cleanups);

  // Notify once per schedule occurrence while the app is open.
  useEffect(() => {
    if (!due.length) return;
    try {
      const key = 'prodlog_cleanup_notified';
      const seen = JSON.parse(localStorage.getItem(key) || '{}');
      let changed = false;
      for (const c of due) {
        if (seen[c.id] !== c.nextAt) {
          seen[c.id] = c.nextAt;
          changed = true;
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            fireNotification(
              'ProdLog',
              `🧹 Time to clean up${scopeLabel(c, state.categories)}`,
              `cleanup-${c.id}`,
            );
          }
        }
      }
      if (changed) localStorage.setItem(key, JSON.stringify(seen));
    } catch {
      /* ignore */
    }
  }, [due, state.categories]);

  if (!due.length) return null;

  // Combined scope of everything due: any unscoped schedule → all tasks.
  const categoryIds = due.some((c) => !c.categoryIds?.length)
    ? null
    : [...new Set(due.flatMap((c) => c.categoryIds))];
  const label =
    due.length === 1 ? scopeLabel(due[0], state.categories).replace(/^: /, ' — ') : '';

  const later = () => {
    due.forEach((c) =>
      actions.updateCleanup(c.id, { nextAt: computeNextAt(c.everyDays, c.time) }),
    );
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-accent/20 bg-accent/10 px-3 py-2">
      <span className="text-sm">🧹</span>
      <p className="min-w-0 flex-1 text-xs font-medium text-ink/80">
        Cleanup time{label} — review one task at a time
      </p>
      <button
        type="button"
        onClick={later}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink/55 hover:bg-ink/5"
      >
        Later
      </button>
      <button
        type="button"
        onClick={() => onStart({ categoryIds, scheduleIds: due.map((c) => c.id) })}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
      >
        Start
      </button>
    </div>
  );
}
