// Classic tic tac toe on an N×N board (3 to 5) where K in a row wins (3 up to N). X moves first.
// Pure: no DOM, storage, network or clock.

import type { Cell, ClassicHint, ClassicMove, GameConfig, HintSet, Legality, Mark, Move, StateBase, Status } from "./types.ts";
import { OK, cellOf, other, refuse } from "./types.ts";
import { hashString } from "./seed.ts";

export interface ClassicState extends StateBase {
  size: 3 | 4 | 5;
  /** K: cells in a row that win */
  winLength: number;
  /** size*size cells; 0 empty, 1 X, 2 O */
  cells: Cell[];
  /** The cells of the winning line, in order, once somebody has won */
  winLine: number[] | null;
}

/** Every reason isLegal can refuse a move with. */
export const REASONS = ["not-a-placement", "game-over", "out-of-range", "occupied"] as const;

const lineCache = new Map<string, number[][]>();

/** Every line that wins on a board of this size: every window of exactly winLength cells in rows, columns and diagonals.
 *  A longer run contains a window, so it wins too. Cached by the pair. */
export function lines(size: number, winLength: number): number[][] {
  const key = `${size}/${winLength}`;
  const cached = lineCache.get(key);
  if (cached) return cached;
  const k = winLength;
  const out: number[][] = [];
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      for (const [dr, dc] of dirs) {
        const endR = r + dr * (k - 1);
        const endC = c + dc * (k - 1);
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
        out.push(Array.from({ length: k }, (_, i) => (r + dr * i) * size + (c + dc * i)));
      }
    }
  }
  lineCache.set(key, out);
  return out;
}

export function newGame(config: GameConfig): ClassicState {
  const size = config.size;
  return {
    config,
    moves: [],
    toMove: "X",
    status: "playing",
    winner: null,
    size,
    winLength: config.winLength,
    cells: Array<Cell>(size * size).fill(0),
    winLine: null,
  };
}

export function status(state: ClassicState): { status: Status; winner: Mark | null; winLine?: number[] } {
  return state.winLine
    ? { status: state.status, winner: state.winner, winLine: state.winLine }
    : { status: state.status, winner: state.winner };
}

export function isLegal(state: ClassicState, move: Move): Legality {
  if (move.t !== "place" || "board" in move || "face" in move) return refuse("not-a-placement");
  if (state.status !== "playing") return refuse("game-over");
  const cell = (move as ClassicMove).cell;
  if (!Number.isInteger(cell) || cell < 0 || cell >= state.cells.length) return refuse("out-of-range");
  if (state.cells[cell] !== 0) return refuse("occupied");
  return OK;
}

export function legalMoves(state: ClassicState): ClassicMove[] {
  if (state.status !== "playing") return [];
  const out: ClassicMove[] = [];
  state.cells.forEach((c, cell) => {
    if (c === 0) out.push({ t: "place", cell });
  });
  return out;
}

export function apply(state: ClassicState, move: Move): ClassicState {
  const legal = isLegal(state, move);
  if (!legal.ok) throw new Error(legal.reason);
  const { cell } = move as ClassicMove;
  const cells = state.cells.slice();
  const mark = cellOf(state.toMove);
  cells[cell] = mark;
  const winLine = lines(state.size, state.winLength).find((line) => line.includes(cell) && line.every((i) => cells[i] === mark)) ?? null;
  const full = cells.every((c) => c !== 0);
  return {
    ...state,
    moves: [...state.moves, move],
    cells,
    toMove: other(state.toMove),
    winLine,
    winner: winLine ? state.toMove : null,
    status: winLine ? "won" : full ? "draw" : "playing",
  };
}

export function fromMoves(config: GameConfig, moves: Move[]): ClassicState {
  return moves.reduce<ClassicState>((s, m) => apply(s, m), newGame(config));
}

/** Takes back one move. Against the computer the controller calls this twice. */
export function undo(state: ClassicState): ClassicState {
  if (state.moves.length === 0) return state;
  return fromMoves(state.config, state.moves.slice(0, -1));
}

/** A position hash, used to check that two devices agree. */
export function hash(state: ClassicState): number {
  return hashString(state.cells.join("") + state.toMove);
}

/** Cells where `mark` would win, and cells where the other player would win (so `mark` must block). */
export function hints(state: ClassicState, mark: Mark): HintSet<ClassicHint> {
  const out: HintSet<ClassicHint> = { win: [], block: [] };
  if (state.status !== "playing") return out;
  const mine = cellOf(mark);
  const theirs = cellOf(other(mark));
  const all = lines(state.size, state.winLength);
  const completes = (cell: number, who: Cell) =>
    all.some((line) => line.includes(cell) && line.every((i) => i === cell || state.cells[i] === who));
  state.cells.forEach((value, cell) => {
    if (value !== 0) return;
    if (completes(cell, mine)) out.win.push({ cell });
    if (completes(cell, theirs)) out.block.push({ cell });
  });
  return out;
}
