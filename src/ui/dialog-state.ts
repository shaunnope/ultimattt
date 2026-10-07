// The dialogs that are open, as a stack: the last is on top and the ones under it wait. A request's promise settles when
// its dialog has closed, with the chosen action's value or null for a dismissal (Close, Escape, a click on the backdrop).
// Framework-free and store-compatible; the DialogHost component renders the stack.

import type { IconName } from "./icons.ts";

export interface DialogAction {
  label: string;
  value: string;
  primary?: boolean;
}

export interface DialogOptions {
  title: string;
  /** Strings become paragraphs; DOM nodes (from screens not yet ported) are placed as they are. */
  body?: (Node | string)[];
  actions: DialogAction[];
  /** A small icon before the title, such as a tick for a win. Decorative: the title carries the meaning. */
  icon?: IconName;
  /** A component to render as the body, with its props (ported dialogs). */
  component?: unknown;
  props?: Record<string, unknown>;
}

export interface DialogRequest extends DialogOptions {
  id: number;
}

export interface DialogState {
  subscribe(run: (stack: DialogRequest[]) => void): () => void;
  get(): DialogRequest[];
  top(): DialogRequest | null;
  /** True while any dialog is open: the page behind it is locked. */
  modalOpen(): boolean;
  open(options: DialogOptions): Promise<string | null>;
  /** The dialog has closed with this action's value. Does nothing if it is not open. */
  close(id: number, value: string | null): void;
  /** The dialog was dismissed. */
  dismiss(id: number): void;
}

export function createDialogState(): DialogState {
  let stack: DialogRequest[] = [];
  let nextId = 1;
  const resolvers = new Map<number, (value: string | null) => void>();
  const listeners = new Set<(stack: DialogRequest[]) => void>();
  const set = (next: DialogRequest[]): void => {
    stack = next;
    for (const run of [...listeners]) run(stack);
  };
  const state: DialogState = {
    subscribe(run) {
      listeners.add(run);
      run(stack);
      return () => void listeners.delete(run);
    },
    get: () => stack,
    top: () => stack.at(-1) ?? null,
    modalOpen: () => stack.length > 0,
    open(options) {
      return new Promise((resolve) => {
        const id = nextId++;
        resolvers.set(id, resolve);
        set([...stack, { ...options, id }]);
      });
    },
    close(id, value) {
      const resolve = resolvers.get(id);
      if (!resolve) return;
      resolvers.delete(id);
      set(stack.filter((request) => request.id !== id));
      resolve(value);
    },
    dismiss(id) {
      state.close(id, null);
    },
  };
  return state;
}

/** The page's one dialog stack. */
export const dialogs = createDialogState();
