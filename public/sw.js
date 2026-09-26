/* TYTAX service worker: offline-first app shell.
 *
 * - install: precache the app-shell routes, the offline page, manifest and icons.
 * - /_next/static/** (content-hashed JS/CSS/fonts, incl. lazy catalog chunks):
 *   cache-first, stored on first fetch.
 * - page navigations: network-first; offline -> cached page -> offline.html.
 * - message {type:'CACHE_URLS', urls}: the page hands over the chunk URLs it
 *   loaded before this worker controlled it, plus every catalog chunk, so a
 *   chunk never opened online still works offline (AC15, AC18).
 * - never caches /api/**, /auth/** or cross-origin requests.
 */
const CACHE_VERSION = 'v2-1';
const SHELL_CACHE = `tytax-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `tytax-static-${CACHE_VERSION}`;
const OFFLINE_FALLBACK = '/offline.html';

const SHELL_ROUTES = [
  '/dashboard',
  '/workout',
  '/workout/active',
  '/workout/debrief',
  '/exercises',
  '/programs',
  '/programs/new',
  '/history',
  '/analytics',
  '/settings',
  '/tools/plate-calculator',
  '/tools/rm-calculator',
];

const SHELL_ASSETS = [
  OFFLINE_FALLBACK,
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

const isCacheableStatic = (url) =>
  url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');

const isExcluded = (url) =>
  url.origin !== self.location.origin ||
  url.pathname.startsWith('/api/') ||
  url.pathname.startsWith('/auth/');

// A route that fails to precache (e.g. not built yet) must not abort install.
async function cacheEach(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'no-cache' });
        if (res.ok) await cache.put(u, res);
      } catch {
        /* offline during install: skip, the network-first path will fill it */
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_ASSETS);
      await cacheEach(SHELL_CACHE, SHELL_ROUTES);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, STATIC_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) return;
  const port = event.ports && event.ports[0];
  const statics = [];
  const pages = [];
  for (const raw of data.urls) {
    let url;
    try {
      url = new URL(raw, self.location.origin);
    } catch {
      continue;
    }
    if (isCacheableStatic(url)) statics.push(url.href);
    else if (!isExcluded(url) && SHELL_ROUTES.includes(url.pathname)) pages.push(url.pathname);
  }
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const missing = [];
      for (const u of statics) if (!(await cache.match(u))) missing.push(u);
      await cacheEach(STATIC_CACHE, missing);
      await cacheEach(SHELL_CACHE, pages);
      if (port) port.postMessage({ type: 'CACHE_URLS_DONE', cached: missing.length + pages.length });
    })()
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(url.pathname)) || (await caches.match(request, { ignoreSearch: true }));
    return cached || (await caches.match(OFFLINE_FALLBACK)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isExcluded(url)) return;

  if (isCacheableStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // RSC payloads and other same-origin GETs: network, falling back to cache.
  // A failed RSC fetch makes Next do a full navigation, which the page handler serves.
  event.respondWith(
    fetch(request).catch(async () => (await caches.match(request)) || Response.error())
  );
});
