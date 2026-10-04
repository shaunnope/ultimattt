// The computer for Ultimate tic tac toe. Same approach as ai.ts (negamax, alpha-beta,
// iterative deepening, position-count budget, rng only from the caller) with a position
// evaluation built for the board of boards. On 3×3 small boards are scored through a lookup table
// keyed by the board's base-3 code, so a position costs a few array reads. Larger boards (4×4, 5×5)
// have too many codes for a table (3^25), so they keep a count of X and O in every line and update
// the position's score as each mark goes on or comes off (see Big below).

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

/** Most positions searched, by board size and level (positions, never milliseconds, so a seed plays the same
 *  everywhere). Size 3 keeps the 001 budgets; larger boards cost more per position and get lower ones, tuned so the
 *  slowest reply stays well under a second (tests/e2e/perf.spec.ts). */
export const ULTIMATE_BUDGETS: Record<3 | 4 | 5, Record<Level, number>> = {
  3: { 1: 3_000, 2: 20_000, 3: 40_000, 4: 30_000, 5: 50_000 },
  4: { 1: 2_000, 2: 10_000, 3: 25_000, 4: 25_000, 5: 35_000 },
  5: { 1: 1_500, 2: 8_000, 3: 20_000, 4: 20_000, 5: 25_000 },
};

const WIN = 1_000_000;
const POW3 = [1, 3, 9, 27, 81, 243, 729, 2187, 6561];
const SMALL = lines(3, 3);
const META = lines(3, 3);

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

function chooseSmall(state: UltimateState, level: Level, rng: () => number): Choice {
  const spec = { ...ULTIMATE_LEVELS[level], budget: ULTIMATE_BUDGETS[3][level] };
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

// ---- N×N small boards on an N×N grid, N = 4 or 5 ----

/** Weight of a line holding `count` of one player's marks and none of the other's: 2, 10, 50, ... */
const lineWeight = (count: number): number => (count <= 0 ? 0 : 2 * 5 ** (count - 1));
const metaWeight = (count: number): number => (count <= 0 ? 0 : 15 * 6 ** (count - 1));
const ringWeight = (index: number, n: number, floor: number): number => {
  const d = Math.max(Math.abs(2 * Math.floor(index / n) - (n - 1)), Math.abs(2 * (index % n) - (n - 1)));
  return Math.max(floor, 4 - Math.floor(d / 2));
};

interface Big {
  n: number;
  n2: number;
  k: number;
  windows: number[][];
  /** byCell[c]: the windows that contain cell (or board) c */
  byCell: number[][];
  boardW: number[];
  cellW: number[];
  cells: Int8Array; // board * n2 + cell
  cx: Int8Array; // board * windows + window: X marks
  co: Int8Array;
  /** Open-board potential from X's point of view, kept up to date as marks go on and off */
  bscore: Int32Array;
  claims: Int8Array; // 0 open, 1 X, 2 O, 3 full
  filled: Int16Array;
  open: number;
  mx: Int8Array; // per grid window: boards claimed by X, by O, and drawn
  mo: Int8Array;
  mb: Int8Array;
  forced: number;
  nodes: number;
  budget: number;
}

const windowScore = (x: number, o: number): number => (x > 0 && o === 0 ? lineWeight(x) : o > 0 && x === 0 ? -lineWeight(o) : 0);

function makeBig(state: UltimateState, budget: number): Big {
  const n = state.config.size;
  const k = state.config.winLength;
  const n2 = n * n;
  const windows = lines(n, k);
  const byCell: number[][] = Array.from({ length: n2 }, () => []);
  windows.forEach((w, i) => w.forEach((c) => byCell[c]!.push(i)));
  const L = windows.length;
  const big: Big = {
    n, n2, k, windows, byCell,
    boardW: Array.from({ length: n2 }, (_, i) => ringWeight(i, n, 2)),
    cellW: Array.from({ length: n2 }, (_, i) => ringWeight(i, n, 1)),
    cells: new Int8Array(n2 * n2),
    cx: new Int8Array(n2 * L),
    co: new Int8Array(n2 * L),
    bscore: new Int32Array(n2),
    claims: Int8Array.from(state.claims),
    filled: new Int16Array(n2),
    open: 0,
    mx: new Int8Array(L),
    mo: new Int8Array(L),
    mb: new Int8Array(L),
    forced: state.forced === null ? -1 : state.forced,
    nodes: 0,
    budget,
  };
  state.boards.forEach((board, b) => {
    board.forEach((v, c) => {
      if (v === 0) return;
      big.cells[b * n2 + c] = v;
      big.filled[b]!++;
      for (const w of byCell[c]!) (v === 1 ? big.cx : big.co)[b * L + w]!++;
    });
    if (state.claims[b] === 0) {
      for (let w = 0; w < L; w++) big.bscore[b] = big.bscore[b]! + windowScore(big.cx[b * L + w]!, big.co[b * L + w]!);
      big.open++;
    }
  });
  state.claims.forEach((c, b) => {
    if (c === 0) return;
    for (const w of byCell[b]!) (c === 1 ? big.mx : c === 2 ? big.mo : big.mb)[w]!++;
  });
  return big;
}

function evaluateBig(s: Big, player: number): number {
  let x = 0;
  for (let b = 0; b < s.n2; b++) {
    const c = s.claims[b]!;
    if (c === 0) x += s.boardW[b]! * s.bscore[b]!;
    else if (c === 1) x += CLAIM * s.boardW[b]!;
    else if (c === 2) x -= CLAIM * s.boardW[b]!;
  }
  for (let w = 0; w < s.windows.length; w++) {
    if (s.mb[w]!) continue;
    const cx = s.mx[w]!;
    const co = s.mo[w]!;
    if (cx > 0 && co === 0) x += metaWeight(cx);
    else if (co > 0 && cx === 0) x -= metaWeight(co);
  }
  let v = player === 1 ? x : -x;
  if (s.forced === -1) v -= FREE_CHOICE;
  return v;
}

/** The most moves looked at in a position where the player may choose any board. */
const FREE_CHOICE_LIMIT = 24;

/** Legal moves as board*n2+cell, best looking first. At the root every move is kept; inside the search a free choice keeps the best few. */
function generateBig(s: Big, player: number, root: boolean): number[] {
  const L = s.windows.length;
  const moves: { m: number; p: number }[] = [];
  for (let b = 0; b < s.n2; b++) {
    if (s.claims[b] !== 0 || (s.forced !== -1 && s.forced !== b)) continue;
    for (let c = 0; c < s.n2; c++) {
      if (s.cells[b * s.n2 + c] !== 0) continue;
      let wins = false;
      for (const w of s.byCell[c]!) {
        const mine = (player === 1 ? s.cx : s.co)[b * L + w]!;
        const theirs = (player === 1 ? s.co : s.cx)[b * L + w]!;
        if (mine === s.k - 1 && theirs === 0) {
          wins = true;
          break;
        }
      }
      let p = s.cellW[c]! + s.boardW[b]!;
      if (wins) p += 100;
      const closes = wins || s.filled[b]! + 1 === s.n2;
      const targetClosed = c === b ? closes : s.claims[c] !== 0;
      if (targetClosed) p -= 8;
      moves.push({ m: b * s.n2 + c, p });
    }
  }
  moves.sort((a, z) => z.p - a.p || a.m - z.m);
  const out = moves.map((x) => x.m);
  return !root && s.forced === -1 && out.length > FREE_CHOICE_LIMIT ? out.slice(0, FREE_CHOICE_LIMIT) : out;
}

interface BigUndo {
  b: number;
  c: number;
  oldScore: number;
  oldForced: number;
  /** 0 none, else the claim written */
  claimed: number;
}

function makeBigMove(s: Big, move: number, player: number): { undo: BigUndo; won: boolean; decided: boolean } {
  const L = s.windows.length;
  const b = Math.floor(move / s.n2);
  const c = move % s.n2;
  const undo: BigUndo = { b, c, oldScore: s.bscore[b]!, oldForced: s.forced, claimed: 0 };
  s.cells[b * s.n2 + c] = player;
  s.filled[b]!++;
  const mine = player === 1 ? s.cx : s.co;
  let win = false;
  for (const w of s.byCell[c]!) {
    const i = b * L + w;
    const before = windowScore(s.cx[i]!, s.co[i]!);
    mine[i]!++;
    s.bscore[b] = s.bscore[b]! + windowScore(s.cx[i]!, s.co[i]!) - before;
    if (mine[i] === s.k) win = true;
  }
  let won = false;
  if (win || s.filled[b] === s.n2) {
    const claim = win ? player : 3;
    undo.claimed = claim;
    s.claims[b] = claim;
    s.bscore[b] = 0;
    s.open--;
    const meta = claim === 1 ? s.mx : claim === 2 ? s.mo : s.mb;
    for (const w of s.byCell[b]!) {
      meta[w]!++;
      if (win && meta[w] === s.k) won = true;
    }
  }
  s.forced = s.claims[c] === 0 ? c : -1;
  return { undo, won, decided: s.open === 0 };
}

function unmakeBigMove(s: Big, u: BigUndo, player: number): void {
  const L = s.windows.length;
  if (u.claimed) {
    const meta = u.claimed === 1 ? s.mx : u.claimed === 2 ? s.mo : s.mb;
    for (const w of s.byCell[u.b]!) meta[w]!--;
    s.claims[u.b] = 0;
    s.open++;
  }
  const mine = player === 1 ? s.cx : s.co;
  for (const w of s.byCell[u.c]!) mine[u.b * L + w]!--;
  s.filled[u.b]!--;
  s.cells[u.b * s.n2 + u.c] = 0;
  s.bscore[u.b] = u.oldScore;
  s.forced = u.oldForced;
}

function negamaxBig(s: Big, depth: number, alpha: number, beta: number, player: number, ply: number): number {
  if (s.nodes >= s.budget) throw new OutOfBudget();
  s.nodes++;
  const moves = generateBig(s, player, false);
  if (moves.length === 0) return 0;
  let best = -Infinity;
  for (const m of moves) {
    const { undo, won, decided } = makeBigMove(s, m, player);
    let v: number;
    if (won) v = WIN - ply;
    else if (decided) v = 0;
    else if (depth <= 1) v = evaluateBig(s, player);
    else v = -negamaxBig(s, depth - 1, -beta, -alpha, 3 - player, ply + 1);
    unmakeBigMove(s, undo, player);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

function scoreRootBig(s: Big, player: number, depth: number, exact: boolean): Scored[] {
  const out: Scored[] = [];
  let best = -Infinity;
  for (const m of generateBig(s, player, true)) {
    const { undo, won, decided } = makeBigMove(s, m, player);
    let score: number;
    if (won) score = WIN - 1;
    else if (decided) score = 0;
    else if (depth <= 1) score = evaluateBig(s, player);
    else score = -negamaxBig(s, depth - 1, -Infinity, exact ? Infinity : -(best - 1), 3 - player, 1);
    unmakeBigMove(s, undo, player);
    out.push({ move: m, score });
    if (score > best) best = score;
  }
  return out;
}

function chooseLarge(state: UltimateState, level: Level, rng: () => number): Choice {
  const spec = ULTIMATE_LEVELS[level];
  const s = makeBig(state, ULTIMATE_BUDGETS[state.config.size][level]);
  const player = state.toMove === "X" ? 1 : 2;
  const exact = spec.random > 0;
  const openCells = state.boards.reduce((n, b, i) => n + (state.claims[i] === 0 ? b.filter((v) => v === 0).length : 0), 0);

  let scored: Scored[] | null = null;
  let reached = 0;
  try {
    for (let depth = 1; depth <= Math.min(spec.depth, openCells); depth++) {
      scored = scoreRootBig(s, player, depth, exact);
      reached = depth;
      if (scored.every((m) => Math.abs(m.score) > WIN / 2)) break;
    }
  } catch (e) {
    if (!(e instanceof OutOfBudget)) throw e;
  }
  if (!scored) {
    const first = generateBig(s, player, true)[0]!;
    return { move: { t: "place", board: Math.floor(first / s.n2), cell: first % s.n2 }, nodes: s.nodes, depth: 0 };
  }
  const best = Math.max(...scored.map((m) => m.score));
  const pool =
    spec.random > 0 && rng() % 1000 < spec.random * 1000
      ? scored.filter((m) => m.score >= best - spec.margin)
      : scored.filter((m) => m.score === best);
  const chosen = pool[rng() % pool.length]!;
  const move: UltimateMove = { t: "place", board: Math.floor(chosen.move / s.n2), cell: chosen.move % s.n2 };
  return { move: move as Move, nodes: s.nodes, depth: reached };
}

export function chooseUltimate(state: UltimateState, level: Level, rng: () => number): Choice {
  return state.config.size === 3 ? chooseSmall(state, level, rng) : chooseLarge(state, level, rng);
}
