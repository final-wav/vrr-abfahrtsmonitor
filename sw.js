// ─────────────────────────────────────────────────────────────
//  sw.js — Service Worker: App-Shell cachen
//  API-Requests (Cross-Origin zum Worker) werden NIE gecacht.
// ─────────────────────────────────────────────────────────────

const CACHE = "vrr-shell-v4";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./app.js",
  "./api.js",
  "./views.js",
  "./settings.js",
  "./store.js",
  "./manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Nur eigene Origin (App-Shell) bedienen — API läuft cross-origin.
  if (url.origin !== self.location.origin) return;

  // Cache-first für die Shell, Netz als Fallback (und Cache aktualisieren).
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
