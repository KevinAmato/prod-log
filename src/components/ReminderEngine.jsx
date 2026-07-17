import { useEffect } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import { fireNotification, mirrorReminders, pendingReminders } from '../lib/reminders.js';
import { cleanupMirrorEntries } from '../lib/cleanup.js';

// Headless: fires due reminders while the app is open (checked every 20 s and
// on tab focus) and keeps the IndexedDB mirror fresh so the service worker can
// cover the app-closed case. If notifications are blocked, falls back to an
// in-app snackbar so a reminder is never silently lost.
export default function ReminderEngine() {
  const { state, actions } = useStore();
  const snack = useSnack();

  useEffect(() => {
    mirrorReminders(state.cards, cleanupMirrorEntries(state.cleanups, state.categories));
  }, [state.cards, state.cleanups, state.categories]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const r of pendingReminders(state.cards)) {
        if (new Date(r.at).getTime() > now) continue;
        actions.markReminderFired(r.cardId, r.id);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          fireNotification(r.title, r.body, r.id);
        } else {
          snack(`${r.body} — ${r.title}`);
        }
      }
    };
    check();
    const iv = setInterval(check, 20000);
    const onVis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [state.cards, actions, snack]);

  return null;
}
