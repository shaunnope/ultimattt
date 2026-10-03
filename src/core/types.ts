// Shared types for every variant. Pure: no DOM, storage, network or clock.

export type Variant = "classic" | "ultimate" | "cube";
export type Mark = "X" | "O";
/** 0 empty, 1 X, 2 O */
export type Cell = 0 | 1 | 2;
export type Mode = "computer" | "local" | "network";
export type Level = 1 | 2 | 3 | 4 | 5;
export type Axis = "x" | "y" | "z";
/** +1 quarter turn, -1 quarter turn back, 2 half turn */
export type RotateDir = 1 | -1 | 2;

export interface GameConfig {
  variant: Variant;
  /** Classic board size (3, 4 or 5); 3 for the other variants */
  size: 3 | 4 | 5;
  mode: Mode;
  /** Computer level, when mode is "computer" */
  level?: Level;
  /** The mark the human takes in computer and network games */
  humanMark?: Mark;
  seed: string;
}

export interface ClassicMove {
  t: "place";
  cell: number;
}
export interface UltimateMove {
  t: "place";
  board: number;
  cell: number;
}
export interface CubePlace {
  t: "place";
  face: number;
  cell: number;
}
export interface CubeRotate {
  t: "rotate";
  axis: Axis;
  layer: 0 | 1 | 2;
  dir: RotateDir;
}
export type CubeMove = CubePlace | CubeRotate;
export type Move = ClassicMove | UltimateMove | CubeMove;

export type Status = "playing" | "won" | "draw" | "tie";

export interface StateBase {
  config: GameConfig;
  moves: Move[];
  toMove: Mark;
  status: Status;
  winner: Mark | null;
}

/** Cells worth pointing out to a player: ones that win for them, and ones they must block. */
export interface HintSet<H> {
  win: H[];
  block: H[];
}
export interface ClassicHint {
  cell: number;
}
export interface UltimateHint {
  board: number;
  cell: number;
}
export interface CubeHint {
  face: number;
  cell: number;
}

export type Legality = { ok: true } | { ok: false; reason: string };

export const OK: Legality = { ok: true };
export const refuse = (reason: string): Legality => ({ ok: false, reason });

export const other = (mark: Mark): Mark => (mark === "X" ? "O" : "X");
export const cellOf = (mark: Mark): 1 | 2 => (mark === "X" ? 1 : 2);
export const markOf = (cell: 1 | 2): Mark => (cell === 1 ? "X" : "O");
