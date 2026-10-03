// Ultimate tic tac toe: a 3×3 grid of 3×3 boards. The cell you play inside a small board
// decides which small board your opponent must play next. Winning a small board claims it;
// claiming three in a line wins. Sent to a board that is claimed or full, the opponent may
// play in any open board. X moves first, anywhere.
// Pure: no DOM, storage, network or clock.

import type { Cell, GameConfig, HintSet, Legality, Mark, Move, StateBase, Status, UltimateHint, UltimateMove } from "./types.ts";
import { OK, cellOf, other, refuse } from "./types.ts";
import { hashString } from "./seed.ts";
import { lines } from "./classic.ts";

/** 0 open, 1 claimed by X, 2 claimed by O, 3 full with no winner (counts for nobody) */
export type Claim = 0 | 1 | 2 | 3;

export interface UltimateState extends StateBase {
  /** 9 small boards of 9 cells; 0 empty, 1 X, 2 O */
  boards: Cell[][];
  claims: Claim[];
  /** The small board the next player must play, or null when any open board will do */
  forced: number | null;
  /** The three small boards that won the game, once somebody has */
  winLine: number[] | null;
}

/** Every reason isLegal can refuse a move with. */
export const REASONS = ["not-a-placement", "game-over", "out-of-range", "not-your-board", "closed-board", "occupied"] as const;

const SMALL_LINES = lines(3);

export function newGame(config: GameConfig): UltimateState {
  return {
    config,
    moves: [],
    toMove: "X",
    status: "playing",
    winner: null,
    boards: Array.from({ length: 9 }, () => Array<Cell>(9).fill(0)),
    claims: Array<Claim>(9).fill(0),
    forced: null,
    winLine: null,
  };
}

export function status(state: UltimateState): { status: Status; winner: Mark | null; winLine?: number[] } {
  return state.winLine
    ? { status: state.status, winner: state.winner, winLine: state.winLine }
    : { status: state.status, winner: state.winner };
}

/** The small boards the next player may play in. */
export function playable(state: UltimateState): number[] {
  if (state.status !== "playing") return [];
  if (state.forced !== null) return [state.forced];
  return state.claims.flatMap((c, b) => (c === 0 ? [b] : []));
}

function isPlacement(move: Move): move is UltimateMove {
  return move.t === "place" && "board" in move && typeof (move as UltimateMove).board === "number";
}

export function isLegal(state: UltimateState, move: Move): Legality {
  if (!isPlacement(move)) return refuse("not-a-placement");
  if (state.status !== "playing") return refuse("game-over");
  const { board, cell } = move;
  if (!Number.isInteger(board) || board < 0 || board > 8 || !Number.isInteger(cell) || cell < 0 || cell > 8) return refuse("out-of-range");
  if (state.forced !== null && board !== state.forced) return refuse("not-your-board");
  if (state.claims[board] !== 0) return refuse("closed-board");
  if (state.boards[board]![cell] !== 0) return refuse("occupied");
  return OK;
}

export function legalMoves(state: UltimateState): UltimateMove[] {
  const out: UltimateMove[] = [];
  for (const board of playable(state)) {
    state.boards[board]!.forEach((c, cell) => {
      if (c === 0) out.push({ t: "place", board, cell });
    });
  }
  return out;
}

export function apply(state: UltimateState, move: Move): UltimateState {
  const legal = isLegal(state, move);
  if (!legal.ok) throw new Error(legal.reason);
  const { board, cell } = move as UltimateMove;
  const mark = cellOf(state.toMove);

  const small = state.boards[board]!.slice();
  small[cell] = mark;
  const boards = state.boards.slice();
  boards[board] = small;

  const claims = state.claims.slice();
  if (SMALL_LINES.some((line) => line.includes(cell) && line.every((i) => small[i] === mark))) claims[board] = mark;
  else if (small.every((c) => c !== 0)) claims[board] = 3;

  const winLine = lines(3).find((line) => line.every((b) => claims[b] === mark)) ?? null;
  const decided = claims.every((c) => c !== 0);
  return {
    ...state,
    moves: [...state.moves, move],
    boards,
    claims,
    // Sent to a claimed or full board: free choice.
    forced: claims[cell] === 0 ? cell : null,
    toMove: other(state.toMove),
    winLine,
    winner: winLine ? state.toMove : null,
    status: winLine ? "won" : decided ? "draw" : "playing",
  };
}

export function fromMoves(config: GameConfig, moves: Move[]): UltimateState {
  return moves.reduce<UltimateState>((s, m) => apply(s, m), newGame(config));
}

export function undo(state: UltimateState): UltimateState {
  if (state.moves.length === 0) return state;
  return fromMoves(state.config, state.moves.slice(0, -1));
}

export function hash(state: UltimateState): number {
  return hashString(state.boards.map((b) => b.join("")).join("|") + state.claims.join("") + String(state.forced) + state.toMove);
}

/** In the board(s) you may play: cells that would win a small board for `mark`, and ones that stop the other player doing so. */
export function hints(state: UltimateState, mark: Mark): HintSet<UltimateHint> {
  const out: HintSet<UltimateHint> = { win: [], block: [] };
  const mine = cellOf(mark);
  const theirs = cellOf(other(mark));
  for (const board of playable(state)) {
    const cells = state.boards[board]!;
    const completes = (cell: number, who: Cell) =>
      SMALL_LINES.some((line) => line.includes(cell) && line.every((i) => i === cell || cells[i] === who));
    cells.forEach((value, cell) => {
      if (value !== 0) return;
      if (completes(cell, mine)) out.win.push({ board, cell });
      if (completes(cell, theirs)) out.block.push({ board, cell });
    });
  }
  return out;
}
