import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseMove, chooseMoveDetailed, LEVELS } from "../../src/core/ai.ts";
import { newGame, apply, status, legalMoves } from "../../src/core/classic.ts";
import type { ClassicState } from "../../src/core/classic.ts";
import { rngFor } from "../../src/core/seed.ts";
import type { ClassicMove, GameConfig, Level } from "../../src/core/types.ts";

const config = (size: 3 | 4 | 5, seed: string): GameConfig => ({ variant: "classic", size, mode: "computer", seed });
const place = (cell: number): ClassicMove => ({ t: "place", cell });
const pick = (state: ClassicState, level: Level, seed: string): number =>
  (chooseMove("classic", state, level, rngFor(seed, state.moves.length)) as ClassicMove).cell;
const play = (size: 3 | 4 | 5, seed: string, cells: number[]): ClassicState =>
  cells.reduce((st, c) => apply(st, place(c)), newGame(config(size, seed)));

test("same seed and same moves give the same move at every level", () => {
  for (const level of [1, 2, 3, 4, 5] as Level[]) {
    const s = play(3, "3X3-BXK4-M9TR", [0, 4, 8]);
    assert.equal(pick(s, level, "3X3-BXK4-M9TR"), pick(s, level, "3X3-BXK4-M9TR"), `level ${level}`);
  }
});

test("the computer always chooses a legal move, on every size and level", () => {
  for (const size of [3, 4, 5] as const) {
    for (const level of [1, 2, 3, 4, 5] as Level[]) {
      const seed = `${size}X${size}-BXK4-M9TR`;
      let s = newGame(config(size, seed));
      while (status(s).status === "playing" && s.moves.length < 6) {
        const cell = pick(s, level, seed);
        assert.ok(legalMoves(s).some((m) => (m as ClassicMove).cell === cell), `size ${size} level ${level}`);
        s = apply(s, place(cell));
      }
    }
  }
});

test("blocks a loss in one and takes a win in one at the sharper levels", () => {
  const seed = "3X3-BXK4-M9TR";
  // X has 0 and 1 and threatens 2; O to move must block at 2
  const block = play(3, seed, [0, 3, 1]);
  for (const level of [3, 4, 5] as Level[]) assert.equal(pick(block, level, seed), 2, `block level ${level}`);
  // O has 3 and 4 and threatens 5; with O to move it must win at 5
  const win = play(3, seed, [0, 3, 1, 4, 8]);
  for (const level of [3, 4, 5] as Level[]) assert.equal(pick(win, level, seed), 5, `win level ${level}`);
});

test("node budget is never exceeded", () => {
  for (const size of [3, 4, 5] as const) {
    for (const level of [1, 2, 3, 4, 5] as Level[]) {
      const seed = `${size}X${size}-BXK4-M9TR`;
      const s = newGame(config(size, seed));
      const detail = chooseMoveDetailed("classic", s, level, rngFor(seed, 0));
      assert.ok(detail.nodes <= LEVELS[level].budget, `size ${size} level ${level}: ${detail.nodes} > ${LEVELS[level].budget}`);
    }
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
    const s = newGame(config(4, "4X4-BXK4-M9TR"));
    for (const level of [1, 3, 5] as Level[]) pick(s, level, "4X4-BXK4-M9TR");
  } finally {
    Math.random = random;
    Date.now = now;
    performance.now = perf;
  }
});

// Master on 3x3 against every possible opponent line of play.
function masterNeverLoses(masterMark: "X" | "O"): number {
  const seed = "3X3-BXK4-M9TR";
  const cache = new Map<string, number>();
  let games = 0;
  const walk = (s: ClassicState): void => {
    const st = status(s);
    if (st.status !== "playing") {
      games++;
      assert.notEqual(st.winner, masterMark === "X" ? "O" : "X", `master lost: ${s.moves.map((m) => (m as ClassicMove).cell).join(",")}`);
      return;
    }
    if (s.toMove === masterMark) {
      const key = s.cells.join("");
      let cell = cache.get(key);
      if (cell === undefined) {
        cell = pick(s, 5, seed);
        cache.set(key, cell);
      }
      walk(apply(s, place(cell)));
    } else {
      for (const m of legalMoves(s)) walk(apply(s, m));
    }
  };
  walk(newGame(config(3, seed)));
  return games;
}

test("Master never loses on 3x3 as X, against every opponent line", () => {
  assert.ok(masterNeverLoses("X") > 100);
});

test("Master never loses on 3x3 as O, against every opponent line", () => {
  assert.ok(masterNeverLoses("O") > 100);
});

// Self-play: a higher level should out-score a lower one over paired games.
function match(higher: Level, lower: Level, games: number): number {
  const first = "BCDFGHJK";
  const last = "23456789";
  let score = 0;
  for (let g = 0; g < games; g++) {
    const seed = `3X3-${first[g % 8]}XK4-M9T${last[Math.floor(g / 8) % 8]}`;
    const higherIsX = g % 2 === 0;
    let s = newGame(config(3, seed));
    while (status(s).status === "playing") {
      const level = (s.toMove === "X") === higherIsX ? higher : lower;
      s = apply(s, place(pick(s, level, seed)));
    }
    const w = status(s).winner;
    if (w === null) continue;
    score += (w === "X") === higherIsX ? 1 : -1;
  }
  return score;
}

test("higher levels out-score lower levels in self-play on 3x3", () => {
  // Where the gap is real the stronger level wins more than it loses...
  assert.ok(match(2, 1, 40) > 0, "level 2 vs 1");
  assert.ok(match(3, 1, 40) > 0, "level 3 vs 1");
  assert.ok(match(5, 1, 40) > 0, "level 5 vs 1");
  assert.ok(match(5, 3, 40) > 0, "level 5 vs 3");
  // ...and where both are near perfect on 3x3 they draw, but the stronger never does worse.
  assert.ok(match(3, 2, 40) >= 0, "level 3 vs 2");
  assert.ok(match(4, 2, 40) >= 0, "level 4 vs 2");
  assert.ok(match(4, 3, 40) >= 0, "level 4 vs 3");
  assert.ok(match(5, 4, 40) >= 0, "level 5 vs 4");
});
