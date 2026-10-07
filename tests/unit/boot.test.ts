import { test } from "node:test";
import assert from "node:assert/strict";
import { decideBoot } from "../../src/ui/boot.ts";
import { defaultSave, savedGameFrom, type SaveFile } from "../../src/adapters/store.ts";
import { packLink, recordFromGame } from "../../src/core/record.ts";
import type { GameConfig, Move } from "../../src/core/types.ts";

// What the app opens on, in the order the start-up has always used (data-model: Boot decision): a ?join= code first, then a
// good ?watch= replay link (a bad one is explained and the rest carries on), then a game left in progress, then the start screen.

const local: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
const network: GameConfig = { ...local, mode: "network" };
const place = (cell: number): Move => ({ t: "place", cell });
const withGame = (game: SaveFile["game"]): SaveFile => ({ ...defaultSave(), game });
const midGame = (config: GameConfig, extra: { hostCode?: string; joinCode?: string } = {}) => savedGameFrom(config, [0, 4].map(place), 5, undefined, extra.hostCode, extra.joinCode);
const finishedGame = (config: GameConfig, extra: { hostCode?: string; joinCode?: string } = {}) => savedGameFrom(config, [0, 3, 1, 4, 2].map(place), 5, undefined, extra.hostCode, extra.joinCode);
const link = () => packLink(recordFromGame(local, [0, 3, 1, 4, 2].map(place)), 1);

test("with nothing in the address and nothing saved, the start screen opens", () => {
  assert.deepEqual(decideBoot("", defaultSave()), { screen: "setup", toasts: [] });
});

test("a ?join= code opens the join, and the query is cleared", () => {
  const boot = decideBoot("?join=BXK4M9", defaultSave());
  assert.deepEqual(boot, { screen: "join", code: "BXK4M9", clearQuery: true, toasts: [] });
});

test("a join code wins over a replay link and over a saved game", () => {
  const boot = decideBoot(`?join=BXK4M9&${link().slice(link().indexOf("?") + 1)}`, withGame(midGame(local)));
  assert.equal(boot.screen, "join");
});

test("a bad join code is ignored, and the start-up carries on", () => {
  assert.equal(decideBoot("?join=nope", defaultSave()).screen, "setup");
});

test("a good ?watch= link opens the replay and leaves the address as it is", () => {
  const boot = decideBoot(link().slice(link().indexOf("?")), withGame(midGame(local)));
  assert.equal(boot.screen, "watch");
  assert.ok(boot.screen === "watch" && boot.record.moves.length === 5);
  assert.equal(boot.clearQuery, undefined);
});

test("a ?watch= link that is not good is explained, the query is cleared, and the saved game carries on", () => {
  const boot = decideBoot("?watch=1&game=classic", withGame(midGame(local)));
  assert.equal(boot.screen, "game");
  assert.equal(boot.clearQuery, true);
  assert.equal(boot.toasts.length, 1);
  assert.match(boot.toasts[0]!, /link/i);
});

test("a bad ?watch= link with nothing saved shows the start screen and the explanation", () => {
  const boot = decideBoot("?watch=1", defaultSave());
  assert.equal(boot.screen, "setup");
  assert.equal(boot.toasts.length, 1);
});

test("a local game in progress resumes with its rebuilt position", () => {
  const boot = decideBoot("", withGame(midGame(local)));
  assert.equal(boot.screen, "game");
  assert.ok(boot.screen === "game");
  assert.deepEqual(boot.config, local);
  assert.equal(boot.restored.state.moves.length, 2);
  assert.equal(boot.restored.resigned, null);
  assert.equal(boot.restored.startedAt, 5);
});

test("a finished local game is shown as it ended", () => {
  const boot = decideBoot("", withGame(finishedGame(local)));
  assert.equal(boot.screen, "game");
});

test("a saved game whose moves do not play is not resumed", () => {
  const game = midGame(local);
  game.moves = "zz";
  assert.equal(decideBoot("", withGame(game)).screen, "setup");
});

test("a two-device game this device was hosting is hosted again under the same code, with its moves", () => {
  const boot = decideBoot("", withGame(midGame(network, { hostCode: "BXK4M9" })));
  assert.ok(boot.screen === "host");
  assert.equal(boot.code, "BXK4M9");
  assert.equal(boot.moves.length, 2);
  assert.deepEqual(boot.config, network);
});

test("a two-device game this device joined as a guest is joined again with the same code", () => {
  assert.deepEqual(decideBoot("", withGame(midGame(network, { joinCode: "BXK4M9" }))), { screen: "rejoin", code: "BXK4M9", toasts: [] });
});

test("a finished two-device game is not resumed, and its save is cleared", () => {
  for (const extra of [{ hostCode: "BXK4M9" }, { joinCode: "BXK4M9" }]) {
    const boot = decideBoot("", withGame(finishedGame(network, extra)));
    assert.equal(boot.screen, "setup");
    assert.equal(boot.clearSave, true);
  }
});

test("a resigned two-device game counts as finished", () => {
  const game = midGame(network, { hostCode: "BXK4M9" });
  game.resigned = "X";
  const boot = decideBoot("", withGame(game));
  assert.equal(boot.screen, "setup");
  assert.equal(boot.clearSave, true);
});

test("a two-device save without a code is cleared, since there is nothing to pick up", () => {
  const boot = decideBoot("", withGame(midGame(network)));
  assert.equal(boot.screen, "setup");
  assert.equal(boot.clearSave, true);
});

test("a notice from reading the save (for example a corrupt one set aside) is passed on to show", () => {
  const boot = decideBoot("", defaultSave(), "Your saved game could not be read.");
  assert.deepEqual(boot.toasts, ["Your saved game could not be read."]);
});

test("the replay link's error comes before the save's notice", () => {
  const boot = decideBoot("?watch=1", defaultSave(), "notice");
  assert.equal(boot.toasts.length, 2);
  assert.equal(boot.toasts[1], "notice");
});
