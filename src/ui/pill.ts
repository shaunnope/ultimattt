// The current-player pill: two segments, X then O, with the player to move highlighted. In Twist each segment also holds
// that player's score. It is display only (not focusable, not clickable). A highlight slides under the active segment
// with a CSS transform (no slide under reduced motion). What is said aloud goes through the page's live region from the
// caller; the pill itself is not a live region. The model comes from pillModel() in status-text.ts.

import type { Mark } from "../core/types.ts";
import type { PillModel, Segment } from "./status-text.ts";
import { createMark } from "./mark.ts";
import { h } from "./ui.ts";

export interface Pill {
  element: HTMLElement;
  update(model: PillModel): void;
}

interface Parts {
  root: HTMLElement;
  score: HTMLElement | null;
  you: HTMLElement;
  winner: HTMLElement;
}

export function createPill(): Pill {
  const thumb = h("span", { class: "pill-thumb", "aria-hidden": "true" });
  const parts = new Map<Mark, Parts>();
  const segments = (["X", "O"] as const).map((mark) => {
    const you = h("span", { class: "pill-caption pill-you", hidden: true });
    const winner = h("span", { class: "pill-caption pill-winner", hidden: true });
    const root = h("div", { class: "pill-seg", "data-mark": mark }, createMark(mark), you, winner);
    parts.set(mark, { root, score: null, you, winner });
    return root;
  });
  const element = h("div", { id: "turn-pill", class: "turn-pill", role: "group", "aria-label": "Current player", "data-active": "" }, thumb, ...segments);

  function updateSegment(seg: Segment): void {
    const p = parts.get(seg.mark)!;
    if (seg.active) {
      p.root.setAttribute("aria-current", "true");
      p.root.dataset.active = "true";
    } else {
      p.root.removeAttribute("aria-current");
      delete p.root.dataset.active;
    }
    if (seg.winner) p.root.dataset.winner = "true";
    else delete p.root.dataset.winner;
    if (seg.score !== undefined) {
      if (!p.score) {
        p.score = h("span", { class: "pill-score" });
        p.root.insertBefore(p.score, p.you);
      }
      const text = String(seg.score);
      if (p.score.textContent !== text) p.score.textContent = text;
    } else if (p.score) {
      p.score.remove();
      p.score = null;
    }
    // The caption text exists only while shown, so a hidden caption is never read or matched as text.
    p.you.textContent = seg.you ? "You" : "";
    p.you.hidden = !seg.you;
    p.winner.textContent = seg.winner ? "Winner" : "";
    p.winner.hidden = !seg.winner;
  }

  return {
    element,
    update(model) {
      for (const seg of model.segments) updateSegment(seg);
      const active = model.segments.find((s) => s.active)?.mark ?? "";
      if (element.dataset.active !== active) element.dataset.active = active;
    },
  };
}
