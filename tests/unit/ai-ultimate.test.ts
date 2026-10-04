import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseMove, chooseMoveDetailed } from "../../src/core/ai.ts";
import { ULTIMATE_BUDGETS } from "../../src/core/ai-ultimate.ts";
import { newGame, apply, status, legalMoves, isLegal } from "../../src/core/ultimate.ts";
import type { UltimateState } from "../../src/core/ultimate.ts";
import { rngFor } from "../../src/core/seed.ts";
import type { GameConfig, Level, UltimateMove } from "../../src/core/types.ts";

const config = (seed: string, size: 3 | 4 | 5 = 3, winLength = 3): GameConfig => ({ variant: "ultimate", size, winLength, scoring: "lines", lockFaces: false, mode: "computer", seed });
const SEEDS = ["U33-BXK4-M9TR", "U33-CDFG-HJKL", "U33-MNPQ-RSTV", "U33-WXYZ-2345", "U33-6789-BCDF"];
const pick = (state: UltimateState, level: Level, seed: string): UltimateMove =>
  chooseMove("ultimate", state, level, rngFor(seed, state.moves.length)) as UltimateMove;

test("the computer only plays legal moves, at every level, across seeded self-play", () => {
  for (const level of [1, 2, 3, 4, 5] as Level[]) {
    // Sharper levels search deeper, so check fewer plies of each game.
    const plies = level <= 2 ? 81 : 14;
    for (const seed of SEEDS.slice(0, level <= 2 ? 5 : 2)) {
      let s = newGame(config(seed));
      let n = 0;
      while (status(s).status === "playing" && n++ < plies) {
        const move = pick(s, level, seed);
        assert.deepEqual(isLegal(s, move), { ok: true }, `level ${level} seed ${seed} ply ${n}`);
        s = apply(s, move);
      }
    }
  }
});

test("same seed and same moves give the same move", () => {
  for (const level of [1, 3, 5] as Level[]) {
    let s = newGame(config(SEEDS[0]!));
    for (let i = 0; i < 6; i++) s = apply(s, pick(s, 1, SEEDS[0]!));
    assert.deepEqual(pick(s, level, SEEDS[0]!), pick(s, level, SEEDS[0]!), `level ${level}`);
  }
});

test("every size has a node budget for every level, and it is never exceeded", () => {
  for (const size of [3, 4, 5] as const) {
    for (const level of [1, 2, 3, 4, 5] as Level[]) {
      const budget = ULTIMATE_BUDGETS[size][level];
      assert.ok(Number.isInteger(budget) && budget > 0, `size ${size} level ${level} has a budget`);
      for (const winLength of size === 3 ? [3] : [3, size]) {
        const s = newGame(config(SEEDS[0]!, size, winLength));
        const detail = chooseMoveDetailed("ultimate", s, level, rngFor(SEEDS[0]!, 0));
        assert.ok(detail.nodes <= budget, `size ${size} K=${winLength} level ${level}: ${detail.nodes} > ${budget}`);
      }
    }
  }
});

test("on 4x4 and 5x5 the computer only plays legal moves and is deterministic", () => {
  for (const [size, winLength] of [[4, 3], [4, 4], [5, 3], [5, 5]] as const) {
    for (const level of [1, 2, 3, 5] as Level[]) {
      let s = newGame(config(SEEDS[1]!, size, winLength));
      for (let ply = 0; ply < 10 && status(s).status === "playing"; ply++) {
        const a = pick(s, level, SEEDS[1]!);
        assert.deepEqual(a, pick(s, level, SEEDS[1]!), `deterministic ${size}/${winLength} L${level}`);
        assert.deepEqual(isLegal(s, a), { ok: true }, `legal ${size}/${winLength} L${level} ply ${ply}`);
        s = apply(s, a);
      }
    }
  }
});

test("on a larger board it takes a board-claiming win and blocks one", () => {
  for (const size of [4, 5] as const) {
    const base = newGame(config(SEEDS[0]!, size, 3));
    const boards = base.boards.map((b) => b.slice());
    // X has cells 0 and 1 of board 7 and threatens 2; O has cells 5, 6 elsewhere in it so nothing else interferes
    boards[7] = boards[7]!.map((_, i) => (i === 0 || i === 1 ? 1 : i === size * size - 1 ? 2 : 0)) as typeof boards[7];
    const s: UltimateState = { ...base, boards, forced: 7, toMove: "X" };
    for (const level of [2, 3, 4, 5] as Level[]) {
      assert.deepEqual(pick(s, level, SEEDS[0]!), { t: "place", board: 7, cell: 2 }, `size ${size} claim level ${level}`);
    }
    const o: UltimateState = { ...s, toMove: "O" };
    for (const level of [3, 4, 5] as Level[]) {
      assert.deepEqual(pick(o, level, SEEDS[0]!), { t: "place", board: 7, cell: 2 }, `size ${size} block level ${level}`);
    }
  }
});

test("a full self-play game on 4x4 ends with a result and never an illegal move", () => {
  let s = newGame(config(SEEDS[2]!, 4, 3));
  let n = 0;
  while (status(s).status === "playing" && n++ < 300) {
    const move = pick(s, 1, SEEDS[2]!);
    assert.deepEqual(isLegal(s, move), { ok: true });
    s = apply(s, move);
  }
  assert.notEqual(status(s).status, "playing");
});

test("takes a game-winning move and a board-claiming move when one is available", () => {
  // X can complete board 2 and with it the line of claimed boards 0-1-2.
  const base = newGame(config(SEEDS[0]!));
  const boards = base.boards.map((b) => b.slice());
  boards[2] = [1, 1, 0, 2, 2, 0, 0, 0, 0];
  const s: UltimateState = { ...base, boards, claims: [1, 1, 0, 0, 0, 0, 0, 0, 0], forced: 2, toMove: "X" };
  for (const level of [2, 3, 4, 5] as Level[]) {
    assert.deepEqual(pick(s, level, SEEDS[0]!), { t: "place", board: 2, cell: 2 }, `level ${level}`);
  }
});

test("search never reads the clock or Math.random", () => {
  const random = Math.random;
  const now = Date.now;
  const perf = performance.now.bind(performance);
  Math.random = () => {
    throw new Error("Math.random used");
  };
  Date.now = () => {
    throw new Error("Date.now used");
  };
  performance.now = () => {
    throw new Error("performance.now used");
  };
  try {
    let s = newGame(config(SEEDS[1]!));
    for (let i = 0; i < 4; i++) s = apply(s, pick(s, 3, SEEDS[1]!));
  } finally {
    Math.random = random;
    Date.now = now;
    performance.now = perf;
  }
});

test("legalMoves and the computer agree on what is playable", () => {
  let s = newGame(config(SEEDS[2]!));
  for (let i = 0; i < 10; i++) {
    const move = pick(s, 2, SEEDS[2]!);
    assert.ok((legalMoves(s) as UltimateMove[]).some((m) => m.board === move.board && m.cell === move.cell));
    s = apply(s, move);
  }
});

// Master (level 5) against Beginner (level 1), paired colours over several seeds.
test("Master beats Beginner over a seeded match set", () => {
  let score = 0;
  let games = 0;
  for (const seed of SEEDS) {
    for (const masterIsX of [true, false]) {
      let s = newGame(config(seed));
      while (status(s).status === "playing") {
        const level: Level = (s.toMove === "X") === masterIsX ? 5 : 1;
        s = apply(s, pick(s, level, seed));
      }
      const w = status(s).winner;
      games++;
      if (w) score += (w === "X") === masterIsX ? 1 : -1;
    }
  }
  assert.ok(score >= games - 2, `Master scored ${score} over ${games} games`);
});
