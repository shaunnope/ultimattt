// The service worker: keeps the whole app in a cache named for the build, so it plays offline after one visit, and only
// takes over from an older version when the player asks (the update bar sends "skip-waiting").
//
// What to cache comes from the build itself ($app/manifest), and the cache name follows the build's version, so a new
// build is a new cache and nobody has to remember to bump a number.
/// <reference lib="webworker" />
import { immutable, assets, prerendered } from "$app/manifest";
import { version } from "$app/env";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `ttt-${version}`;

/** A URL inside the site, resolved against where this worker lives so it works under any base path. */
const inScope = (path: string): string => new URL(path, sw.registration.scope).toString();

/** The build's files, less the install screenshots (only the installer uses them) and dot files. */
function files(): string[] {
  const listed = [...immutable, ...assets, ...prerendered].map((entry) => entry.path);
  return listed.filter((path) => !path.startsWith("screenshots/") && !path.split("/").some((part) => part.startsWith(".")));
}

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE);
  const urls = ["./", ...files()].map(inScope);
  await cache.addAll(urls.map((url) => new Request(url, { cache: "reload" })));
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
    const shell = await cache.match(inScope("./"));
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
