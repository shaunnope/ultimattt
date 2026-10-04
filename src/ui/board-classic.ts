// The Classic board: a grid of buttons. Arrow keys move between cells (one tab stop),
// Enter or Space places a mark, marks animate in, and a winning line is outlined and struck through.

import type { Cell, ClassicHint, HintSet } from "../core/types.ts";
import { markOf } from "../core/types.ts";
import type { ClassicState } from "../core/classic.ts";
import { createMark, markName } from "./mark.ts";
import { h } from "./ui.ts";

export interface BoardOptions {
  size: number;
  onCell(cell: number): void;
}

export interface ClassicBoardView {
  element: HTMLElement;
  update(state: ClassicState): void;
  /** Point out winning cells (a dot) and cells to block (a dashed ring). */
  setHints(hints: HintSet<ClassicHint>): void;
  focusCell(cell: number): void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export function createClassicBoard(opts: BoardOptions): ClassicBoardView {
  const { size } = opts;
  const buttons: HTMLButtonElement[] = [];
  let tabCell = 0;
  let previous: Cell[] = Array<Cell>(size * size).fill(0);
  /** The first position drawn (a game picked up again) shows its marks in place; only a mark placed after that draws itself in. */
  let drawn = false;

  const grid = h("div", { class: "board", role: "grid", "aria-label": `Tic tac toe board, ${size} by ${size}`, style: `--n:${size}` });

  function describe(cell: number, value: Cell): string {
    const where = `Row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}`;
    return `${where}, ${value === 0 ? "empty" : markName(markOf(value))}`;
  }

  function setTab(cell: number): void {
    tabCell = cell;
    buttons.forEach((b, i) => b.setAttribute("tabindex", i === cell ? "0" : "-1"));
  }

  for (let r = 0; r < size; r++) {
    const row = h("div", { role: "row", class: "board-row" });
    for (let c = 0; c < size; c++) {
      const cell = r * size + c;
      const button = h("button", { type: "button", class: "cell", "data-cell": cell, "aria-label": describe(cell, 0), tabindex: cell === 0 ? 0 : -1 });
      button.addEventListener("click", () => {
        setTab(cell);
        opts.onCell(cell);
      });
      button.addEventListener("keydown", (e) => {
        const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
        const d = delta[e.key];
        if (!d) return;
        e.preventDefault();
        const nr = Math.min(size - 1, Math.max(0, r + d[0]));
        const nc = Math.min(size - 1, Math.max(0, c + d[1]));
        view.focusCell(nr * size + nc);
      });
      buttons.push(button);
      row.append(h("div", { role: "gridcell", class: "board-cell" }, button));
    }
    grid.append(row);
  }

  const strike = document.createElementNS(SVG_NS, "svg");
  strike.setAttribute("class", "win-line");
  strike.setAttribute("viewBox", "0 0 100 100");
  strike.setAttribute("preserveAspectRatio", "none");
  strike.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(SVG_NS, "line");
  strike.append(line);

  const element = h("div", { class: "board-wrap" }, grid, strike);

  const view: ClassicBoardView = {
    element,
    focusCell(cell) {
      setTab(cell);
      buttons[cell]?.focus();
    },
    setHints(hints) {
      buttons.forEach((b) => b.removeAttribute("data-hint"));
      for (const h of hints.block) buttons[h.cell]?.setAttribute("data-hint", "block");
      for (const h of hints.win) buttons[h.cell]?.setAttribute("data-hint", "win");
    },
    update(state) {
      const winCells = new Set(state.winLine ?? []);
      const last = state.moves.length ? (state.moves[state.moves.length - 1] as { cell: number }).cell : -1;
      state.cells.forEach((value, i) => {
        const button = buttons[i]!;
        const fresh = drawn && value !== 0 && previous[i] === 0;
        if (value === 0) {
          button.replaceChildren();
        } else if (previous[i] !== value) {
          button.replaceChildren(createMark(markOf(value), { fresh }));
        }
        button.setAttribute("aria-label", describe(i, value));
        button.dataset.mark = value === 0 ? "" : markOf(value);
        button.toggleAttribute("data-last", i === last);
        if (winCells.has(i)) button.dataset.win = "true";
        else delete button.dataset.win;
      });
      previous = state.cells.slice();
      drawn = true;
      const first = state.winLine?.[0];
      const lastWin = state.winLine?.[state.winLine.length - 1];
      if (first !== undefined && lastWin !== undefined) {
        const at = (i: number) => [((i % size) + 0.5) / size * 100, (Math.floor(i / size) + 0.5) / size * 100] as const;
        const [x1, y1] = at(first);
        const [x2, y2] = at(lastWin);
        line.setAttribute("x1", String(x1));
        line.setAttribute("y1", String(y1));
        line.setAttribute("x2", String(x2));
        line.setAttribute("y2", String(y2));
        strike.classList.add("show");
      } else {
        strike.classList.remove("show");
      }
      setTab(tabCell);
    },
  };
  return view;
}
