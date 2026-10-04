import { test } from "node:test";
import assert from "node:assert/strict";
import { targetAngle, settleAngle } from "../../src/core/turn-path.ts";

const QUARTERS = [-1, 1, 2] as const;
const mod360 = (a: number) => ((a % 360) + 360) % 360;

test("targetAngle is congruent to the target turn mod 360 and within 180° of where the layer is", () => {
  for (const start of [0, 90, -90, 180, 270, -270, 360]) {
    for (const q of QUARTERS) {
      const result = targetAngle(start, q);
      assert.equal(mod360(result), mod360(q * 90), `from ${start} to ${q}`);
      assert.ok(Math.abs(result - start) <= 180, `from ${start} to ${q}: moved ${result - start}`);
    }
  }
});

test("a first turn from rest goes the short way, and a half turn goes the positive way", () => {
  assert.equal(targetAngle(0, 1), 90);
  assert.equal(targetAngle(0, -1), -90);
  assert.equal(targetAngle(0, 2), 180);
});

test("a quarter to its opposite quarter continues away from 0, through the half turn", () => {
  assert.equal(targetAngle(90, -1), 270);
  assert.equal(targetAngle(-90, 1), -270);
});

test("for every ordered pair of turns on a layer the straight path never crosses a multiple of 360", () => {
  for (const first of QUARTERS) {
    for (const second of QUARTERS) {
      for (const third of QUARTERS) {
        const a = targetAngle(0, first);
        const b = targetAngle(a, second);
        const c = targetAngle(b, third);
        for (const [from, to] of [[a, b], [b, c]] as const) {
          const lo = Math.min(from, to);
          const hi = Math.max(from, to);
          for (let k = Math.ceil(lo / 360); k <= Math.floor(hi / 360); k++) {
            const crossing = k * 360;
            assert.ok(crossing === from || crossing === to, `${first} ${second} ${third}: ${from} to ${to} crosses ${crossing}`);
          }
          // never through the layer's original orientation unless it starts or ends there
          if (mod360(from) !== 0 && mod360(to) !== 0) {
            const mid = (from + to) / 2;
            assert.notEqual(mod360(mid), 0, `${from} to ${to} passes through 0`);
          }
        }
      }
    }
  }
});

test("targetAngle to the turn already shown does not move", () => {
  for (const start of [90, -90, 180]) assert.equal(targetAngle(start, (mod360(start) === 270 ? -1 : mod360(start) === 90 ? 1 : 2) as -1 | 1 | 2), start);
});

test("settleAngle goes to the nearest multiple of 360", () => {
  assert.equal(settleAngle(270), 360);
  assert.equal(settleAngle(-90), 0);
  assert.equal(settleAngle(90), 0);
  assert.equal(settleAngle(-270), -360);
  assert.equal(settleAngle(0), 0);
  assert.equal(settleAngle(360), 360);
  assert.equal(settleAngle(180), 360);
  assert.equal(settleAngle(-180), -360);
});

test("settleAngle never moves a layer more than 180°", () => {
  for (const start of [-360, -270, -180, -90, 0, 90, 180, 270, 360]) {
    assert.ok(Math.abs(settleAngle(start) - start) <= 180, String(start));
    assert.equal(mod360(settleAngle(start)), 0);
  }
});
