import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { isCleanupDue, computeNextAt } from '../lib/cleanup.js';
import { fireNotification } from '../lib/reminders.js';

// Renders the "cleanup due" banner and fires the one in-app notification per
// occurrence (the service worker covers the app-closed case via the reminder
// mirror). Always mounted so the due-check keeps ticking on any view.
export default function CleanupBanner({ onStart }) {
  const { state, actions } = useStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  const due = isCleanupDue(state.cleanup);

  // Notify once per occurrence while the app is open.
  useEffect(() => {
    if (!due) return;
    try {
      const key = 'prodlog_cleanup_notified';
      if (localStorage.getItem(key) !== state.cleanup.nextAt) {
        localStorage.setItem(key, state.cleanup.nextAt);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          fireNotification('ProdLog', '🧹 Time to clean up your board', 'cleanup');
        }
      }
    } catch {
      /* ignore */
    }
  }, [due, state.cleanup?.nextAt]);

  if (!due) return null;

  const later = () =>
    actions.setCleanup({
      nextAt: computeNextAt(state.cleanup.everyDays, state.cleanup.time),
    });

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-accent/20 bg-accent/10 px-3 py-2">
      <span className="text-sm">🧹</span>
      <p className="min-w-0 flex-1 text-xs font-medium text-ink/80">
        Cleanup time — review your board one task at a time
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
        onClick={onStart}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
      >
        Start
      </button>
    </div>
  );
}
