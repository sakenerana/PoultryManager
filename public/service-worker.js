const STATIC_CACHE = "ggdc-static-v4";
const RUNTIME_CACHE = "ggdc-runtime-v4";
const PRECACHE_URLS = ["/", "/index.html", "/manifest.webmanifest"];

function isHttpRequest(request) {
  return request.url.startsWith("http");
}

function isApiRequest(url, request) {
  return (
    url.hostname.includes("supabase.co") ||
    url.pathname.includes("/rest/v1/") ||
    request.headers.get("accept")?.includes("application/json")
  );
}

function clientsClaim() {
  return self.clients.claim();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await clientsClaim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isHttpRequest(request)) return;

  const url = new URL(request.url);

  if (isApiRequest(url, request)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(STATIC_CACHE);
          cache.put("/index.html", networkResponse.clone());
          return networkResponse;
        } catch {
          const cachedResponse = await caches.match("/index.html");
          return cachedResponse || Response.error();
        }
      })()
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cachedResponse = await cache.match(request);

        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cachedResponse || Response.error());

        if (cachedResponse) {
          return cachedResponse;
        }

        return networkFetch;
      })()
    );
  }
});
