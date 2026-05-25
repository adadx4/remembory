// Chronicle Service Worker v8
const CACHE_VERSION = "chronicle-v40";
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const TILES_CACHE   = `${CACHE_VERSION}-tiles`;
const MAX_TILES     = 500;

const SHELL_URLS = [
  "/chronicle.html",
  "/lineage.html",
  "/research.html",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,700;1,400&display=swap",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      Promise.allSettled(
        SHELL_URLS.map(url =>
          cache.add(url).catch(err => console.warn("[SW] Could not cache:", url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== TILES_CACHE)
          .map(k => { console.log("[SW] Deleting old cache:", k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Cloudflare Worker — never cache
  if (url.hostname.includes("social.remembory.net") || url.hostname.includes("share.remembory.net") || url.hostname.includes("workers.dev")) return;

  // Geocoding — never cache
  if (url.hostname.includes("nominatim.openstreetmap.org")) return;

  // Map tiles — cache-first with limit
  if (url.hostname.includes("tile.openstreetmap.org")) {
    event.respondWith(tileStrategy(event.request)); return;
  }

  // App entry pages — network-first so updates always land
  if (url.pathname === "/chronicle.html"   || url.pathname === "/chronicle"   || url.pathname === "/" ||
      url.pathname === "/lineage.html"     || url.pathname === "/lineage"     ||
      url.pathname === "/research.html"    || url.pathname === "/research"    ||
      url.pathname === "/add-resource.html" || url.pathname === "/add-resource" ||
      url.pathname === "/resources/genealogy-free-resources.js") {
    event.respondWith(networkFirst(event.request)); return;
  }

  // CDN assets — cache-first, refresh in background
  if (url.hostname.includes("cdnjs.cloudflare.com") ||
      url.hostname.includes("fonts.googleapis.com") ||
      url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(cacheFirst(event.request)); return;
  }

  // All other requests — pass through without caching
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then(r => { if (r.ok) caches.open(SHELL_CACHE).then(c => c.put(request, r)); }).catch(()=>{});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) { const c = await caches.open(SHELL_CACHE); c.put(request, response.clone()); }
    return response;
  } catch { return new Response("Offline — resource not cached yet.", { status: 503 }); }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const c = await caches.open(SHELL_CACHE);
      // Check if the content has changed
      const cached = await c.match(request);
      const newBody = await response.clone().text();
      if (cached) {
        const oldBody = await cached.text();
        if (oldBody !== newBody) {
          // Notify all clients that a new version is available
          const clients = await self.clients.matchAll({type: "window"});
          clients.forEach(client => client.postMessage({type: "UPDATE_AVAILABLE"}));
        }
      }
      c.put(request, response.clone());
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
    if (response && response.ok) {
      const cache = await caches.open(TILES_CACHE);
      const keys = await cache.keys();
      if (keys.length >= MAX_TILES) await cache.delete(keys[0]);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const empty = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    return new Response(Uint8Array.from(atob(empty), c => c.charCodeAt(0)), { headers: { "Content-Type": "image/png" } });
  }
}
