// Boot and routing between the start screen, the game screen and a replay opened from a link.
//
// The start screen needs only a small part of the app. The game, the replay and two-device play (with
// the rules and the computer behind them) are loaded when they are first needed, so a first visit gets
// to an interactive page quickly.

import type { GameConfig, Mark } from "../core/types.ts";
import type { AnyGameState } from "../core/variants.ts";
import { loadSave, saveGame, updateSettings } from "../adapters/store.ts";
import { codeFromSearch } from "../core/pairing.ts";
import { renderSetup } from "./setup.ts";
import { initServiceWorker } from "./update-bar.ts";
import { applySettings, openSettings } from "./settings.ts";
import { icon } from "./icons.ts";
import { h, toast } from "./ui.ts";

/** A game picked up where it was left. */
export interface RestoredGame {
  state: AnyGameState;
  resigned: Mark | null;
  startedAt: number;
}

export interface GameScreen {
  /** Mount the game into `container`. `exit` returns to the start screen. */
  mount(container: HTMLElement, config: GameConfig, exit: () => void, restored?: RestoredGame): void;
}

function main(): HTMLElement {
  const el = document.getElementById("main");
  if (!el) throw new Error("#main is missing from index.html");
  return el;
}

export function showSetup(seed?: string): void {
  const options = { onStart: startGame, onJoin: joinFriend };
  renderSetup(main(), seed ? { ...options, seed } : options);
}

// ---- help (#/help) ----
// The help page has its own place in the document next to the game's, so opening or leaving it never touches
// whatever is on the game's side: a game in progress carries on exactly as it was.

const HELP_HASH = "#/help";
let helpBuilt = false;
/** True when help was opened by following a link (so the browser's Back goes where the player came from) */
let helpFromLink = false;

function helpView(): HTMLElement {
  const el = document.getElementById("help-view");
  if (!el) throw new Error("#help-view is missing from index.html");
  return el;
}

function leaveHelp(): void {
  if (helpFromLink && history.length > 1) {
    history.back();
    return;
  }
  history.replaceState(null, "", location.pathname + location.search);
  routeHash();
}

/** Show or hide the help page to match the address. */
async function routeHash(): Promise<void> {
  const wantsHelp = location.hash === HELP_HASH;
  const view = helpView();
  if (wantsHelp) {
    try {
      if (!helpBuilt) {
        const { renderHelp } = await import("./help.ts");
        renderHelp(view, { onBack: leaveHelp });
        helpBuilt = true;
      }
    } catch {
      loadFailed();
      history.replaceState(null, "", location.pathname + location.search);
      return;
    }
    if (location.hash !== HELP_HASH) return; // the player already left while the page was loading
    main().hidden = true;
    view.hidden = false;
    view.focus();
    window.scrollTo?.(0, 0);
  } else {
    const wasOpen = !view.hidden;
    view.hidden = true;
    main().hidden = false;
    if (wasOpen) main().focus();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    helpFromLink = location.hash === HELP_HASH;
    void routeHash();
  });
}

/**
 * The game and two-device code are loaded when first needed. Offline they come from the service worker's
 * cache; in the first moments of a very first visit the worker may not have finished caching them yet.
 */
function loadFailed(): void {
  toast("The game could not be loaded. Check your connection and try again; once it has loaded, it works offline.", 8000);
}

export async function startGame(config: GameConfig): Promise<void> {
  try {
    if (config.mode === "network") {
      const { hostGame } = await import("./multiplayer.ts");
      hostGame(main(), config, () => showSetup());
    } else {
      const { gameScreen } = await import("./game.ts");
      gameScreen.mount(main(), config, () => showSetup(), undefined);
    }
    main().focus();
  } catch {
    loadFailed();
  }
}

async function joinFriend(code: string): Promise<void> {
  try {
    const { joinGame } = await import("./multiplayer.ts");
    joinGame(main(), code, () => showSetup());
    main().focus();
  } catch {
    loadFailed();
  }
}

/** Leave a replay link behind: back to the player's own saved game, or the start screen. */
function leaveWatch(): void {
  history.replaceState(null, "", location.pathname);
  void openOwnGame();
}

async function openOwnGame(): Promise<void> {
  const { save, notice } = loadSave();
  if (notice) toast(notice, 8000);
  if (save.game) {
    main().replaceChildren(h("p", { class: "status-line", role: "status" }, "Loading your game…"));
    try {
      const [{ restoreGame }, { gameScreen }] = await Promise.all([import("../adapters/restore.ts"), import("./game.ts")]);
      const restored = restoreGame(save.game);
      if (restored && save.game.config.mode === "network") {
        // A game this device was hosting: carry on hosting under the same code, unless it was finished.
        const over = restored.resigned !== null || restored.state.status !== "playing";
        if (save.game.hostCode && !over) {
          const { hostGame } = await import("./multiplayer.ts");
          hostGame(main(), save.game.config, () => showSetup(), { code: save.game.hostCode, moves: restored.state.moves });
          return;
        }
        if (save.game.joinCode && !over) {
          // A game this device joined as a guest: join it again with the same code, unless it was finished.
          const { joinGame } = await import("./multiplayer.ts");
          joinGame(main(), save.game.joinCode, () => showSetup());
          return;
        }
        saveGame(null);
      } else if (restored) {
        gameScreen.mount(main(), save.game.config, () => showSetup(), { state: restored.state, resigned: restored.resigned, startedAt: save.game.startedAt });
        return;
      }
    } catch {
      loadFailed();
    }
  }
  showSetup();
}

/** A replay link: plays the game without touching the viewer's own saved game. */
async function openWatch(): Promise<boolean> {
  const { configFromRecord, unpackLink } = await import("../core/record.ts");
  const record = unpackLink(location.search);
  if ("error" in record) {
    toast(record.error, 8000);
    history.replaceState(null, "", location.pathname);
    return false;
  }
  const { mountReplay } = await import("./replay.ts");
  const settings = loadSave().save.settings;
  // Only a game that has a seed (one against the computer) can be played again from its seed.
  const playThisSeed = record.seed
    ? h("button", {
        class: "btn",
        type: "button",
        onclick: () => {
          history.replaceState(null, "", location.pathname);
          showSetup(record.seed);
        },
      }, "Play this seed")
    : null;
  const options = {
    config: configFromRecord(record),
    moves: record.moves,
    speed: settings.replaySpeed,
    onSpeed: (speed: typeof settings.replaySpeed) => updateSettings({ replaySpeed: speed }),
    autoplay: true,
    notation: settings.cubeNotation,
    onClose: leaveWatch,
    actions: playThisSeed ? [playThisSeed] : [],
  };
  const resigner: Mark | undefined = record.end === "rx" ? "X" : record.end === "ro" ? "O" : undefined;
  mountReplay(main(), resigner ? { ...options, resigned: resigner } : options);
  return true;
}

function addHeaderButtons(): void {
  const actions = document.getElementById("header-actions");
  if (!actions || actions.childElementCount > 0) return;
  const helpButton = h("button", { class: "icon-btn", type: "button", "aria-label": "Help", title: "Help", id: "help-button" }, icon("help"));
  helpButton.addEventListener("click", () => {
    location.hash = HELP_HASH;
  });
  const button = h("button", { class: "icon-btn", type: "button", "aria-label": "Settings", title: "Settings" }, icon("settings"));
  button.addEventListener("click", () => void openSettings());
  actions.append(helpButton, button);
}

async function boot(): Promise<void> {
  initServiceWorker();
  applySettings(loadSave().save.settings);
  addHeaderButtons();
  const code = codeFromSearch(location.search);
  if (location.hash === HELP_HASH) void routeHash();
  if (code) {
    history.replaceState(null, "", location.pathname);
    await joinFriend(code);
    return;
  }
  if (new URLSearchParams(location.search).has("watch") && (await openWatch())) return;
  await openOwnGame();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void boot());
  else void boot();
}
