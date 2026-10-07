// What the screens share: a live announcement for screen readers, the toast and dialog entry points that the Toasts and
// DialogHost components render, and storage that never throws (adapters/storage.ts).

import { dialogs, type DialogOptions } from "./dialog-state.ts";
import { DEFAULT_TOAST_MS, toasts } from "./toast-state.ts";

/** Say something to screen readers through the page's live region. */
export function announce(text: string): void {
  const region = document.getElementById("status");
  if (!region) return;
  region.textContent = "";
  requestAnimationFrame(() => {
    region.textContent = text;
  });
}

export function toast(text: string, ms = DEFAULT_TOAST_MS): void {
  toasts.add(text, ms);
}

/**
 * Open a modal dialog (see Dialog.svelte): a bottom sheet on phones, centred from 640px. Resolves with the chosen
 * action's value, or null when dismissed.
 */
export function openDialog(options: DialogOptions): Promise<string | null> {
  return dialogs.open(options);
}

/* Storage that never throws lives in adapters/storage.ts; re-exported here for the UI. */
export { storageGet, storageSet, storageRemove, resetStorageForTests } from "../adapters/storage.ts";
