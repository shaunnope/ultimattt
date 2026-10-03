// The computer. Negamax with alpha-beta and iterative deepening, bounded by a count
// of positions (never a clock) so the same seed and moves always give the same game
// on every device. Randomness comes only from the `rng` passed in.
//
// Levels look further ahead and, below Sharp, sometimes pick a decent move that is
// not the best one rather than a random one.

import type { Cell, ClassicMove, Level, Move, Variant } from "./types.ts";
import { cellOf, other } from "./types.ts";
import type { ClassicState } from "./classic.ts";
import { lines as classicLines } from "./classic.ts";
import type { UltimateState } from "./ultimate.ts";
import type { CubeState } from "./cube.ts";
import { chooseUltimate } from "./ai-ultimate.ts";

export interface LevelSpec {
  /** Deepest search, in moves */
  depth: number;
  /** Chance (0..1) of picking from the wider spread instead of the best moves */
  random: number;
  /** Spread of score below the best that still counts as decent; Infinity = any legal move */
  margin: number;
  /** Most positions searched before falling back to the last completed depth */
  budget: number;
}

export const LEVELS: Record<Level, LevelSpec> = {
  1: { depth: 1, random: 0.3, margin: Infinity, budget: 5_000 },
  2: { depth: 2, random: 0.1, margin: 60, budget: 20_000 },
  3: { depth: 3, random: 0.03, margin: 20, budget: 60_000 },
  4: { depth: 5, random: 0, margin: 0, budget: 60_000 },
  5: { depth: 99, random: 0, margin: 0, budget: 150_000 },
};

export type AnyState = ClassicState | UltimateState | CubeState;

export interface Choice {
  move: Move;
  /** Positions searched */
  nodes: number;
  /** Deepest completed search */
  depth: number;
}

const WIN = 1_000_000;
const WEIGHT = [0, 1, 10, 100, 1000, 10000];

class OutOfBudget extends Error {}

interface Board {
  cells: Int8Array;
  lines: number[][];
  byCell: number[][][];
  /** Empty cells, centre first, as a stable move order */
  order: number[];
  size: number;
}

function makeBoard(state: ClassicState): Board {
  const lines = classicLines(state.size);
  const byCell: number[][][] = Array.from({ length: state.cells.length }, () => []);
  for (const line of lines) for (const i of line) byCell[i]!.push(line);
  const mid = (state.size - 1) / 2;
  const order = state.cells
    .map((_, i) => i)
    .sort((a, b) => {
      const da = Math.hypot(Math.floor(a / state.size) - mid, (a % state.size) - mid);
      const db = Math.hypot(Math.floor(b / state.size) - mid, (b % state.size) - mid);
      return da - db || a - b;
    });
  return { cells: Int8Array.from(state.cells), lines, byCell, order, size: state.size };
}

function completes(board: Board, cell: number, mark: number): boolean {
  for (const line of board.byCell[cell]!) {
    let all = true;
    for (const i of line) {
      if (board.cells[i] !== mark) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

/** Score of the position for `player`: open lines weighted by how full they are. */
function evaluate(board: Board, player: number): number {
  let score = 0;
  for (const line of board.lines) {
    let mine = 0;
    let theirs = 0;
    for (const i of line) {
      const v = board.cells[i];
      if (v === player) mine++;
      else if (v !== 0) theirs++;
    }
    if (mine > 0 && theirs === 0) score += WEIGHT[mine] ?? 0;
    else if (theirs > 0 && mine === 0) score -= WEIGHT[theirs] ?? 0;
  }
  return score;
}

interface Search {
  board: Board;
  budget: number;
  nodes: number;
  empties: number;
}

function negamax(s: Search, depth: number, alpha: number, beta: number, player: number, ply: number, last: number): number {
  if (s.nodes >= s.budget) throw new OutOfBudget();
  s.nodes++;
  const opponent = 3 - player;
  if (last >= 0 && completes(s.board, last, opponent)) return -(WIN - ply);
  if (s.empties === 0) return 0;
  if (depth === 0) return evaluate(s.board, player);
  let best = -Infinity;
  for (const cell of s.board.order) {
    if (s.board.cells[cell] !== 0) continue;
    s.board.cells[cell] = player;
    s.empties--;
    const v = -negamax(s, depth - 1, -beta, -alpha, opponent, ply + 1, cell);
    s.empties++;
    s.board.cells[cell] = 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

interface Scored {
  cell: number;
  score: number;
}

/** Score every root move at one depth. With `exact`, scores are exact (needed to pick from a spread);
 *  otherwise moves worse than the best may be reported as bounds, but every best move is exact. */
function scoreRoot(s: Search, player: number, depth: number, exact: boolean): Scored[] {
  const out: Scored[] = [];
  let best = -Infinity;
  for (const cell of s.board.order) {
    if (s.board.cells[cell] !== 0) continue;
    s.board.cells[cell] = player;
    s.empties--;
    let score: number;
    if (completes(s.board, cell, player)) {
      score = WIN - 1;
    } else {
      const alpha = exact ? -Infinity : best - 1;
      score = -negamax(s, depth - 1, -Infinity, -alpha, 3 - player, 1, cell);
    }
    s.empties++;
    s.board.cells[cell] = 0;
    out.push({ cell, score });
    if (score > best) best = score;
  }
  return out;
}

function chooseClassic(state: ClassicState, level: Level, rng: () => number): Choice {
  const spec = LEVELS[level];
  const board = makeBoard(state);
  const player = cellOf(state.toMove);
  const empties = board.cells.reduce((n, c) => n + (c === 0 ? 1 : 0), 0);
  const search: Search = { board, budget: spec.budget, nodes: 0, empties };
  const exact = spec.random > 0;

  let scored: Scored[] | null = null;
  let reached = 0;
  const maxDepth = Math.min(spec.depth, empties);
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      scored = scoreRoot(search, player, depth, exact);
      reached = depth;
      if (scored.every((m) => Math.abs(m.score) > WIN / 2)) break; // every line of play is already decided
    }
  } catch (e) {
    if (!(e instanceof OutOfBudget)) throw e;
  }
  if (!scored) {
    // Out of budget before depth 1 finished (cannot happen at the configured budgets): play the first legal move.
    const cell = board.order.find((c) => board.cells[c] === 0)!;
    return { move: { t: "place", cell }, nodes: search.nodes, depth: 0 };
  }

  const best = Math.max(...scored.map((m) => m.score));
  let pool: Scored[];
  if (spec.random > 0 && rng() % 1000 < spec.random * 1000) {
    pool = scored.filter((m) => m.score >= best - spec.margin);
  } else {
    pool = scored.filter((m) => m.score === best);
  }
  const chosen = pool[rng() % pool.length]!;
  const move: ClassicMove = { t: "place", cell: chosen.cell };
  return { move, nodes: search.nodes, depth: reached };
}

export function chooseMoveDetailed(variant: Variant, state: AnyState, level: Level, rng: () => number): Choice {
  if (variant === "classic") return chooseClassic(state as ClassicState, level, rng);
  if (variant === "ultimate") return chooseUltimate(state as UltimateState, level, rng);
  throw new Error(`no computer opponent for ${variant}`);
}

export function chooseMove(variant: Variant, state: AnyState, level: Level, rng: () => number): Move {
  return chooseMoveDetailed(variant, state, level, rng).move;
}

// Re-exported so callers need one import for "who is the opponent".
export { other };
export type { Cell };
