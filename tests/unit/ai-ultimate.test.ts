import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseMove, chooseMoveDetailed } from "../../src/core/ai.ts";
import { ULTIMATE_LEVELS } from "../../src/core/ai-ultimate.ts";
import { newGame, apply, status, legalMoves, isLegal } from "../../src/core/ultimate.ts";
import type { UltimateState } from "../../src/core/ultimate.ts";
import { rngFor } from "../../src/core/seed.ts";
import type { GameConfig, Level, UltimateMove } from "../../src/core/types.ts";

const config = (seed: string): GameConfig => ({ variant: "ultimate", size: 3, mode: "computer", seed });
const SEEDS = ["ULT-BXK4-M9TR", "ULT-CDFG-HJKL", "ULT-MNPQ-RSTV", "ULT-WXYZ-2345", "ULT-6789-BCDF"];
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

test("node budget is never exceeded", () => {
  for (const level of [1, 2, 3, 4, 5] as Level[]) {
    const s = newGame(config(SEEDS[0]!));
    const detail = chooseMoveDetailed("ultimate", s, level, rngFor(SEEDS[0]!, 0));
    assert.ok(detail.nodes <= ULTIMATE_LEVELS[level].budget, `level ${level}: ${detail.nodes} > ${ULTIMATE_LEVELS[level].budget}`);
  }
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
