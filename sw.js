// Small service worker: lets Chef World open without a connection and be installed on a phone.
// Pages and scripts of the site: always fresh from the network (skipping the browser's HTTP cache),
// saved copy only when there is no connection.
// Firebase library files (fixed version in the URL): saved copy first.
// Bump CACHE whenever the caching rules change, so old copies are thrown away.
const CACHE = 'chef-world-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function save(request, response) {
  if (response && response.ok && !response.redirected) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

// GitHub Pages and the browser can each keep a page for ~10 minutes. 'no-store' skips the
// browser's copy so a returning visitor gets the version that was just deployed.
function fresh(request) {
  return fetch(request.url, { cache: 'no-store', credentials: 'same-origin' }).then((response) => {
    // A navigation must not be answered with a redirected response; let the browser follow it itself.
    if (response.redirected) return fetch(request);
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      fresh(request)
        .then((response) => save(request, response))
        .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || Response.error()))
    );
  } else if (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => save(request, response)))
    );
  }
});
