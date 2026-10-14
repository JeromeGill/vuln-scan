// The app's service worker, registered by components/service-worker.tsx as
// /sw.js?v=<build version> in production builds. See docs/web.md#pwa.
//
// - /api/* (app data and Better Auth) is never cached. Navigations to it
//   still use the navigation preload, so the request is sent once.
// - Page navigations go to the network; only when that fails is the cached
//   offline page served. Pages themselves are never cached.
// - Hashed build assets (/_next/static/…) are cache-first; app icons are
//   served from the cache and refreshed in the background. Their cache isn't
//   versioned: a hashed URL never changes content, so assets cached by one
//   worker are still good for the next.
// - Each build has a new `v`, so a new worker: it installs in the
//   background, takes over once every app window is closed (the next
//   launch), caches its build's offline page, and drops the old one.

const VERSION = new URL(self.location.href).searchParams.get("v");
const CACHE_PREFIX = "app-";
const STATIC_CACHE = `${CACHE_PREFIX}static`;
const PAGES_CACHE = `${CACHE_PREFIX}offline-${VERSION}`;
const OFFLINE_URL = "/offline";
/** Assets kept across builds: enough for a few builds; oldest go first. */
const MAX_STATIC_ENTRIES = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(precacheOfflinePage());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== STATIC_CACHE &&
              key !== PAGES_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      // Cache keys come back oldest first.
      const statics = await caches.open(STATIC_CACHE);
      const entries = await statics.keys();
      await Promise.all(
        entries
          .slice(0, -MAX_STATIC_ENTRIES)
          .map((entry) => statics.delete(entry)),
      );
      // Start navigation requests while the worker boots.
      await self.registration.navigationPreload?.enable();
      // The first install controls the open page straight away, so its
      // assets are cached from now on. (An update only activates once no
      // page uses the old worker, so this changes nothing then.)
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Other origins are left to the browser, notably signed object storage
  // URLs: private, short-lived, and possibly big.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    // Not cached, but a navigation (e.g. a link from an email) must use the
    // preload, or the browser sends the request a second time.
    if (request.mode === "navigate") {
      event.respondWith(preloadOrFetch(event));
    }
  } else if (request.mode === "navigate") {
    event.respondWith(navigate(event));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event));
  } else if (isAppIcon(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

/**
 * Caches the offline page, and then each script, style, and font its HTML
 * references. Only the page itself is required: an asset that fails to load
 * is skipped (the page still renders without it) rather than failing the
 * install.
 */
async function precacheOfflinePage() {
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) throw new Error(`${OFFLINE_URL}: ${response.status}`);
  const html = await response.clone().text();
  const pages = await caches.open(PAGES_CACHE);
  await pages.put(OFFLINE_URL, response);

  const assets = new Set(
    [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(
      ([, path]) => path.replaceAll("&amp;", "&"),
    ),
  );
  const statics = await caches.open(STATIC_CACHE);
  await Promise.allSettled([...assets].map((asset) => statics.add(asset)));
}

async function preloadOrFetch(event) {
  return (await event.preloadResponse) ?? fetch(event.request);
}

async function navigate(event) {
  try {
    return await preloadOrFetch(event);
  } catch {
    const offline = await caches.match(OFFLINE_URL, {
      cacheName: PAGES_CACHE,
    });
    return offline ?? Response.error();
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;
  return fetchAndCache(event, cache);
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (!cached) return fetchAndCache(event, cache);
  event.waitUntil(fetchAndCache(event, cache).catch(() => undefined));
  return cached;
}

/**
 * Fetches from the network and stores a copy in the background. A failed
 * write (e.g. storage full on a phone) must never fail the response.
 */
async function fetchAndCache(event, cache) {
  const response = await fetch(event.request);
  if (response.ok) {
    event.waitUntil(
      cache.put(event.request, response.clone()).catch(() => undefined),
    );
  }
  return response;
}

function isAppIcon(pathname) {
  return (
    pathname === "/favicon.ico" ||
    pathname === "/icon" ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/icons/")
  );
}
