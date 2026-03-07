const CACHE_NAME = "flocks-cache-v2";
const ASSETS_TO_CACHE = ["/", "/index.html", "/manifest.webmanifest"];

function isHttpRequest(request) {
  return request.url.startsWith("http");
}

function isApiLikeRequest(requestUrl, request) {
  return (
    requestUrl.hostname.includes("supabase.co") ||
    requestUrl.pathname.includes("/rest/v1/") ||
    request.headers.get("accept")?.includes("application/json")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!isHttpRequest(event.request)) return;

  const requestUrl = new URL(event.request.url);
  const apiLike = isApiLikeRequest(requestUrl, event.request);

  if (apiLike) {
    // Always try network first so reads reflect latest saved data in production.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: "offline", message: "No cached data available." }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }

  // App shell/static files: cache-first for fast loads, then cache on first network hit.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match("/"));
    })
  );
});
