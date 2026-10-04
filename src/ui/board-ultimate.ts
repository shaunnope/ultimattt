// The Ultimate board: N×N small boards in an N×N grid (N = 3 to 5). The board(s) you may play are outlined
// (a dashed outline, not just a colour) and named in the status line; claimed boards show
// their owner as a large mark. Arrow keys move across all N⁴ cells with one tab stop.

import type { Cell, HintSet, Move, UltimateHint } from "../core/types.ts";
import { markOf } from "../core/types.ts";
import type { UltimateState } from "../core/ultimate.ts";
import { playable } from "../core/ultimate.ts";
import { createMark, markName } from "./mark.ts";
import { h } from "./ui.ts";

const NAMES = ["top left", "top middle", "top right", "middle left", "centre", "middle right", "bottom left", "bottom middle", "bottom right"];

/** A small board's name. 3×3 uses compass words; larger grids use row and column. */
export const boardName = (board: number, size = 3): string =>
  size === 3 ? `${NAMES[board]} board` : `row ${Math.floor(board / size) + 1}, column ${(board % size) + 1} board`;

/** Where the next player must play, in words. */
export function whereToPlay(state: UltimateState): string {
  const open = playable(state);
  if (open.length === 0) return "";
  if (state.forced === null) return "Play in any open board.";
  return `Play in the ${boardName(state.forced, state.config.size)}.`;
}

export interface UltimateBoardOptions {
  size: number;
  onMove(move: Move): void;
}

export interface UltimateBoardView {
  element: HTMLElement;
  update(state: UltimateState): void;
  setHints(hints: HintSet<UltimateHint>): void;
}

/** A cell's row and column in the N²×N² layout, and back. */
export const cellPosition = {
  toGlobal(board: number, cell: number, n: number): { row: number; col: number } {
    return { row: Math.floor(board / n) * n + Math.floor(cell / n), col: (board % n) * n + (cell % n) };
  },
  fromGlobal(row: number, col: number, n: number): { board: number; cell: number } {
    return { board: Math.floor(row / n) * n + Math.floor(col / n), cell: (row % n) * n + (col % n) };
  },
};

export function createUltimateBoard(opts: UltimateBoardOptions): UltimateBoardView {
  const n = opts.size;
  const n2 = n * n;
  const buttons = new Map<string, HTMLButtonElement>();
  const subs: HTMLElement[] = [];
  const overlays: HTMLElement[] = [];
  let previous: Cell[][] = Array.from({ length: n2 }, () => Array<Cell>(n2).fill(0));
  let tab = { board: 0, cell: 0 };
  /** The first position drawn (a game picked up again) shows its marks in place; only a mark placed after that draws itself in. */
  let drawn = false;

  const key = (b: number, c: number) => `${b}:${c}`;
  const setTab = (b: number, c: number) => {
    tab = { board: b, cell: c };
    for (const [k, btn] of buttons) btn.setAttribute("tabindex", k === key(b, c) ? "0" : "-1");
  };

  const describe = (b: number, c: number, value: Cell) =>
    `${boardName(b, n)}, row ${Math.floor(c / n) + 1}, column ${(c % n) + 1}, ${value === 0 ? "empty" : markName(markOf(value))}`;

  const grid = h("div", { class: "board ultimate", role: "group", "aria-label": "Ultimate tic tac toe board", style: `--n:${n}` });
  for (let b = 0; b < n2; b++) {
    const sub = h("div", { class: "sub-board", role: "group", "data-board": b, "aria-label": boardName(b, n) });
    const inner = h("div", { class: "sub-grid" });
    for (let c = 0; c < n2; c++) {
      const button = h("button", { type: "button", class: "cell", "data-board": b, "data-cell": c, "aria-label": describe(b, c, 0), tabindex: b === 0 && c === 0 ? 0 : -1 });
      button.addEventListener("click", () => {
        setTab(b, c);
        opts.onMove({ t: "place", board: b, cell: c });
      });
      button.addEventListener("keydown", (e) => {
        const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        const d = delta[e.key];
        if (!d) return;
        e.preventDefault();
        const here = cellPosition.toGlobal(b, c, n);
        const row = Math.min(n2 - 1, Math.max(0, here.row + d[0]));
        const col = Math.min(n2 - 1, Math.max(0, here.col + d[1]));
        const next = cellPosition.fromGlobal(row, col, n);
        setTab(next.board, next.cell);
        buttons.get(key(next.board, next.cell))?.focus();
      });
      buttons.set(key(b, c), button);
      inner.append(button);
    }
    const overlay = h("div", { class: "claim-overlay", "aria-hidden": "true" });
    sub.append(inner, overlay);
    subs.push(sub);
    overlays.push(overlay);
    grid.append(sub);
  }

  const element = h("div", { class: "board-wrap board-wrap-ultimate", style: `--n:${n}` }, grid);

  return {
    element,
    setHints(hints) {
      buttons.forEach((b) => b.removeAttribute("data-hint"));
      for (const hint of hints.block) buttons.get(key(hint.board, hint.cell))?.setAttribute("data-hint", "block");
      for (const hint of hints.win) buttons.get(key(hint.board, hint.cell))?.setAttribute("data-hint", "win");
    },
    update(state) {
      const open = new Set(playable(state));
      const last = state.moves.length ? (state.moves[state.moves.length - 1] as { board: number; cell: number }) : null;
      for (let b = 0; b < n2; b++) {
        const claim = state.claims[b]!;
        const sub = subs[b]!;
        const name = boardName(b, n);
        const label = claim === 1 || claim === 2 ? `${name}, won by ${markName(markOf(claim))}` : claim === 3 ? `${name}, full, nobody won` : open.has(b) ? `${name}, playable` : name;
        sub.setAttribute("aria-label", label);
        sub.dataset.playable = String(open.has(b));
        sub.dataset.claim = claim === 1 ? "X" : claim === 2 ? "O" : claim === 3 ? "tie" : "";
        const overlay = overlays[b]!;
        if (claim === 1 || claim === 2) overlay.replaceChildren(createMark(markOf(claim)));
        else overlay.textContent = claim === 3 ? "tie" : "";
        overlay.className = `claim-overlay${claim === 1 ? " mark-x" : claim === 2 ? " mark-o" : ""}`;
        if (state.winLine?.includes(b)) sub.dataset.win = "true";
        else delete sub.dataset.win;
        for (let c = 0; c < n2; c++) {
          const btn = buttons.get(key(b, c))!;
          const value = state.boards[b]![c]!;
          if (value === 0) btn.replaceChildren();
          else if (previous[b]![c] !== value) {
            const fresh = drawn && previous[b]![c] === 0;
            btn.replaceChildren(createMark(markOf(value), { fresh }));
          }
          btn.setAttribute("aria-label", describe(b, c, value));
          btn.dataset.mark = value === 0 ? "" : markOf(value);
          btn.toggleAttribute("data-last", last !== null && last.board === b && last.cell === c);
        }
      }
      previous = state.boards.map((cells) => cells.slice());
      drawn = true;
      setTab(tab.board, tab.cell);
    },
  };
}
