// The start screen: pick a variant, an opponent and options, then start.
// A seed pasted into the seed box decides the variant and board size, and the game uses that seed.

import type { GameConfig, Level, Mark, Mode, Variant } from "../core/types.ts";
import { newSeed, parseSeed, pickMark } from "../core/seed.ts";
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

export type SetupState = SetupChoice;

export const DEFAULT_SETUP: SetupState = { variant: "classic", size: 3, mode: "computer", level: 3, markChoice: "random" };

const VARIANTS: { value: Variant; title: string; blurb: string }[] = [
  { value: "classic", title: "Classic", blurb: "3×3, or four in a row on 4×4 and 5×5" },
  { value: "ultimate", title: "Ultimate", blurb: "Nine boards; your move picks their board" },
  { value: "cube", title: "Cube", blurb: "Six faces in 3D; score, then turn a layer" },
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
  return state;
}

/** Turn the choices into a game config with a fresh seed (or the given one). */
export function configFromSetup(state: SetupState, seed?: string): GameConfig {
  const size = state.variant === "classic" ? state.size : 3;
  const mode = modesFor(state.variant).includes(state.mode) ? state.mode : modesFor(state.variant)[0]!;
  const gameSeed = seed ?? newSeed(state.variant, state.variant === "classic" ? size : undefined);
  const config: GameConfig = { variant: state.variant, size, mode, seed: gameSeed };
  if (mode === "computer") config.level = state.level;
  // In a two-device game the host picks a mark; the guest takes the other one.
  if (mode === "computer" || mode === "network") config.humanMark = state.markChoice === "random" ? pickMark(gameSeed) : state.markChoice;
  return config;
}

/** A seed pasted on the start screen decides the variant and board size (and Cube is always two players). */
export function applySeedToSetup(state: SetupState, seed: string): SetupState | { error: string } {
  const parsed = parseSeed(seed);
  if ("error" in parsed) return { error: parsed.error };
  const next: SetupState = { ...state, variant: parsed.variant };
  if (parsed.variant === "classic" && parsed.size) next.size = parsed.size;
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
  const state: SetupState = { ...initialSetup(loadSave().save.settings.lastSetup), ...opts.initial };
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

  const seedInput = h("input", { id: "seed-input", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "3X3-BXK4-M9TR", "aria-describedby": "seed-error" });
  const seedError = h("p", { id: "seed-error", class: "field-error", role: "alert" });
  seedError.hidden = true;
  const showSeedError = (text: string) => {
    seedError.textContent = text;
    seedError.hidden = text === "";
    seedInput.setAttribute("aria-invalid", text === "" ? "false" : "true");
  };
  /** The seed in the box, if it is a good one. */
  let seed: string | null = null;

  const sizeGroup = radioGroup<number>("size", "Board", [
    { value: 3, title: "3×3", blurb: "three in a row" },
    { value: 4, title: "4×4", blurb: "four in a row" },
    { value: 5, title: "5×5", blurb: "four in a row" },
  ], state.size, (v) => { state.size = v as 3 | 4 | 5; clearSeed(); });

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

  function renderModes(): void {
    const allowed = modesFor(state.variant);
    if (!allowed.includes(state.mode)) state.mode = allowed[0]!;
    const group = radioGroup<string>("mode", "Opponent", [
      ...(allowed.includes("computer") ? [{ value: "computer", title: "Computer" }] : []),
      { value: "local", title: "A friend on this device" },
      { value: "network", title: "A friend on another device" },
    ], state.mode, (v) => { state.mode = v as Mode; sync(); });
    modeHost.replaceChildren(group);
    if (state.variant === "cube") modeHost.append(h("p", { class: "hint-text" }, "Cube is for two players."));
    applyOnline();
  }

  function sync(): void {
    sizeGroup.hidden = state.variant !== "classic";
    const vsComputer = state.mode === "computer";
    levelField.hidden = !vsComputer;
    markGroup.hidden = state.mode === "local";
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
    state.variant = v as Variant;
    clearSeed();
    renderModes();
    sync();
  });

  /** Take a seed from the box: a good one sets the variant and board, a bad one is explained. */
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
    Object.assign(state, applied);
    seed = text.trim().toUpperCase();
    showSeedError("");
    select(variantGroup, state.variant);
    select(sizeGroup, state.size);
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
    updateSettings({ lastSetup: { ...state } });
    opts.onStart(configFromSetup(state, seed ?? undefined));
  });

  renderModes();
  sync();
  container.replaceChildren(
    h("section", { class: "screen", "aria-labelledby": "setup-title" },
      h("h2", { id: "setup-title", class: "sr-only" }, "New game"),
      h("div", { class: "card" }, variantGroup),
      h("div", { class: "card" }, modeHost, levelField, markGroup, sizeGroup),
      h("div", { class: "card" },
        h("div", { class: "field" }, h("label", { for: "seed-input" }, "Seed (optional)"), seedInput, seedError,
          h("p", { class: "hint-text" }, "Paste a seed to play that exact game again. It sets the game type and board for you."))),
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
