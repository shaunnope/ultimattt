const VERSION = "1";
self.addEventListener("install", () => {});
self.addEventListener("activate", () => {});
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});
