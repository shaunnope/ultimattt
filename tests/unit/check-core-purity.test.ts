import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
// @ts-expect-error plain .mjs scripts, no types
import { checkCorePurity } from "../../scripts/check-core-purity.mjs";

// src/core and src/adapters stay free of the framework (contract C5, research R11).

function run(files: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), "ttt-purity-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), body);
    }
    return checkCorePurity(root) as string[];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("check-core-purity: clean folders pass", () => {
  assert.deepEqual(
    run({
      "src/core/a.ts": 'import { b } from "./b.ts";\nexport const a = b;\n',
      "src/core/b.ts": "export const b = 1;\n",
      "src/adapters/store.ts": 'import { a } from "../core/a.ts";\nexport const s = a;\n',
    }),
    [],
  );
});

test("check-core-purity: a framework import in src/core fails with its file and line", () => {
  for (const spec of ["svelte", "svelte/store", "@sveltejs/kit", "$app/state", "$app/navigation", "$lib/x", "#lib/x", "$lib/state/settings.ts", "./Thing.svelte", "../ui/Thing.svelte"]) {
    const problems = run({ "src/core/a.ts": `export const a = 1;\nimport { x } from "${spec}";\n` });
    assert.equal(problems.length, 1, spec);
    assert.match(problems[0]!, /src\/core\/a\.ts:2/, spec);
    assert.ok(problems[0]!.includes(spec), spec);
  }
});

test("check-core-purity: src/adapters is checked too, and bare, dynamic and re-export imports are caught", () => {
  assert.equal(run({ "src/adapters/s.ts": 'import "svelte";\n' }).length, 1);
  assert.equal(run({ "src/adapters/s.ts": 'const m = await import("svelte/store");\n' }).length, 1);
  assert.equal(run({ "src/adapters/s.ts": 'export { writable } from "svelte/store";\n' }).length, 1);
});

test("check-core-purity: a framework name in a comment or a string is not an import", () => {
  assert.deepEqual(run({ "src/core/a.ts": '// import x from "svelte"\nexport const s = "from svelte";\n' }), []);
});

test("check-core-purity: other folders may use the framework", () => {
  assert.deepEqual(run({ "src/lib/a.svelte": '<script>import { onMount } from "svelte";</script>', "src/ui/b.ts": 'import { writable } from "svelte/store";\n' }), []);
});
