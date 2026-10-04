// The replay: a finished game played back on the board, with play and pause, steps, a slider,
// a move list and a speed (remembered). It shows positions the rules produce from the moves; it
// never takes a move, so opening one cannot change anything.

import type { GameConfig, Mark, Move } from "../core/types.ts";
import { other } from "../core/types.ts";
import type { ReplaySpeed } from "../core/settings.ts";
import type { NotationStyle } from "../core/notation.ts";
import { replayFrames } from "../core/replay.ts";
import { variantName } from "../core/variants.ts";
import type { CubeState } from "../core/cube.ts";
import { createBoard } from "./boards.ts";
import { lockEndText, optionsNote } from "./cube-labels.ts";
import { describeMove } from "./replay-text.ts";
import { announce, h } from "./ui.ts";

export interface ReplayOptions {
  config: GameConfig;
  moves: readonly Move[];
  /** Who resigned, if the game ended that way */
  resigned?: Mark;
  speed: ReplaySpeed;
  onSpeed(speed: ReplaySpeed): void;
  /** Start playing from the first move at once */
  autoplay: boolean;
  onClose(): void;
  closeLabel?: string;
  /** How Cube turns are named in the move list. Display only. */
  notation?: NotationStyle;
  /** More buttons beside Close, such as "Play this seed" */
  actions?: HTMLElement[];
}

export interface ReplayHandle {
  destroy(): void;
}

const SPEEDS: ReplaySpeed[] = [0.5, 1, 2, 4];
const STEP_MS = 900;
const MIN_STEP_MS = 160;

export function mountReplay(container: HTMLElement, opts: ReplayOptions): ReplayHandle {
  const { config, moves } = opts;
  const frames = replayFrames(config, moves);
  const total = moves.length;
  let index = opts.autoplay ? 0 : total;
  let speed = opts.speed;
  let playing = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stepMs = () => Math.max(MIN_STEP_MS, STEP_MS / speed);
  const board = createBoard(config, () => undefined, { readOnly: true, notation: opts.notation ?? "words", stepMs });
  const statusEl = h("div", { id: "game-status", class: "status-line" });

  const playButton = h("button", { type: "button", class: "btn", "aria-label": "Play" }, "Play");
  const backButton = h("button", { type: "button", class: "btn", "aria-label": "Step back" }, "◀");
  const forwardButton = h("button", { type: "button", class: "btn", "aria-label": "Step forward" }, "▶");
  const slider = h("input", { type: "range", min: 0, max: total, step: 1, value: index, "aria-label": "Replay position", class: "replay-slider" });
  const speedSelect = h("select", { id: "replay-speed" }, ...SPEEDS.map((s) => h("option", { value: String(s), selected: s === speed }, `${s}×`)));
  const speedField = h("label", { class: "replay-speed" }, "Speed", speedSelect);
  const controls = h("div", { class: "replay-controls", role: "group", "aria-label": "Replay controls" }, playButton, backButton, forwardButton, slider, speedField);

  const list = h("ol", { class: "move-list", "aria-label": "Moves" });
  const items = moves.map((move, i) => {
    const text = describeMove(config, move, frames[i + 1]!.mover!, i + 1, opts.notation ?? "words");
    const button = h("button", { type: "button", class: "move-item", "aria-label": text.name }, text.label);
    button.addEventListener("click", () => {
      pause();
      setIndex(i + 1);
    });
    const item = h("li", null, button);
    list.append(item);
    return item;
  });

  function outcome(): string {
    if (opts.resigned) return ` ${opts.resigned} resigned. ${other(opts.resigned)} wins.`;
    const state = frames[total]!.state;
    const lockNote = config.variant === "cube" ? lockEndText(state as CubeState) : "";
    const note = lockNote ? ` ${lockNote}` : "";
    if (state.status === "won") return ` ${state.winner!} wins!${note}`;
    if (state.status === "draw") return " It's a draw.";
    if (state.status === "tie") return ` It's a tie.${note}`;
    return "";
  }

  function setIndex(i: number): void {
    index = Math.max(0, Math.min(total, i));
    board.update(frames[index]!.state);
    slider.value = String(index);
    items.forEach((item, k) => {
      if (k + 1 === index) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    items[index - 1]?.scrollIntoView?.({ block: "nearest" });
    const text = `Move ${index} of ${total}.${index === total ? outcome() : ""}`;
    statusEl.textContent = text;
    announce(text);
    backButton.disabled = index === 0;
    forwardButton.disabled = index === total;
    renderPlayButton();
  }

  function renderPlayButton(): void {
    const label = playing ? "Pause" : "Play";
    playButton.textContent = label;
    playButton.setAttribute("aria-label", label);
  }

  function schedule(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, stepMs());
  }

  function tick(): void {
    timer = null;
    if (!playing) return;
    if (index >= total) {
      playing = false;
      renderPlayButton();
      return;
    }
    setIndex(index + 1);
    if (index >= total) {
      playing = false;
      renderPlayButton();
    } else schedule();
  }

  function play(): void {
    if (index >= total) setIndex(0);
    playing = true;
    renderPlayButton();
    schedule();
  }

  function pause(): void {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = null;
    renderPlayButton();
  }

  playButton.addEventListener("click", () => (playing ? pause() : play()));
  backButton.addEventListener("click", () => {
    pause();
    setIndex(index - 1);
  });
  forwardButton.addEventListener("click", () => {
    pause();
    setIndex(index + 1);
  });
  slider.addEventListener("input", () => {
    pause();
    setIndex(Number(slider.value));
  });
  speedSelect.addEventListener("change", () => {
    speed = Number(speedSelect.value) as ReplaySpeed;
    opts.onSpeed(speed);
  });

  const close = h("button", { type: "button", class: "btn", onclick: () => opts.onClose() }, opts.closeLabel ?? "Close replay");
  const title = `${variantName(config.variant, "short")} ${config.size}×${config.size}, ${config.winLength} in a row${optionsNote(config)}`;
  container.replaceChildren(
    h("section", { class: "screen replay", "aria-label": "Replay" },
      h("div", { class: "game-head" }, h("span", { class: "game-title" }, "Replay"), h("span", { class: "game-sub", id: "replay-rules" }, config.seed ? `${title}, seed ${config.seed}` : title)),
      statusEl,
      board.element,
      controls,
      list,
      h("div", { class: "game-controls" }, close, ...(opts.actions ?? []))),
  );

  setIndex(index);
  if (opts.autoplay) play();

  return {
    destroy() {
      pause();
    },
  };
}
