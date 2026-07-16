// Minimal offline support for the installed PWA. Network-first so a deploy is
// picked up on the next online load; the cache only serves when offline.
const CACHE = 'prodlog-v1';

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
