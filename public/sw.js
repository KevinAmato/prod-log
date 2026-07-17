// Minimal offline support for the installed PWA. Network-first so a deploy is
// picked up on the next online load; the cache only serves when offline.
// Also: reminder notifications while the app is closed, via Periodic Background
// Sync reading the IndexedDB mirror the app maintains (SWs can't read
// localStorage — see src/lib/reminders.js).
const CACHE = 'prodlog-v7'; // v7: user-managed categories (create/delete, max 10)

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches
          .match(e.request)
          // SPA fallback: any uncached navigation gets the cached shell.
          .then((m) => m || caches.match(new URL('index.html', self.registration.scope).href)),
      ),
  );
});

// ── Reminders while the app is closed ────────────────────────────────────
// Same DB/store names as src/lib/reminders.js.
const openDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open('prodlog', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('reminders', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function checkReminders() {
  const db = await openDB();
  const all = await new Promise((resolve, reject) => {
    const req = db.transaction('reminders').objectStore('reminders').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const now = Date.now();
  const due = all.filter((r) => new Date(r.at).getTime() <= now);
  for (const r of due) {
    await self.registration.showNotification(r.title, {
      body: r.body || '⏰ Reminder', // subtask reminders carry the subtask text
      tag: r.id, // dedupes with an app-fired copy of the same reminder
      icon: 'icon-192.png',
      badge: 'icon-192.png',
    });
  }
  // Delete what we notified so the next sync doesn't repeat it. The app marks
  // these fired in its own state the next time it opens (at <= now && !fired).
  if (due.length) {
    const tx = db.transaction('reminders', 'readwrite');
    due.forEach((r) => tx.objectStore('reminders').delete(r.id));
    await new Promise((res) => {
      tx.oncomplete = res;
      tx.onerror = res;
    });
  }
  db.close();
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'prodlog-reminders') e.waitUntil(checkReminders().catch(() => {}));
});

// Tapping a notification opens (or focuses) the app.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.registration.scope));
      return win ? win.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
