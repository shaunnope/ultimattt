import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PARTICLES, createParticles, stepParticles, startConfetti, DURATION_MS, type ConfettiDeps } from "../../src/ui/confetti.ts";
import { randomSource } from "../../src/core/seed.ts";

/** A canvas, a clock and a frame loop we can drive by hand. */
function fake(overrides: Partial<ConfettiDeps> = {}) {
  const rand = randomSource(1);
  let time = 0;
  let nextId = 1;
  const frames = new Map<number, () => void>();
  const log = { created: 0, attached: 0, detached: 0, cancelled: 0, drawn: 0 };
  const context = new Proxy({}, { get: () => () => void log.drawn++, set: () => true });
  const deps: ConfettiDeps = {
    reducedMotion: false,
    createCanvas: () => {
      log.created++;
      return { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    },
    attach: () => void log.attached++,
    detach: () => void log.detached++,
    requestFrame: (cb) => {
      const id = nextId++;
      frames.set(id, () => cb(time));
      return id;
    },
    cancelFrame: (id) => {
      log.cancelled++;
      frames.delete(id);
    },
    now: () => time,
    random: () => (rand() % 1000) / 1000,
    size: () => ({ width: 400, height: 300 }),
    ...overrides,
  };
  const tick = (ms: number) => {
    time += ms;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((f) => f());
  };
  return { deps, log, tick, pending: () => frames.size };
}

test("with reduced motion requested, nothing is drawn: no canvas is even created", () => {
  const { deps, log } = fake({ reducedMotion: true });
  assert.equal(startConfetti(deps), null);
  assert.deepEqual(log, { created: 0, attached: 0, detached: 0, cancelled: 0, drawn: 0 });
});

test("the number of particles is bounded", () => {
  const random = () => 0.5;
  assert.equal(createParticles(0, random, 400).length, 0);
  assert.equal(createParticles(40, random, 400).length, 40);
  assert.equal(createParticles(100_000, random, 400).length, MAX_PARTICLES);
  assert.ok(MAX_PARTICLES <= 200);
});

test("particles start above the screen and within its width, and fall", () => {
  const rand = randomSource(5) as unknown as () => number;
  const particles = createParticles(60, () => (rand() % 1000) / 1000, 400);
  for (const p of particles) {
    assert.ok(p.x >= 0 && p.x <= 400);
    assert.ok(p.y <= 0);
  }
  const later = stepParticles(particles, 16);
  later.forEach((p, i) => assert.ok(p.y > particles[i]!.y));
});

test("particles that have fallen out of sight are dropped", () => {
  const particles = createParticles(20, () => 0.5, 400);
  let live = particles;
  for (let i = 0; i < 4000 && live.length; i++) live = stepParticles(live, 50, 300);
  assert.equal(live.length, 0);
});

test("it draws, then stops by itself, removes its canvas and leaves nothing running", () => {
  const { deps, log, tick, pending } = fake();
  const run = startConfetti(deps);
  assert.ok(run);
  assert.equal(log.created, 1);
  assert.equal(log.attached, 1);
  for (let i = 0; i < 20; i++) tick(16);
  assert.ok(log.drawn > 0);
  assert.equal(log.detached, 0);
  tick(DURATION_MS + 100);
  tick(16);
  assert.equal(log.detached, 1);
  assert.equal(pending(), 0);
});

test("stopping early removes the canvas at once, and stopping twice is harmless", () => {
  const { deps, log, tick, pending } = fake();
  const run = startConfetti(deps)!;
  tick(16);
  run.stop();
  assert.equal(log.detached, 1);
  assert.equal(pending(), 0);
  run.stop();
  tick(16);
  assert.equal(log.detached, 1);
});
