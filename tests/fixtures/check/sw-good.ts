const VERSION = "1";
self.addEventListener("install", () => {});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))));
});
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
