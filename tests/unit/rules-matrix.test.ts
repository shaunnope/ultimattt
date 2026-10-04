// SC-001: every supported combination of variant, board size (3 to 5) and win length (3 to N) plays by the rules.
// Scripted pseudo-random games are played through newGame/apply, and after every move the result is compared with
// a reference written here from the rule definitions alone (maximal runs in four directions), not from core/classic.ts.
// Any discrepancy fails the test with the combination and move number.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as classic from "../../src/core/classic.ts";
import * as ultimate from "../../src/core/ultimate.ts";
import * as cube from "../../src/core/cube.ts";
import { randomSource } from "../../src/core/seed.ts";
import { winLengthOptions } from "../../src/core/rules.ts";
import type { Cell, GameConfig, Mark, Variant } from "../../src/core/types.ts";

const SIZES = [3, 4, 5] as const;
const COMBINATIONS = SIZES.flatMap((size) => winLengthOptions(size).map((winLength) => ({ size, winLength })));

test("there are 6 combinations per variant, 18 in all", () => {
  assert.equal(COMBINATIONS.length, 6);
  assert.equal(COMBINATIONS.length * 3, 18);
});

/** Lengths of every maximal run of `value` on an n×n grid, in the four line directions. */
function maximalRuns(grid: readonly number[], n: number, value: number): number[] {
  const runs: number[] = [];
  const at = (r: number, c: number) => (r >= 0 && r < n && c >= 0 && c < n ? grid[r * n + c] : -1);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (at(r, c) !== value) continue;
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
        if (at(r - dr, c - dc) === value) continue; // not the start of a run
        let length = 0;
        while (at(r + dr * length, c + dc * length) === value) length++;
        runs.push(length);
      }
    }
  }
  return runs;
}

const hasRun = (grid: readonly number[], n: number, k: number, value: number): boolean => maximalRuns(grid, n, value).some((l) => l >= k);
/** Windows of exactly k inside the runs: a run of L holds L-k+1. */
const windowCount = (grid: readonly number[], n: number, k: number, value: number): number =>
  maximalRuns(grid, n, value).reduce((sum, l) => sum + Math.max(0, l - k + 1), 0);

const mark = (m: Mark): 1 | 2 => (m === "X" ? 1 : 2);

function configFor(variant: Variant, size: 3 | 4 | 5, winLength: number): GameConfig {
  return { variant, size, winLength, mode: "local" };
}

test("Classic: win, draw and game-over match the run definition for every combination", () => {
  for (const { size, winLength } of COMBINATIONS) {
    for (let game = 0; game < 25; game++) {
      const rand = randomSource(1000 * size + 10 * winLength + game);
      let s = classic.newGame(configFor("classic", size, winLength));
      while (s.status === "playing") {
        const moves = classic.legalMoves(s);
        const move = moves[rand() % moves.length]!;
        const mover = s.toMove;
        s = classic.apply(s, move);
        const where = `classic ${size}x${size} K=${winLength} game ${game} move ${s.moves.length}`;
        const won = hasRun(s.cells, size, winLength, mark(mover));
        assert.equal(s.status === "won", won, where);
        if (won) {
          assert.equal(s.winner, mover, where);
          assert.ok(s.winLine && s.winLine.length === winLength && s.winLine.every((i) => s.cells[i] === mark(mover)), where);
        } else {
          assert.equal(s.status === "draw", s.cells.every((c) => c !== 0), where);
        }
      }
    }
  }
});

test("Ultimate: small-board claims, grid wins, draws and forced-board routing match the definitions for every combination", () => {
  for (const { size, winLength } of COMBINATIONS) {
    const n2 = size * size;
    for (let game = 0; game < 12; game++) {
      const rand = randomSource(5000 + 1000 * size + 10 * winLength + game);
      let s = ultimate.newGame(configFor("ultimate", size, winLength));
      while (s.status === "playing") {
        const moves = ultimate.legalMoves(s);
        const move = moves[rand() % moves.length]!;
        const mover = s.toMove;
        const before = s;
        s = ultimate.apply(s, move);
        const played = move as { board: number; cell: number };
        const where = `ultimate ${size}x${size} K=${winLength} game ${game} move ${s.moves.length}`;
        // the board played in is claimed by the mover on a K run, closed as full otherwise
        const small = s.boards[played.board]!;
        const claimedNow = hasRun(small, size, winLength, mark(mover));
        const expectClaim = before.claims[played.board] !== 0 ? before.claims[played.board] : claimedNow ? mark(mover) : small.every((c) => c !== 0) ? 3 : 0;
        assert.equal(s.claims[played.board], expectClaim, where);
        // routing: cell index is the board index, unless that board is closed
        assert.equal(s.forced, s.claims[played.cell] === 0 ? played.cell : null, where);
        // the grid: a K run of claims for the mover wins; every board closed with none is a draw
        const grid = s.claims.map((c) => c as number);
        const gridWon = hasRun(grid, size, winLength, mark(mover));
        assert.equal(s.status === "won", gridWon, where);
        if (gridWon) {
          assert.equal(s.winner, mover, where);
          assert.ok(s.winLine && s.winLine.length === winLength && s.winLine.every((b) => s.claims[b] === mark(mover)), where);
        } else {
          assert.equal(s.status === "draw", s.claims.every((c) => c !== 0), where);
        }
        // only boards that were legal were played: forced board respected
        if (before.forced !== null) assert.equal(played.board, before.forced, where);
        assert.ok(played.board < n2 && played.cell < n2, where);
      }
    }
  }
});

test("Cube: line counts are one per window of exactly K, turns move only their layer, and a score forces exactly one turn, for every combination", () => {
  for (const { size, winLength } of COMBINATIONS) {
    const n2 = size * size;
    for (let game = 0; game < 4; game++) {
      const rand = randomSource(9000 + 1000 * size + 10 * winLength + game);
      let s = cube.newGame(configFor("cube", size, winLength));
      let steps = 0;
      while (s.status === "playing" && steps++ < 3000) {
        const moves = cube.legalMoves(s);
        const move = moves[rand() % moves.length]!;
        const mover = s.toMove;
        const before = s;
        s = cube.apply(s, move);
        const where = `cube ${size}x${size} K=${winLength} game ${game} move ${s.moves.length}`;
        // the reference count from each face's grid
        let x = 0;
        let o = 0;
        for (let face = 0; face < 6; face++) {
          const grid = s.stickers.slice(face * n2, (face + 1) * n2);
          x += windowCount(grid, size, winLength, 1);
          o += windowCount(grid, size, winLength, 2);
        }
        assert.deepEqual(s.lines, { X: x, O: o }, where);
        if (move.t === "rotate") {
          // only the stickers of that layer may change place, and none are created or lost
          const inLayer = new Set(cube.layerStickers(size, move.axis, move.layer));
          before.stickers.forEach((v, i) => {
            if (!inLayer.has(i)) assert.equal(s.stickers[i], v, `${where}: sticker ${i} outside the layer moved`);
          });
          assert.deepEqual([...s.stickers].sort(), [...before.stickers].sort(), where);
          assert.equal(s.phase, "place", where);
          assert.equal(s.toMove, mover === "X" ? "O" : "X", where);
        } else {
          const scored = (mover === "X" ? x : o) > before.lines[mover];
          assert.equal(s.phase, scored ? "rotate" : "place", where);
          assert.equal(s.toMove, scored ? mover : mover === "X" ? "O" : "X", where);
          assert.equal(s.empty, before.empty - 1, where);
        }
      }
      assert.notEqual(s.status, "playing", `cube ${size}x${size} K=${winLength} game ${game} ended`);
      assert.equal(s.status === "tie", s.lines.X === s.lines.O);
    }
  }
});

test("a stationary turn sequence on every size returns the starting position: four quarters of any layer", () => {
  for (const size of SIZES) {
    const stickers = Array.from({ length: 6 * size * size }, (_, i) => (i % 3) as Cell);
    for (const r of cube.rotations(size)) {
      let t = stickers;
      const quarters = r.dir === 2 ? 2 : 4;
      for (let i = 0; i < quarters; i++) t = cube.rotateStickers(t, size, r.axis, r.layer, r.dir);
      assert.deepEqual(t, stickers, `${size} ${r.axis}${r.layer}${r.dir}`);
    }
  }
});
