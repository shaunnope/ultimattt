import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { storageGet, storageSet, storageRemove, resetStorageForTests } from "../../src/ui/ui.ts";

const g = globalThis as unknown as { localStorage?: unknown };

beforeEach(() => {
  delete g.localStorage;
  resetStorageForTests();
});

test("falls back to memory when localStorage does not exist", () => {
  assert.equal(storageGet("a"), null);
  assert.equal(storageSet("a", "1"), false, "reports that nothing reached persistent storage");
  assert.equal(storageGet("a"), "1");
  storageRemove("a");
  assert.equal(storageGet("a"), null);
});

test("never throws when localStorage throws; keeps the value in memory", () => {
  g.localStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.doesNotThrow(() => storageSet("k", "v"));
  assert.equal(storageGet("k"), "v");
  assert.doesNotThrow(() => storageRemove("k"));
  assert.equal(storageGet("k"), null);
});

test("uses localStorage when it works", () => {
  const map = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  storageSet("x", "9");
  assert.equal(map.get("x"), "9");
  assert.equal(storageGet("x"), "9");
});
