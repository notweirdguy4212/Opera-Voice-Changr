/* Offline app-shell cache only. API, WebSocket, model and recording data are never cached here. */
const CACHE = 'opera-shell-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './opera-icon.svg'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.includes('/ws')) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && request.destination !== 'audio' && request.destination !== 'video') {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))));
});
