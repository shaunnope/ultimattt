// Pairing over PeerJS, STUN only (STUN-p2p-spec.md in the reference game).
//
// Two devices find each other with a six-character code through PeerJS's public broker, then talk
// directly over a WebRTC data channel. There is no TURN relay: the devices must be able to reach each
// other, which in practice means the same wifi, or one sharing a hotspot with the other.
//
// PeerJS is loaded only when somebody hosts or joins, from a CDN, and is never cached by the service
// worker. Everything else in the app works without it.

import { describePeerError, peerIdFor } from "../core/pairing.ts";

const PEERJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
const CONNECT_TIMEOUT_MS = 15_000;

// STUN only. Supplying `config` replaces PeerJS's default, which includes a public TURN relay.
export const ICE_SERVERS: { urls: string | string[] }[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export function peerOptions(): { debug: number; config: { iceServers: typeof ICE_SERVERS } } {
  return { debug: 0, config: { iceServers: ICE_SERVERS } };
}

/** The little of PeerJS this app uses. */
interface DataConnectionLike {
  peer: string;
  open: boolean;
  send(data: unknown): void;
  close(options?: { flush?: boolean }): void;
  on(event: "open" | "close", cb: () => void): void;
  on(event: "data", cb: (data: unknown) => void): void;
  on(event: "error", cb: (error: unknown) => void): void;
}
interface PeerLike {
  destroyed: boolean;
  disconnected: boolean;
  on(event: "open", cb: (id: string) => void): void;
  on(event: "connection", cb: (conn: DataConnectionLike) => void): void;
  on(event: "disconnected", cb: () => void): void;
  on(event: "error", cb: (error: { type?: string }) => void): void;
  once(event: "open", cb: (id: string) => void): void;
  connect(id: string, options?: { reliable?: boolean }): DataConnectionLike;
  reconnect(): void;
  destroy(): void;
}
type PeerConstructor = new (...args: unknown[]) => PeerLike;

let library: PeerConstructor | null = null;

function loadPeerJs(): Promise<PeerConstructor> {
  const existing = (window as unknown as { Peer?: PeerConstructor }).Peer;
  if (library) return Promise.resolve(library);
  if (existing) return Promise.resolve((library = existing));
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PEERJS_URL;
    script.async = true;
    script.onload = () => {
      const Peer = (window as unknown as { Peer?: PeerConstructor }).Peer;
      if (Peer) resolve((library = Peer));
      else reject(new Error("PeerJS did not define Peer"));
    };
    script.onerror = () => reject(new Error("Could not load PeerJS"));
    document.head.append(script);
  });
}

export type Status = "idle" | "connecting" | "waiting" | "connected" | "dropped" | "unreachable" | "error";

export interface Handlers {
  onStatus(status: Status, message?: string): void;
  onMessage(message: unknown): void;
}

const BROKER_ERRORS = new Set(["network", "server-error", "socket-error", "socket-closed", "disconnected"]);

/** The broker socket can drop while channels stay up: register again under the same name, backing off. */
function watchBroker(peer: PeerLike, still: () => boolean): void {
  let delay = 1000;
  peer.on("open", () => {
    delay = 1000;
  });
  peer.on("disconnected", () => {
    setTimeout(() => {
      if (still() && !peer.destroyed && peer.disconnected) peer.reconnect();
    }, delay);
    delay = Math.min(delay * 2, 30_000);
  });
}

/** The device that created the game and waits for one guest on a code. */
export class Host {
  private peer: PeerLike | null = null;
  private link: DataConnectionLike | null = null;
  private closed = false;
  private readonly handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  async start(code: string): Promise<void> {
    this.handlers.onStatus("connecting");
    let Peer: PeerConstructor;
    try {
      Peer = await loadPeerJs();
    } catch {
      this.handlers.onStatus("error", "Cannot reach the pairing service. Everything else still works.");
      return;
    }
    const peer = new Peer(peerIdFor(code), peerOptions());
    this.peer = peer;
    watchBroker(peer, () => this.peer === peer);
    peer.on("open", () => this.handlers.onStatus(this.link ? "connected" : "waiting"));
    peer.on("connection", (incoming) => {
      if (this.closed) {
        incoming.close(); // cancelled a moment ago: nobody is hosting any more
        return;
      }
      if (this.link) {
        // One guest only. A newcomer is told the game is full and dropped.
        incoming.on("open", () => {
          incoming.send({ v: 2, type: "reject", reason: "full" });
          incoming.close({ flush: true });
        });
        return;
      }
      this.bind(incoming);
    });
    peer.on("error", (error) => {
      if (this.link && BROKER_ERRORS.has(error?.type ?? "")) return; // an attached guest does not need the broker
      this.handlers.onStatus("error", describePeerError(error));
    });
  }

  private bind(incoming: DataConnectionLike): void {
    let opened = false;
    incoming.on("open", () => {
      opened = true;
      this.link = incoming;
      this.handlers.onStatus("connected");
    });
    incoming.on("data", (data) => {
      if (!this.closed) this.handlers.onMessage(data);
    });
    const closed = () => {
      if (this.link !== incoming) return;
      this.link = null;
      this.handlers.onStatus(opened ? "dropped" : "waiting");
    };
    incoming.on("close", closed);
    incoming.on("error", closed);
  }

  send(message: unknown): void {
    try {
      this.link?.send(message);
    } catch {
      /* closed between the check and the send; the close handler reports it */
    }
  }

  close(): void {
    this.send({ v: 2, type: "bye" });
    const link = this.link;
    const peer = this.peer;
    this.closed = true;
    this.link = null;
    this.peer = null;
    if (link) {
      link.close({ flush: true });
      setTimeout(() => peer?.destroy(), 500); // let the goodbye get through
    } else {
      peer?.destroy(); // nobody joined: stop being findable at once
    }
    this.handlers.onStatus("idle");
  }
}

/** The device that joins a game by code. */
export class Guest {
  private peer: PeerLike | null = null;
  private link: DataConnectionLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private status: Status = "idle";
  private readonly handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  private set(status: Status, message?: string): void {
    this.status = status;
    this.handlers.onStatus(status, message);
  }

  async connect(code: string): Promise<void> {
    this.hangUp();
    this.set("connecting");
    let Peer: PeerConstructor;
    try {
      Peer = await loadPeerJs();
    } catch {
      this.set("error", "Cannot reach the pairing service. Everything else still works.");
      return;
    }
    const peer = new Peer(peerOptions());
    this.peer = peer;
    watchBroker(peer, () => this.peer === peer);
    // Nothing errors when ICE cannot find a path; it just keeps trying.
    this.timer = setTimeout(() => {
      if (this.status !== "connecting") return;
      this.hangUp();
      this.set("unreachable");
    }, CONNECT_TIMEOUT_MS);
    peer.once("open", () => {
      const link = peer.connect(peerIdFor(code), { reliable: true });
      this.link = link;
      let opened = false;
      link.on("open", () => {
        opened = true;
        if (this.timer) clearTimeout(this.timer);
        this.set("connected");
      });
      link.on("data", (data) => this.handlers.onMessage(data));
      const closed = () => {
        if (this.link !== link) return;
        this.link = null;
        this.set(opened ? "dropped" : "unreachable");
      };
      link.on("close", closed);
      link.on("error", closed);
    });
    peer.on("error", (error) => {
      if (this.status === "connected" && BROKER_ERRORS.has(error?.type ?? "")) return;
      this.hangUp();
      this.set("error", describePeerError(error));
    });
  }

  send(message: unknown): void {
    if (!this.link?.open) return;
    try {
      this.link.send(message);
    } catch {
      /* as on the host */
    }
  }

  /** Leaving on purpose: tell the host first, and flush so it arrives. */
  leave(): void {
    this.send({ v: 2, type: "bye" });
    const link = this.link;
    const peer = this.peer;
    if (this.timer) clearTimeout(this.timer);
    this.link = null;
    this.peer = null;
    link?.close({ flush: true });
    setTimeout(() => peer?.destroy(), 500);
    this.set("idle");
  }

  private hangUp(): void {
    if (this.timer) clearTimeout(this.timer);
    const link = this.link;
    const peer = this.peer;
    this.link = null;
    this.peer = null;
    link?.close();
    peer?.destroy();
  }
}
