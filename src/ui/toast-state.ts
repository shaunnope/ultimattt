// The messages shown in the toast region. Each one removes itself after its time. Framework-free and store-compatible
// (`subscribe` calls back at once and returns an unsubscribe), so the Toasts component binds to it with `$toasts`.

export const DEFAULT_TOAST_MS = 3500;

export interface ToastItem {
  id: number;
  text: string;
  ms: number;
}

export interface ToastState {
  subscribe(run: (items: ToastItem[]) => void): () => void;
  get(): ToastItem[];
  add(text: string, ms?: number): void;
  remove(id: number): void;
}

export function createToastState(): ToastState {
  let items: ToastItem[] = [];
  let nextId = 1;
  const listeners = new Set<(items: ToastItem[]) => void>();
  const set = (next: ToastItem[]): void => {
    items = next;
    for (const run of [...listeners]) run(items);
  };
  const state: ToastState = {
    subscribe(run) {
      listeners.add(run);
      run(items);
      return () => void listeners.delete(run);
    },
    get: () => items,
    add(text, ms = DEFAULT_TOAST_MS) {
      const id = nextId++;
      set([...items, { id, text, ms }]);
      const timer = setTimeout(() => state.remove(id), ms) as unknown as { unref?: () => void };
      timer.unref?.(); // in node, a pending toast must not keep the process alive
    },
    remove(id) {
      if (items.some((item) => item.id === id)) set(items.filter((item) => item.id !== id));
    },
  };
  return state;
}

/** The page's one toast list. */
export const toasts = createToastState();
