// Two-device play: hosting a game, joining one, and keeping the connection alive.
// The rules, the turn order and the checking of moves live in core/protocol.ts (NetSession); the
// connection lives in adapters/net.ts; this joins them to the game screen.

import type { GameConfig, Mark, Move } from "../core/types.ts";
import { NetSession, type Message, type NetEvent, type Reaction } from "../core/protocol.ts";
import { generateCode, joinLink } from "../core/pairing.ts";
import { loadSave, saveGame } from "../adapters/store.ts";
import { Guest, Host, type Status } from "../adapters/net.ts";
import { mountNetGame, type NetGameHandle, type NetHooks } from "./game.ts";
import { refusalMessage } from "./messages.ts";
import { qrToSvg } from "./qr.ts";
import { h, toast } from "./ui.ts";

const PING_EVERY_MS = 5000;
const SILENCE_LIMIT_MS = 15_000;

interface Transport {
  send(message: unknown): void;
  /** Leave on purpose: tell the other device, then close */
  leave(): void;
  /** Guests can reconnect to a host that is still there */
  reconnect: (() => void) | null;
}

/** One two-device game from the moment the first message arrives until somebody leaves. */
class NetRun {
  readonly session: NetSession;
  private readonly container: HTMLElement;
  private readonly exit: () => void;
  private transport!: Transport;
  private handle: NetGameHandle | null = null;
  private lastSeen = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lost = false;
  private finished = false;
  readonly hooks: NetHooks;

  constructor(session: NetSession, container: HTMLElement, exit: () => void, hostCode: string | null = null, joinCode: string | null = null) {
    this.session = session;
    this.container = container;
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

  attach(transport: Transport): void {
    this.transport = transport;
    this.timer = setInterval(() => this.heartbeat(), PING_EVERY_MS);
    addEventListener("pagehide", () => this.finish());
  }

  private heartbeat(): void {
    if (this.finished || !this.handle) return;
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
    if (this.session.role === "host" && type === "hello" && !this.handle) this.show();
    if (this.session.role === "host" && type === "hello") this.markFound();
  }

  private show(): void {
    if (this.handle || !this.session.state) return;
    // The game screen calls hooks.leave() (which stops this run) and then exit itself.
    this.handle = mountNetGame(this.container, this.session.config, this.exit, this.hooks);
  }

  private markFound(): void {
    this.lost = false;
    this.lastSeen = Date.now();
    this.handle?.setConnection({ state: "connected" });
    this.handle?.sync();
  }

  markLost(message: string): void {
    if (!this.handle) return;
    this.lost = true;
    this.handle.setConnection({ state: "lost", message: `Connection lost. ${message}`.trim(), canReconnect: this.transport.reconnect !== null });
  }

  /** The transport changed state. */
  status(status: Status, message?: string): void {
    if (this.finished) return;
    if (status === "connected") {
      if (this.session.role === "guest") this.transport.send(this.session.hello());
      else if (this.handle) this.markFound();
    } else if (status === "dropped") {
      this.markLost(this.session.role === "host" ? "Waiting for your friend to come back with the same code." : "Press Reconnect to try again.");
    } else if ((status === "unreachable" || status === "error") && this.handle) {
      this.markLost(message ?? "Press Reconnect to try again.");
    }
  }

  private reconnect(): void {
    this.transport.reconnect?.();
    this.handle?.setConnection({ state: "lost", message: "Reconnecting…", canReconnect: false });
  }

  private async handleEvents(events: NetEvent[]): Promise<void> {
    for (const event of events) {
      switch (event.type) {
        case "synced":
          if (!this.handle) this.show();
          this.markFound();
          break;
        case "applied":
        case "resigned":
          this.handle?.sync();
          break;
        case "refused":
          this.handle?.sync();
          this.handle?.notify(refusalMessage(event.reason));
          break;
        case "undo-asked": {
          const ok = await this.handle?.promptUndo(event.by);
          this.flush(this.session.answerUndo(ok === true));
          this.handle?.sync();
          break;
        }
        case "undo-done":
          this.handle?.sync();
          this.handle?.notify("A move was taken back.");
          break;
        case "undo-declined":
          this.handle?.notify("Your friend said no.");
          break;
        case "left":
          if (this.handle) {
            this.lost = true;
            const guest = this.transport.reconnect !== null;
            this.handle.setConnection({
              state: "lost",
              message: guest ? "Your friend left the game. If they come back, press Reconnect." : "Your friend left the game. They can rejoin with the same code.",
              canReconnect: guest,
            });
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
    this.transport?.leave();
    if (leaveScreen) this.exit();
  }
}

function waitingScreen(container: HTMLElement, code: string, link: string, onCancel: () => void, note?: string): { setStatus(text: string, error?: boolean): void } {
  const status = h("p", { id: "net-wait-status", class: "status-line", role: "status" }, "Connecting to the pairing service…");
  const qr = h("div", { class: "qr" });
  qr.innerHTML = qrToSvg(link);
  const copy = h("button", { class: "btn", type: "button" }, "Copy link");
  copy.addEventListener("click", () => {
    navigator.clipboard.writeText(link).then(() => toast("Link copied."), () => toast(link));
  });
  container.replaceChildren(
    h("section", { class: "screen waiting", "aria-labelledby": "waiting-title" },
      h("h2", { id: "waiting-title" }, "Waiting for a friend"),
      ...(note ? [h("p", { class: "hint-text" }, note)] : []),
      h("div", { class: "card" },
        h("p", null, "Tell your friend this code:"),
        h("p", { id: "join-code-display", class: "big-code" }, code),
        h("p", null, "Or send them this link:"),
        h("p", { class: "join-link" }, link),
        h("div", { class: "btn-row" }, copy),
        qr,
        h("p", { class: "hint-text" }, "Both devices need to be online. If they are on different networks and cannot connect, try the same wifi, or let one device share a hotspot.")),
      status,
      h("div", { class: "btn-row" }, h("button", { class: "btn", type: "button", onclick: onCancel }, "Cancel"))),
  );
  return {
    setStatus(text, error = false) {
      status.textContent = text;
      status.dataset.tone = error ? "error" : "";
      if (error) status.classList.add("net-error");
      status.setAttribute("role", error ? "alert" : "status");
    },
  };
}

/** A hosted game on its way back after a reload: the code it was hosted under, and the moves played. */
export interface ResumeHost {
  code: string;
  moves: Move[];
}

/** Forget a hosted or joined game that was saved (but never a local one the player might still want). */
function forgetHostedGame(): void {
  if (loadSave().save.game?.config.mode === "network") saveGame(null);
}

/** Host a game: show the code, link and QR code, and start when a friend joins. Given `resume`, carry on a saved game. */
export function hostGame(container: HTMLElement, config: GameConfig, exit: () => void, resume?: ResumeHost): void {
  const code = resume?.code ?? generateCode();
  const session = NetSession.host(config, resume?.moves);
  const run = new NetRun(session, container, exit, code);
  const link = joinLink(`${location.origin}${location.pathname}`, code);
  const played = resume?.moves.length ?? 0;
  const note = resume ? `Your game was kept: ${played} ${played === 1 ? "move" : "moves"} played. Your friend can rejoin with the same code.` : undefined;
  const screen = waitingScreen(container, code, link, () => {
    forgetHostedGame();
    run.finish(true);
  }, note);
  const host = new Host({
    onStatus: (status, message) => {
      if (status === "waiting") screen.setStatus("Waiting for your friend to join…");
      else if (status === "connecting") screen.setStatus("Connecting to the pairing service…");
      else if (status === "error") screen.setStatus(message ?? "The connection failed.", true);
      run.status(status, message);
    },
    onMessage: (raw) => run.receive(raw),
  });
  run.attach({ send: (m) => host.send(m), leave: () => host.close(), reconnect: null });
  void host.start(code);
}

/** Join a friend's game by code. */
export function joinGame(container: HTMLElement, code: string, exit: () => void): void {
  const session = NetSession.guest();
  const run = new NetRun(session, container, exit, null, code);
  let inGame = false;
  /** The host turned us away: that is the answer, so the connection closing after it must not replace it. */
  let rejected = false;
  const status = h("p", { id: "join-status", class: "status-line", role: "status" }, "Joining…");
  const retry = h("button", { class: "btn", type: "button", hidden: true }, "Try again");
  const back = h("button", { class: "btn", type: "button" }, "Back");
  const show = (text: string, error = false) => {
    status.textContent = text;
    status.dataset.tone = error ? "error" : "";
    status.setAttribute("role", error ? "alert" : "status");
    status.classList.toggle("net-error", error);
    retry.hidden = !error;
    if (error) toast(text, 6000);
  };
  container.replaceChildren(
    h("section", { class: "screen waiting", "aria-label": "Joining a game" },
      h("h2", null, `Joining game ${code}`),
      status,
      h("div", { class: "btn-row" }, retry, back)),
  );

  const guest: Guest = new Guest({
    onStatus: (s, message) => {
      if (rejected) return;
      if (inGame) {
        run.status(s, message);
        return;
      }
      if (s === "connecting") show("Connecting…");
      else if (s === "connected") {
        show("Connected. Waiting for the host…");
        run.status(s);
      } else if (s === "unreachable") show("Could not reach that game. If you are on different networks, try the same wifi, or let one device share a hotspot.", true);
      else if (s === "error") show(message ?? "The connection failed.", true);
      else if (s === "dropped") show("The connection dropped. Try again.", true);
    },
    onMessage: (raw) => {
      if (typeof raw === "object" && raw !== null && (raw as Message).type === "reject") {
        const reason = (raw as { reason?: string }).reason;
        rejected = true;
        forgetHostedGame(); // the answer is no: a reload must not ask again
        show(reason === "full" ? "This game already has two players." : "The other device needs the latest version of the app. Reload the page to update it.", true);
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
  retry.addEventListener("click", () => void guest.connect(code));
  back.addEventListener("click", () => {
    forgetHostedGame();
    run.finish(true);
  });
  void guest.connect(code);
}
