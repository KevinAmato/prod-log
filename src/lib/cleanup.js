// Cleanup-schedule plumbing. state.cleanups = ARRAY of schedules:
//   { id, everyDays: 1..n, time: 'HH:mm', nextAt: 'YYYY-MM-DDTHH:mm'|null,
//     categoryIds: [] }         // empty = ALL tasks; else scope to colors
// Several schedules can coexist (e.g. daily for Urgent + weekly for all).
// nextAt uses the reminders' local-datetime format so string comparison and
// the SW mirror both work.
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

export function dueCleanups(cleanups, now = new Date()) {
  const stamp = toLocalInput(now);
  return (cleanups || []).filter((c) => c.everyDays && c.nextAt && c.nextAt <= stamp);
}

// "": all tasks; ": Urgent, Personal" when scoped.
export function scopeLabel(schedule, categories) {
  const ids = schedule?.categoryIds || [];
  if (!ids.length) return '';
  const names = ids
    .map((id) => categories.find((k) => k.id === id)?.name)
    .filter(Boolean);
  return names.length ? `: ${names.join(', ')}` : '';
}

// Synthetic entries for the service-worker reminder mirror so "time to clean
// up" notifications fire even while the app is closed. Only FUTURE occurrences
// are mirrored — once due, the in-app banner owns it (and the SW already fired
// once and deleted its copy).
export function cleanupMirrorEntries(cleanups, categories, now = new Date()) {
  const stamp = toLocalInput(now);
  return (cleanups || [])
    .filter((c) => c.everyDays && c.nextAt && c.nextAt > stamp)
    .map((c) => ({
      id: `cleanup-${c.id}-${c.nextAt}`,
      at: c.nextAt,
      title: 'ProdLog',
      body: `🧹 Time to clean up${scopeLabel(c, categories)}`,
    }));
}

export const CADENCES = [
  [1, 'Daily'],
  [2, 'Every 2 days'],
  [3, 'Every 3 days'],
  [4, 'Every 4 days'],
  [5, 'Every 5 days'],
  [6, 'Every 6 days'],
  [7, 'Weekly'],
  [14, 'Every 2 weeks'],
];
