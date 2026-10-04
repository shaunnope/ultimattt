import { test } from "node:test";
import assert from "node:assert/strict";
import { Computer, type WorkerLike } from "../../src/ui/computer.ts";
import type { GameConfig, Move } from "../../src/core/types.ts";

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  sent: { id: number }[] = [];
  terminated = false;
  postMessage(message: unknown): void {
    this.sent.push(message as { id: number });
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(id: number, move: Move): void {
    this.onmessage?.({ data: { id, move } });
  }
}

const config: GameConfig = { variant: "classic", size: 3, winLength: 3, mode: "computer", level: 3, seed: "C33-BXK4-M9TR" };
const mv = (cell: number): Move => ({ t: "place", cell });

function setup() {
  const worker = new FakeWorker();
  const computer = new Computer(() => worker);
  return { worker, computer };
}

test("resolves with the worker's reply and reports thinking while it waits", async () => {
  const { worker, computer } = setup();
  const pending = computer.request(config, [], 3);
  assert.equal(computer.thinking, true);
  assert.equal(worker.sent.length, 1);
  worker.reply(worker.sent[0]!.id, mv(4));
  assert.deepEqual(await pending, mv(4));
  assert.equal(computer.thinking, false);
});

test("cancel resolves the pending request with null", async () => {
  const { worker, computer } = setup();
  const pending = computer.request(config, [], 3);
  computer.cancel();
  assert.equal(await pending, null);
  assert.equal(computer.thinking, false);
  worker.reply(worker.sent[0]!.id, mv(4)); // a late reply must not throw or resolve anything
});

test("a late reply for a cancelled request does not answer a newer request", async () => {
  const { worker, computer } = setup();
  const first = computer.request(config, [], 3);
  computer.cancel();
  await first;
  const second = computer.request(config, [], 3);
  worker.reply(worker.sent[0]!.id, mv(1)); // stale
  assert.equal(computer.thinking, true);
  worker.reply(worker.sent[1]!.id, mv(7));
  assert.deepEqual(await second, mv(7));
});

test("a new request cancels the one in flight", async () => {
  const { worker, computer } = setup();
  const first = computer.request(config, [], 3);
  const second = computer.request(config, [], 3);
  assert.equal(await first, null);
  worker.reply(worker.sent[1]!.id, mv(2));
  assert.deepEqual(await second, mv(2));
});

test("the request carries what the worker needs to rebuild the position", () => {
  const { worker, computer } = setup();
  void computer.request(config, [mv(0), mv(4)], 5);
  const sent = worker.sent[0] as unknown as { config: GameConfig; moves: Move[]; level: number };
  assert.deepEqual(sent.config, config);
  assert.deepEqual(sent.moves, [mv(0), mv(4)]);
  assert.equal(sent.level, 5);
});
