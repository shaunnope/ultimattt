// The start screen: pick a variant, a board size and win length, an opponent and options, then start.
// Against the computer a seed can be pasted: it decides the variant, size and win length, and the game uses that seed.
// Only games with a computer have a seed at all, so no other game shows a seed field.

import type { GameConfig, Level, Mark, Mode, Variant } from "../core/types.ts";
import { newSeed, parseSeed, pickMark, randomMark } from "../core/seed.ts";
import { clampWinLength, defaultWinLength, winLengthOptions } from "../core/rules.ts";
import { isValidCode, normaliseCode } from "../core/pairing.ts";
import type { SetupChoice } from "../core/settings.ts";
import { loadSave, updateSettings } from "../adapters/store.ts";
import { h } from "./ui.ts";

export const LEVEL_NAMES: Record<Level, string> = {
  1: "Beginner",
  2: "Casual",
  3: "Steady",
  4: "Sharp",
  5: "Master",
};

/** The header's logo, copied for the start screen so the artwork lives in one place (index.html). Decorative. */
function startLogo(): HTMLElement[] {
  const logo = typeof document === "undefined" ? null : document.querySelector(".app-header .app-logo");
  return logo ? [h("div", { class: "start-logo", "aria-hidden": "true" }, logo.cloneNode(true))] : [];
}

export type SetupState = SetupChoice;

export const DEFAULT_SETUP: SetupState = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 3, markChoice: "random" };

const VARIANTS: { value: Variant; title: string; blurb: string }[] = [
  { value: "classic", title: "Classic", blurb: "One board; get a line in a row" },
  { value: "ultimate", title: "Ultimate", blurb: "Boards within boards; your move picks their board" },
  { value: "cube", title: "Twist", blurb: "Six faces in 3D; score, then turn a layer" },
];

/** Opponents a variant offers. Every variant can be played on one device or on two; the Cube has no computer opponent. */
export function modesFor(variant: Variant): Mode[] {
  return variant === "cube" ? ["local", "network"] : ["computer", "local", "network"];
}

/** What the start screen opens on: the last choices, or the defaults. */
export function initialSetup(saved: SetupChoice | null): SetupState {
  const state: SetupState = { ...(saved ?? DEFAULT_SETUP) };
  const allowed = modesFor(state.variant);
  if (!allowed.includes(state.mode)) state.mode = allowed[0]!;
  state.winLength = clampWinLength(state.variant, state.size, state.winLength);
  return state;
}

/** The win length choice for the chosen size: 3 up to the size, and fixed (no real choice) on a 3×3 board. */
export function winLengthChoice(state: SetupState): { options: number[]; fixed: boolean; value: number } {
  return { options: winLengthOptions(state.size), fixed: state.size === 3, value: clampWinLength(state.variant, state.size, state.winLength) };
}

/** A new board size always sets that size's default win length, in every variant. The same size changes nothing. */
export function chooseSize(state: SetupState, size: 3 | 4 | 5): SetupState {
  if (size === state.size) return state;
  return { ...state, size, winLength: defaultWinLength(size) };
}

/** A new variant keeps the board size and a valid win length, and moves to an opponent the variant offers. */
export function chooseVariant(state: SetupState, variant: Variant): SetupState {
  const allowed = modesFor(variant);
  return { ...state, variant, mode: allowed.includes(state.mode) ? state.mode : allowed[0]!, winLength: clampWinLength(variant, state.size, state.winLength) };
}

/** The start screen's choices plus the seed text typed so far (null when there is none). */
export interface SetupForm {
  choice: SetupState;
  seed: string | null;
}

/** Only a game against the computer has a seed. */
export const seedControlsVisible = (state: SetupState): boolean => state.mode === "computer" && state.variant !== "cube";

/** Choosing another opponent: leaving the computer discards any typed seed, and coming back starts with an empty field. */
export function chooseMode(form: SetupForm, mode: Mode): SetupForm {
  const choice = { ...form.choice, mode };
  return { choice, seed: seedControlsVisible(choice) ? form.seed : null };
}

/** Turn the choices into a game config. A seed is made (or the given one used) only for a computer game. */
export function configFromSetup(state: SetupState, seed?: string): GameConfig {
  const mode = modesFor(state.variant).includes(state.mode) ? state.mode : modesFor(state.variant)[0]!;
  const winLength = clampWinLength(state.variant, state.size, state.winLength);
  const cube = state.variant === "cube";
  const config: GameConfig = { variant: state.variant, size: state.size, winLength, scoring: cube ? state.scoring : "lines", lockFaces: cube && state.lockFaces, mode };
  if (mode === "computer") {
    const gameSeed = seed ?? newSeed(state.variant, state.size, winLength);
    config.seed = gameSeed;
    config.level = state.level;
    config.humanMark = state.markChoice === "random" ? pickMark(gameSeed) : state.markChoice;
  } else if (mode === "network") {
    // In a two-device game the host picks a mark (or one is drawn now); the guest takes the other one.
    config.humanMark = state.markChoice === "random" ? randomMark() : state.markChoice;
  }
  return config;
}

/** A seed pasted on the start screen decides the variant, board size and win length (and Cube is never against the computer). */
export function applySeedToSetup(state: SetupState, seed: string): SetupState | { error: string } {
  const parsed = parseSeed(seed);
  if ("error" in parsed) return { error: parsed.error };
  const next: SetupState = { ...state, variant: parsed.variant, size: parsed.size, winLength: parsed.winLength };
  if (!modesFor(parsed.variant).includes(next.mode)) next.mode = modesFor(parsed.variant)[0]!;
  return next;
}

function radioGroup<T extends string | number>(
  name: string,
  legend: string,
  options: { value: T; title: string; blurb?: string }[],
  current: T,
  onChange: (value: T) => void,
): HTMLFieldSetElement {
  const grid = h("div", { class: "choice-grid" });
  for (const opt of options) {
    const id = `${name}-${opt.value}`;
    const input = h("input", { type: "radio", name, id, value: String(opt.value), checked: opt.value === current });
    input.addEventListener("change", () => onChange(opt.value));
    grid.append(h("div", { class: "choice" }, input, h("label", { for: id }, h("strong", null, opt.title), opt.blurb ? h("small", null, opt.blurb) : null)));
  }
  return h("fieldset", { "data-group": name }, h("legend", null, legend), grid);
}

function select(group: HTMLElement, value: string | number): void {
  group.querySelectorAll<HTMLInputElement>("input[type=radio]").forEach((input) => (input.checked = input.value === String(value)));
}

export interface SetupOptions {
  onStart: (config: GameConfig) => void;
  /** Join a friend's game with their code */
  onJoin: (code: string) => void;
  initial?: Partial<SetupState>;
  /** A seed to fill in, as when arriving from a replay link */
  seed?: string;
}

let listeners: AbortController | null = null;

export function renderSetup(container: HTMLElement, opts: SetupOptions): void {
  let state: SetupState = initialSetup({ ...initialSetup(loadSave().save.settings.lastSetup), ...opts.initial });
  listeners?.abort();
  listeners = new AbortController();

  // Joining a friend's game: their code, six characters.
  const joinInput = h("input", { id: "join-code", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", maxlength: 12, placeholder: "BXK4M9", "aria-describedby": "join-error" });
  const joinError = h("p", { id: "join-error", class: "field-error", role: "alert" });
  joinError.hidden = true;
  const joinButton = h("button", { class: "btn", type: "button" }, "Join game");
  const offlineNote = h("p", { class: "hint-text" }, "Playing on two devices needs an internet connection.");
  offlineNote.hidden = true;
  joinButton.addEventListener("click", () => {
    const code = normaliseCode(joinInput.value);
    if (!isValidCode(code)) {
      joinError.textContent = "A game code is six letters and digits, like BXK4M9.";
      joinError.hidden = false;
      joinInput.focus();
      return;
    }
    joinError.hidden = true;
    opts.onJoin(code);
  });
  joinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinButton.click();
  });

  const seedInput = h("input", { id: "seed-input", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "C53-BXK4-M9TR", "aria-describedby": "seed-error" });
  const seedError = h("p", { id: "seed-error", class: "field-error", role: "alert" });
  seedError.hidden = true;
  const showSeedError = (text: string) => {
    seedError.textContent = text;
    seedError.hidden = text === "";
    seedInput.setAttribute("aria-invalid", text === "" ? "false" : "true");
  };
  /** The seed in the box, if it is a good one. */
  let seed: string | null = null;
  const seedCard = h("div", { class: "card", id: "seed-card" },
    h("div", { class: "field" }, h("label", { for: "seed-input" }, "Seed (optional)"), seedInput, seedError));

  const sizeHost = h("div");
  const winHost = h("div");

  // Cube-only rule options. They are kept when another variant is picked, but only a Cube game uses them.
  const lockInput = h("input", { type: "checkbox", id: "opt-lock", "aria-describedby": "opt-lock-hint", checked: state.lockFaces });
  lockInput.addEventListener("change", () => { state.lockFaces = lockInput.checked; });
  const facesInput = h("input", { type: "checkbox", id: "opt-faces", "aria-describedby": "opt-faces-hint", checked: state.scoring === "faces" });
  facesInput.addEventListener("change", () => { state.scoring = facesInput.checked ? "faces" : "lines"; });
  const cubeOptions = h("div", { class: "card", id: "cube-options" },
    h("fieldset", { "data-group": "cube-options" },
      h("legend", null, "Twist rules"),
      h("label", { class: "check", for: "opt-lock" }, lockInput, h("span", null, "Lock scored faces")),
      h("p", { class: "hint-text", id: "opt-lock-hint" }, "A face holding a line takes no more marks, until a turn breaks the line."),
      h("label", { class: "check", for: "opt-faces" }, facesInput, h("span", null, "Count faces, not lines")),
      h("p", { class: "hint-text", id: "opt-faces-hint" }, "Your score is the number of faces holding one of your lines.")));

  const modeHost = h("div");
  const levelSelect = h("select", { id: "level" },
    ...(Object.keys(LEVEL_NAMES) as unknown as Level[]).map((l) =>
      h("option", { value: String(l), selected: Number(l) === state.level }, `${l}. ${LEVEL_NAMES[Number(l) as Level]}`)));
  levelSelect.addEventListener("change", () => { state.level = Number(levelSelect.value) as Level; });
  const levelField = h("div", { class: "field" }, h("label", { for: "level" }, "Computer level"), levelSelect);
  const markGroup = radioGroup<string>("mark", "Your mark", [
    { value: "X", title: "X", blurb: "moves first" },
    { value: "O", title: "O", blurb: "moves second" },
    { value: "random", title: "Let the game decide" },
  ], state.markChoice, (v) => { state.markChoice = v as SetupState["markChoice"]; });

  function renderSize(): void {
    sizeHost.replaceChildren(radioGroup<number>("size", "Board", [
      { value: 3, title: "3×3" },
      { value: 4, title: "4×4" },
      { value: 5, title: "5×5" },
    ], state.size, (v) => {
      state = chooseSize(state, v as 3 | 4 | 5);
      clearSeed();
      renderWinLength();
    }));
  }

  function renderWinLength(): void {
    const choice = winLengthChoice(state);
    if (choice.fixed) {
      winHost.replaceChildren(h("div", { class: "field", "data-group": "winlength", "data-fixed": "true" },
        h("span", { class: "field-label" }, "Win length"),
        h("p", { id: "win-fixed", class: "fixed-value" }, "3 in a row (fixed on 3×3)")));
      return;
    }
    winHost.replaceChildren(radioGroup<number>("winlength", "Win length", choice.options.map((n) => ({ value: n, title: String(n), blurb: "in a row" })), choice.value, (v) => {
      state.winLength = v;
      clearSeed();
    }));
  }

  function renderModes(): void {
    const allowed = modesFor(state.variant);
    if (!allowed.includes(state.mode)) state.mode = allowed[0]!;
    const group = radioGroup<string>("mode", "Opponent", [
      ...(allowed.includes("computer") ? [{ value: "computer", title: "Computer" }] : []),
      { value: "local", title: "A friend on this device" },
      { value: "network", title: "A friend on another device" },
    ], state.mode, (v) => {
      const form = chooseMode({ choice: state, seed }, v as Mode);
      state = form.choice;
      if (form.seed === null && seedInput.value !== "") clearSeed();
      sync();
    });
    modeHost.replaceChildren(group);
    if (state.variant === "cube") modeHost.append(h("p", { class: "hint-text" }, "Twist is for two players."));
    applyOnline();
  }

  function sync(): void {
    const vsComputer = state.mode === "computer";
    levelField.hidden = !vsComputer;
    markGroup.hidden = state.mode === "local";
    seedCard.hidden = !seedControlsVisible(state);
    cubeOptions.hidden = state.variant !== "cube";
    if (seedCard.hidden) clearSeed();
    start.textContent = state.mode === "network" ? "Host game" : "Start game";
  }

  /** Two-device play needs the internet to introduce the devices; everything else works without it. */
  function applyOnline(): void {
    const online = typeof navigator === "undefined" || navigator.onLine !== false;
    modeHost.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((input) => {
      if (input.value === "network") input.disabled = !online;
    });
    if (!online && state.mode === "network") {
      state.mode = modesFor(state.variant)[0]!;
      select(modeHost, state.mode);
      sync();
    }
    joinInput.disabled = !online;
    joinButton.disabled = !online;
    offlineNote.hidden = online;
  }

  function clearSeed(): void {
    seed = null;
    if (seedInput.value !== "") seedInput.value = "";
    showSeedError("");
  }

  const variantGroup = radioGroup<string>("variant", "Game", VARIANTS.map((v) => ({ value: v.value, title: v.title, blurb: v.blurb })), state.variant, (v) => {
    state = chooseVariant(state, v as Variant);
    clearSeed();
    renderModes();
    renderWinLength();
    sync();
  });

  /** Take a seed from the box: a good one sets the variant, board and win length; a bad one is explained. */
  function readSeed(text: string): void {
    if (text.trim() === "") {
      seed = null;
      showSeedError("");
      return;
    }
    const applied = applySeedToSetup(state, text);
    if ("error" in applied) {
      seed = null;
      showSeedError(applied.error);
      return;
    }
    state = applied;
    seed = text.trim().toUpperCase();
    showSeedError("");
    select(variantGroup, state.variant);
    renderSize();
    renderWinLength();
    renderModes();
    sync();
  }
  seedInput.addEventListener("input", () => readSeed(seedInput.value));

  const start = h("button", { class: "btn btn-primary", type: "button" }, "Start game");
  start.addEventListener("click", () => {
    if (seedInput.value.trim() !== "" && seed === null) {
      readSeed(seedInput.value);
      seedInput.focus();
      return;
    }
    updateSettings({ lastSetup: { ...state, winLength: winLengthChoice(state).value } });
    opts.onStart(configFromSetup(state, state.mode === "computer" ? (seed ?? undefined) : undefined));
  });

  renderModes();
  renderSize();
  renderWinLength();
  sync();
  container.replaceChildren(
    h("section", { class: "screen", "aria-labelledby": "setup-title" },
      h("h2", { id: "setup-title", class: "sr-only" }, "New game"),
      ...startLogo(),
      h("div", { class: "card" }, variantGroup),
      h("div", { class: "card" }, sizeHost, winHost),
      h("div", { class: "card" }, modeHost, levelField, markGroup),
      cubeOptions,
      seedCard,
      h("div", { class: "btn-row" }, start),
      h("div", { class: "card" },
        h("div", { class: "field" }, h("label", { for: "join-code" }, "Game code"), joinInput, joinError,
          h("p", { class: "hint-text" }, "Joining a friend? Type the code from their screen, or scan their QR code."),
          h("div", { class: "btn-row" }, joinButton), offlineNote))),
  );
  window.addEventListener("online", applyOnline, { signal: listeners.signal });
  window.addEventListener("offline", applyOnline, { signal: listeners.signal });
  applyOnline();
  if (opts.seed) {
    seedInput.value = opts.seed;
    readSeed(opts.seed);
  }
}
