import { useEffect } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import { fireNotification, mirrorReminders } from '../lib/reminders.js';

// Headless: fires due reminders while the app is open (checked every 20 s and
// on tab focus) and keeps the IndexedDB mirror fresh so the service worker can
// cover the app-closed case. If notifications are blocked, falls back to an
// in-app snackbar so a reminder is never silently lost.
export default function ReminderEngine() {
  const { state, actions } = useStore();
  const snack = useSnack();

  useEffect(() => {
    mirrorReminders(state.cards);
  }, [state.cards]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      for (const card of state.cards) {
        if (card.status !== 'live') continue;
        for (const r of card.reminders || []) {
          if (r.fired || new Date(r.at).getTime() > now) continue;
          actions.markReminderFired(card.id, r.id);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            fireNotification(card.title, '⏰ Reminder', r.id);
          } else {
            snack(`⏰ ${card.title}`);
          }
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
