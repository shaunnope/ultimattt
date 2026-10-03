// The computer for Ultimate tic tac toe. Same approach as ai.ts (negamax, alpha-beta,
// iterative deepening, position-count budget, rng only from the caller) with a position
// evaluation built for the nine-board game. Small boards are scored through a lookup table
// keyed by the board's base-3 code, so a position costs a few array reads.

import type { Level, Move, UltimateMove } from "./types.ts";
import { lines } from "./classic.ts";
import type { UltimateState } from "./ultimate.ts";
import type { LevelSpec, Choice } from "./ai.ts";

export const ULTIMATE_LEVELS: Record<Level, LevelSpec> = {
  1: { depth: 1, random: 0.3, margin: Infinity, budget: 3_000 },
  2: { depth: 2, random: 0.1, margin: 150, budget: 20_000 },
  3: { depth: 3, random: 0.03, margin: 60, budget: 40_000 },
  4: { depth: 5, random: 0, margin: 0, budget: 30_000 },
  5: { depth: 99, random: 0, margin: 0, budget: 50_000 },
};

const WIN = 1_000_000;
const POW3 = [1, 3, 9, 27, 81, 243, 729, 2187, 6561];
const SMALL = lines(3);
const META = lines(3);

// ---- lookup tables over every possible small board (3^9 = 19683) ----
const WIN_LUT = new Int8Array(19683); // 0 none, 1 X, 2 O
const FULL_LUT = new Uint8Array(19683);
const SCORE_LUT = new Int16Array(19683); // open-board potential, X's point of view
const EMPTY_LUT = new Uint16Array(19683); // bit i set when cell i is empty
const LINE_W = [0, 2, 10, 0];

for (let code = 0; code < 19683; code++) {
  const cell = (i: number) => Math.floor(code / POW3[i]!) % 3;
  let empty = 0;
  for (let i = 0; i < 9; i++) if (cell(i) === 0) empty |= 1 << i;
  EMPTY_LUT[code] = empty;
  FULL_LUT[code] = empty === 0 ? 1 : 0;
  let winner = 0;
  let score = 0;
  for (const line of SMALL) {
    let x = 0;
    let o = 0;
    for (const i of line) {
      const v = cell(i);
      if (v === 1) x++;
      else if (v === 2) o++;
    }
    if (x === 3) winner = 1;
    else if (o === 3) winner = 2;
    else if (x > 0 && o === 0) score += LINE_W[x]!;
    else if (o > 0 && x === 0) score -= LINE_W[o]!;
  }
  WIN_LUT[code] = winner;
  SCORE_LUT[code] = winner ? 0 : score;
}

const BOARD_W = [3, 2, 3, 2, 4, 2, 3, 2, 3]; // corners and the centre matter more
const CELL_W = [2, 1, 2, 1, 3, 1, 2, 1, 2];
const CLAIM = 30;
const META_W = [0, 15, 90, 0];
const FREE_CHOICE = 12;

class OutOfBudget extends Error {}

interface Search {
  code: Int32Array;
  claims: Int8Array; // 0 open, 1 X, 2 O, 3 full
  forced: number; // -1 = free choice
  nodes: number;
  budget: number;
}

/** Position value from `player`'s point of view, with `player` having just moved. */
function evaluate(s: Search, player: number): number {
  let x = 0; // X's point of view
  for (let b = 0; b < 9; b++) {
    const c = s.claims[b]!;
    if (c === 0) x += BOARD_W[b]! * SCORE_LUT[s.code[b]!]!;
    else if (c === 1) x += CLAIM * BOARD_W[b]!;
    else if (c === 2) x -= CLAIM * BOARD_W[b]!;
  }
  for (const line of META) {
    let cx = 0;
    let co = 0;
    let blocked = false;
    for (const b of line) {
      const c = s.claims[b]!;
      if (c === 1) cx++;
      else if (c === 2) co++;
      else if (c === 3) blocked = true;
    }
    if (blocked) continue;
    if (cx > 0 && co === 0) x += META_W[cx]!;
    else if (co > 0 && cx === 0) x -= META_W[co]!;
  }
  let v = player === 1 ? x : -x;
  // The side about to move gets a free choice when nothing forces them: bad for `player`.
  if (s.forced === -1) v -= FREE_CHOICE;
  return v;
}

/** Legal moves as board*9+cell, best looking first. */
function generate(s: Search, player: number): number[] {
  const moves: { m: number; p: number }[] = [];
  for (let b = 0; b < 9; b++) {
    if (s.claims[b] !== 0 || (s.forced !== -1 && s.forced !== b)) continue;
    const empty = EMPTY_LUT[s.code[b]!]!;
    for (let c = 0; c < 9; c++) {
      if (!(empty & (1 << c))) continue;
      const next = s.code[b]! + player * POW3[c]!;
      const wins = WIN_LUT[next] === player;
      let p = CELL_W[c]! + BOARD_W[b]!;
      if (wins) p += 100;
      const closes = wins || FULL_LUT[next] === 1;
      const targetClosed = c === b ? closes : s.claims[c] !== 0;
      if (targetClosed) p -= 8; // hands the opponent a free choice
      moves.push({ m: b * 9 + c, p });
    }
  }
  moves.sort((a, z) => z.p - a.p || a.m - z.m);
  return moves.map((x) => x.m);
}

interface Undo {
  board: number;
  code: number;
  claim: number;
  forced: number;
}

function make(s: Search, move: number, player: number): { undo: Undo; won: boolean; decided: boolean } {
  const b = Math.floor(move / 9);
  const c = move % 9;
  const undo: Undo = { board: b, code: s.code[b]!, claim: s.claims[b]!, forced: s.forced };
  s.code[b] = s.code[b]! + player * POW3[c]!;
  const win = WIN_LUT[s.code[b]!]!;
  if (win) s.claims[b] = win;
  else if (FULL_LUT[s.code[b]!]) s.claims[b] = 3;
  s.forced = s.claims[c] === 0 ? c : -1;
  let won = false;
  if (win) {
    for (const line of META) {
      if (line.includes(b) && line.every((i) => s.claims[i] === player)) {
        won = true;
        break;
      }
    }
  }
  let decided = true;
  for (let i = 0; i < 9; i++) {
    if (s.claims[i] === 0) {
      decided = false;
      break;
    }
  }
  return { undo, won, decided };
}

function unmake(s: Search, u: Undo): void {
  s.code[u.board] = u.code;
  s.claims[u.board] = u.claim;
  s.forced = u.forced;
}

function negamax(s: Search, depth: number, alpha: number, beta: number, player: number, ply: number): number {
  if (s.nodes >= s.budget) throw new OutOfBudget();
  s.nodes++;
  const moves = generate(s, player);
  if (moves.length === 0) return 0;
  let best = -Infinity;
  for (const m of moves) {
    const { undo, won, decided } = make(s, m, player);
    let v: number;
    if (won) v = WIN - ply;
    else if (decided) v = 0;
    else if (depth <= 1) v = evaluate(s, player);
    else v = -negamax(s, depth - 1, -beta, -alpha, 3 - player, ply + 1);
    unmake(s, undo);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

interface Scored {
  move: number;
  score: number;
}

function scoreRoot(s: Search, player: number, depth: number, exact: boolean): Scored[] {
  const out: Scored[] = [];
  let best = -Infinity;
  for (const m of generate(s, player)) {
    const { undo, won, decided } = make(s, m, player);
    let score: number;
    if (won) score = WIN - 1;
    else if (decided) score = 0;
    else if (depth <= 1) score = evaluate(s, player);
    else score = -negamax(s, depth - 1, -Infinity, exact ? Infinity : -(best - 1), 3 - player, 1);
    unmake(s, undo);
    out.push({ move: m, score });
    if (score > best) best = score;
  }
  return out;
}

export function chooseUltimate(state: UltimateState, level: Level, rng: () => number): Choice {
  const spec = ULTIMATE_LEVELS[level];
  const code = new Int32Array(9);
  state.boards.forEach((cells, b) => {
    let c = 0;
    cells.forEach((v, i) => (c += v * POW3[i]!));
    code[b] = c;
  });
  const s: Search = {
    code,
    claims: Int8Array.from(state.claims),
    forced: state.forced === null ? -1 : state.forced,
    nodes: 0,
    budget: spec.budget,
  };
  const player = state.toMove === "X" ? 1 : 2;
  const exact = spec.random > 0;
  const openCells = state.boards.reduce((n, b, i) => n + (state.claims[i] === 0 ? b.filter((v) => v === 0).length : 0), 0);

  let scored: Scored[] | null = null;
  let reached = 0;
  try {
    for (let depth = 1; depth <= Math.min(spec.depth, openCells); depth++) {
      scored = scoreRoot(s, player, depth, exact);
      reached = depth;
      if (scored.every((m) => Math.abs(m.score) > WIN / 2)) break;
    }
  } catch (e) {
    if (!(e instanceof OutOfBudget)) throw e;
  }
  if (!scored) {
    const first = generate(s, player)[0]!;
    return { move: { t: "place", board: Math.floor(first / 9), cell: first % 9 }, nodes: s.nodes, depth: 0 };
  }
  const best = Math.max(...scored.map((m) => m.score));
  const pool =
    spec.random > 0 && rng() % 1000 < spec.random * 1000
      ? scored.filter((m) => m.score >= best - spec.margin)
      : scored.filter((m) => m.score === best);
  const chosen = pool[rng() % pool.length]!;
  const move: UltimateMove = { t: "place", board: Math.floor(chosen.move / 9), cell: chosen.move % 9 };
  return { move: move as Move, nodes: s.nodes, depth: reached };
}
