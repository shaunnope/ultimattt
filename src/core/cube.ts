// Cube tic tac toe (from the 1D Tic-Tac-Toe game "Rubik's-Tac-Toe"): six 3×3 boards, one per
// face of a cube. Every completed line on any face scores a point for its owner. A move that
// scores must be followed, by the same player, by turning one layer of the cube, which carries
// marks between faces and can make or break lines. The game ends when all 54 cells are filled and
// no turn is pending; the player with more lines wins.
//
// Pure: no DOM, storage, network or clock.
//
// Geometry. 54 stickers, index = face*9 + row*3 + col, faces U, D, F, B, L, R (0..5), each viewed
// from outside with up = +y (U: up = -z, D: up = +z). Axes: x right, y up, z towards the viewer.
// A layer turn is a true 3D rotation, so orientation can never go wrong:
//   dir +1 = +90° by the right-hand rule about +axis (anticlockwise seen from the positive end),
//   dir -1 = -90°, dir 2 = 180°; layer l turns the stickers whose coordinate on the axis is l-1.
// Checked against the original game's own turn logic in tests/fixtures/cube-golden.json.

import type { Axis, Cell, CubeHint, CubeMove, CubeRotate, GameConfig, HintSet, Legality, Mark, Move, RotateDir, StateBase, Status } from "./types.ts";
import { OK, cellOf, other, refuse } from "./types.ts";
import { hashString } from "./seed.ts";

export const FACES = ["U", "D", "F", "B", "L", "R"] as const;

export type Phase = "place" | "rotate";

export interface CubeState extends StateBase {
  /** 54 stickers; 0 empty, 1 X, 2 O */
  stickers: Cell[];
  /** "rotate" means the player to move has just scored and must turn a layer next */
  phase: Phase;
  /** Lines currently on the cube, recounted from the stickers after every move */
  lines: { X: number; O: number };
  empty: number;
  pendingRotateFor: Mark | null;
}

/** Every reason isLegal can refuse a move with. */
export const REASONS = ["invalid-move", "game-over", "out-of-range", "occupied", "rotate-pending", "no-rotation-due"] as const;

type Vec = readonly [number, number, number];

function geometry(face: number, row: number, col: number): { p: Vec; n: Vec } {
  switch (face) {
    case 0: return { p: [col - 1, 1, row - 1], n: [0, 1, 0] };
    case 1: return { p: [col - 1, -1, 1 - row], n: [0, -1, 0] };
    case 2: return { p: [col - 1, 1 - row, 1], n: [0, 0, 1] };
    case 3: return { p: [1 - col, 1 - row, -1], n: [0, 0, -1] };
    case 4: return { p: [-1, 1 - row, col - 1], n: [-1, 0, 0] };
    default: return { p: [1, 1 - row, 1 - col], n: [1, 0, 0] };
  }
}

const GEOM = Array.from({ length: 54 }, (_, i) => geometry(Math.floor(i / 9), Math.floor((i % 9) / 3), i % 3));
const INDEX_OF = new Map(GEOM.map((g, i) => [`${g.p.join(",")}|${g.n.join(",")}`, i]));
const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };
const AXES: Axis[] = ["x", "y", "z"];
const DIRS: RotateDir[] = [1, -1, 2];

function quarter(v: Vec, axis: Axis): Vec {
  const [x, y, z] = v;
  if (axis === "x") return [x, -z, y];
  if (axis === "y") return [z, y, -x];
  return [-y, x, z];
}

function turned(v: Vec, axis: Axis, quarters: number): Vec {
  let out = v;
  for (let i = 0; i < quarters; i++) out = quarter(out, axis);
  return out;
}

const tableCache = new Map<string, number[]>();

/** table[dst] = src: after the turn, the sticker at `dst` is the one that was at `src`. */
export function rotateTable(axis: Axis, layer: 0 | 1 | 2, dir: RotateDir): number[] {
  const key = `${axis}${layer}${dir}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  const quarters = dir === 1 ? 1 : dir === -1 ? 3 : 2;
  const a = AXIS_INDEX[axis];
  const table = Array.from({ length: 54 }, (_, i) => i);
  GEOM.forEach(({ p, n }, src) => {
    if (p[a] !== layer - 1) return;
    const dst = INDEX_OF.get(`${turned(p, axis, quarters).join(",")}|${turned(n, axis, quarters).join(",")}`)!;
    table[dst] = src;
  });
  tableCache.set(key, table);
  return table;
}

export function rotateStickers<T>(stickers: readonly T[], axis: Axis, layer: 0 | 1 | 2, dir: RotateDir): T[] {
  const table = rotateTable(axis, layer, dir);
  return table.map((src) => stickers[src]!);
}

/** The stickers a layer turn carries: an outer layer is a ring of 12 plus its whole face (21); a middle layer is 12. */
export function layerStickers(axis: Axis, layer: 0 | 1 | 2): number[] {
  const a = AXIS_INDEX[axis];
  return GEOM.flatMap((g, i) => (g.p[a] === layer - 1 ? [i] : []));
}

/** The 27 turns: 3 axes × 3 layers × {quarter, quarter back, half}. */
export function rotations(): CubeRotate[] {
  const out: CubeRotate[] = [];
  for (const axis of AXES) for (const layer of [0, 1, 2] as const) for (const dir of DIRS) out.push({ t: "rotate", axis, layer, dir });
  return out;
}

const FACE_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export interface CubeLine {
  face: number;
  cells: number[];
  owner: Mark;
}

/** Every line on the cube, with its owner. */
export function cubeLines(stickers: readonly Cell[]): CubeLine[] {
  const out: CubeLine[] = [];
  for (let face = 0; face < 6; face++) {
    for (const cells of FACE_LINES) {
      const v = stickers[face * 9 + cells[0]!]!;
      if (v !== 0 && cells.every((c) => stickers[face * 9 + c] === v)) out.push({ face, cells, owner: v === 1 ? "X" : "O" });
    }
  }
  return out;
}

export function countLines(stickers: readonly Cell[]): { X: number; O: number } {
  const count = { X: 0, O: 0 };
  for (const line of cubeLines(stickers)) count[line.owner]++;
  return count;
}

export function newGame(config: GameConfig): CubeState {
  return {
    config,
    moves: [],
    toMove: "X",
    status: "playing",
    winner: null,
    stickers: Array<Cell>(54).fill(0),
    phase: "place",
    lines: { X: 0, O: 0 },
    empty: 54,
    pendingRotateFor: null,
  };
}

export function status(state: CubeState): { status: Status; winner: Mark | null } {
  return { status: state.status, winner: state.winner };
}

function isRotate(move: Move): move is CubeRotate {
  const m = move as CubeRotate;
  return m.t === "rotate" && AXES.includes(m.axis) && [0, 1, 2].includes(m.layer) && DIRS.includes(m.dir);
}

function isPlace(move: Move): move is Extract<CubeMove, { t: "place" }> {
  const m = move as { t: string; face?: unknown; cell?: unknown };
  return m.t === "place" && typeof m.face === "number" && typeof m.cell === "number";
}

export function isLegal(state: CubeState, move: Move): Legality {
  if (!isRotate(move) && !isPlace(move)) return refuse("invalid-move");
  if (state.status !== "playing") return refuse("game-over");
  if (isPlace(move)) {
    if (state.phase === "rotate") return refuse("rotate-pending");
    const { face, cell } = move;
    if (!Number.isInteger(face) || face < 0 || face > 5 || !Number.isInteger(cell) || cell < 0 || cell > 8) return refuse("out-of-range");
    if (state.stickers[face * 9 + cell] !== 0) return refuse("occupied");
    return OK;
  }
  if (state.phase !== "rotate") return refuse("no-rotation-due");
  return OK;
}

export function legalMoves(state: CubeState): CubeMove[] {
  if (state.status !== "playing") return [];
  if (state.phase === "rotate") return rotations();
  const out: CubeMove[] = [];
  state.stickers.forEach((v, i) => {
    if (v === 0) out.push({ t: "place", face: Math.floor(i / 9), cell: i % 9 });
  });
  return out;
}

function settle(state: CubeState): CubeState {
  if (state.phase === "place" && state.empty === 0) {
    const { X, O } = state.lines;
    return { ...state, status: X === O ? "tie" : "won", winner: X === O ? null : X > O ? "X" : "O" };
  }
  return state;
}

export function apply(state: CubeState, move: Move): CubeState {
  const legal = isLegal(state, move);
  if (!legal.ok) throw new Error(legal.reason);
  const moves = [...state.moves, move];
  if (isPlace(move)) {
    const stickers = state.stickers.slice();
    stickers[move.face * 9 + move.cell] = cellOf(state.toMove);
    const lines = countLines(stickers);
    const scored = lines[state.toMove] > state.lines[state.toMove];
    return settle({
      ...state,
      moves,
      stickers,
      lines,
      empty: state.empty - 1,
      phase: scored ? "rotate" : "place",
      pendingRotateFor: scored ? state.toMove : null,
      toMove: scored ? state.toMove : other(state.toMove),
    });
  }
  const rotation = move as CubeRotate;
  const stickers = rotateStickers(state.stickers, rotation.axis, rotation.layer, rotation.dir);
  return settle({
    ...state,
    moves,
    stickers,
    lines: countLines(stickers),
    phase: "place",
    pendingRotateFor: null,
    toMove: other(state.toMove),
  });
}

export function fromMoves(config: GameConfig, moves: Move[]): CubeState {
  return moves.reduce<CubeState>((s, m) => apply(s, m), newGame(config));
}

/** Takes back one unit: a placement, or a rotation together with the placement that caused it. */
export function undo(state: CubeState): CubeState {
  if (state.moves.length === 0) return state;
  const last = state.moves[state.moves.length - 1]!;
  return fromMoves(state.config, state.moves.slice(0, last.t === "rotate" ? -2 : -1));
}

export function hash(state: CubeState): number {
  return hashString(state.stickers.join("") + state.phase + state.toMove);
}

/** Empty stickers where placing a mark would complete a line for `mark` (win) or for the other player (block).
 *  This looks only at placing a mark: it does not try to predict what a later layer turn would do. */
export function hints(state: CubeState, mark: Mark): HintSet<CubeHint> {
  const out: HintSet<CubeHint> = { win: [], block: [] };
  if (state.status !== "playing" || state.phase !== "place") return out;
  const mine = cellOf(mark);
  const theirs = cellOf(other(mark));
  state.stickers.forEach((value, i) => {
    if (value !== 0) return;
    const face = Math.floor(i / 9);
    const cell = i % 9;
    const completes = (who: Cell) =>
      FACE_LINES.some((line) => line.includes(cell) && line.every((c) => c === cell || state.stickers[face * 9 + c] === who));
    if (completes(mine)) out.win.push({ face, cell });
    if (completes(theirs)) out.block.push({ face, cell });
  });
  return out;
}
