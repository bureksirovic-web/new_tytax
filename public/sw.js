/* TYTAX service worker: offline-first app shell.
 *
 * - install: precache the app-shell routes, the offline page, manifest and icons.
 * - /_next/static/** (content-hashed JS/CSS/fonts, incl. lazy catalog chunks):
 *   cache-first, stored on first fetch.
 * - page navigations: network-first; offline -> cached page -> offline.html.
 * - message {type:'CACHE_URLS', urls}: the page hands over the chunk URLs it
 *   loaded before this worker controlled it, plus every catalog chunk, so a
 *   chunk never opened online still works offline (AC15, AC18).
 * - every cached chunk is scanned for the lazy chunks it can load, and those
 *   are cached too (cacheChunksDeep).
 * - never caches /api/**, /auth/** or cross-origin requests.
 */
const CACHE_VERSION = 'v2-1';
const SHELL_CACHE = `tytax-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `tytax-static-${CACHE_VERSION}`;
const OFFLINE_FALLBACK = '/offline.html';
// Registered as /sw.js?dev=1 by `next dev`: chunk URLs are not hashed there, so
// static files go network-first (fresh while online, cached for offline).
const DEV = new URL(self.location.href).searchParams.get('dev') === '1';

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

// Chunk URLs referenced by a page: <script src>, <link href> and the RSC flight
// data inlined in the HTML (escaped strings such as \"/_next/static/chunks/x.js\").
// Some Next versions list client chunks without the /_next/ prefix ("static/chunks/x.js").
const CHUNK_RE = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s)<>]+/g;

function chunkUrlsIn(html) {
  const found = html.match(CHUNK_RE) || [];
  return [...new Set(found.map((m) => (m.startsWith('/_next/') ? m : `/_next/${m}`)))];
}

// Lazy chunks (next/dynamic, import()) are named only inside other chunks'
// loader code ("static/chunks/x.js"), never in a page's HTML. Cache `urls` and
// follow those references transitively, so every chunk a shell route can load
// later (settings panels, the backup service and its row validator, analytics
// cards) works offline even if that screen was never opened online.
async function cacheChunksDeep(urls) {
  const statics = await caches.open(STATIC_CACHE);
  const seen = new Set();
  let queue = [...new Set(urls)];
  while (queue.length > 0) {
    const next = [];
    await Promise.all(
      queue.map(async (u) => {
        if (seen.has(u)) return;
        seen.add(u);
        let res = await statics.match(u);
        if (!res) {
          try {
            const fetched = await fetch(u, { cache: 'no-cache' });
            if (!fetched.ok) return;
            await statics.put(u, fetched.clone());
            res = fetched;
          } catch {
            return; /* offline: keep what is cached */
          }
        }
        if (!new URL(u, self.location.origin).pathname.endsWith('.js')) return;
        for (const c of chunkUrlsIn(await res.text())) if (!seen.has(c)) next.push(c);
      })
    );
    queue = next;
  }
}

// Cache pages plus every chunk their HTML references (and, transitively, the
// lazy chunks those load), so a page first opened offline still has its JS.
async function cachePages(paths) {
  const shell = await caches.open(SHELL_CACHE);
  const chunks = new Set();
  await Promise.all(
    paths.map(async (p) => {
      try {
        const res = await fetch(p, { cache: 'no-cache' });
        if (!res.ok) return;
        const html = await res.clone().text();
        await shell.put(p, res);
        for (const c of chunkUrlsIn(html)) chunks.add(c);
      } catch {
        /* offline: keep what is cached */
      }
    })
  );
  await cacheChunksDeep([...chunks]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_ASSETS);
      await cachePages(SHELL_ROUTES);
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
      await cacheChunksDeep(statics);
      // Re-fetch all shell routes: their chunks may be new since install.
      await cachePages([...new Set([...pages, ...SHELL_ROUTES])]);
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

async function networkFirstStatic(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
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
    event.respondWith(DEV ? networkFirstStatic(request) : cacheFirst(request));
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
