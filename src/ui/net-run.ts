// Two-device play: hosting a game, joining one, and keeping the connection alive. The rules, the turn order and the checking of
// moves live in core/protocol.ts (NetSession); the connection lives in adapters/net.ts; this joins them. No DOM and no framework:
// the screens (Host.svelte, Join.svelte, Game.svelte) subscribe to a run and show what it says.

import type { GameConfig, Mark, Move } from "../core/types.ts";
import { NetSession, type Message, type NetEvent, type Reaction } from "../core/protocol.ts";
import { generateCode, joinLink } from "../core/pairing.ts";
import { loadSave, saveGame } from "../adapters/store.ts";
import { Guest, Host, type Status } from "../adapters/net.ts";
import { refusalMessage, VERSION_MISMATCH } from "./messages.ts";
import type { ConnectionView, NetHooks } from "./net-types.ts";
import { toast } from "./ui.ts";

const PING_EVERY_MS = 5000;
const SILENCE_LIMIT_MS = 15_000;

interface Transport {
  send(message: unknown): void;
  /** Leave on purpose: tell the other device, then close */
  leave(): void;
  /** Guests can reconnect to a host that is still there */
  reconnect: (() => void) | null;
}

/** What a run needs from the game screen once it is showing: to say something, and to ask the player something. */
export interface RunScreen {
  notify(text: string): void;
  /** Ask the player whether their friend may take a move back */
  promptUndo(by: Mark): Promise<boolean>;
}

/** One two-device game from the moment the first message arrives until somebody leaves. Store-compatible. */
export class NetRun {
  readonly session: NetSession;
  /** "waiting" until the game is on both devices (the host's waiting screen, the guest's joining screen), then "playing". */
  phase: "waiting" | "playing" = "waiting";
  connection: ConnectionView = { state: "connected" };
  /** Bumped whenever the shared position may have changed, so the game screen reads it again. */
  revision = 0;
  readonly hooks: NetHooks;

  private readonly exit: () => void;
  private transport!: Transport;
  private screen: RunScreen | null = null;
  private lastSeen = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lost = false;
  private finished = false;
  private readonly listeners = new Set<(run: NetRun) => void>();
  private readonly onPageHide = (): void => this.finish();

  constructor(session: NetSession, exit: () => void, hostCode: string | null = null, joinCode: string | null = null) {
    this.session = session;
    this.exit = exit;
    this.hooks = {
      get myMark(): Mark {
        return session.myMark;
      },
      hostCode,
      joinCode,
      state: () => session.state!,
      resigned: () => session.resigned,
      move: (move: Move) => this.run(session.move(move)),
      askUndo: () => this.run(session.askUndo()),
      resign: () => this.run(session.resign()),
      leave: () => this.finish(),
      reconnect: () => this.reconnect(),
    };
  }

  // ---- a store for the screens ----

  subscribe(run: (run: NetRun) => void): () => void {
    this.listeners.add(run);
    run(this);
    return () => void this.listeners.delete(run);
  }

  private changed(): void {
    for (const run of [...this.listeners]) run(this);
  }

  /** The game screen is showing: it takes the run's messages and questions. */
  bind(screen: RunScreen | null): void {
    this.screen = screen;
  }

  // ---- the connection ----

  attach(transport: Transport): void {
    this.transport = transport;
    this.timer = setInterval(() => this.heartbeat(), PING_EVERY_MS);
    addEventListener("pagehide", this.onPageHide);
  }

  private get playing(): boolean {
    return this.phase === "playing";
  }

  private heartbeat(): void {
    if (this.finished || !this.playing) return;
    if (!this.lost) this.transport.send({ v: 2, type: "ping" });
    if (!this.lost && Date.now() - this.lastSeen > SILENCE_LIMIT_MS) this.markLost("The connection has gone quiet.");
  }

  /** Send what a reaction says to send, and act on what it says happened. Returns the error, if any. */
  private run(reaction: Reaction & { error?: string }): string | null {
    this.flush(reaction);
    return reaction.error ?? null;
  }

  flush(reaction: Reaction): void {
    for (const message of reaction.send) this.transport.send(message);
    void this.handleEvents(reaction.events);
  }

  /** Called by the transport for every message from the other device. */
  receive(raw: unknown): void {
    if (this.finished) return;
    this.lastSeen = Date.now();
    const type = typeof raw === "object" && raw !== null ? (raw as { type?: string }).type : undefined;
    const reaction = this.session.receive(raw);
    this.flush(reaction);
    // The host shows the game as soon as the first guest has said hello.
    if (this.session.role === "host" && type === "hello" && !this.playing) this.show();
    if (this.session.role === "host" && type === "hello") this.markFound();
  }

  private show(): void {
    if (this.playing || !this.session.state) return;
    this.phase = "playing";
    this.changed();
  }

  private markFound(): void {
    this.lost = false;
    this.lastSeen = Date.now();
    this.connection = { state: "connected" };
    this.revision++;
    this.changed();
  }

  markLost(message: string): void {
    if (!this.playing) return;
    this.lost = true;
    this.connection = { state: "lost", message: `Connection lost. ${message}`.trim(), canReconnect: this.transport.reconnect !== null };
    this.changed();
  }

  /** The transport changed state. */
  status(status: Status, message?: string): void {
    if (this.finished) return;
    if (status === "connected") {
      if (this.session.role === "guest") this.transport.send(this.session.hello());
      else if (this.playing) this.markFound();
    } else if (status === "dropped") {
      this.markLost(this.session.role === "host" ? "Waiting for your friend to come back with the same code." : "Press Reconnect to try again.");
    } else if ((status === "unreachable" || status === "error") && this.playing) {
      this.markLost(message ?? "Press Reconnect to try again.");
    }
  }

  private reconnect(): void {
    this.transport.reconnect?.();
    this.connection = { state: "lost", message: "Reconnecting…", canReconnect: false };
    this.changed();
  }

  private sync(): void {
    this.revision++;
    this.changed();
  }

  private async handleEvents(events: NetEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case "synced":
          if (!this.playing) this.show();
          this.markFound();
          break;
        case "applied":
        case "resigned":
          this.sync();
          break;
        case "refused":
          this.sync();
          this.screen?.notify(refusalMessage(event.reason));
          break;
        case "undo-asked": {
          const ok = await this.screen?.promptUndo(event.by);
          this.flush(this.session.answerUndo(ok === true));
          this.sync();
          break;
        }
        case "undo-done":
          this.sync();
          this.screen?.notify("A move was taken back.");
          break;
        case "undo-declined":
          this.screen?.notify("Your friend said no.");
          break;
        case "left":
          if (this.playing) {
            this.lost = true;
            const guest = this.transport.reconnect !== null;
            this.connection = {
              state: "lost",
              message: guest ? "Your friend left the game. If they come back, press Reconnect." : "Your friend left the game. They can rejoin with the same code.",
              canReconnect: guest,
            };
            this.changed();
          }
          break;
        case "resync":
        case "rejected":
          break;
      }
    }
  }

  /** Stop: drop the connection, and go back to the start screen when `leaveScreen` is set. */
  finish(leaveScreen = false): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    removeEventListener("pagehide", this.onPageHide);
    this.transport?.leave();
    if (leaveScreen) this.exit();
  }
}

/** Forget a hosted or joined game that was saved (but never a local one the player might still want). */
function forgetHostedGame(): void {
  if (loadSave().save.game?.config.mode === "network") saveGame(null);
}

/** A line under the waiting or joining screen, and whether it is an error. Store-compatible. */
export class StatusLine {
  text: string;
  error = false;
  private readonly listeners = new Set<(line: StatusLine) => void>();

  constructor(text: string) {
    this.text = text;
  }

  subscribe(run: (line: StatusLine) => void): () => void {
    this.listeners.add(run);
    run(this);
    return () => void this.listeners.delete(run);
  }

  set(text: string, error = false): void {
    this.text = text;
    this.error = error;
    for (const run of [...this.listeners]) run(this);
  }
}

/** A hosted game on its way back after a reload: the code it was hosted under, and the moves played. */
export interface ResumeHost {
  code: string;
  moves: Move[];
}

export interface HostedRun {
  run: NetRun;
  code: string;
  link: string;
  /** Said under the code on a game that was kept, or undefined. */
  note: string | undefined;
  status: StatusLine;
  /** The host gave up waiting. */
  cancel(): void;
}

/** Host a game: the code, the link, and the connection that starts the game when a friend joins. Given `resume`, carry on a saved game. */
export function hostRun(config: GameConfig, exit: () => void, resume?: ResumeHost): HostedRun {
  const code = resume?.code ?? generateCode();
  const session = NetSession.host(config, resume?.moves);
  const run = new NetRun(session, exit, code);
  const link = joinLink(`${location.origin}${location.pathname}`, code);
  const played = resume?.moves.length ?? 0;
  const note = resume ? `Your game was kept: ${played} ${played === 1 ? "move" : "moves"} played. Your friend can rejoin with the same code.` : undefined;
  const status = new StatusLine("Connecting to the pairing service…");
  const host = new Host({
    onStatus: (state, message) => {
      if (state === "waiting") status.set("Waiting for your friend to join…");
      else if (state === "connecting") status.set("Connecting to the pairing service…");
      else if (state === "error") status.set(message ?? "The connection failed.", true);
      run.status(state, message);
    },
    onMessage: (raw) => run.receive(raw),
  });
  run.attach({ send: (m) => host.send(m), leave: () => host.close(), reconnect: null });
  void host.start(code);
  return {
    run,
    code,
    link,
    note,
    status,
    cancel: () => {
      forgetHostedGame();
      run.finish(true);
    },
  };
}

export interface JoinedRun {
  run: NetRun;
  code: string;
  status: StatusLine;
  /** Try the connection again (shown after a failure). */
  retry(): void;
  /** Give up and go back. */
  back(): void;
}

/** Join a friend's game by code. */
export function joinRun(code: string, exit: () => void): JoinedRun {
  const session = NetSession.guest();
  const run = new NetRun(session, exit, null, code);
  let inGame = false;
  /** The host turned us away: that is the answer, so the connection closing after it must not replace it. */
  let rejected = false;
  const status = new StatusLine("Joining…");
  const show = (text: string, error = false): void => {
    status.set(text, error);
    if (error) toast(text, 6000);
  };
  const guest: Guest = new Guest({
    onStatus: (state, message) => {
      if (rejected) return;
      if (inGame) {
        run.status(state, message);
        return;
      }
      if (state === "connecting") show("Connecting…");
      else if (state === "connected") {
        show("Connected. Waiting for the host…");
        run.status(state);
      } else if (state === "unreachable") show("Could not reach that game. If you are on different networks, try the same wifi, or let one device share a hotspot.", true);
      else if (state === "error") show(message ?? "The connection failed.", true);
      else if (state === "dropped") show("The connection dropped. Try again.", true);
    },
    onMessage: (raw) => {
      if (typeof raw === "object" && raw !== null && (raw as Message).type === "reject") {
        const reason = (raw as { reason?: string }).reason;
        rejected = true;
        forgetHostedGame(); // the answer is no: a reload must not ask again
        show(reason === "full" ? "This game already has two players." : VERSION_MISMATCH, true);
        return;
      }
      run.receive(raw);
      if (session.state && !inGame) inGame = true;
    },
  });
  run.attach({
    send: (m) => guest.send(m),
    leave: () => guest.leave(),
    reconnect: () => void guest.connect(code),
  });
  void guest.connect(code);
  return {
    run,
    code,
    status,
    retry: () => void guest.connect(code),
    back: () => {
      forgetHostedGame();
      run.finish(true);
    },
  };
}
