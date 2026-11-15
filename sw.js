// Small service worker: lets Chef World open without a connection and be installed on a phone.
// Pages and scripts of the site: fresh from the network when possible, saved copy otherwise.
// Firebase library files (fixed version in the URL): saved copy first.
const CACHE = 'chef-world-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function save(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => save(request, response))
        .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || Response.error()))
    );
  } else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => save(request, response)))
    );
  }
});
