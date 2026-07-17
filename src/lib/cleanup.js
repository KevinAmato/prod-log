// Cleanup-schedule plumbing. state.cleanup = { everyDays, time, nextAt }:
//   everyDays: null (off) or 1..n — cadence in days
//   time:      'HH:mm' local time of day
//   nextAt:    'YYYY-MM-DDTHH:mm' local — the next due moment (same format as
//              reminders, so string comparison and the SW mirror both work)
import { toLocalInput } from './reminders.js';

// Next occurrence: today at `time` if that's still ahead, otherwise
// `everyDays` days out. One rule covers both initial scheduling and advancing
// after a finished/skipped cleanup.
export function computeNextAt(everyDays, time, from = new Date()) {
  const [h, m] = String(time || '18:00')
    .split(':')
    .map(Number);
  const c = new Date(from);
  c.setHours(h, m, 0, 0);
  if (c <= from) c.setDate(c.getDate() + Math.max(1, everyDays || 1));
  return toLocalInput(c);
}

export function isCleanupDue(cleanup, now = new Date()) {
  return !!cleanup?.everyDays && !!cleanup?.nextAt && cleanup.nextAt <= toLocalInput(now);
}

// Synthetic entry for the service-worker reminder mirror so the "time to
// clean up" notification fires even while the app is closed. Only FUTURE
// occurrences are mirrored — once due, the in-app banner owns it (and the SW
// already fired once and deleted its copy).
export function cleanupMirrorEntry(cleanup, now = new Date()) {
  if (!cleanup?.everyDays || !cleanup?.nextAt) return null;
  if (cleanup.nextAt <= toLocalInput(now)) return null;
  return {
    id: `cleanup-${cleanup.nextAt}`,
    at: cleanup.nextAt,
    title: 'ProdLog',
    body: '🧹 Time to clean up your board',
  };
}

export const CADENCES = [
  [null, 'Off'],
  [1, 'Daily'],
  [2, 'Every 2 days'],
  [3, 'Every 3 days'],
  [4, 'Every 4 days'],
  [5, 'Every 5 days'],
  [6, 'Every 6 days'],
  [7, 'Weekly'],
  [14, 'Every 2 weeks'],
];
