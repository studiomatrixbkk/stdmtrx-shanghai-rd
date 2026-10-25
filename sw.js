// Offline support for the STDMTRX Shanghai trip app.
// Bump VERSION on every deploy so phones pick up the new shell.
const VERSION = 'mtrx-2026-10-25b';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/tailwind-12b979f6.css',
  './vendor/fonts/anuphan-thai-wght-normal.woff2',
  './vendor/fonts/anuphan-latin-wght-normal.woff2',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png'
];
const TILE_CACHE = 'mtrx-tiles';
const NAV_TIMEOUT_MS = 3500;

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser HTTP cache so a new VERSION really gets the new files
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== TILE_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page: try the network briefly (to get itinerary updates), else serve the cached copy.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match('./index.html');
      // no-cache = revalidate with the server (fast 304) so itinerary edits show up right away
      const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
        if (res.ok) cache.put('./index.html', res.clone());
        return res;
      });
      if (!cached) return net;
      const timeout = new Promise(r => setTimeout(() => r(cached), NAV_TIMEOUT_MS));
      return Promise.race([net.catch(() => cached), timeout]);
    })());
    return;
  }

  // Map tiles (Amap / Tencent): cache-first, shared across subdomains.
  if (/autonavi\.com$|gtimg\.com$/.test(url.hostname)) {
    const key = req.url.replace(/\/\/webrd0\d\./, '//webrd01.').replace(/\/\/rt\d\./, '//rt0.');
    e.respondWith(caches.open(TILE_CACHE).then(c => c.match(key).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(key, res.clone());
      return res;
    }))));
    return;
  }

  // Same-origin files (libraries, OCR data, icons): cache-first, fill on first use.
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }))));
  }
});
