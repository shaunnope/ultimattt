// The Ultimate board: nine small boards in a 3×3 grid. The board(s) you may play are outlined
// (a dashed outline, not just a colour) and named in the status line; claimed boards show
// their owner as a large letter. Arrow keys move across all 81 cells with one tab stop.

import type { Cell, HintSet, Mark, Move, UltimateHint } from "../core/types.ts";
import { markOf } from "../core/types.ts";
import type { UltimateState } from "../core/ultimate.ts";
import { playable } from "../core/ultimate.ts";
import { markGlyph } from "./glyph.ts";
import { h } from "./ui.ts";

const NAMES = ["top left", "top middle", "top right", "middle left", "centre", "middle right", "bottom left", "bottom middle", "bottom right"];

export const boardName = (board: number): string => `${NAMES[board]} board`;

/** Where the next player must play, in words. */
export function whereToPlay(state: UltimateState): string {
  const open = playable(state);
  if (open.length === 0) return "";
  if (state.forced === null) return "Play in any open board.";
  return `Play in the ${boardName(state.forced)}.`;
}

export interface UltimateBoardOptions {
  onMove(move: Move): void;
  glyph?: (mark: Mark) => string;
}

export interface UltimateBoardView {
  element: HTMLElement;
  update(state: UltimateState): void;
  setHints(hints: HintSet<UltimateHint>): void;
}

/** Position of a cell in the 9×9 layout. */
const globalRow = (board: number, cell: number) => Math.floor(board / 3) * 3 + Math.floor(cell / 3);
const globalCol = (board: number, cell: number) => (board % 3) * 3 + (cell % 3);
const fromGlobal = (row: number, col: number) => ({ board: Math.floor(row / 3) * 3 + Math.floor(col / 3), cell: (row % 3) * 3 + (col % 3) });

export function createUltimateBoard(opts: UltimateBoardOptions): UltimateBoardView {
  const glyph = opts.glyph ?? markGlyph;
  const buttons = new Map<string, HTMLButtonElement>();
  const subs: HTMLElement[] = [];
  const overlays: HTMLElement[] = [];
  let previous: Cell[][] = Array.from({ length: 9 }, () => Array<Cell>(9).fill(0));
  let tab = { board: 0, cell: 0 };

  const key = (b: number, c: number) => `${b}:${c}`;
  const setTab = (b: number, c: number) => {
    tab = { board: b, cell: c };
    for (const [k, btn] of buttons) btn.setAttribute("tabindex", k === key(b, c) ? "0" : "-1");
  };

  const describe = (b: number, c: number, value: Cell) =>
    `${boardName(b)}, row ${Math.floor(c / 3) + 1}, column ${(c % 3) + 1}, ${value === 0 ? "empty" : glyph(markOf(value))}`;

  const grid = h("div", { class: "board ultimate", role: "group", "aria-label": "Ultimate tic tac toe board" });
  for (let b = 0; b < 9; b++) {
    const sub = h("div", { class: "sub-board", role: "group", "data-board": b, "aria-label": boardName(b) });
    const inner = h("div", { class: "sub-grid" });
    for (let c = 0; c < 9; c++) {
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
        const row = Math.min(8, Math.max(0, globalRow(b, c) + d[0]));
        const col = Math.min(8, Math.max(0, globalCol(b, c) + d[1]));
        const next = fromGlobal(row, col);
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

  const element = h("div", { class: "board-wrap" }, grid);

  return {
    element,
    setHints(hints) {
      buttons.forEach((b) => b.removeAttribute("data-hint"));
      for (const h of hints.block) buttons.get(key(h.board, h.cell))?.setAttribute("data-hint", "block");
      for (const h of hints.win) buttons.get(key(h.board, h.cell))?.setAttribute("data-hint", "win");
    },
    update(state) {
      const open = new Set(playable(state));
      const last = state.moves.length ? (state.moves[state.moves.length - 1] as { board: number; cell: number }) : null;
      for (let b = 0; b < 9; b++) {
        const claim = state.claims[b]!;
        const sub = subs[b]!;
        const label = claim === 1 || claim === 2 ? `${boardName(b)}, won by ${glyph(markOf(claim))}` : claim === 3 ? `${boardName(b)}, full, nobody won` : open.has(b) ? `${boardName(b)}, playable` : boardName(b);
        sub.setAttribute("aria-label", label);
        sub.dataset.playable = String(open.has(b));
        sub.dataset.claim = claim === 1 ? "X" : claim === 2 ? "O" : claim === 3 ? "tie" : "";
        const overlay = overlays[b]!;
        overlay.textContent = claim === 1 || claim === 2 ? glyph(markOf(claim)) : claim === 3 ? "tie" : "";
        overlay.className = `claim-overlay${claim === 1 ? " mark-x" : claim === 2 ? " mark-o" : ""}`;
        if (state.winLine?.includes(b)) sub.dataset.win = "true";
        else delete sub.dataset.win;
        for (let c = 0; c < 9; c++) {
          const btn = buttons.get(key(b, c))!;
          const value = state.boards[b]![c]!;
          if (value === 0) btn.replaceChildren();
          else if (previous[b]![c] !== value) {
            const fresh = previous[b]![c] === 0;
            btn.replaceChildren(h("span", { class: `mark mark-${markOf(value).toLowerCase()}${fresh ? " mark-new" : ""}`, "aria-hidden": "true" }, glyph(markOf(value))));
          }
          btn.setAttribute("aria-label", describe(b, c, value));
          btn.dataset.mark = value === 0 ? "" : markOf(value);
          btn.toggleAttribute("data-last", last !== null && last.board === b && last.cell === c);
        }
      }
      previous = state.boards.map((cells) => cells.slice());
      setTab(tab.board, tab.cell);
    },
  };
}
