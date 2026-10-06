// Registers the service worker and shows a bar when a newer version is waiting.
// The player chooses when to switch; the game in progress is saved on every move, so it survives.

import { icon } from "./icons.ts";
import { h } from "./ui.ts";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** Show "A new version is ready." with an Update button. Nothing happens until the player presses it. */
export function offerUpdate(bar: HTMLElement, worker: Pick<ServiceWorker, "postMessage">): void {
  const button = h("button", { class: "btn", type: "button" }, "Update");
  button.addEventListener("click", () => {
    button.disabled = true;
    worker.postMessage({ type: "skip-waiting" });
  });
  bar.replaceChildren(icon("info"), h("span", { class: "update-text" }, "A new version is ready."), button);
  bar.hidden = false;
}

export function initServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const bar = document.getElementById("update-bar");
  const hadController = !!navigator.serviceWorker.controller;

  function offer(worker: ServiceWorker): void {
    if (bar) offerUpdate(bar, worker);
  }

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // The first worker taking control of a first visit needs no reload; a replacement does.
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });

  void navigator.serviceWorker
    .register(new URL("../../sw.js", import.meta.url))
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) offer(installing);
        });
      });
      const check = () => void registration.update().catch(() => undefined);
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    })
    .catch(() => undefined); // no worker (private window, http): the app still plays online
}
