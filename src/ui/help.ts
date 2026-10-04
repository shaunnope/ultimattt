// The help page: static text from help-content.ts in a centred column, with a Back control. It is loaded only when
// the player opens it (hash route #/help, see app.ts) and is part of the precache, so it works offline. Examples are
// drawn with the same mark renderer as the boards, so they follow light and dark, and each carries a text alternative.

import { HELP_SECTIONS, type HelpBlock, type HelpBoard, type HelpSection } from "./help-content.ts";
import { createMark } from "./mark.ts";
import { icon } from "./icons.ts";
import { h } from "./ui.ts";

function drawBoard(board: HelpBoard): HTMLElement {
  const columns = board.rows[0]!.length;
  const grid = h("div", { class: "help-board", "aria-hidden": "true", style: `--cols:${columns}` });
  const marked = new Set((board.mark ?? []).map(([r, c]) => `${r},${c}`));
  board.rows.forEach((row, r) => {
    [...row].forEach((value, c) => {
      const cell = h("span", { class: "help-cell", ...(marked.has(`${r},${c}`) ? { "data-point": "true" } : {}) });
      if (value === "X" || value === "O") cell.append(createMark(value));
      grid.append(cell);
    });
  });
  return h("figure", { class: "help-board-figure" }, grid, board.label ? h("figcaption", null, board.label) : null);
}

function drawBlock(block: HelpBlock): HTMLElement {
  if (block.kind === "paragraph") return h("p", null, block.text);
  if (block.kind === "steps") return h("ol", { class: "help-steps" }, ...block.items.map((item) => h("li", null, item)));
  return h("div", { class: "help-example", role: "img", "aria-label": `${block.title}. ${block.alt}` },
    h("p", { class: "help-example-title", "aria-hidden": "true" }, block.title),
    h("div", { class: "help-boards" }, ...block.boards.map(drawBoard)));
}

function drawSection(section: HelpSection): HTMLElement {
  return h("section", { class: "help-section", "aria-labelledby": `help-${section.id}` },
    h("h2", { id: `help-${section.id}` }, section.title),
    ...section.blocks.map(drawBlock));
}

export interface HelpOptions {
  /** Go back to the screen the player came from */
  onBack(): void;
}

/** Draw the help page into `container`. */
export function renderHelp(container: HTMLElement, opts: HelpOptions): void {
  const back = h("button", { type: "button", class: "btn", id: "help-back" }, icon("back"), " Back");
  back.addEventListener("click", () => opts.onBack());
  container.replaceChildren(
    h("article", { class: "help", "aria-label": "Help" },
      h("div", { class: "help-top" }, back),
      ...HELP_SECTIONS.map(drawSection),
      h("div", { class: "help-top" }, h("button", { type: "button", class: "btn", onclick: () => opts.onBack() }, "Back to the game"))),
  );
}
