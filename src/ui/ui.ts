// Small DOM helpers: element builder, live announcements, toasts, dialogs and a
// storage wrapper that never throws. Nothing here knows about game rules.

import { icon, type IconName } from "./icons.ts";

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> | null;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = String(value);
    else if (key === "dataset") Object.assign(el.dataset, value as Record<string, string>);
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "object" ? child : String(child));
  }
  return el;
}

export function clear(el: Element): void {
  el.replaceChildren();
}

/** Say something to screen readers through the page's live region. */
export function announce(text: string): void {
  const region = document.getElementById("status");
  if (!region) return;
  region.textContent = "";
  requestAnimationFrame(() => {
    region.textContent = text;
  });
}

export type BannerTone = "info" | "error" | "ok" | "warn" | "busy";

/**
 * Fill an element as a banner: its status colour on a tint of itself, an icon, then the text. A busy banner has a
 * pulsing dot (CSS) instead of an icon. An empty text empties the element.
 */
export function setBanner(el: HTMLElement, text: string, tone: BannerTone = "info"): void {
  el.classList.add("banner");
  if (tone === "info") delete el.dataset.tone;
  else el.dataset.tone = tone;
  if (text === "") {
    el.replaceChildren();
    return;
  }
  const mark: IconName | null = tone === "busy" ? null : tone === "ok" ? "check" : "info";
  el.replaceChildren(...(mark ? [icon(mark)] : []), h("span", null, text));
}

export function toast(text: string, ms = 3500): void {
  const host = document.getElementById("toasts");
  if (!host) return;
  const item = h("div", { class: "toast", role: "status" }, text);
  host.append(item);
  setTimeout(() => item.remove(), ms);
}

export interface DialogAction {
  label: string;
  value: string;
  primary?: boolean;
}

export interface DialogOptions {
  title: string;
  body: (Node | string)[];
  actions: DialogAction[];
  /** A small icon before the title, such as a tick for a win. Decorative: the title carries the meaning. */
  icon?: IconName;
}

/**
 * Modal dialog: a bottom sheet on phones, centred from 640px (see the dialog rules in style.css). It opens and closes
 * by one class flip; the timing is CSS. A Close button, Escape and a click on the backdrop all dismiss it. Resolves
 * with the chosen action's value, or null when dismissed.
 */
export function openDialog(opts: DialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = h("dialog", { class: "modal", "aria-labelledby": "dialog-title" });
    let result: string | null = null;
    let closing = false;

    /** Play the closing transition, then close for real. A timer covers the case where no transition runs. */
    const requestClose = (value: string | null) => {
      if (closing) return;
      closing = true;
      result = value;
      dialog.classList.remove("is-open");
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        dialog.close();
      };
      dialog.addEventListener("transitionend", (event) => { if (event.target === dialog) finish(); });
      setTimeout(finish, 400);
    };

    const buttons = opts.actions.map((a) =>
      h("button", { class: a.primary ? "btn btn-primary" : "btn", type: "button", onclick: () => requestClose(a.value) }, a.label),
    );
    const closeButton = h("button", { class: "icon-btn small", type: "button", "aria-label": "Close", onclick: () => requestClose(null) }, icon("close"));
    // The padding lives on an inner box, so a click on the dialog element itself can only be a click on the backdrop.
    dialog.append(
      h("div", { class: "modal-inner" },
        h("div", { class: "modal-head" }, h("h2", { id: "dialog-title" }, opts.icon ? icon(opts.icon) : null, opts.title), closeButton),
        h("div", { class: "dialog-body" }, ...opts.body.map((b) => (typeof b === "string" ? h("p", null, b) : b))),
        h("div", { class: "btn-row" }, ...buttons)),
    );
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      requestClose(null);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) requestClose(null); // the backdrop is part of the dialog's own box
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("modal-open");
      resolve(result);
    });
    document.body.append(dialog);
    dialog.showModal();
    document.body.classList.add("modal-open");
    void dialog.offsetWidth; // start from the closed look, so adding the class below is a transition
    dialog.classList.add("is-open");
    (dialog.querySelector(".btn-primary") as HTMLElement | null)?.focus();
  });
}

/* Storage that never throws lives in adapters/storage.ts; re-exported here for the UI. */
export { storageGet, storageSet, storageRemove, resetStorageForTests } from "../adapters/storage.ts";
