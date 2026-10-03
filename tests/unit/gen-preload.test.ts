import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs script, no types
import { staticImports, startupModules, injectPreload, START_MARK, END_MARK } from "../../scripts/gen-preload.mjs";

test("static imports and re-exports are found; dynamic imports and comments are not", () => {
  const source = [
    'import { a } from "./a.js";',
    'import "./side.js";',
    'import type { T } from "./types.js";',
    'export { b } from "./b.js";',
    'export * from "../core/c.js";',
    'const lazy = () => import("./lazy.js");',
    '// import "./commented.js";',
    '/* import "./block.js"; */',
    'const text = "from ./not-an-import.js";',
  ].join("\n");
  assert.deepEqual(staticImports(source).sort(), ["../core/c.js", "./a.js", "./b.js", "./side.js", "./types.js"]);
});

test("the start-up modules are the entry and everything it imports statically, in a stable order", () => {
  const files: Record<string, string> = {
    "js/ui/app.js": 'import "./a.js"; const later = import("./lazy.js");',
    "js/ui/a.js": 'import { b } from "../core/b.js"; export { c } from "./c.js";',
    "js/core/b.js": "",
    "js/ui/c.js": 'import "../core/b.js";',
    "js/ui/lazy.js": 'import "./only-lazy.js";',
    "js/ui/only-lazy.js": "",
  };
  const read = (path: string) => files[path] ?? null;
  assert.deepEqual(startupModules("js/ui/app.js", read), ["js/core/b.js", "js/ui/a.js", "js/ui/app.js", "js/ui/c.js"]);
});

test("an import that cannot be read is skipped rather than crashing the build", () => {
  const read = (path: string) => (path === "js/ui/app.js" ? 'import "./gone.js";' : null);
  assert.deepEqual(startupModules("js/ui/app.js", read), ["js/ui/app.js"]);
});

const PAGE = `<head>\n  ${START_MARK}\n  ${END_MARK}\n  <title>x</title>\n</head>`;

test("the page gets one modulepreload link per start-up module, between the markers", () => {
  const html = injectPreload(PAGE, ["js/core/b.js", "js/ui/app.js"]);
  assert.match(html, /<link rel="modulepreload" href="js\/core\/b\.js">/);
  assert.match(html, /<link rel="modulepreload" href="js\/ui\/app\.js">/);
  assert.ok(html.indexOf(START_MARK) < html.indexOf("js/core/b.js") && html.indexOf("js/ui/app.js") < html.indexOf(END_MARK));
  assert.ok(html.includes("<title>x</title>"));
});

test("injecting twice gives the same page, and a changed list replaces the old links", () => {
  const once = injectPreload(PAGE, ["js/a.js"]);
  assert.equal(injectPreload(once, ["js/a.js"]), once);
  const changed = injectPreload(once, ["js/b.js"]);
  assert.ok(!changed.includes("js/a.js"));
  assert.ok(changed.includes("js/b.js"));
});

test("a page without the markers is an error, not a silent skip", () => {
  assert.throws(() => injectPreload("<head></head>", ["js/a.js"]), /marker/i);
});
