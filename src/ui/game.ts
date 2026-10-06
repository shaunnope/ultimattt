// The game screen: owns the game state, turns clicks into moves, runs the computer,
// and shows the result. It never decides what is legal; the core does (contracts/core-api.md).

import type { GameConfig, Mark, Move } from "../core/types.ts";
import { other } from "../core/types.ts";
import { newSeed } from "../core/seed.ts";
import { recordFromGame, packLink } from "../core/record.ts";
import type { AnyGameState, VariantModule } from "../core/variants.ts";
import { moduleFor, variantName } from "../core/variants.ts";
import type { UltimateState } from "../core/ultimate.ts";
import type { CubeState } from "../core/cube.ts";
import { Computer, defaultWorker } from "./computer.ts";
import { createBoard, type BoardView } from "./boards.ts";
import { whereToPlay } from "./board-ultimate.ts";
import { lockEndText, optionsNote, scoreLabel } from "./cube-labels.ts";
import { createPill, type Pill } from "./pill.ts";
import { pillModel, statusText } from "./status-text.ts";
import { refusalMessage } from "./messages.ts";
import { mountReplay, type ReplayHandle } from "./replay.ts";
import { LEVEL_NAMES } from "./setup.ts";
import type { GameScreen, RestoredGame } from "./app.ts";
import { loadSave, saveGame, savedGameFrom, updateSettings } from "../adapters/store.ts";
import { NO_HINTS, hintsFor } from "./hints.ts";
import { SETTINGS_EVENT } from "./settings.ts";
import { celebrate } from "./confetti.ts";
import { icon } from "./icons.ts";
import { announce, h, openDialog, setBanner, toast } from "./ui.ts";

const COMPUTER_MIN_DELAY_MS = 250;

/** What the game screen needs from a two-device session (see multiplayer.ts). */
export interface NetHooks {
  readonly myMark: Mark;
  /** The position both devices share */
  state(): AnyGameState;
  resigned(): Mark | null;
  /** Each returns the reason it was refused, or null */
  move(move: Move): string | null;
  askUndo(): string | null;
  resign(): string | null;
  /** The code this device is hosting under (null for a guest) */
  readonly hostCode: string | null;
  /** The code a guest joined with, so a reload can join again */
  readonly joinCode: string | null;
  /** Leave the game and drop the connection */
  leave(): void;
  reconnect(): void;
}

export type ConnectionView = { state: "connected" } | { state: "lost"; message: string; canReconnect: boolean };

/** How the connection code drives the game screen. */
export interface NetGameHandle {
  /** The shared position changed: redraw, and show the result if the game ended */
  sync(): void;
  setConnection(view: ConnectionView): void;
  notify(text: string): void;
  /** Ask the player whether their friend may take a move back */
  promptUndo(by: Mark): Promise<boolean>;
}


// Settings changes (hints, turn notation, colours) redraw whichever game is on screen.
let active: GameController | null = null;
if (typeof window !== "undefined") window.addEventListener(SETTINGS_EVENT, () => active?.refresh());

class GameController implements NetGameHandle {
  private readonly container: HTMLElement;
  private readonly config: GameConfig;
  private readonly exit: () => void;
  private readonly mod: VariantModule<AnyGameState>;
  private readonly computer = new Computer(defaultWorker);
  private state: AnyGameState;
  private resigned: Mark | null = null;
  private board!: BoardView;
  private statusEl!: HTMLElement;
  private pill!: Pill;
  private undoBtn!: HTMLButtonElement;
  private resignBtn!: HTMLButtonElement;
  private replayBtn!: HTMLButtonElement;
  private shareBtn!: HTMLButtonElement;
  private errorTone = false;
  private startedAt: number;
  private replay: ReplayHandle | null = null;
  private resultShown = false;
  private net: NetHooks | null = null;
  private netStatusEl: HTMLElement | null = null;
  private reconnectBtn: HTMLButtonElement | null = null;
  private connection: ConnectionView = { state: "connected" };

  constructor(container: HTMLElement, config: GameConfig, exit: () => void, restored?: RestoredGame, net?: NetHooks) {
    this.container = container;
    this.config = config;
    this.exit = exit;
    this.mod = moduleFor(config);
    this.state = restored ? restored.state : this.mod.newGame(config);
    this.resigned = restored ? restored.resigned : null;
    this.startedAt = restored ? restored.startedAt : Date.now();
    this.net = net ?? null;
    if (net) {
      this.state = net.state();
      this.resigned = net.resigned();
    }
  }

  private get vsComputer(): boolean {
    return this.config.mode === "computer";
  }
  private get human(): Mark {
    return this.config.humanMark ?? "X";
  }
  private get over(): boolean {
    return this.resigned !== null || this.mod.status(this.state).status !== "playing";
  }
  private get computerToMove(): boolean {
    return this.vsComputer && !this.over && this.state.toMove !== this.human;
  }

  // ---- two-device play ----

  private buildNetBar(): HTMLElement {
    this.netStatusEl = h("span", { id: "net-status", role: "status" });
    this.reconnectBtn = h("button", { class: "btn btn-small", type: "button", onclick: () => this.net?.reconnect() }, "Reconnect");
    return h("div", { class: "net-bar" }, this.netStatusEl, this.reconnectBtn);
  }

  private renderConnection(): void {
    if (!this.netStatusEl || !this.reconnectBtn) return;
    const view = this.connection;
    this.netStatusEl.replaceChildren(icon(view.state === "connected" ? "check" : "info"), view.state === "connected" ? "Connected" : view.message);
    this.netStatusEl.dataset.tone = view.state === "connected" ? "" : "error";
    this.reconnectBtn.hidden = !(view.state === "lost" && view.canReconnect);
  }

  setConnection(view: ConnectionView): void {
    this.connection = view;
    this.renderConnection();
  }

  notify(text: string): void {
    toast(text);
  }

  /** The shared position changed. */
  sync(): void {
    if (!this.net) return;
    this.state = this.net.state();
    this.resigned = this.net.resigned();
    if (!this.over) this.resultShown = false;
    if (this.replay) return;
    this.render();
    if (this.over) void this.showResult();
  }

  async promptUndo(by: Mark): Promise<boolean> {
    const choice = await openDialog({
      title: "Take back a move?",
      body: [`${by} asks to take back their last move.`],
      actions: [
        { label: "Not now", value: "no" },
        { label: "Allow", value: "yes", primary: true },
      ],
    });
    return choice === "yes";
  }

  /** Redraw after a setting changed (for instance the turn notation). */
  refresh(): void {
    if (this.replay) return;
    this.start();
  }

  start(): void {
    active = this;
    this.replay?.destroy();
    this.replay = null;
    const net = this.net;
    const notation = loadSave().save.settings.cubeNotation;
    this.board = createBoard(this.config, (move) => this.onMove(move), { notation, ...(net ? { mayMove: (state: AnyGameState) => state.toMove === net.myMark } : {}) });
    this.statusEl = h("div", { id: "game-status", class: "status-line" });
    this.pill = createPill();
    this.undoBtn = h("button", { class: "btn", type: "button", onclick: () => this.undo() }, "Undo");
    this.resignBtn = h("button", { class: "btn btn-destructive", type: "button", onclick: () => void this.resign() }, "Resign");
    this.replayBtn = h("button", { class: "btn", type: "button", onclick: () => this.showReplay(true) }, "Replay");
    this.shareBtn = h("button", { class: "btn", type: "button", onclick: () => void this.shareReplay() }, "Share replay");
    const newGame = h("button", { class: "btn", type: "button", onclick: () => this.leave() }, "New game");

    const sub = this.net ? `two devices, you are ${this.net.myMark}` : this.vsComputer ? `vs Computer (${LEVEL_NAMES[this.config.level ?? 3]}), you are ${this.human}` : "two players, this device";
    this.container.replaceChildren(
      h("section", { class: "screen", "aria-label": "Game" },
        h("div", { class: "game-head" },
          h("span", { class: "game-title", id: "game-title" }, `${variantName(this.config.variant, "short")} ${this.config.size}×${this.config.size}, ${this.config.winLength} in a row${optionsNote(this.config)}`),
          h("span", { class: "game-sub" }, sub)),
        ...(this.config.seed
          ? [h("div", { class: "seed-row" }, h("span", { id: "game-seed", class: "game-sub" }, `Seed: ${this.config.seed}`), h("button", { class: "btn btn-small", type: "button", onclick: () => void this.copySeed() }, "Copy seed"))]
          : []),
        ...(this.net ? [this.buildNetBar()] : []),
        this.pill.element,
        this.statusEl,
        h("div", { class: "card board-card" }, this.board.element),
        h("div", { class: "game-controls" }, this.undoBtn, this.resignBtn, this.replayBtn, this.shareBtn, newGame)),
    );
    this.render();
    this.renderConnection();
    if (this.computerToMove) void this.computerTurn();
  }

  private leave(): void {
    this.computer.cancel();
    this.replay?.destroy();
    if (active === this) active = null;
    this.net?.leave();
    if (!this.net || this.net.hostCode || this.net.joinCode) saveGame(null); // leaving on purpose: nothing to come back to
    this.exit();
  }

  private get playMode(): "one-device" | "computer" | "two-device" {
    return this.net ? "two-device" : this.vsComputer ? "computer" : "one-device";
  }

  private pillModel() {
    const st = this.mod.status(this.state);
    return pillModel({
      variant: this.config.variant,
      status: st.status,
      winner: st.winner,
      toMove: this.state.toMove,
      ...(this.config.variant === "cube" ? { scores: (this.state as CubeState).scores } : {}),
      mode: this.playMode,
      ...(this.net ? { myMark: this.net.myMark } : {}),
      ...(this.vsComputer ? { humanMark: this.human } : {}),
      resigned: this.resigned,
    });
  }

  private statusText(): string {
    const st = this.mod.status(this.state);
    return statusText({
      variant: this.config.variant,
      status: st.status,
      winner: st.winner,
      toMove: this.state.toMove,
      ...(this.config.variant === "cube" ? { phase: (this.state as CubeState).phase } : {}),
      mode: this.playMode,
      ...(this.net ? { myMark: this.net.myMark } : {}),
      ...(this.vsComputer ? { humanMark: this.human } : {}),
      resigned: this.resigned,
      thinking: !this.net && (this.computer.thinking || this.computerToMove),
      lockNote: this.config.variant === "cube" ? lockEndText(this.state as CubeState) : "",
      where: this.config.variant === "ultimate" && st.status === "playing" ? whereToPlay(this.state as UltimateState) : "",
    });
  }

  /** The game in progress is saved after every change, so a reload or a closed tab loses nothing. */
  private persist(): void {
    if (this.net) {
      // A host keeps the game and the code, so a reload can carry on and the guest can come back;
      // a guest keeps the code it joined with, so a reload joins again. A finished game is not worth resuming.
      const { hostCode, joinCode } = this.net;
      if (!hostCode && !joinCode) return;
      if (this.over) saveGame(null);
      else saveGame(savedGameFrom(this.config, this.state.moves, this.startedAt, undefined, hostCode ?? undefined, joinCode ?? undefined));
      return;
    }
    saveGame(savedGameFrom(this.config, this.state.moves, this.startedAt, this.resigned ?? undefined));
  }

  private render(message?: string): void {
    this.persist();
    this.board.update(this.state);
    const showHints = loadSave().save.settings.hints && !this.over && !this.computerToMove;
    this.board.setHints(showHints ? hintsFor(this.config, this.state, this.state.toMove) : NO_HINTS);
    const text = message ?? this.statusText();
    const pill = this.pillModel();
    this.pill.update(pill);
    setBanner(this.statusEl, text, this.errorTone ? "error" : "info");
    this.statusEl.hidden = text === "";
    announce(text || pill.spoken);
    this.undoBtn.disabled = !this.canUndo();
    this.resignBtn.disabled = this.over;
    this.replayBtn.hidden = !this.over;
    this.shareBtn.hidden = !this.over;
  }

  private canUndo(): boolean {
    if (this.state.moves.length === 0) return false;
    if (this.net) return !this.over;
    if (!this.vsComputer) return true;
    // Needs at least one move by the human to take back.
    return this.state.moves.some((_, i) => this.moverOf(i) === this.human);
  }

  private moverOf(moveIndex: number): Mark {
    return moveIndex % 2 === 0 ? "X" : "O";
  }

  private onMove(move: Move): void {
    if (this.over || this.computer.thinking) return;
    if (this.vsComputer && this.state.toMove !== this.human) return;
    if (this.net) {
      const reason = this.net.move(move);
      if (reason) this.refuseWith(reason);
      else this.sync();
      return;
    }
    const legal = this.mod.isLegal(this.state, move);
    if (!legal.ok) {
      this.refuseWith(legal.reason);
      return;
    }
    this.play(move);
  }

  private refuseWith(reason: string): void {
    const text = refusalMessage(reason);
    this.errorTone = true;
    this.render(text);
    this.errorTone = false;
    toast(text);
  }

  private play(move: Move): void {
    this.state = this.mod.apply(this.state, move);
    this.errorTone = false;
    this.render();
    if (this.over) void this.showResult();
    else if (this.computerToMove) void this.computerTurn();
  }

  private async computerTurn(): Promise<void> {
    this.render();
    const length = this.state.moves.length;
    const [move] = await Promise.all([
      this.computer.request(this.config, this.state.moves, this.config.level ?? 3),
      new Promise((r) => setTimeout(r, COMPUTER_MIN_DELAY_MS)),
    ]);
    if (!move || this.state.moves.length !== length || this.over) return;
    this.play(move);
  }

  private undo(): void {
    if (!this.canUndo()) return;
    if (this.net) {
      const reason = this.net.askUndo();
      if (reason) this.refuseWith(reason);
      else toast("Asked your friend to take your move back.");
      return;
    }
    this.computer.cancel();
    this.board.reset();
    this.resigned = null;
    do {
      const last = this.state.moves.length - 1;
      const wasHuman = !this.vsComputer || this.moverOf(last) === this.human;
      this.state = this.mod.undo(this.state);
      if (wasHuman) break;
    } while (this.state.moves.length > 0);
    this.render();
    if (this.computerToMove) void this.computerTurn();
  }

  private async resign(): Promise<void> {
    if (this.over) return;
    const who = this.net ? this.net.myMark : this.vsComputer ? this.human : this.state.toMove;
    const choice = await openDialog({
      title: "Resign this game?",
      body: [`${who} will lose.`],
      actions: [
        { label: "Keep playing", value: "no" },
        { label: "Confirm resign", value: "yes", primary: true },
      ],
    });
    if (choice !== "yes" || this.over) return;
    this.computer.cancel();
    if (this.net) {
      const reason = this.net.resign();
      if (reason) this.refuseWith(reason);
      else this.sync();
      return;
    }
    this.resigned = who;
    this.render();
    void this.showResult();
  }

  /** Play the finished game back, at the speed the player last chose. */
  private showReplay(autoplay: boolean): void {
    this.computer.cancel();
    const settings = loadSave().save.settings;
    this.replay?.destroy();
    const options = {
      config: this.config,
      moves: this.state.moves,
      speed: settings.replaySpeed,
      onSpeed: (speed: typeof settings.replaySpeed) => updateSettings({ replaySpeed: speed }),
      autoplay,
      notation: settings.cubeNotation,
      onClose: () => this.start(),
    };
    this.replay = mountReplay(this.container, this.resigned ? { ...options, resigned: this.resigned } : options);
  }

  private replayLink(): string {
    const record = recordFromGame(this.config, this.state.moves, this.resigned ?? undefined);
    const base = `${location.origin}${location.pathname}`;
    return base + packLink(record, 10_000 + Math.floor(Math.random() * 90_000));
  }

  private async shareReplay(): Promise<void> {
    const url = this.replayLink();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Tic Tac Toe replay", url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Replay link copied.");
    } catch {
      await openDialog({
        title: "Replay link",
        body: ["Copy this link to share the game:", h("input", { type: "text", readonly: true, value: url, class: "link-box", "aria-label": "Replay link" })],
        actions: [{ label: "Done", value: "ok", primary: true }],
      });
    }
  }

  private async copySeed(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.config.seed ?? "");
      toast("Seed copied.");
    } catch {
      toast(`Seed: ${this.config.seed ?? ""}`);
    }
  }

  private async showResult(): Promise<void> {
    if (this.resultShown) return;
    this.resultShown = true;
    const st = this.mod.status(this.state);
    const title = this.resigned ? `${this.resigned} resigned` : st.status === "won" ? `${st.winner!} wins` : st.status === "tie" ? "It's a tie" : "It's a draw";
    const winner = this.resigned ? other(this.resigned) : st.winner;
    if (winner) celebrate(); // nothing at all when the player has asked for reduced motion
    let body: string;
    if (this.config.variant === "cube" && !this.resigned) {
      const cube = this.state as CubeState;
      const note = lockEndText(cube);
      body = `Final ${scoreLabel(cube.config.scoring).toLowerCase()}: X ${cube.scores.X}, O ${cube.scores.O}.${note ? ` ${note}` : ""}`;
    } else if (!winner) body = "Nobody won this one.";
    else if (this.net) body = winner === this.net.myMark ? "You won." : "Your friend won.";
    else if (this.vsComputer) body = winner === this.human ? "You won." : "The computer won.";
    else body = `${winner} won.`;
    const choice = await openDialog({
      title,
      ...(winner ? { icon: "check" as const } : {}),
      body: [body],
      actions: [
        { label: "Watch replay", value: "replay", primary: true },
        ...(this.net ? [] : [{ label: "Play again", value: "again" }]),
        { label: "New game", value: "new" },
      ],
    });
    if (choice === "again") {
      this.computer.cancel();
      // A new game against the computer gets a new seed; a game without a computer has none.
      const next: GameConfig = { ...this.config };
      if (this.config.mode === "computer") next.seed = newSeed(this.config.variant, this.config.size, this.config.winLength);
      new GameController(this.container, next, this.exit).start();
    } else if (choice === "new") {
      this.leave();
    } else if (choice === "replay") {
      this.showReplay(true);
    } else if (loadSave().save.settings.autoReplay) {
      // The result was dismissed: the replay plays by itself unless the setting is off.
      this.showReplay(true);
    }
  }
}

export const gameScreen: GameScreen = {
  mount(container, config, exit, restored) {
    new GameController(container, config, exit, restored).start();
  },
};

/** Show a two-device game; the connection code drives it through the returned handle. */
export function mountNetGame(container: HTMLElement, config: GameConfig, exit: () => void, net: NetHooks): NetGameHandle {
  const controller = new GameController(container, config, exit, undefined, net);
  controller.start();
  return controller;
}
