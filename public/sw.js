// MedLens service worker: makes the app installable and keeps the shell available offline.
// API responses are never cached here (label results are cached server-side by drug name).
const SHELL_CACHE = "medlens-shell-v2";
const STATIC_CACHE = "medlens-static-v2";
const STATIC_LIMIT = 80; // each deploy adds new hashed files; drop the oldest so storage does not grow forever
const SHELL = ["/", "/dashboard", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  const keep = [SHELL_CACHE, STATIC_CACHE];
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function putStatic(request, response) {
  const cache = await caches.open(STATIC_CACHE);
  await cache.put(request, response);
  const keys = await cache.keys(); // insertion order: oldest first
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Static build assets: cache first. Only successful responses are stored, so an error is never replayed.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) => hit || fetch(e.request).then((res) => {
          if (res.ok) e.waitUntil(putStatic(e.request, res.clone()));
          return res;
        }),
      ),
    );
    return;
  }

  // Pages: network first, fall back to cache when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy)));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/dashboard"))),
    );
  }
});
