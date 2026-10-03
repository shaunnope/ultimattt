// A stand-in for PeerJS that pairs pages of one browser through a BroadcastChannel, so two-device play can be
// tested with no internet. It offers the small part of the PeerJS API that src/adapters/net.ts uses:
//   new Peer(id?, options), peer.on/once("open" | "connection" | "disconnected" | "error"), peer.connect(id),
//   peer.reconnect(), peer.destroy(), and connections with on("open" | "data" | "close" | "error"), send(), close().
// window.__fakePeer.drop() drops every connection on every page, as a lost network would.
(() => {
  const channel = new BroadcastChannel("fake-peerjs");
  const peers = new Map();
  const registry = new Set();
  let counter = 0;

  class Emitter {
    constructor() {
      this.handlers = {};
    }
    on(event, fn) {
      (this.handlers[event] = this.handlers[event] || []).push(fn);
      return this;
    }
    once(event, fn) {
      const wrapped = (...args) => {
        this.off(event, wrapped);
        fn(...args);
      };
      return this.on(event, wrapped);
    }
    off(event, fn) {
      this.handlers[event] = (this.handlers[event] || []).filter((f) => f !== fn);
    }
    emit(event, ...args) {
      (this.handlers[event] || []).slice().forEach((fn) => fn(...args));
    }
  }

  class DataConnection extends Emitter {
    constructor(local, remote, connectionId) {
      super();
      this.local = local;
      this.peer = remote;
      this.connectionId = connectionId;
      this.open = false;
      this.answered = false;
    }
    send(data) {
      if (!this.open) throw new Error("connection is not open");
      channel.postMessage({ kind: "data", to: this.peer, conn: this.connectionId, data: JSON.parse(JSON.stringify(data)) });
    }
    close() {
      if (!this.open) return;
      this.open = false;
      channel.postMessage({ kind: "close", conn: this.connectionId });
      setTimeout(() => this.emit("close"), 0);
    }
    remoteClosed() {
      if (!this.open) return;
      this.open = false;
      this.emit("close");
    }
  }

  class Peer extends Emitter {
    constructor(first) {
      super();
      this.id = typeof first === "string" ? first : "anon-" + Math.random().toString(36).slice(2, 8);
      this.destroyed = false;
      this.disconnected = false;
      this.conns = new Map();
      setTimeout(() => {
        if (registry.has(this.id)) {
          this.emit("error", { type: "unavailable-id" });
          return;
        }
        peers.set(this.id, this);
        registry.add(this.id);
        channel.postMessage({ kind: "register", id: this.id });
        this.emit("open", this.id);
      }, 10);
    }
    connect(remote) {
      const conn = new DataConnection(this, remote, "c" + ++counter + Math.random().toString(36).slice(2, 6));
      this.conns.set(conn.connectionId, conn);
      channel.postMessage({ kind: "connect", to: remote, from: this.id, conn: conn.connectionId });
      setTimeout(() => {
        if (!conn.answered && !this.destroyed) this.emit("error", { type: "peer-unavailable" });
      }, 400);
      return conn;
    }
    reconnect() {}
    destroy() {
      this.destroyed = true;
      for (const conn of this.conns.values()) conn.close();
      peers.delete(this.id);
      registry.delete(this.id);
      channel.postMessage({ kind: "unregister", id: this.id });
    }
  }

  channel.onmessage = ({ data: m }) => {
    switch (m.kind) {
      case "register":
        registry.add(m.id);
        break;
      case "unregister":
        registry.delete(m.id);
        break;
      case "connect": {
        const host = peers.get(m.to);
        if (!host) return;
        const conn = new DataConnection(host, m.from, m.conn);
        conn.answered = true;
        host.conns.set(m.conn, conn);
        host.emit("connection", conn);
        conn.open = true;
        setTimeout(() => conn.emit("open"), 0);
        channel.postMessage({ kind: "ack", conn: m.conn });
        break;
      }
      case "ack":
        for (const peer of peers.values()) {
          const conn = peer.conns.get(m.conn);
          if (conn && !conn.answered) {
            conn.answered = true;
            conn.open = true;
            setTimeout(() => conn.emit("open"), 0);
          }
        }
        break;
      case "data":
        for (const peer of peers.values()) {
          if (peer.id === m.to) peer.conns.get(m.conn)?.emit("data", m.data);
        }
        break;
      case "close":
        for (const peer of peers.values()) peer.conns.get(m.conn)?.remoteClosed();
        break;
      case "dropAll":
        for (const peer of peers.values()) for (const conn of peer.conns.values()) conn.remoteClosed();
        break;
    }
  };

  window.Peer = Peer;
  window.__fakePeer = {
    drop() {
      for (const peer of peers.values()) for (const conn of peer.conns.values()) conn.remoteClosed();
      channel.postMessage({ kind: "dropAll" });
    },
  };
})();
