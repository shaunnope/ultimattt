import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
// @ts-expect-error the script is plain JavaScript
import { stripComments } from "../../scripts/check-names.mjs";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** The one place the word Cube may stay: it names the standard cubing notation, not the mode. */
const ALLOWED = ["Cube notation (R, U', F2, 2L)"];

test("no visible text uses Cube as a mode name (the mode is Twist-Tac-Toe or Twist)", () => {
  const files = [...walk(join(ROOT, "src")).filter((f) => extname(f) === ".ts"), join(ROOT, "site/index.html"), join(ROOT, "site/manifest.json")];
  const problems: string[] = [];
  for (const file of files) {
    const kind = file.endsWith(".html") ? "html" : file.endsWith(".json") ? "json" : "ts";
    let text: string = stripComments(readFileSync(file, "utf8"), kind);
    for (const ok of ALLOWED) text = text.replaceAll(ok, "");
    text.split("\n").forEach((line, i) => {
      if (/\bCube\b/.test(line)) problems.push(`${file.slice(ROOT.length)}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(problems, []);
});
