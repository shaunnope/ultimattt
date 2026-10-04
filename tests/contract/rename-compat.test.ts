import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSave } from "../../src/adapters/store.ts";
import { restoreGame } from "../../src/adapters/restore.ts";
import { unpackLink, configFromRecord } from "../../src/core/record.ts";
import { parseMessage } from "../../src/core/protocol.ts";

const read = (name: string): string => readFileSync(new URL(`../fixtures/003/${name}`, import.meta.url), "utf8");

test("a save made before the rename loads and restores as the same stored mode", () => {
  const result = parseSave(read("save-cube.json"));
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.save.game!.config.variant, "cube");
  assert.equal(result.save.game!.config.scoring, "faces");
  assert.equal(result.save.game!.config.lockFaces, true);
  assert.ok(restoreGame(result.save.game!));
});

test("replay links made before the rename still open", () => {
  const links = JSON.parse(read("links.json")) as { link: string; variant: string; scoring: string; lockFaces: boolean }[];
  for (const entry of links) {
    const record = unpackLink(entry.link);
    assert.ok(!("error" in record), entry.link);
    if ("error" in record) continue;
    const config = configFromRecord(record);
    assert.equal(config.variant, entry.variant);
    assert.equal(config.scoring, entry.scoring);
    assert.equal(config.lockFaces, entry.lockFaces);
  }
});

test("a two-device welcome made before the rename is still understood", () => {
  const message = parseMessage(JSON.parse(read("welcome.json")));
  assert.ok(!("error" in message));
  if (!("error" in message) && message.type === "welcome") assert.equal(message.config.variant, "cube");
});
