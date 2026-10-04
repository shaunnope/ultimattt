// The service worker: keeps the whole app in a versioned cache so it plays offline after one visit,
// and only takes over from an older version when the player asks (the update bar sends "skip-waiting").
//
// Bump VERSION whenever the cached files change (scripts/check-version.mjs fails the release if not).
// The list of files comes from precache.json, written by scripts/gen-precache.mjs at build time.
/// <reference lib="webworker" />

// Kept a plain script (no import or export): the worker is registered as a classic script.
const sw = self as unknown as ServiceWorkerGlobalScope;

const VERSION = "3";
const CACHE = `ttt-${VERSION}`;

/** A URL inside the site, resolved against where this worker lives so it works under any subpath. */
const inScope = (path: string): string => new URL(path, sw.registration.scope).toString();

async function precache(): Promise<void> {
  const response = await fetch(inScope("precache.json"), { cache: "reload" });
  const list = (await response.json()) as { files: string[] };
  const cache = await caches.open(CACHE);
  await cache.addAll(list.files.map((file) => new Request(inScope(file), { cache: "reload" })));
}

sw.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("ttt-") && key !== CACHE).map((key) => caches.delete(key)));
      await sw.clients.claim();
    })(),
  );
});

async function respond(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE);
  // A link such as ?watch=... opens the same page, so a page navigation ignores the query.
  const hit = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
  if (hit) return hit;
  if (request.mode === "navigate") {
    const shell = (await cache.match(inScope("./"))) ?? (await cache.match(inScope("index.html")));
    if (shell) return shell;
  }
  try {
    return await fetch(request);
  } catch {
    return Response.error();
  }
}

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== sw.location.origin) return; // PeerJS and the like are never cached
  event.respondWith(respond(request));
});

sw.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type === "skip-waiting") void sw.skipWaiting();
});
