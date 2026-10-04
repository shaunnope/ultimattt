import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeMoves, decodeMoves } from "../../src/core/tokens.ts";
import { unpackLink } from "../../src/core/record.ts";
import type { CubeMove, Move } from "../../src/core/types.ts";

const ALPHABET = "0123456789abcdefghijklmno";

test("Classic cells use the whole 25 symbol alphabet", () => {
  const moves: Move[] = Array.from({ length: 25 }, (_, cell) => ({ t: "place", cell }));
  assert.equal(encodeMoves("classic", moves), ALPHABET);
  assert.deepEqual(decodeMoves("classic", ALPHABET), moves);
});

test("Ultimate boards and cells use the 25 symbol alphabet, two characters per move", () => {
  const moves: Move[] = [{ t: "place", board: 24, cell: 0 }, { t: "place", board: 10, cell: 14 }, { t: "place", board: 9, cell: 24 }];
  assert.equal(encodeMoves("ultimate", moves), "o0ae9o");
  assert.deepEqual(decodeMoves("ultimate", "o0ae9o"), moves);
});

test("Cube places are a face digit then a cell symbol; turns are dot, axis, layer 0-4 and way", () => {
  const moves: CubeMove[] = [
    { t: "place", face: 5, cell: 24 },
    { t: "place", face: 0, cell: 12 },
    { t: "rotate", axis: "x", layer: 4, dir: -1 },
    { t: "rotate", axis: "z", layer: 3, dir: 2 },
    { t: "rotate", axis: "y", layer: 0, dir: 1 },
  ];
  const text = encodeMoves("cube", moves);
  assert.equal(text, "5o0c.x4-.z32.y0+");
  assert.deepEqual(decodeMoves("cube", text), moves);
});

test("001 tokens decode to the same moves as before", () => {
  assert.deepEqual(decodeMoves("ultimate", "008437"), [{ t: "place", board: 0, cell: 0 }, { t: "place", board: 8, cell: 4 }, { t: "place", board: 3, cell: 7 }]);
  assert.deepEqual(decodeMoves("cube", "24.x1+.z02.y2-58"), [
    { t: "place", face: 2, cell: 4 }, { t: "rotate", axis: "x", layer: 1, dir: 1 }, { t: "rotate", axis: "z", layer: 0, dir: 2 },
    { t: "rotate", axis: "y", layer: 2, dir: -1 }, { t: "place", face: 5, cell: 8 },
  ]);
});

test("bad tokens give an error, never a throw", () => {
  for (const [variant, text] of [["classic", "p"], ["classic", "A"], ["ultimate", "p0"], ["ultimate", "0"], ["cube", "6"], ["cube", "60"], ["cube", ".x5+"], ["cube", ".w1+"], ["cube", ".x1*"], ["cube", "0p"]] as const) {
    const result = decodeMoves(variant, text);
    assert.ok(!Array.isArray(result) && "error" in result, `${variant} ${text}`);
  }
});

test("every 001 link in the fixtures still decodes to the recorded number of moves", () => {
  const links = JSON.parse(readFileSync(new URL("../fixtures/001/links.json", import.meta.url), "utf8")) as { name: string; link: string; moveCount: number }[];
  for (const { name, link, moveCount } of links) {
    const record = unpackLink(link);
    assert.ok(!("error" in record), name);
    if (!("error" in record)) assert.equal(record.moves.length, moveCount, name);
  }
});
