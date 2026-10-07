import { test } from "node:test";
import assert from "node:assert/strict";
import { GameSession, type ComputerPlayer, type SessionDeps } from "../../src/ui/game-session.ts";
import { fromMoves } from "../../src/core/variants.ts";
import { NO_HINTS } from "../../src/ui/hints.ts";
import type { SavedGame } from "../../src/adapters/store.ts";
import type { GameConfig, Level, Mark, Move } from "../../src/core/types.ts";

// The rules and state of one game on this device, with no DOM and no framework (contracts C7). The component shows it; this
// holds what game.ts's controller always did: turn a click into a move, ask the computer, undo, resign, work out the result,
// and save after every change. The first tests are written from the behaviour of that controller and the e2e specs.

const local: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
const vsComputer: GameConfig = { ...local, mode: "computer", level: 1 as Level, humanMark: "X", seed: "CLA-AAAA-BBBB" };
const place = (cell: number): Move => ({ t: "place", cell });

class FakeComputer implements ComputerPlayer {
  asked: { moves: number; level: Level }[] = [];
  private waiting: ((move: Move | null) => void) | null = null;
  reply: Move | null = null;
  holdReplies = false;
  get thinking(): boolean {
    return this.waiting !== null;
  }
  request(_config: GameConfig, moves: Move[], level: Level): Promise<Move | null> {
    this.asked.push({ moves: moves.length, level });
    this.cancel();
    return new Promise((resolve) => {
      if (this.holdReplies) this.waiting = resolve;
      else resolve(this.reply);
    });
  }
  answer(move: Move | null): void {
    const resolve = this.waiting;
    this.waiting = null;
    resolve?.(move);
  }
  cancel(): void {
    this.answer(null);
  }
}

function make(config: GameConfig, extra: Partial<SessionDeps> = {}) {
  const saves: (SavedGame | null)[] = [];
  const computer = new FakeComputer();
  const session = new GameSession(config, { computer, save: (game) => saves.push(game), now: () => 1234, delay: () => Promise.resolve(), ...extra });
  return { session, saves, computer };
}

test("placing a mark applies the move, switches the turn and saves the game", () => {
  const { session, saves } = make(local);
  session.start();
  const first = saves.length;
  assert.deepEqual(session.place(place(4)), { ok: true });
  assert.equal(session.state.toMove, "O");
  assert.equal(session.state.moves.length, 1);
  assert.equal(saves.length, first + 1);
  assert.equal(saves.at(-1)!.moves.length > 0, true);
  assert.equal(saves.at(-1)!.startedAt, 1234);
});

test("a game is saved as soon as it starts, even before the first move", () => {
  const { session, saves } = make(local);
  session.start();
  assert.equal(saves.length, 1);
  assert.equal(saves[0]!.moves, "");
});

test("an illegal cell is refused with a reason, and nothing changes", () => {
  const { session } = make(local);
  session.start();
  session.place(place(4));
  const result = session.place(place(4));
  assert.deepEqual(result, { ok: false, reason: "occupied" });
  assert.equal(session.state.moves.length, 1);
  assert.equal(session.state.toMove, "O");
});

test("nothing can be played once the game is over", () => {
  const { session } = make(local);
  session.start();
  for (const cell of [0, 3, 1, 4, 2]) session.place(place(cell));
  assert.equal(session.over, true);
  assert.equal(session.place(place(8)).ok, false);
  assert.equal(session.state.moves.length, 5);
});

test("undo against a friend takes back one move", () => {
  const { session } = make(local);
  session.start();
  session.place(place(0));
  session.place(place(1));
  assert.equal(session.canUndo, true);
  session.undo();
  assert.equal(session.state.moves.length, 1);
  assert.equal(session.state.toMove, "O");
});

test("undo with no moves played does nothing, and cannot be asked for", () => {
  const { session } = make(local);
  session.start();
  assert.equal(session.canUndo, false);
  session.undo();
  assert.equal(session.state.moves.length, 0);
});

test("undo against the computer takes back the computer's reply and the player's move before it", async () => {
  const { session, computer } = make(vsComputer);
  computer.reply = place(4);
  session.start();
  session.place(place(0));
  await session.idle();
  assert.equal(session.state.moves.length, 2);
  computer.reply = null;
  session.undo();
  assert.equal(session.state.moves.length, 0);
});

test("against the computer there is nothing to take back until the player has moved", () => {
  const { session } = make({ ...vsComputer, humanMark: "O" });
  session.start();
  assert.equal(session.canUndo, false);
});

test("resigning ends the game for that player, and the save records it", () => {
  const { session, saves } = make(local);
  session.start();
  session.place(place(0));
  session.resign("O");
  assert.equal(session.resigned, "O");
  assert.equal(session.over, true);
  assert.equal(saves.at(-1)!.resigned, "O");
  assert.equal(session.place(place(1)).ok, false);
});

test("undo after a resignation reopens the game", () => {
  const { session } = make(local);
  session.start();
  session.place(place(0));
  session.resign("O");
  session.undo();
  assert.equal(session.resigned, null);
  assert.equal(session.over, false);
});

test("hints point at the cell that wins and the cell to block, only when asked for and on the player's turn", () => {
  const { session } = make(local);
  session.start();
  for (const cell of [0, 3, 1, 4]) session.place(place(cell)); // X: 0,1  O: 3,4  X to move
  assert.deepEqual(session.hints(false), NO_HINTS);
  const hints = session.hints(true);
  assert.deepEqual(hints.win.map((h) => h.cell), [2]);
  assert.deepEqual(hints.block.map((h) => h.cell), [5]);
});

test("no hints while the computer is to move or after the game is over", async () => {
  const { session, computer } = make(vsComputer);
  computer.holdReplies = true;
  session.start();
  session.place(place(0));
  assert.equal(session.computerToMove, true);
  assert.deepEqual(session.hints(true), NO_HINTS);
  computer.answer(null);
  await session.idle();
});

test("the computer is asked after the player's move, and its reply is applied", async () => {
  const { session, computer, saves } = make(vsComputer);
  computer.reply = place(4);
  session.start();
  session.place(place(0));
  await session.idle();
  assert.deepEqual(computer.asked, [{ moves: 1, level: 1 }]);
  assert.equal(session.state.moves.length, 2);
  assert.equal(session.state.toMove, "X");
  assert.equal(saves.length >= 3, true, "saved at start, after the move and after the reply");
});

test("while the computer chooses, the session says so, and the player cannot move", () => {
  const { session, computer } = make(vsComputer);
  computer.holdReplies = true;
  session.start();
  session.place(place(0));
  assert.equal(session.thinking, true);
  assert.equal(session.place(place(8)).ok, false);
  assert.match(session.statusText(), /Computer is thinking/);
  computer.answer(place(4));
});

test("a reply that arrives after the position changed (an undo) is ignored", async () => {
  const { session, computer } = make(vsComputer);
  computer.holdReplies = true;
  session.start();
  session.place(place(0));
  session.undo();
  computer.answer(place(4));
  await session.idle();
  assert.equal(session.state.moves.length, 0);
});

test("when the computer moves first, it is asked as soon as the game starts", async () => {
  const { session, computer } = make({ ...vsComputer, humanMark: "O" });
  computer.reply = place(4);
  session.start();
  await session.idle();
  assert.equal(session.state.moves.length, 1);
  assert.equal(session.state.toMove, "O");
});

test("a win, a draw and a resignation each have their own result", () => {
  const won = make(local);
  won.session.start();
  assert.equal(won.session.result(), null);
  for (const cell of [0, 3, 1, 4, 2]) won.session.place(place(cell));
  assert.deepEqual(won.session.result(), { title: "X wins", body: "X won.", winner: "X" });

  const drawn = make(local);
  drawn.session.start();
  for (const cell of [0, 1, 2, 4, 3, 5, 7, 6, 8]) drawn.session.place(place(cell));
  assert.deepEqual(drawn.session.result(), { title: "It's a draw", body: "Nobody won this one.", winner: null });

  const resigned = make(local);
  resigned.session.start();
  resigned.session.resign("X");
  assert.deepEqual(resigned.session.result(), { title: "X resigned", body: "O won.", winner: "O" });
});

test("against the computer the result says who won in the player's words", async () => {
  const lost = make(vsComputer);
  lost.session.start();
  lost.session.resign("X");
  assert.equal(lost.session.result()!.body, "The computer won.");
  const won = make(vsComputer);
  won.session.start();
  won.session.resign("O");
  assert.equal(won.session.result()!.body, "You won.");
});

test("the status line is empty for a plain turn, names the result at the end, and the pill follows the turn", () => {
  const { session } = make(local);
  session.start();
  assert.equal(session.statusText(), "");
  assert.equal(session.pill().segments[0].active, true);
  for (const cell of [0, 3, 1, 4, 2]) session.place(place(cell));
  assert.equal(session.statusText(), "X wins.");
  assert.equal(session.pill().segments[0].winner, true);
});

test("a restored game continues from its position, its resignation and its start time", () => {
  const moves = [0, 3].map(place);
  const { session, saves } = make(local, { restored: { state: fromMoves(local, moves), resigned: null, startedAt: 99 } });
  assert.equal(session.state.moves.length, 2);
  assert.equal(session.state.toMove, "X");
  session.start();
  assert.equal(saves.at(-1)!.startedAt, 99);
  session.place(place(4));
  assert.equal(saves.at(-1)!.startedAt, 99);
  assert.equal(session.state.moves.length, 3);
});

test("a restored resigned game is still over", () => {
  const resigned: Mark = "X";
  const { session } = make(local, { restored: { state: fromMoves(local, [place(0)]), resigned, startedAt: 5 } });
  assert.equal(session.over, true);
  assert.equal(session.resigned, "X");
});

test("a restored game with the computer to move asks the computer when it starts", async () => {
  const { session, computer } = make(vsComputer, { restored: { state: fromMoves(vsComputer, [place(0)]), resigned: null, startedAt: 7 } });
  computer.reply = place(4);
  session.start();
  await session.idle();
  assert.equal(session.state.moves.length, 2);
});

test("subscribers are told after every change, and stop when they unsubscribe", () => {
  const { session } = make(local);
  let calls = 0;
  const stop = session.subscribe(() => calls++);
  assert.equal(calls, 1);
  session.start();
  session.place(place(0));
  const before = calls;
  assert.equal(before >= 3, true);
  stop();
  session.place(place(1));
  assert.equal(calls, before);
});

test("the session says what just happened, so the screen can show the result once", () => {
  const { session } = make(local);
  const seen: string[] = [];
  session.subscribe((s) => seen.push(s.change));
  session.start();
  for (const cell of [0, 3, 1, 4, 2]) session.place(place(cell));
  assert.equal(seen.at(-1), "ended");
  assert.equal(seen.includes("move"), true);
  session.undo();
  assert.equal(seen.at(-1), "undo");
});

test("the refusal wording comes from the one place that has it", () => {
  const { session } = make(local);
  session.start();
  session.place(place(0));
  const refused = session.place(place(0));
  assert.equal(refused.ok, false);
  assert.match(session.refusalText(!refused.ok ? refused.reason : ""), /taken/);
});

test("the play-again config has a new seed against the computer and none without one", () => {
  const a = make(vsComputer).session.nextConfig();
  assert.notEqual(a.seed, vsComputer.seed);
  assert.equal(a.mode, "computer");
  const b = make(local).session.nextConfig();
  assert.equal(b.seed, undefined);
});

// ---- two-device play: the position is the one both devices share, moves go through the connection ----

import { moduleFor, type AnyGameState } from "../../src/core/variants.ts";
import type { NetHooks } from "../../src/ui/net-types.ts";

class FakeNet implements NetHooks {
  myMark: Mark;
  hostCode: string | null;
  joinCode: string | null;
  current: AnyGameState;
  gone: Mark | null = null;
  refuse: string | null = null;
  asked = 0;
  resignedByMe = 0;
  left = 0;
  constructor(config: GameConfig, myMark: Mark = "X", codes: { hostCode?: string | null; joinCode?: string | null } = { hostCode: "BXK4M9" }) {
    this.myMark = myMark;
    this.hostCode = codes.hostCode ?? null;
    this.joinCode = codes.joinCode ?? null;
    this.current = moduleFor(config).newGame(config);
  }
  state(): AnyGameState {
    return this.current;
  }
  resigned(): Mark | null {
    return this.gone;
  }
  move(move: Move): string | null {
    if (this.refuse) return this.refuse;
    this.current = moduleFor(this.current.config).apply(this.current, move);
    return null;
  }
  askUndo(): string | null {
    this.asked++;
    return this.refuse;
  }
  resign(): string | null {
    this.resignedByMe++;
    this.gone = this.myMark;
    return null;
  }
  leave(): void {
    this.left++;
  }
  reconnect(): void {}
}

const network: GameConfig = { ...local, mode: "network", humanMark: "X" };

function makeNet(net = new FakeNet(network), config: GameConfig = network) {
  const saves: (SavedGame | null)[] = [];
  const session = new GameSession(config, { net, save: (game) => saves.push(game), now: () => 1234, delay: () => Promise.resolve() });
  return { session, net, saves };
}

test("two devices: the game starts from the position both share, and says so", () => {
  const { session } = makeNet();
  assert.equal(session.state.moves.length, 0);
  assert.equal(session.playMode, "two-device");
  assert.equal(session.pill().segments[0].you, true);
  assert.equal(session.pill().segments[1].you, false);
});

test("two devices: a move goes through the connection and the screen shows the shared position", () => {
  const { session, net } = makeNet();
  session.start();
  assert.deepEqual(session.place(place(4)), { ok: true });
  assert.equal(net.state().moves.length, 1);
  assert.equal(session.state.moves.length, 1);
});

test("two devices: a move the connection refuses comes back with its reason", () => {
  const { session, net } = makeNet();
  session.start();
  net.refuse = "not-your-turn";
  assert.deepEqual(session.place(place(4)), { ok: false, reason: "not-your-turn" });
  assert.equal(session.state.moves.length, 0);
});

test("two devices: sync takes the shared position, saves it, and reports an ending", () => {
  const { session, net, saves } = makeNet(new FakeNet(network, "O", { joinCode: "BXK4M9" }));
  session.start();
  net.current = fromMoves(network, [0, 3].map(place));
  session.sync();
  assert.equal(session.state.moves.length, 2);
  assert.equal(session.change, "move");
  assert.equal(saves.at(-1)!.joinCode, "BXK4M9");
  net.current = fromMoves(network, [0, 3, 1, 4, 2].map(place));
  session.sync();
  assert.equal(session.change, "ended");
  assert.equal(session.over, true);
});

test("two devices: a host saves the game with its code, and a finished game is not worth resuming", () => {
  const { session, net, saves } = makeNet();
  session.start();
  session.place(place(0));
  assert.equal(saves.at(-1)!.hostCode, "BXK4M9");
  assert.equal(saves.at(-1)!.joinCode, undefined);
  net.current = fromMoves(network, [0, 3, 1, 4, 2].map(place));
  session.sync();
  assert.equal(saves.at(-1), null);
});

test("two devices: with neither code there is nothing to come back to, so nothing is saved", () => {
  const { session, saves } = makeNet(new FakeNet(network, "X", {}));
  session.start();
  session.place(place(0));
  assert.deepEqual(saves, []);
});

test("two devices: undo is a request to the friend, possible while the game goes on", () => {
  const { session, net } = makeNet();
  session.start();
  assert.equal(session.canUndo, false);
  session.place(place(0));
  assert.equal(session.canUndo, true);
  assert.deepEqual(session.undo(), { ok: true });
  assert.equal(net.asked, 1);
  assert.equal(session.state.moves.length, 1, "nothing is taken back until the friend agrees");
  net.refuse = "undo-pending";
  assert.deepEqual(session.undo(), { ok: false, reason: "undo-pending" });
});

test("two devices: resigning is for this device's own mark, and goes through the connection", () => {
  const { session, net } = makeNet(new FakeNet(network, "O", { joinCode: "BXK4M9" }));
  session.start();
  assert.equal(session.resigner, "O");
  assert.deepEqual(session.resign("O"), { ok: true });
  assert.equal(net.resignedByMe, 1);
  session.sync();
  assert.equal(session.over, true);
  assert.equal(session.resigned, "O");
});

test("two devices: the status line says whose turn it is, and the result speaks of 'your friend'", () => {
  const { session, net } = makeNet();
  session.start();
  assert.equal(session.statusText(), "");
  session.place(place(0));
  assert.match(session.statusText(), /Waiting for your friend \(O\)/);
  net.current = fromMoves(network, [0, 3, 1, 4, 2].map(place));
  session.sync();
  assert.equal(session.result()!.body, "You won.");
  const guest = makeNet(new FakeNet(network, "O", { joinCode: "BXK4M9" }));
  guest.net.current = fromMoves(network, [0, 3, 1, 4, 2].map(place));
  guest.session.sync();
  assert.equal(guest.session.result()!.body, "Your friend won.");
  assert.equal(guest.session.canPlayAgain, false);
});

test("two devices: the computer is never asked", () => {
  const { session } = makeNet();
  session.start();
  assert.equal(session.computerToMove, false);
  assert.equal(session.thinking, false);
});

test("two devices: leaving drops the connection and, when there is a code to come back to, forgets the game", () => {
  const { session, net, saves } = makeNet();
  session.start();
  session.leave();
  assert.equal(net.left, 1);
  assert.equal(saves.at(-1), null);
  const local1 = make(local);
  local1.session.start();
  local1.session.leave();
  assert.equal(local1.saves.at(-1), null);
  const bare = makeNet(new FakeNet(network, "X", {}));
  bare.session.start();
  bare.session.leave();
  assert.equal(bare.net.left, 1);
  assert.deepEqual(bare.saves, []);
});

test("play again is offered for a game on this device only", () => {
  assert.equal(make(local).session.canPlayAgain, true);
  assert.equal(makeNet().session.canPlayAgain, false);
});
