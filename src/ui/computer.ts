// The page's side of the computer opponent: asks the Web Worker for a move, ignores stale
// answers, and can cancel (for undo). If workers are unavailable it runs the same code inline.

import type { GameConfig, Level, Move } from "../core/types.ts";

export interface WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

interface Pending {
  id: number;
  resolve: (move: Move | null) => void;
}

export class Computer {
  private worker: WorkerLike | null = null;
  private nextId = 1;
  private pending: Pending | null = null;

  private readonly makeWorker: () => WorkerLike;

  constructor(makeWorker: () => WorkerLike) {
    this.makeWorker = makeWorker;
  }

  get thinking(): boolean {
    return this.pending !== null;
  }

  private ensureWorker(): WorkerLike {
    if (!this.worker) {
      this.worker = this.makeWorker();
      this.worker.onmessage = (e) => {
        const { id, move } = e.data as { id: number; move: Move };
        if (this.pending && this.pending.id === id) {
          const { resolve } = this.pending;
          this.pending = null;
          resolve(move);
        }
      };
    }
    return this.worker;
  }

  /** Ask for the computer's move. Resolves null if it was cancelled or replaced first. */
  request(config: GameConfig, moves: Move[], level: Level): Promise<Move | null> {
    this.cancel();
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending = { id, resolve };
      this.ensureWorker().postMessage({ id, config, moves, level });
    });
  }

  cancel(): void {
    if (this.pending) {
      const { resolve } = this.pending;
      this.pending = null;
      resolve(null);
    }
  }
}

/** A worker backed by the real module worker, or by the same solver run inline where workers are missing. */
export function defaultWorker(): WorkerLike {
  if (typeof Worker !== "undefined") {
    return new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" }) as unknown as WorkerLike;
  }
  const inline: WorkerLike = {
    onmessage: null,
    postMessage(message) {
      void import("./ai-worker.js").then(({ solve }) => {
        const req = message as Parameters<typeof solve>[0];
        const move = solve(req);
        setTimeout(() => inline.onmessage?.({ data: { id: req.id, move } }), 0);
      });
    },
    terminate() {},
  };
  return inline;
}
