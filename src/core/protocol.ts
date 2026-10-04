// Two-device play (contracts/net-protocol.md): the messages, and the session each device runs.
// Pure: no network here; the adapter feeds messages in and sends what comes out.
//
// The host is the authority. A guest sends the move it wants; the host checks it against the rules
// and answers with the move as applied, plus the hash of the position, which both sides compare.
// Both devices run the same rules, so a disagreement is caught at once and cured by sending the
// whole game again. Nothing here knows about icons: they are a display preference of each device.

import type { GameConfig, Mark, Move } from "./types.ts";
import { other } from "./types.ts";
import { parseConfig } from "./config.ts";
import { decodeMoves, encodeMoves } from "./record.ts";
import { replayFrames } from "./replay.ts";
import type { AnyGameState } from "./variants.ts";
import { moduleFor } from "./variants.ts";

export const PROTOCOL_VERSION = 2 as const;

export type Message =
  | { v: 2; type: "hello" }
  | { v: 2; type: "welcome"; config: GameConfig; moves: string }
  | { v: 2; type: "reject"; reason: "full" | "version" }
  | { v: 2; type: "move"; n: number; move: Move }
  | { v: 2; type: "applied"; n: number; move: Move; hash: number }
  | { v: 2; type: "refused"; n: number; reason: string }
  | { v: 2; type: "undo-ask"; n: number }
  | { v: 2; type: "undo-answer"; n: number; ok: boolean }
  | { v: 2; type: "resign" }
  | { v: 2; type: "ping" }
  | { v: 2; type: "pong" }
  | { v: 2; type: "bye" };

export type NetEvent =
  | { type: "synced" }
  | { type: "applied"; move: Move; by: Mark }
  | { type: "refused"; reason: string }
  | { type: "undo-asked"; by: Mark; target: number }
  | { type: "undo-done"; target: number }
  | { type: "undo-declined" }
  | { type: "resigned"; by: Mark }
  | { type: "left" }
  | { type: "rejected"; reason: "full" | "version" }
  | { type: "resync" };

export interface Reaction {
  send: Message[];
  events: NetEvent[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const isMove = (v: unknown): v is Move => isObject(v) && typeof v.t === "string";

/** A checked message, or { error }. Anything unknown or malformed is an error, never a throw. */
export function parseMessage(raw: unknown): Message | { error: string } {
  if (!isObject(raw) || raw.v !== PROTOCOL_VERSION || typeof raw.type !== "string") return { error: "not a message" };
  switch (raw.type) {
    case "hello":
    case "resign":
    case "ping":
    case "pong":
    case "bye":
      return { v: 2, type: raw.type };
    case "welcome": {
      const config = parseConfig(raw.config);
      if (!config || typeof raw.moves !== "string") return { error: "bad welcome" };
      return { v: 2, type: "welcome", config, moves: raw.moves };
    }
    case "reject":
      return raw.reason === "full" || raw.reason === "version" ? { v: 2, type: "reject", reason: raw.reason } : { error: "bad reject" };
    case "move":
      return isCount(raw.n) && isMove(raw.move) ? { v: 2, type: "move", n: raw.n, move: raw.move } : { error: "bad move" };
    case "applied":
      return isCount(raw.n) && isMove(raw.move) && typeof raw.hash === "number" ? { v: 2, type: "applied", n: raw.n, move: raw.move, hash: raw.hash } : { error: "bad applied" };
    case "refused":
      return isCount(raw.n) && typeof raw.reason === "string" ? { v: 2, type: "refused", n: raw.n, reason: raw.reason } : { error: "bad refused" };
    case "undo-ask":
      return isCount(raw.n) ? { v: 2, type: "undo-ask", n: raw.n } : { error: "bad undo-ask" };
    case "undo-answer":
      return isCount(raw.n) && typeof raw.ok === "boolean" ? { v: 2, type: "undo-answer", n: raw.n, ok: raw.ok } : { error: "bad undo-answer" };
    default:
      return { error: "unknown message" };
  }
}

/** The host takes one guest. A second one is told the game is full. */
export function admitGuest(hasGuest: boolean): Message | null {
  return hasGuest ? { v: 2, type: "reject", reason: "full" } : null;
}

/**
 * The move count to go back to when `mark` takes back their last move: the position just before it.
 * In the Cube a mark that scored and the layer turn that followed are one move. Null if they have not moved.
 */
export function undoTarget(config: GameConfig, moves: readonly Move[], mark: Mark): number | null {
  const frames = replayFrames(config, moves);
  for (let i = moves.length; i >= 1; i--) {
    if (frames[i]!.mover !== mark) continue;
    const isTurn = moves[i - 1]!.t === "rotate";
    return isTurn ? i - 2 : i - 1;
  }
  return null;
}

/** Every reason a move, an undo or a resignation can be refused on this device or by the host. */
export const NET_REASONS = ["not-connected", "not-your-turn", "game-over", "out-of-sync", "nothing-to-undo", "undo-pending"] as const;

const none = (): Reaction => ({ send: [], events: [] });

export class NetSession {
  readonly role: "host" | "guest";
  config!: GameConfig;
  state: AnyGameState | null = null;
  resigned: Mark | null = null;
  pendingUndo: { by: Mark; target: number } | null = null;

  private constructor(role: "host" | "guest") {
    this.role = role;
  }

  /** The host of a new game, or of one picked up again from the moves already played (it throws if they do not play). */
  static host(config: GameConfig, moves?: readonly Move[]): NetSession {
    const session = new NetSession("host");
    session.config = config;
    session.state = moves ? moduleFor(config).fromMoves(config, [...moves]) : moduleFor(config).newGame(config);
    return session;
  }

  static guest(): NetSession {
    return new NetSession("guest");
  }

  /** This device's mark. The host chose theirs in the config; the guest has the other one. */
  get myMark(): Mark {
    const host: Mark = this.config?.humanMark ?? "X";
    return this.role === "host" ? host : other(host);
  }

  private get mod() {
    return moduleFor(this.config);
  }

  hello(): Message {
    return { v: 2, type: "hello" };
  }

  private welcome(): Message {
    return { v: 2, type: "welcome", config: this.config, moves: encodeMoves(this.config.variant, this.state!.moves) };
  }

  private truncate(target: number): void {
    this.state = this.mod.fromMoves(this.config, this.state!.moves.slice(0, target));
  }

  /** The guest has lost track of the game: ask the host to send all of it again. */
  private resync(): Reaction {
    return { send: [this.hello()], events: [{ type: "resync" }] };
  }

  receive(raw: unknown): Reaction {
    // A hello from another version of the app gets a reason, not silence.
    if (isObject(raw) && raw.type === "hello" && raw.v !== PROTOCOL_VERSION) {
      return this.role === "host" ? { send: [{ v: 2, type: "reject", reason: "version" }], events: [] } : none();
    }
    const message = parseMessage(raw);
    if ("error" in message) return none();
    switch (message.type) {
      case "hello":
        return this.role === "host" ? { send: [this.welcome()], events: [] } : none();
      case "welcome":
        return this.role === "guest" ? this.onWelcome(message) : none();
      case "reject":
        return this.role === "guest" ? { send: [], events: [{ type: "rejected", reason: message.reason }] } : none();
      case "move":
        return this.role === "host" ? this.onGuestMove(message) : none();
      case "applied":
        return this.role === "guest" ? this.onApplied(message) : none();
      case "refused":
        return this.role === "guest" ? { send: [], events: [{ type: "refused", reason: message.reason }] } : none();
      case "undo-ask":
        return this.onUndoAsk(message.n);
      case "undo-answer":
        return this.onUndoAnswer(message.n, message.ok);
      case "resign":
        if (!this.state || this.resigned) return none();
        this.resigned = other(this.myMark);
        return { send: [], events: [{ type: "resigned", by: this.resigned }] };
      case "ping":
        return { send: [{ v: 2, type: "pong" }], events: [] };
      case "pong":
        return none();
      case "bye":
        return { send: [], events: [{ type: "left" }] };
    }
  }

  private onWelcome(message: Extract<Message, { type: "welcome" }>): Reaction {
    if (message.config.mode !== "network") return none();
    const moves = decodeMoves(message.config.variant, message.moves);
    if (!Array.isArray(moves)) return none();
    try {
      this.config = message.config;
      this.state = this.mod.fromMoves(message.config, moves);
    } catch {
      this.state = null;
      return none();
    }
    this.pendingUndo = null;
    return { send: [], events: [{ type: "synced" }] };
  }

  /** Host: check a guest's move against the rules and the turn, apply it, and say so. */
  private onGuestMove(message: Extract<Message, { type: "move" }>): Reaction {
    const state = this.state!;
    const refuse = (reason: string): Reaction => ({ send: [{ v: 2, type: "refused", n: message.n, reason }], events: [] });
    if (this.resigned) return refuse("game-over");
    if (message.n !== state.moves.length) return refuse("out-of-sync");
    if (state.toMove !== other(this.myMark)) return refuse("not-your-turn");
    const legal = this.mod.isLegal(state, message.move);
    if (!legal.ok) return refuse(legal.reason);
    return this.applyHere(message.move, other(this.myMark));
  }

  private applyHere(move: Move, by: Mark): Reaction {
    const n = this.state!.moves.length;
    this.state = this.mod.apply(this.state!, move);
    return { send: [{ v: 2, type: "applied", n, move, hash: this.mod.hash(this.state) }], events: [{ type: "applied", move, by }] };
  }

  /** Guest: take the host's move, and check we ended up in the same position. */
  private onApplied(message: Extract<Message, { type: "applied" }>): Reaction {
    if (!this.state) return none();
    const length = this.state.moves.length;
    if (message.n < length) return none(); // already have it
    if (message.n > length) return this.resync();
    const by = this.state.toMove;
    let next: AnyGameState;
    try {
      next = this.mod.apply(this.state, message.move);
    } catch {
      return this.resync();
    }
    if (this.mod.hash(next) !== message.hash) return this.resync();
    this.state = next;
    return { send: [], events: [{ type: "applied", move: message.move, by }] };
  }

  /** Play a move made on this device. The host applies it at once; the guest waits for the host's answer. */
  move(move: Move): Reaction & { error?: string } {
    const state = this.state;
    if (!state) return { ...none(), error: "not-connected" };
    if (this.resigned) return { ...none(), error: "game-over" };
    if (state.toMove !== this.myMark) return { ...none(), error: "not-your-turn" };
    const legal = this.mod.isLegal(state, move);
    if (!legal.ok) return { ...none(), error: legal.reason };
    if (this.role === "host") return this.applyHere(move, this.myMark);
    return { send: [{ v: 2, type: "move", n: state.moves.length, move }], events: [] };
  }

  askUndo(): Reaction & { error?: string } {
    const state = this.state;
    if (!state || this.resigned || state.status !== "playing") return { ...none(), error: "game-over" };
    if (this.pendingUndo) return { ...none(), error: "undo-pending" };
    const target = undoTarget(this.config, state.moves, this.myMark);
    if (target === null) return { ...none(), error: "nothing-to-undo" };
    this.pendingUndo = { by: this.myMark, target };
    return { send: [{ v: 2, type: "undo-ask", n: target }], events: [] };
  }

  private onUndoAsk(n: number): Reaction {
    if (!this.state) return none();
    const asker = other(this.myMark);
    if (undoTarget(this.config, this.state.moves, asker) !== n) return none();
    // Two asks at once: ours stands, theirs is declined.
    if (this.pendingUndo) return { send: [{ v: 2, type: "undo-answer", n, ok: false }], events: [] };
    this.pendingUndo = { by: asker, target: n };
    return { send: [], events: [{ type: "undo-asked", by: asker, target: n }] };
  }

  /** Answer the other player's request to take a move back. */
  answerUndo(ok: boolean): Reaction {
    const pending = this.pendingUndo;
    if (!pending || pending.by === this.myMark || !this.state) return none();
    this.pendingUndo = null;
    const send: Message[] = [{ v: 2, type: "undo-answer", n: pending.target, ok }];
    if (!ok) return { send, events: [] };
    this.truncate(pending.target);
    return { send, events: [{ type: "undo-done", target: pending.target }] };
  }

  private onUndoAnswer(n: number, ok: boolean): Reaction {
    const pending = this.pendingUndo;
    if (!pending || pending.by !== this.myMark || pending.target !== n || !this.state) return none();
    this.pendingUndo = null;
    if (!ok) return { send: [], events: [{ type: "undo-declined" }] };
    this.truncate(n);
    return { send: [], events: [{ type: "undo-done", target: n }] };
  }

  resign(): Reaction & { error?: string } {
    if (!this.state || this.resigned || this.state.status !== "playing") return { ...none(), error: "game-over" };
    this.resigned = this.myMark;
    return { send: [{ v: 2, type: "resign" }], events: [{ type: "resigned", by: this.myMark }] };
  }
}
