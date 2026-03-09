// Chronicle Service Worker
// Strategy:
//   - App shell + CDN assets: cache-first (serve from cache, update in background)
//   - Netlify functions (/share, /fetch): network-only (never cache)
//   - Map tiles: cache-first with limit (nice to have offline, not essential)
//   - Everything else: network-first with cache fallback

const CACHE_VERSION = "chronicle-v1";
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const TILES_CACHE   = `${CACHE_VERSION}-tiles`;
const MAX_TILES     = 500;

// Resources to pre-cache on install
const SHELL_URLS = [
  "/chronicle.html",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap",
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      // Cache what we can — don't fail install if a CDN resource is unavailable
      return Promise.allSettled(
        SHELL_URLS.map(url =>
          cache.add(url).catch(err => console.warn("[SW] Could not cache:", url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith("chronicle-") && k !== SHELL_CACHE && k !== TILES_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: route requests ─────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // 1. Netlify functions — always network, never cache
  if (url.pathname.startsWith("/.netlify/functions/")) {
    return; // let browser handle normally
  }

  // 2. Map tiles — cache-first with tile limit
  if (url.hostname.includes("tile.openstreetmap.org")) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  // 3. Nominatim geocoding — network only (location search)
  if (url.hostname.includes("nominatim.openstreetmap.org")) {
    return;
  }

  // 4. App shell & CDN assets — cache-first, update in background
  if (
    url.hostname.includes("cdnjs.cloudflare.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.pathname === "/chronicle.html" ||
    url.pathname === "/"
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 5. Everything else — network-first, cache as fallback
  event.respondWith(networkFirst(event.request));
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(SHELL_CACHE).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — resource not cached yet.", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

async function tileStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(TILES_CACHE);
      // Trim cache if it's getting large
      const keys = await cache.keys();
      if (keys.length >= MAX_TILES) {
        await cache.delete(keys[0]);
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return a transparent 1x1 PNG tile as fallback
    const empty = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    return new Response(
      Uint8Array.from(atob(empty), c => c.charCodeAt(0)),
      { headers: { "Content-Type": "image/png" } }
    );
  }
}
