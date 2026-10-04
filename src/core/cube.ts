// Cube tic tac toe (from the 1D Tic-Tac-Toe game "Rubik's-Tac-Toe"): six N×N boards (N = 3 to 5), one per
// face of a cube. Every window of K in a row on any face scores a point for its owner (a run longer than K
// scores one point per window). A move that scores must be followed, by the same player, by turning one
// layer of the cube, which carries marks between faces and can make or break lines. The game ends when
// every cell is filled and no turn is pending; the player with more lines wins.
//
// Pure: no DOM, storage, network or clock.
//
// Geometry. 6·N² stickers, index = face*N² + row*N + col, faces U, D, F, B, L, R (0..5), each viewed
// from outside with up = +y (U: up = -z, D: up = +z). Axes: x right, y up, z towards the viewer.
// Coordinates are doubled integers so they stay whole for any N: along a face the sticker at col c sits at
// 2c-(N-1), and on the outer plane at ±(N-1). Layer l (0..N-1) is the plane at 2l-(N-1).
// A layer turn is a true 3D rotation, so orientation can never go wrong:
//   dir +1 = +90° by the right-hand rule about +axis (anticlockwise seen from the positive end),
//   dir -1 = -90°, dir 2 = 180°; layer l turns the stickers whose coordinate on the axis is 2l-(N-1).
// For N=3 this is the 001 geometry scaled by two; tests/fixtures/cube-golden.json checks it against
// the original game's own turn logic.

import type { Axis, Cell, CubeHint, CubeMove, CubeRotate, GameConfig, HintSet, Legality, Mark, Move, RotateDir, StateBase, Status } from "./types.ts";
import { OK, cellOf, other, refuse } from "./types.ts";
import { hashString } from "./seed.ts";
import { lines as windows } from "./classic.ts";

export const FACES = ["U", "D", "F", "B", "L", "R"] as const;

export type Phase = "place" | "rotate";

export interface CubeState extends StateBase {
  /** 6·N² stickers; 0 empty, 1 X, 2 O */
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

function geometry(size: number, face: number, row: number, col: number): { p: Vec; n: Vec } {
  const m = size - 1;
  const c = 2 * col - m;
  const r = 2 * row - m;
  switch (face) {
    case 0: return { p: [c, m, r], n: [0, 1, 0] };
    case 1: return { p: [c, -m, -r], n: [0, -1, 0] };
    case 2: return { p: [c, -r, m], n: [0, 0, 1] };
    case 3: return { p: [-c, -r, -m], n: [0, 0, -1] };
    case 4: return { p: [-m, -r, c], n: [-1, 0, 0] };
    default: return { p: [m, -r, -c], n: [1, 0, 0] };
  }
}

interface Geom {
  geom: { p: Vec; n: Vec }[];
  indexOf: Map<string, number>;
}

const geomCache = new Map<number, Geom>();

function geomFor(size: number): Geom {
  const cached = geomCache.get(size);
  if (cached) return cached;
  const n2 = size * size;
  const geom = Array.from({ length: 6 * n2 }, (_, i) => geometry(size, Math.floor(i / n2), Math.floor((i % n2) / size), i % size));
  const indexOf = new Map(geom.map((g, i) => [`${g.p.join(",")}|${g.n.join(",")}`, i]));
  const made = { geom, indexOf };
  geomCache.set(size, made);
  return made;
}

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
export function rotateTable(size: number, axis: Axis, layer: number, dir: RotateDir): number[] {
  const key = `${size}${axis}${layer}${dir}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  const quarters = dir === 1 ? 1 : dir === -1 ? 3 : 2;
  const a = AXIS_INDEX[axis];
  const { geom, indexOf } = geomFor(size);
  const plane = 2 * layer - (size - 1);
  const table = Array.from({ length: geom.length }, (_, i) => i);
  geom.forEach(({ p, n }, src) => {
    if (p[a] !== plane) return;
    const dst = indexOf.get(`${turned(p, axis, quarters).join(",")}|${turned(n, axis, quarters).join(",")}`)!;
    table[dst] = src;
  });
  tableCache.set(key, table);
  return table;
}

export function rotateStickers<T>(stickers: readonly T[], size: number, axis: Axis, layer: number, dir: RotateDir): T[] {
  const table = rotateTable(size, axis, layer, dir);
  return table.map((src) => stickers[src]!);
}

/** The stickers a layer turn carries: an outer layer is a ring plus its whole face; an inner layer is the ring only. */
export function layerStickers(size: number, axis: Axis, layer: number): number[] {
  const a = AXIS_INDEX[axis];
  const plane = 2 * layer - (size - 1);
  return geomFor(size).geom.flatMap((g, i) => (g.p[a] === plane ? [i] : []));
}

/** The 9N turns: 3 axes × N layers × {quarter, quarter back, half}. */
export function rotations(size: number): CubeRotate[] {
  const out: CubeRotate[] = [];
  for (const axis of AXES) for (let layer = 0; layer < size; layer++) for (const dir of DIRS) out.push({ t: "rotate", axis, layer, dir });
  return out;
}

export interface CubeLine {
  face: number;
  cells: number[];
  owner: Mark;
}

/** Every line on the cube, with its owner: one per window of exactly winLength cells held by one player. */
export function cubeLines(stickers: readonly Cell[], size: number, winLength: number): CubeLine[] {
  const out: CubeLine[] = [];
  const n2 = size * size;
  const faceLines = windows(size, winLength);
  for (let face = 0; face < 6; face++) {
    for (const cells of faceLines) {
      const v = stickers[face * n2 + cells[0]!]!;
      if (v !== 0 && cells.every((c) => stickers[face * n2 + c] === v)) out.push({ face, cells, owner: v === 1 ? "X" : "O" });
    }
  }
  return out;
}

export function countLines(stickers: readonly Cell[], size: number, winLength: number): { X: number; O: number } {
  const count = { X: 0, O: 0 };
  for (const line of cubeLines(stickers, size, winLength)) count[line.owner]++;
  return count;
}

export function newGame(config: GameConfig): CubeState {
  const total = 6 * config.size * config.size;
  return {
    config,
    moves: [],
    toMove: "X",
    status: "playing",
    winner: null,
    stickers: Array<Cell>(total).fill(0),
    phase: "place",
    lines: { X: 0, O: 0 },
    empty: total,
    pendingRotateFor: null,
  };
}

export function status(state: CubeState): { status: Status; winner: Mark | null } {
  return { status: state.status, winner: state.winner };
}

function isRotate(move: Move): move is CubeRotate {
  const m = move as CubeRotate;
  return m.t === "rotate" && AXES.includes(m.axis) && typeof m.layer === "number" && DIRS.includes(m.dir);
}

function isPlace(move: Move): move is Extract<CubeMove, { t: "place" }> {
  const m = move as { t: string; face?: unknown; cell?: unknown };
  return m.t === "place" && typeof m.face === "number" && typeof m.cell === "number";
}

export function isLegal(state: CubeState, move: Move): Legality {
  const { size } = state.config;
  const n2 = size * size;
  if (!isRotate(move) && !isPlace(move)) return refuse("invalid-move");
  if (state.status !== "playing") return refuse("game-over");
  if (isPlace(move)) {
    if (state.phase === "rotate") return refuse("rotate-pending");
    const { face, cell } = move;
    if (!Number.isInteger(face) || face < 0 || face > 5 || !Number.isInteger(cell) || cell < 0 || cell >= n2) return refuse("out-of-range");
    if (state.stickers[face * n2 + cell] !== 0) return refuse("occupied");
    return OK;
  }
  if (state.phase !== "rotate") return refuse("no-rotation-due");
  if (!Number.isInteger(move.layer) || move.layer < 0 || move.layer >= size) return refuse("out-of-range");
  return OK;
}

export function legalMoves(state: CubeState): CubeMove[] {
  if (state.status !== "playing") return [];
  if (state.phase === "rotate") return rotations(state.config.size);
  const n2 = state.config.size * state.config.size;
  const out: CubeMove[] = [];
  state.stickers.forEach((v, i) => {
    if (v === 0) out.push({ t: "place", face: Math.floor(i / n2), cell: i % n2 });
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
  const { size, winLength } = state.config;
  const moves = [...state.moves, move];
  if (isPlace(move)) {
    const stickers = state.stickers.slice();
    stickers[move.face * size * size + move.cell] = cellOf(state.toMove);
    const lines = countLines(stickers, size, winLength);
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
  const stickers = rotateStickers(state.stickers, size, rotation.axis, rotation.layer, rotation.dir);
  return settle({
    ...state,
    moves,
    stickers,
    lines: countLines(stickers, size, winLength),
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
  const { size, winLength } = state.config;
  const n2 = size * size;
  const faceLines = windows(size, winLength);
  const mine = cellOf(mark);
  const theirs = cellOf(other(mark));
  state.stickers.forEach((value, i) => {
    if (value !== 0) return;
    const face = Math.floor(i / n2);
    const cell = i % n2;
    const completes = (who: Cell) =>
      faceLines.some((line) => line.includes(cell) && line.every((c) => c === cell || state.stickers[face * n2 + c] === who));
    if (completes(mine)) out.win.push({ face, cell });
    if (completes(theirs)) out.block.push({ face, cell });
  });
  return out;
}
