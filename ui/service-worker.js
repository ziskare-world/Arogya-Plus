const CACHE_VERSION = "v1.0.0";
const STATIC_CACHE = `arogya-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `arogya-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index",
  "/login",
  "/register",
  "/offline.html",
  "/manifest.webmanifest",
  "/css/global.css",
  "/css/dashboard.css",
  "/css/auth.css",
  "/css/user.css",
  "/js/pwa-register.js",
  "/js/utils.js",
  "/js/api-client.js",
  "/js/sidebar.js",
  "/backend-js/authentication.js",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = String(payload.title || "Arogya Plus");
  const body = String(payload.body || "You have a new update.");
  const url = String(payload.url || "/");
  const tag = String(payload.tag || "arogya-push");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/assets/icons/icon-192.png",
      badge: "/assets/icons/icon-192.png",
      data: {
        url
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.url || "/");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        const origin = self.location.origin;
        if (clientUrl.origin === origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

const shouldBypass = (url) =>
  url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/");

const isStaticAsset = (url) =>
  /\.(?:css|js|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
