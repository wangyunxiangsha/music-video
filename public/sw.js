const CACHE = 'claudio-v4';
// JS/CSS always fetched from network; only images/manifest cached
const IMMUTABLE = ['/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(IMMUTABLE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept API, streams, or JS/CSS — always network for these
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/stream') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    return; // browser handles directly, no service worker caching
  }

  // Cache-first only for manifest and icons
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
