// Mark colours and turn notation are display preferences of one device. They must never reach a share link, a seed,
// the game inside a save, or a message to the other device (FR-018, FR-028).

import { test } from "node:test";
import assert from "node:assert/strict";
import { PALETTES } from "../../src/core/palette.ts";
import { recordFromGame, packLink } from "../../src/core/record.ts";
import { defaultSave, savedGameFrom, serializeSave } from "../../src/adapters/store.ts";
import { DEFAULT_SETTINGS } from "../../src/core/settings.ts";
import { newSeed } from "../../src/core/seed.ts";
import { NetSession, type Message } from "../../src/core/protocol.ts";
import { describeMove } from "../../src/ui/replay-text.ts";
import type { GameConfig, Move } from "../../src/core/types.ts";

const place = (cell: number): Move => ({ t: "place", cell });
const classic: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", level: 3, humanMark: "X", seed: newSeed("classic", 3, 3) };
const net: GameConfig = { variant: "classic", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "network", humanMark: "X" };

/** Every colour and palette id, as text a leak could contain. */
const SECRETS = [
  ...PALETTES.flatMap((p) => [p.id === "default" ? "markPalette" : p.id, p.label, p.X.light, p.X.dark, p.O.light, p.O.dark]),
  "markColors",
  "cubeNotation",
  "--mark-x",
];

const leaks = (text: string): string[] => SECRETS.filter((s) => text.toLowerCase().includes(s.toLowerCase()));

test("a share link, a seed and a record never contain a palette id or a colour", () => {
  const moves = [0, 4, 8].map(place);
  const record = recordFromGame(classic, moves);
  for (const text of [JSON.stringify(record), packLink(record, 1), decodeURIComponent(packLink(record, 1)), classic.seed!]) {
    assert.deepEqual(leaks(text), [], text);
  }
});

test("the game inside a save has no palette or notation; they live in the settings next to it", () => {
  const moves = [0, 4, 8].map(place);
  const save = { ...defaultSave(), settings: { ...DEFAULT_SETTINGS, markPalette: "forest", cubeNotation: "cube" as const }, game: savedGameFrom(classic, moves, 1) };
  const parsed = JSON.parse(serializeSave(save));
  assert.equal(parsed.settings.markPalette, "forest");
  assert.deepEqual(leaks(JSON.stringify(parsed.game)), []);
});

test("no message of a two-device game carries a palette id, a colour or the turn notation", () => {
  const host = NetSession.host(net);
  const guest = NetSession.guest();
  const log: Message[] = [];
  const hello = guest.hello();
  log.push(hello);
  const welcome = host.receive(hello);
  log.push(...welcome.send);
  for (const m of welcome.send) guest.receive(m);
  const applied = host.move(place(4));
  log.push(...applied.send);
  for (const m of applied.send) guest.receive(m);
  const reply = guest.move(place(0));
  log.push(...reply.send);
  for (const message of log) assert.deepEqual(leaks(JSON.stringify(message)), [], JSON.stringify(message));
  assert.ok(log.length >= 4);
});

test("the move list reads the same text for a Cube turn whatever the setting only in its display style", () => {
  const cube: GameConfig = { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "local" };
  const turn: Move = { t: "rotate", axis: "x", layer: 2, dir: -1 };
  assert.equal(describeMove(cube, turn, "X", 6, "cube").label, "6. R");
  assert.equal(describeMove(cube, turn, "X", 6, "words").label, "6. turn the right layer up");
});
