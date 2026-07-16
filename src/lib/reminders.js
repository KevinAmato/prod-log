// Reminder plumbing. Reality of a $0, no-backend PWA: there is no push server,
// so notifications are LOCAL. Two delivery paths:
//   1. While the app is open (foreground or background tab): an in-app checker
//      fires exact-time notifications through the service worker.
//   2. While the app is closed: pending reminders are mirrored to IndexedDB
//      (which the service worker CAN read, unlike localStorage) and Periodic
//      Background Sync — available on installed Android PWAs — checks them at
//      the browser's discretion (~every 15 min at best, opportunistic).
// Reminder `at` strings are datetime-local format ('YYYY-MM-DDTHH:mm'), which
// `new Date()` parses as LOCAL time — exactly what a personal reminder means.

export function notifySupport() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

export async function ensureNotifyPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

// Best-effort: register periodic background sync so the SW can check reminders
// while the app is closed. Silently no-ops where unsupported (iOS, desktop).
export async function enableBackgroundChecks() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state === 'granted') {
      await reg.periodicSync.register('prodlog-reminders', { minInterval: 15 * 60 * 1000 });
    }
  } catch {
    /* unsupported — in-app checks still work */
  }
}

// Show a notification, preferring the SW (required on Android; also survives
// the tab being backgrounded). `tag` dedupes app-fired vs SW-fired copies.
export async function fireNotification(title, body, tag) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, { body, tag, icon: 'icon-192.png', badge: 'icon-192.png' });
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    new Notification(title, { body, tag });
    return true;
  } catch {
    return false;
  }
}

// ── IndexedDB mirror (shared DB with sw.js — keep names in sync) ─────────
const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('prodlog', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('reminders', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// Rewrite the mirror with every PENDING reminder on live cards. The SW deletes
// entries as it notifies them, so anything it fires while the app is closed
// won't re-fire on the next sync.
export async function mirrorReminders(cards) {
  try {
    const db = await openDB();
    const tx = db.transaction('reminders', 'readwrite');
    const store = tx.objectStore('reminders');
    store.clear();
    for (const c of cards) {
      if (c.status !== 'live') continue;
      for (const r of c.reminders || []) {
        if (!r.fired) store.put({ id: r.id, at: r.at, title: c.title });
      }
    }
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch {
    /* mirror is best-effort */
  }
}

export function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
