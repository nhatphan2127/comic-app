// Service worker: makes the app installable and keeps working with a bad connection.
//   - Pages: network first, the cached app shell when offline (the SPA routes itself).
//   - Built assets (/assets/*, content-hashed): cache first, they never change.
//   - Covers and chapter pages (/storage/*): cache first, so chapters already read open offline.
//   - API calls: never cached, data must be fresh.
// Bump VERSION to drop every old cache on the next visit.
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const IMAGES = `images-${VERSION}`;
const MAX_IMAGES = 400;
const PRECACHE = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL, ASSETS, IMAGES]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Oldest entries go first once the image cache is full (keys() keeps insertion order).
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function cacheFirst(request, cacheName, max) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Images from the API origin are cross-origin <img> loads, so their responses are opaque.
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (max) trim(cacheName, max);
  }
  return response;
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    // Every route serves the same index.html, so one cached copy covers them all.
    if (response.ok) (await caches.open(SHELL)).put('/', response.clone());
    return response;
  } catch {
    return (await caches.match('/')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') return event.respondWith(networkFirstPage(request));
  if (url.pathname.includes('/api/')) return;
  if (url.pathname.startsWith('/storage/')) return event.respondWith(cacheFirst(request, IMAGES, MAX_IMAGES));
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    return event.respondWith(cacheFirst(request, ASSETS));
  }
});
