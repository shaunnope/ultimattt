// The state behind the update bar, and the service worker registration that feeds it. It knows nothing of the DOM or the
// framework: a component subscribes to it like a Svelte store, and the unit tests drive it with fakes.
//
// A new version is never switched to behind the player's back. The registration notices a worker that is waiting, the bar
// offers it, and only pressing Update tells that worker to take over; the game in progress is saved on every move, so the
// page that reloads when the new worker takes control picks it up again (contracts C3.4 and C3.6).

const CHECK_EVERY_MS = 60 * 60 * 1000;

/** The window event that offers a waiting worker to the bar. Its `detail` is the worker, or anything with `postMessage`. */
export const UPDATE_READY_EVENT = "ttt:update-ready";

export interface WaitingWorker {
  postMessage(message: unknown): void;
}

export interface Snapshot {
  waiting: WaitingWorker | null;
  applying: boolean;
}

interface WorkerLike extends WaitingWorker, EventTarget {
  state?: string;
}

interface RegistrationLike extends EventTarget {
  waiting: WaitingWorker | null;
  installing: WorkerLike | null;
  update(): Promise<unknown>;
}

interface ContainerLike extends EventTarget {
  controller: unknown;
  register(url: URL, options: { scope: string }): Promise<RegistrationLike>;
}

interface Visibility extends EventTarget {
  visibilityState: string;
}

export interface UpdateOptions {
  /** Where `ttt:update-ready` is heard. The window in the browser. */
  events?: EventTarget;
  /** navigator.serviceWorker, or nothing where workers are not supported. */
  container?: ContainerLike | undefined;
  reload?: () => void;
  /** The document's base address, which the worker's address and scope are resolved from. */
  baseURI?: string;
  /** The document, to check for an update whenever the page becomes visible again. */
  visibility?: Visibility | undefined;
}

export interface UpdateState {
  subscribe(run: (value: Snapshot) => void): () => void;
  get(): Snapshot;
  /** A worker is waiting: show the bar. */
  offer(worker: WaitingWorker): void;
  /** The player pressed Update: tell the waiting worker to take over. A second press does nothing. */
  apply(): void;
  /** Register the service worker and watch it for updates. Never throws: without a worker the app still plays online. */
  register(): Promise<void>;
}

export function createUpdateState(options: UpdateOptions = {}): UpdateState {
  const events = options.events ?? window;
  const container = "container" in options ? options.container : typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
  const reload = options.reload ?? (() => location.reload());
  const baseURI = options.baseURI ?? document.baseURI;
  const visibility = "visibility" in options ? options.visibility : typeof document !== "undefined" ? document : undefined;

  let snapshot: Snapshot = { waiting: null, applying: false };
  const listeners = new Set<(value: Snapshot) => void>();
  const set = (next: Snapshot): void => {
    snapshot = next;
    for (const run of [...listeners]) run(snapshot);
  };

  const offer = (worker: WaitingWorker): void => {
    if (!snapshot.applying) set({ waiting: worker, applying: false });
  };

  events.addEventListener(UPDATE_READY_EVENT, (event) => {
    const worker = (event as CustomEvent<WaitingWorker | null>).detail;
    if (worker && typeof worker.postMessage === "function") offer(worker);
  });

  // The first worker taking control of a first visit needs no reload; a replacement does.
  const hadController = !!container?.controller;
  let reloading = false;
  container?.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    reload();
  });

  async function register(): Promise<void> {
    if (!container) return;
    try {
      const registration = await container.register(new URL("service-worker.js", baseURI), { scope: new URL("./", baseURI).pathname });
      if (registration.waiting && container.controller) offer(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && container.controller) offer(installing);
        });
      });
      const check = (): void => void registration.update().catch(() => undefined);
      const timer = setInterval(check, CHECK_EVERY_MS) as unknown as { unref?: () => void };
      timer.unref?.();
      visibility?.addEventListener("visibilitychange", () => {
        if (visibility.visibilityState === "visible") check();
      });
    } catch {
      // no worker (private window, http): the app still plays online
    }
  }

  return {
    subscribe(run) {
      listeners.add(run);
      run(snapshot);
      return () => void listeners.delete(run);
    },
    get: () => snapshot,
    offer,
    apply() {
      const worker = snapshot.waiting;
      if (!worker || snapshot.applying) return;
      set({ waiting: worker, applying: true });
      worker.postMessage({ type: "skip-waiting" });
    },
    register,
  };
}
