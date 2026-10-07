// One game on this device, with no DOM and no framework (contracts C7): the position, who resigned, the computer's turn, undo, the
// words for the status line and the result, and the save after every change. Game.svelte shows it and turns clicks into
// place() calls. It never decides what is legal; the core does (contracts/core-api.md). Store-compatible: `subscribe` calls
// back at once and after every change, so a component binds to it with `$session`.

import type { GameConfig, HintSet, Level, Mark, Move } from "../core/types.ts";
import { other } from "../core/types.ts";
import { newSeed } from "../core/seed.ts";
import type { CubeState } from "../core/cube.ts";
import type { UltimateState } from "../core/ultimate.ts";
import { moduleFor, type AnyGameState, type VariantModule } from "../core/variants.ts";
import { saveGame, savedGameFrom, type SavedGame } from "../adapters/store.ts";
import { whereToPlay } from "./board-text.ts";
import { Computer, defaultWorker } from "./computer.ts";
import { lockEndText, scoreLabel } from "./cube-labels.ts";
import { NO_HINTS, hintsFor, type AnyHint } from "./hints.ts";
import { refusalMessage } from "./messages.ts";
import type { NetHooks } from "./net-types.ts";
import { pillModel, statusText, type PillModel } from "./status-text.ts";

/** The computer opponent, as the session needs it. */
export interface ComputerPlayer {
  readonly thinking: boolean;
  /** Resolves null when the request was cancelled or replaced first. */
  request(config: GameConfig, moves: Move[], level: Level): Promise<Move | null>;
  cancel(): void;
}

export interface SessionDeps {
  computer?: ComputerPlayer;
  /** Write the game in progress (or null to forget it). */
  save?: (game: SavedGame | null) => void;
  now?: () => number;
  /** The computer never answers faster than this, so its move can be seen coming. */
  delay?: (ms: number) => Promise<void>;
  /** A game between two devices: the position is the one both share, and moves go through the connection. */
  net?: NetHooks;
  /** A game picked up where it was left. */
  restored?: { state: AnyGameState; resigned: Mark | null; startedAt: number };
}

/** What the last change was, so the screen can react once (show the result when the game has just ended). */
export type Change = "start" | "move" | "computer" | "undo" | "resign" | "ended" | "refresh";

export type PlaceResult = { ok: true } | { ok: false; reason: string; silent?: true };

export interface GameResult {
  title: string;
  /** One line under the title. */
  body: string;
  winner: Mark | null;
}

const COMPUTER_MIN_DELAY_MS = 250;

export class GameSession {
  readonly config: GameConfig;
  readonly mod: VariantModule<AnyGameState>;
  state: AnyGameState;
  resigned: Mark | null;
  readonly startedAt: number;
  change: Change = "start";
  /** The two-device connection, or null for a game on this device. */
  readonly net: NetHooks | null;

  private readonly computer: ComputerPlayer;
  private readonly save: (game: SavedGame | null) => void;
  private readonly delay: (ms: number) => Promise<void>;
  private readonly listeners = new Set<(session: GameSession) => void>();
  private inflight: Promise<void> = Promise.resolve();

  constructor(config: GameConfig, deps: SessionDeps = {}) {
    this.config = config;
    this.mod = moduleFor(config);
    this.computer = deps.computer ?? new Computer(defaultWorker);
    this.save = deps.save ?? ((game) => saveGame(game));
    this.delay = deps.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const restored = deps.restored;
    this.net = deps.net ?? null;
    this.state = restored ? restored.state : this.mod.newGame(config);
    this.resigned = restored ? restored.resigned : null;
    this.startedAt = restored ? restored.startedAt : (deps.now ?? Date.now)();
    if (this.net) {
      this.state = this.net.state();
      this.resigned = this.net.resigned();
    }
  }

  // ---- a store for the screen ----

  subscribe(run: (session: GameSession) => void): () => void {
    this.listeners.add(run);
    run(this);
    return () => void this.listeners.delete(run);
  }

  private changed(change: Change): void {
    this.change = change;
    this.persist();
    for (const run of [...this.listeners]) run(this);
  }

  /** The game in progress is saved after every change, so a reload or a closed tab loses nothing. */
  private persist(): void {
    if (this.net) {
      // A host keeps the game and the code, so a reload can carry on and the guest can come back; a guest keeps the code it
      // joined with, so a reload joins again. A finished game is not worth resuming.
      const { hostCode, joinCode } = this.net;
      if (!hostCode && !joinCode) return;
      if (this.over) this.save(null);
      else this.save(savedGameFrom(this.config, this.state.moves, this.startedAt, undefined, hostCode ?? undefined, joinCode ?? undefined));
      return;
    }
    this.save(savedGameFrom(this.config, this.state.moves, this.startedAt, this.resigned ?? undefined));
  }

  // ---- what the game is ----

  get vsComputer(): boolean {
    return this.config.mode === "computer";
  }
  get human(): Mark {
    return this.config.humanMark ?? "X";
  }
  get over(): boolean {
    return this.resigned !== null || this.mod.status(this.state).status !== "playing";
  }
  get computerToMove(): boolean {
    return this.vsComputer && !this.over && this.state.toMove !== this.human;
  }
  /** The computer is choosing, or about to. */
  get thinking(): boolean {
    return this.computer.thinking || this.computerToMove;
  }
  /** The mode, as the status words and the pill name it. */
  get playMode(): "one-device" | "computer" | "two-device" {
    return this.net ? "two-device" : this.vsComputer ? "computer" : "one-device";
  }

  /** Play again is for a game on this device: two devices go back to the start screen to host or join anew. */
  get canPlayAgain(): boolean {
    return this.net === null;
  }

  private moverOf(moveIndex: number): Mark {
    return moveIndex % 2 === 0 ? "X" : "O";
  }

  /** Needs at least one move by the player to take back. */
  get canUndo(): boolean {
    if (this.state.moves.length === 0) return false;
    if (this.net) return !this.over;
    if (!this.vsComputer) return true;
    return this.state.moves.some((_, i) => this.moverOf(i) === this.human);
  }

  /** Cells to point out to the player on their turn, when the Show hints setting is on. */
  hints(enabled: boolean): HintSet<AnyHint> {
    if (!enabled || this.over || this.computerToMove) return NO_HINTS;
    return hintsFor(this.config, this.state, this.state.toMove);
  }

  // ---- words ----

  /** One sentence for the status line; "" for a plain turn, which the pill shows instead. */
  statusText(): string {
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
      thinking: !this.net && this.thinking,
      lockNote: this.config.variant === "cube" ? lockEndText(this.state as CubeState) : "",
      where: this.config.variant === "ultimate" && st.status === "playing" ? whereToPlay(this.state as UltimateState) : "",
    });
  }

  /** Who is highlighted, the Twist scores, and what to say aloud. */
  pill(): PillModel {
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

  refusalText(reason: string): string {
    return refusalMessage(reason);
  }

  /** The result of a finished game, or null while it is being played. */
  result(): GameResult | null {
    if (!this.over) return null;
    const st = this.mod.status(this.state);
    const title = this.resigned ? `${this.resigned} resigned` : st.status === "won" ? `${st.winner!} wins` : st.status === "tie" ? "It's a tie" : "It's a draw";
    const winner = this.resigned ? other(this.resigned) : st.winner;
    let body: string;
    if (this.config.variant === "cube" && !this.resigned) {
      const cube = this.state as CubeState;
      const note = lockEndText(cube);
      body = `Final ${scoreLabel(cube.config.scoring).toLowerCase()}: X ${cube.scores.X}, O ${cube.scores.O}.${note ? ` ${note}` : ""}`;
    } else if (!winner) body = "Nobody won this one.";
    else if (this.net) body = winner === this.net.myMark ? "You won." : "Your friend won.";
    else if (this.vsComputer) body = winner === this.human ? "You won." : "The computer won.";
    else body = `${winner} won.`;
    return { title, body, winner };
  }

  /** The config for Play again: a new game against the computer gets a new seed; a game without a computer has none. */
  nextConfig(): GameConfig {
    const next: GameConfig = { ...this.config };
    if (this.config.mode === "computer") next.seed = newSeed(this.config.variant, this.config.size, this.config.winLength);
    return next;
  }

  // ---- doing things ----

  /** Save the game and, if the computer is to move, ask it. Call once when the screen opens. */
  start(): void {
    this.changed("start");
    if (this.computerToMove) this.inflight = this.computerTurn();
  }

  /** Turn a click into a move. Moves the core refuses come back with their reason; ones that cannot be played now are ignored. */
  place(move: Move): PlaceResult {
    if (this.over || this.computer.thinking) return { ok: false, reason: "", silent: true };
    if (this.vsComputer && this.state.toMove !== this.human) return { ok: false, reason: "", silent: true };
    if (this.net) {
      const reason = this.net.move(move);
      if (reason) return { ok: false, reason };
      this.sync();
      return { ok: true };
    }
    const legal = this.mod.isLegal(this.state, move);
    if (!legal.ok) return { ok: false, reason: legal.reason };
    this.play(move, "move");
    return { ok: true };
  }

  private play(move: Move, change: "move" | "computer"): void {
    this.state = this.mod.apply(this.state, move);
    this.changed(this.over ? "ended" : change);
    if (!this.over && this.computerToMove) this.inflight = this.computerTurn();
  }

  private async computerTurn(): Promise<void> {
    this.changed(this.change); // the status line says the computer is thinking
    const length = this.state.moves.length;
    const [move] = await Promise.all([this.computer.request(this.config, this.state.moves, this.config.level ?? 3), this.delay(COMPUTER_MIN_DELAY_MS)]);
    if (!move || this.state.moves.length !== length || this.over) return;
    this.play(move, "computer");
  }

  /** Resolves when the computer has finished the turn it is on (for tests, and to await a reply). */
  idle(): Promise<void> {
    return this.inflight;
  }

  /** The shared position changed (the other device moved, or the connection told us something): show it. */
  sync(): void {
    if (!this.net) return;
    this.state = this.net.state();
    this.resigned = this.net.resigned();
    this.changed(this.over ? "ended" : "move");
  }

  /**
   * Take the last move back; against the computer, the computer's reply and the player's move before it. Two devices ask the
   * friend instead, and nothing is taken back until they agree.
   */
  undo(): PlaceResult {
    if (!this.canUndo) return { ok: false, reason: "", silent: true };
    if (this.net) {
      const reason = this.net.askUndo();
      return reason ? { ok: false, reason } : { ok: true };
    }
    this.computer.cancel();
    this.resigned = null;
    do {
      const last = this.state.moves.length - 1;
      const wasHuman = !this.vsComputer || this.moverOf(last) === this.human;
      this.state = this.mod.undo(this.state);
      if (wasHuman) break;
    } while (this.state.moves.length > 0);
    this.changed("undo");
    if (this.computerToMove) this.inflight = this.computerTurn();
    return { ok: true };
  }

  /** Who would resign here: the player against the computer, whoever is to move on one device. */
  get resigner(): Mark {
    return this.net ? this.net.myMark : this.vsComputer ? this.human : this.state.toMove;
  }

  resign(who: Mark): PlaceResult {
    if (this.over) return { ok: false, reason: "", silent: true };
    this.computer.cancel();
    if (this.net) {
      const reason = this.net.resign();
      if (reason) return { ok: false, reason };
      this.sync();
      return { ok: true };
    }
    this.resigned = who;
    this.changed("ended");
    return { ok: true };
  }

  /** Leave on purpose: stop the computer and the connection, and forget a game there is nothing to come back to. */
  leave(): void {
    this.computer.cancel();
    this.net?.leave();
    if (!this.net || this.net.hostCode || this.net.joinCode) this.save(null);
  }

  /** Stop the computer (leaving the game, or showing a replay). */
  cancel(): void {
    this.computer.cancel();
  }

  /** Something outside the game changed what is shown (a setting): redraw. */
  refresh(): void {
    this.changed("refresh");
  }
}
