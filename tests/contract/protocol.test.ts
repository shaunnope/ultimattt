import { test } from "node:test";
import assert from "node:assert/strict";
import { NetSession, parseMessage, admitGuest, undoTarget, PROTOCOL_VERSION, type Message, type NetEvent } from "../../src/core/protocol.ts";
import { moduleFor } from "../../src/core/variants.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { randomSource } from "../../src/core/seed.ts";
import type { GameConfig, Move } from "../../src/core/types.ts";

const config = (variant: "classic" | "ultimate" | "cube", hostMark: "X" | "O" = "X", size: 3 | 4 | 5 = 3, winLength = 3): GameConfig => ({
  variant,
  size,
  winLength,
  mode: "network",
  humanMark: hostMark,
});

/** A host and a guest joined by a message queue we can inspect, tamper with and replay. */
function pair(cfg: GameConfig) {
  const host = NetSession.host(cfg);
  const guest = NetSession.guest();
  const log: { from: "host" | "guest"; message: Message }[] = [];
  const events: { host: NetEvent[]; guest: NetEvent[] } = { host: [], guest: [] };
  const queue: { to: "host" | "guest"; message: unknown }[] = [];
  const push = (from: "host" | "guest", messages: Message[]) => {
    for (const message of messages) {
      log.push({ from, message });
      queue.push({ to: from === "host" ? "guest" : "host", message });
    }
  };
  const pump = () => {
    while (queue.length) {
      const { to, message } = queue.shift()!;
      const side = to === "host" ? host : guest;
      const reaction = side.receive(message);
      events[to].push(...reaction.events);
      push(to, reaction.send);
    }
  };
  const connect = () => {
    push("guest", [guest.hello()]);
    pump();
  };
  return { host, guest, log, events, queue, push, pump, connect };
}

type Pair = ReturnType<typeof pair>;
const sideFor = (p: Pair, mark: "X" | "O") => (p.host.myMark === mark ? { name: "host" as const, session: p.host } : { name: "guest" as const, session: p.guest });

function playRandomGame(p: Pair, seed: number): void {
  const rand = randomSource(seed);
  const mod = moduleFor(p.host.config);
  while (p.host.state!.status === "playing") {
    const mover = sideFor(p, p.host.state!.toMove);
    const legal = mod.legalMoves(mover.session.state!);
    const move = legal[rand() % legal.length]!;
    const reaction = mover.session.move(move);
    assert.equal(reaction.error, undefined, JSON.stringify(move));
    p.push(mover.name, reaction.send);
    p.pump();
    assert.deepEqual(p.guest.state, p.host.state, "both sides agree after every move");
  }
}

test("messages are checked: wrong version, unknown type and malformed bodies are refused", () => {
  assert.deepEqual(parseMessage({ v: PROTOCOL_VERSION, type: "ping" }), { v: 2, type: "ping" });
  for (const bad of [null, "x", 5, {}, { v: 1, type: "ping" }, { v: 2 }, { v: 2, type: "nope" }, { v: 2, type: "move" }, { v: 2, type: "move", n: "1", move: {} }, { v: 2, type: "applied", n: 1, move: { t: "place", cell: 1 } }, { v: 2, type: "undo-answer", n: 1 }, { v: 2, type: "welcome", config: {}, moves: "" }]) {
    assert.ok("error" in (parseMessage(bad) as object), JSON.stringify(bad));
  }
});

test("joining: hello brings a welcome with the game's setup and moves; the guest takes the other mark", () => {
  const p = pair(config("classic", "O"));
  p.connect();
  assert.equal(p.guest.state !== null, true);
  assert.equal(p.guest.myMark, "X");
  assert.equal(p.host.myMark, "O");
  assert.deepEqual(p.guest.config, p.host.config);
  assert.ok(p.events.guest.some((e) => e.type === "synced"));
  assert.deepEqual(p.log.map((l) => l.message.type), ["hello", "welcome"]);
});

test("a hello from another version is rejected, and a second guest is turned away", () => {
  const host = NetSession.host(config("classic"));
  const reaction = host.receive({ v: 99, type: "hello" });
  assert.deepEqual(reaction.send, [{ v: 2, type: "reject", reason: "version" }]);
  assert.deepEqual(admitGuest(true), { v: 2, type: "reject", reason: "full" });
  assert.equal(admitGuest(false), null);
  const guest = NetSession.guest();
  const rejected = guest.receive({ v: 2, type: "reject", reason: "full" });
  assert.deepEqual(rejected.events, [{ type: "rejected", reason: "full" }]);
});

test("a whole game stays in step on both sides in every variant", () => {
  for (const [variant, seed] of [["classic", 3], ["ultimate", 5], ["cube", 9]] as const) {
    for (const hostMark of ["X", "O"] as const) {
      const p = pair(config(variant, hostMark));
      p.connect();
      playRandomGame(p, seed);
      assert.notEqual(p.guest.state!.status, "playing");
      assert.equal(moduleFor(p.host.config).hash(p.host.state!), moduleFor(p.host.config).hash(p.guest.state!));
    }
  }
});

test("you cannot move on the other player's turn, and a forged move is refused by the host", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  const early = p.guest.move({ t: "place", cell: 4 });
  assert.equal(early.error, "not-your-turn");
  assert.deepEqual(early.send, []);
  // a guest that ignores its own check still gets refused
  p.push("guest", [{ v: 2, type: "move", n: 0, move: { t: "place", cell: 4 } }]);
  p.pump();
  assert.ok(p.log.some((l) => l.message.type === "refused" && (l.message as { reason: string }).reason === "not-your-turn"));
  assert.equal(p.host.state!.moves.length, 0);
  assert.ok(p.events.guest.some((e) => e.type === "refused" && e.reason === "not-your-turn"));
});

test("an illegal move or one with the wrong move number is refused and changes nothing", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  const first = p.host.move({ t: "place", cell: 0 });
  p.push("host", first.send);
  p.pump();
  p.push("guest", [{ v: 2, type: "move", n: 1, move: { t: "place", cell: 0 } }]); // occupied
  p.pump();
  p.push("guest", [{ v: 2, type: "move", n: 7, move: { t: "place", cell: 5 } }]); // out of step
  p.pump();
  const refusals = p.log.filter((l) => l.message.type === "refused").map((l) => (l.message as { reason: string }).reason);
  assert.deepEqual(refusals, ["occupied", "out-of-sync"]);
  assert.equal(p.host.state!.moves.length, 1);
  assert.deepEqual(p.guest.state, p.host.state);
});

test("a position that disagrees is noticed by its hash, and the guest asks for the game again", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  const m = p.host.move({ t: "place", cell: 4 });
  const applied = m.send[0] as Extract<Message, { type: "applied" }>;
  const reaction = p.guest.receive({ ...applied, hash: applied.hash ^ 1 });
  assert.deepEqual(reaction.send, [p.guest.hello()]);
  assert.ok(reaction.events.some((e) => e.type === "resync"));
  // the host answers with the whole game and the guest is back in step
  const welcome = p.host.receive(p.guest.hello()).send[0]!;
  p.guest.receive(welcome);
  p.host.state = p.host.state!; // unchanged
  assert.deepEqual(p.guest.state, p.host.state);
});

test("a move that arrives ahead of the ones before it asks for the game again", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  const m = p.host.move({ t: "place", cell: 4 }).send[0] as Extract<Message, { type: "applied" }>;
  const reaction = p.guest.receive({ ...m, n: 5 });
  assert.deepEqual(reaction.send, [p.guest.hello()]);
});

test("undo: the other player is asked, and agreeing takes both back to the same position", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  for (const cell of [4, 0, 8]) {
    const mover = sideFor(p, p.host.state!.toMove);
    p.push(mover.name, mover.session.move({ t: "place", cell }).send);
    p.pump();
  }
  // X (host) moved last and asks to take that move back
  const ask = p.host.askUndo();
  assert.equal(ask.error, undefined);
  p.push("host", ask.send);
  p.pump();
  assert.ok(p.events.guest.some((e) => e.type === "undo-asked"));
  const answer = p.guest.answerUndo(true);
  assert.deepEqual(answer.events, [{ type: "undo-done", target: 2 }]);
  p.push("guest", answer.send);
  p.pump();
  assert.equal(p.host.state!.moves.length, 2);
  assert.deepEqual(p.guest.state, p.host.state);
  assert.ok(p.events.host.some((e) => e.type === "undo-done"));
});

test("undo declined changes nothing", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  p.push("host", p.host.move({ t: "place", cell: 4 }).send);
  p.pump();
  p.push("host", p.host.askUndo().send);
  p.pump();
  p.push("guest", p.guest.answerUndo(false).send);
  p.pump();
  assert.equal(p.host.state!.moves.length, 1);
  assert.deepEqual(p.guest.state, p.host.state);
  assert.ok(p.events.host.some((e) => e.type === "undo-declined"));
});

test("you can only ask to take back your own move, and two asks at once do not both stand", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  assert.equal(p.guest.askUndo().error, "nothing-to-undo");
  p.push("host", p.host.move({ t: "place", cell: 4 }).send);
  p.pump();
  assert.equal(p.guest.askUndo().error, "nothing-to-undo"); // the guest has not moved yet
  p.push("guest", p.guest.move({ t: "place", cell: 0 }).send);
  p.pump();
  const a = p.host.askUndo();
  const b = p.guest.askUndo();
  assert.equal(a.error, undefined);
  assert.equal(b.error, undefined);
  // each side's ask reaches the other while it has its own outstanding: both are declined
  const fromHost = p.guest.receive(a.send[0]!);
  assert.deepEqual(fromHost.send, [{ v: 2, type: "undo-answer", n: (a.send[0] as { n: number }).n, ok: false }]);
});

test("Cube: taking back a move after a layer turn takes back the turn and the mark together", () => {
  const cfg = config("cube", "X");
  const moves: Move[] = [
    { t: "place", face: 2, cell: 0 }, { t: "place", face: 0, cell: 0 }, { t: "place", face: 2, cell: 1 },
    { t: "place", face: 0, cell: 1 }, { t: "place", face: 2, cell: 2 }, { t: "rotate", axis: "y", layer: 0, dir: 1 },
  ];
  assert.equal(undoTarget(cfg, moves, "X"), 4);
  assert.equal(undoTarget(cfg, moves.slice(0, 5), "X"), 4);
  assert.equal(undoTarget(cfg, moves.slice(0, 4), "O"), 3);
  assert.equal(undoTarget(cfg, [], "X"), null);
});

test("resigning ends the game for both, and no more moves are accepted", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  p.push("guest", p.guest.resign().send);
  p.pump();
  assert.equal(p.host.resigned, "O");
  assert.equal(p.guest.resigned, "O");
  assert.ok(p.events.host.some((e) => e.type === "resigned" && e.by === "O"));
  const late = p.host.move({ t: "place", cell: 0 });
  assert.equal(late.error, "game-over");
});

test("Cube: a scoring placement and its layer turn are two moves by the same player; the other cannot cut in", () => {
  const p = pair(config("cube", "X"));
  p.connect();
  const play = (mark: "X" | "O", move: Move) => {
    const side = sideFor(p, mark);
    const r = side.session.move(move);
    assert.equal(r.error, undefined, JSON.stringify(move));
    p.push(side.name, r.send);
    p.pump();
  };
  play("X", { t: "place", face: 2, cell: 0 });
  play("O", { t: "place", face: 0, cell: 0 });
  play("X", { t: "place", face: 2, cell: 1 });
  play("O", { t: "place", face: 0, cell: 1 });
  play("X", { t: "place", face: 2, cell: 2 }); // scores: X must now turn a layer
  assert.equal(p.guest.move({ t: "place", face: 1, cell: 0 }).error, "not-your-turn");
  p.push("guest", [{ v: 2, type: "move", n: p.host.state!.moves.length, move: { t: "place", face: 1, cell: 0 } }]);
  p.pump();
  assert.equal(p.host.state!.moves.length, 5);
  play("X", { t: "rotate", axis: "y", layer: 0, dir: 1 });
  play("O", { t: "place", face: 0, cell: 2 });
  assert.deepEqual(p.guest.state, p.host.state);
});

test("a guest that comes back gets the whole game and carries on", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  for (const cell of [4, 0, 8]) {
    const mover = sideFor(p, p.host.state!.toMove);
    p.push(mover.name, mover.session.move({ t: "place", cell }).send);
    p.pump();
  }
  const returned = NetSession.guest();
  const welcome = p.host.receive(returned.hello()).send[0]!;
  returned.receive(welcome);
  assert.deepEqual(returned.state, p.host.state);
  assert.equal(returned.myMark, p.guest.myMark);
});

test("liveness and leaving: ping is answered, bye is reported", () => {
  const host = NetSession.host(config("classic"));
  assert.deepEqual(host.receive({ v: 2, type: "ping" }).send, [{ v: 2, type: "pong" }]);
  assert.deepEqual(host.receive({ v: 2, type: "pong" }).send, []);
  assert.deepEqual(host.receive({ v: 2, type: "bye" }).events, [{ type: "left" }]);
});

test("messages that make no sense here are ignored: no reply, no change", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  const before = JSON.stringify(p.host.state);
  for (const odd of [{ v: 2, type: "applied", n: 0, move: { t: "place", cell: 4 }, hash: 1 }, { v: 2, type: "welcome", config: p.host.config, moves: "" }, { v: 2, type: "undo-answer", n: 0, ok: true }, "garbage", null]) {
    const r = p.host.receive(odd);
    assert.deepEqual(r.send, []);
    assert.deepEqual(r.events, []);
  }
  assert.equal(JSON.stringify(p.host.state), before);
  assert.deepEqual(p.guest.receive({ v: 2, type: "move", n: 0, move: { t: "place", cell: 1 } }).send, []);
  assert.deepEqual(p.guest.receive({ v: 2, type: "hello" }).send, []);
});

test("display preferences never travel: messages hold only game data", () => {
  const p = pair(config("classic", "X"));
  p.connect();
  playRandomGame(p, 4);
  for (const { message } of p.log) assert.ok(!/palette|colour|color|icon|notation/i.test(JSON.stringify(message)));
  assert.ok(fromMoves(p.host.config, p.host.state!.moves).moves.length > 0);
});

test("a host that resumes a saved game welcomes a guest with the moves already played", () => {
  const cfg = config("classic", "X");
  const saved: Move[] = [{ t: "place", cell: 0 }, { t: "place", cell: 4 }];
  const host = NetSession.host(cfg, saved);
  assert.equal(host.state!.moves.length, 2);
  assert.equal(host.myMark, "X");
  const guest = NetSession.guest();
  guest.receive(host.receive(guest.hello()).send[0]!);
  assert.deepEqual(guest.state, fromMoves(cfg, saved));
  // and play carries on from there: it is X's turn again
  assert.equal(host.move({ t: "place", cell: 2 }).error, undefined);
  assert.equal(NetSession.host(cfg).state!.moves.length, 0);
});

test("a saved game that does not play through the rules cannot be resumed", () => {
  const cfg = config("classic", "X");
  assert.throws(() => NetSession.host(cfg, [{ t: "place", cell: 0 }, { t: "place", cell: 0 }]), /occupied/);
});

test("protocol version is 2 and every message carries it", () => {
  assert.equal(PROTOCOL_VERSION, 2);
  const p = pair(config("classic"));
  p.connect();
  p.push("host", p.host.move({ t: "place", cell: 4 }).send);
  p.pump();
  assert.ok(p.log.length >= 3);
  for (const { message } of p.log) assert.equal(message.v, 2);
});

test("a version 1 hello is rejected with the version reason, a version 1 message is ignored", () => {
  const host = NetSession.host(config("classic"));
  assert.deepEqual(host.receive({ v: 1, type: "hello" }).send, [{ v: 2, type: "reject", reason: "version" }]);
  const guest = NetSession.guest();
  assert.deepEqual(guest.receive({ v: 1, type: "welcome", config: config("classic"), moves: "" }), { send: [], events: [] });
  assert.deepEqual(guest.receive({ v: 2, type: "reject", reason: "version" }).events, [{ type: "rejected", reason: "version" }]);
});

test("welcome carries the win length and no seed, and the guest reads them back", () => {
  const p = pair(config("ultimate", "X", 4, 3));
  p.connect();
  const welcome = p.log.find((l) => l.message.type === "welcome")!.message as Extract<Message, { type: "welcome" }>;
  assert.equal(welcome.config.winLength, 3);
  assert.equal(welcome.config.size, 4);
  assert.ok(!("seed" in welcome.config));
  assert.deepEqual(p.guest.config, p.host.config);
});

test("a welcome with a bad win length is ignored", () => {
  const guest = NetSession.guest();
  const bad = { ...config("classic", "X", 4, 4), winLength: 5 };
  assert.deepEqual(guest.receive({ v: 2, type: "welcome", config: bad, moves: "" }), { send: [], events: [] });
  assert.equal(guest.state, null);
});

test("a whole game of larger boards and shorter win lengths stays in step on both sides", () => {
  const cases: [GameConfig, number][] = [
    [config("classic", "X", 5, 3), 4],
    [config("ultimate", "O", 4, 3), 6],
    [config("cube", "X", 4, 3), 8],
    [config("cube", "O", 5, 4), 2],
  ];
  for (const [cfg, seed] of cases) {
    const p = pair(cfg);
    p.connect();
    playRandomGame(p, seed);
    assert.notEqual(p.guest.state!.status, "playing");
    assert.equal(moduleFor(cfg).hash(p.host.state!), moduleFor(cfg).hash(p.guest.state!));
  }
});
