import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
// @ts-expect-error plain .mjs scripts, no types
import { checkNoDomBuilders } from "../../scripts/check-no-dom-builders.mjs";

// Once the migration's final phase flips it on (--final), no screen is assembled by hand (contract C5).

function run(files: Record<string, string>, final = true): string[] {
  const root = mkdtempSync(join(tmpdir(), "ttt-dom-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), body);
    }
    return checkNoDomBuilders(root, { final }) as string[];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("check-no-dom-builders: DOM-free helpers pass", () => {
  assert.deepEqual(
    run({
      "src/ui/pill-model.ts": "export function pillModel(a: number) { return a + 1; }\n",
      "src/ui/theme.ts": 'export const search = (x: string) => x.length; // not a builder\nconst chat = 1;\n',
      "src/lib/components/A.svelte": "<script>let n = 1;</script>\n<p>{n}</p>\n",
    }),
    [],
  );
});

test("check-no-dom-builders: an h() call fails with file and line", () => {
  const problems = run({ "src/ui/x.ts": 'const a = 1;\nconst el = h("div", { class: "a" });\n' });
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /src\/ui\/x\.ts:2/);
});

test("check-no-dom-builders: importing h, creating elements, the bridge or a deleted module fails", () => {
  assert.equal(run({ "src/lib/a.ts": 'import { h, clear } from "../ui/ui.ts";\n' }).length, 1);
  assert.equal(run({ "src/routes/a.ts": 'const d = document.createElement("div");\n' }).length, 1);
  assert.equal(run({ "src/routes/+page.svelte": '<script>import Bridge from "$lib/legacy/Bridge.svelte";</script>\n' }).length, 1);
  assert.equal(run({ "src/lib/b.ts": 'import { mountGame } from "../ui/game.ts";\n' }).length, 1);
  assert.equal(run({ "src/ui/c.ts": 'import { createBoard } from "./boards.ts";\n' }).length, 1);
});

test("check-no-dom-builders: a module that merely shares a name with a deleted one passes", () => {
  assert.deepEqual(run({ "src/lib/state/settings.ts": "export const s = 1;\n", "src/lib/state/use.ts": 'import { s } from "./settings.ts";\nexport const t = s;\n' }), []);
});

test("check-no-dom-builders: without --final it checks nothing", () => {
  assert.deepEqual(run({ "src/ui/x.ts": 'const el = h("div");\n' }, false), []);
});
