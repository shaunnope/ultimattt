// Small DOM helpers: element builder, live announcements, toasts, dialogs and a
// storage wrapper that never throws. Nothing here knows about game rules.

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

/** Modal dialog. Resolves with the chosen action's value, or null when dismissed. */
export function openDialog(opts: { title: string; body: (Node | string)[]; actions: DialogAction[] }): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = h("dialog", { "aria-labelledby": "dialog-title" });
    const buttons = opts.actions.map((a) =>
      h("button", { class: a.primary ? "btn btn-primary" : "btn", type: "button", onclick: () => { result = a.value; dialog.close(); } }, a.label),
    );
    let result: string | null = null;
    dialog.append(
      h("h2", { id: "dialog-title" }, opts.title),
      h("div", { class: "dialog-body" }, ...opts.body.map((b) => (typeof b === "string" ? h("p", null, b) : b))),
      h("div", { class: "btn-row" }, ...buttons),
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    });
    document.body.append(dialog);
    dialog.showModal();
    (dialog.querySelector(".btn-primary") as HTMLElement | null)?.focus();
  });
}

/* Storage that never throws lives in adapters/storage.ts; re-exported here for the UI. */
export { storageGet, storageSet, storageRemove, resetStorageForTests } from "../adapters/storage.ts";
