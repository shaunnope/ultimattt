import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error plain .mjs scripts, no types
import { checkSw } from "../../scripts/check-sw.mjs";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "fixtures", "check", name), "utf8");

test("check-sw: passes for a worker that skips waiting only on message and cleans stale caches", () => {
  assert.deepEqual(checkSw(fixture("sw-good.ts")), []);
});

test("check-sw: fails when skipWaiting is called outside the message handler", () => {
  const problems = checkSw(fixture("sw-bad-skipwaiting.ts"));
  assert.ok(problems.some((p: string) => /skipWaiting/.test(p)));
});

test("check-sw: fails when activate does not delete stale caches", () => {
  const problems = checkSw(fixture("sw-bad-nocleanup.ts"));
  assert.ok(problems.some((p: string) => /activate/.test(p)));
});

// ---- check-theme-tokens and check-names ----

// @ts-expect-error plain .mjs scripts, no types
import { checkThemeTokens, checkCssText } from "../../scripts/check-theme-tokens.mjs";
// @ts-expect-error plain .mjs scripts, no types
import { checkNames, stripComments, checkNamesText } from "../../scripts/check-names.mjs";

const fixtureDir = (name: string) => join(import.meta.dirname, "..", "fixtures", "check", name);

test("check-theme-tokens: a colour literal outside theme.css fails, and theme.css may hold them", () => {
  assert.deepEqual(checkThemeTokens(fixtureDir("tokens-good")), []);
  const problems: string[] = checkThemeTokens(fixtureDir("tokens-bad"));
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => /style\.css:1:.*hex colour/.test(p)));
  assert.ok(problems.some((p) => /style\.css:2:.*colour function/.test(p)));
  assert.ok(problems.some((p) => /style\.css:3:.*colour name/.test(p)));
  assert.ok(problems.every((p) => !p.includes("theme.css:")));
});

test("check-theme-tokens: comments, var(), transparent, currentColor and words inside strings pass", () => {
  assert.deepEqual(checkCssText("/* #fff */ a { color: var(--x); background: transparent; border-color: currentColor; content: \"white\"; }", "x.css"), []);
  assert.equal(checkCssText("a { color: #123456; }", "x.css").length, 1);
  assert.equal(checkCssText("a { color: #fff; background: #000; }", "x.css").length, 2);
});

test("check-names: a project name in a comment passes, anywhere else fails", () => {
  assert.deepEqual(checkNames(fixtureDir("names-good")), []);
  const problems: string[] = checkNames(fixtureDir("names-bad"));
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => p.includes("src/a.ts")));
  assert.ok(problems.some((p) => p.includes("src/app.html")));
  assert.ok(problems.some((p) => p.includes("static/manifest.json")));
});

test("check-names: a // inside a string is not a comment, and block comments hide the name", () => {
  assert.deepEqual(checkNamesText('const a = "http://x"; /* flagrant */ // tictactoe-game', "ts", "a.ts"), []);
  assert.equal(checkNamesText('const a = "http://flagrant.example";', "ts", "a.ts").length, 1);
  assert.equal(stripComments("a // b\nc", "ts"), "a \nc");
  assert.deepEqual(checkNamesText("<p>flagrant</p>", "html", "a.html").length, 1);
  assert.deepEqual(checkNamesText("<!-- flagrant --><p>ok</p>", "html", "a.html"), []);
});

test("check-names and check-theme-tokens pass on this project's own files", () => {
  const root = join(import.meta.dirname, "..", "..");
  assert.deepEqual(checkNames(root), []);
});

// ---- check-theme-tokens also scans theme.css: literals only on custom-property declarations ----

// @ts-expect-error plain .mjs scripts, no types
import { checkThemeCssText } from "../../scripts/check-theme-tokens.mjs";

test("check-theme-tokens: theme.css may hold colour literals on --token declarations and nowhere else", () => {
  assert.deepEqual(checkThemeCssText(":root { --bg: #faf8f3; --fg: rgb(26,26,26); --x: color-mix(in srgb, #fff 10%, var(--bg)); }", "theme.css"), []);
  assert.deepEqual(checkThemeCssText(":root {\n  --a: #fff;\n  --b: rgba(0,0,0,.5);\n}\n", "theme.css"), []);
  const problems: string[] = checkThemeCssText(".x { color: #fff; }\n:root { --ok: #000; }\n.y { background: rgba(0,0,0,.1); }", "theme.css");
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => /theme\.css:1:.*hex colour/.test(p)));
  assert.ok(problems.some((p) => /theme\.css:3:.*colour function/.test(p)));
});

test("check-theme-tokens: a literal in a theme.css rule fails the project check", () => {
  const problems: string[] = checkThemeTokens(fixtureDir("tokens-theme-bad"));
  assert.equal(problems.length, 1);
  assert.ok(problems[0]?.includes("theme.css:2"));
});

test("check-theme-tokens passes on this project's own stylesheets, theme.css included", () => {
  assert.deepEqual(checkThemeTokens(join(import.meta.dirname, "..", "..")), []);
});

// ---- check-breakpoints: one narrow breakpoint (480px) and the 640px dialog switch, nothing else ----

// @ts-expect-error plain .mjs scripts, no types
import { checkBreakpointsText, checkBreakpoints } from "../../scripts/check-breakpoints.mjs";

test("check-breakpoints: the 480px and 640px width queries pass", () => {
  assert.deepEqual(checkBreakpointsText("@media (max-width: 480px) { a { color: var(--x); } }\n@media (min-width: 640px) { b { margin: auto; } }", "x.css"), []);
  assert.deepEqual(checkBreakpointsText("@media (max-width:480px){a{}}", "x.css"), []);
});

test("check-breakpoints: any other width query fails with its file and line", () => {
  const problems: string[] = checkBreakpointsText("a { }\n@media (min-width: 720px) { a { } }\n@media (max-width: 600px) { a { } }", "cube.css");
  assert.equal(problems.length, 2);
  assert.ok(problems[0]!.includes("cube.css:2") && problems[0]!.includes("720px"));
  assert.ok(problems[1]!.includes("cube.css:3") && problems[1]!.includes("600px"));
});

test("check-breakpoints: other media features, comments and range syntax are handled", () => {
  assert.deepEqual(checkBreakpointsText("@media (prefers-reduced-motion: reduce) { a { } }\n@media (forced-colors: active) { a { } }\n/* @media (min-width: 900px) */", "x.css"), []);
  assert.equal(checkBreakpointsText("@media screen and (min-width: 481px) and (max-width: 900px) { a { } }", "x.css").length, 2);
  assert.equal(checkBreakpointsText("@media (width >= 720px) { a { } }", "x.css").length, 1);
  assert.equal(checkBreakpointsText("@media (min-width: 40em) { a { } }", "x.css").length, 1);
});

test("check-breakpoints passes on this project's own stylesheets", () => {
  assert.deepEqual(checkBreakpoints(join(import.meta.dirname, "..", "..")), []);
});

// ---- the new layout: static/, src/app.html, src/service-worker.ts and the style blocks of .svelte files ----

// @ts-expect-error plain .mjs scripts, no types
import { checkSwProject } from "../../scripts/check-sw.mjs";
// @ts-expect-error plain .mjs scripts, no types
import { checkTheme } from "../../scripts/check-theme.mjs";
// @ts-expect-error plain .mjs scripts, no types
import { checkContrastProject } from "../../scripts/check-contrast.mjs";

const projectRoot = join(import.meta.dirname, "..", "..");

function tmpProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ttt-layout-"));
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(root, name, ".."), { recursive: true });
    writeFileSync(join(root, name), body);
  }
  return root;
}

test("check-sw reads src/service-worker.ts, and says so when it is missing", () => {
  assert.deepEqual(checkSwProject(projectRoot), []);
  const problems: string[] = checkSwProject(tmpProject({ "src/other.ts": "" }));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /src\/service-worker\.ts/);
  const bad = checkSwProject(tmpProject({ "src/service-worker.ts": fixture("sw-bad-skipwaiting.ts") }));
  assert.ok(bad.some((p: string) => /skipWaiting/.test(p)));
});

test("check-theme reads the inline script from src/app.html and resolveMode from src/ui/theme.ts", async () => {
  assert.deepEqual(await checkTheme(projectRoot), []);
  const problems: string[] = await checkTheme(tmpProject({ "src/app.html": "<html></html>", "src/ui/theme.ts": readFileSync(join(projectRoot, "src", "ui", "theme.ts"), "utf8") }));
  assert.ok(problems.some((p) => /pre-paint/.test(p)));
});

test("check-contrast reads static/css/theme.css", () => {
  assert.deepEqual(checkContrastProject(projectRoot), []);
  assert.ok((checkContrastProject(tmpProject({ "scripts/contrast-pairs.json": "[]" })) as string[]).some((p) => /static\/css\/theme\.css/.test(p)));
});

test("check-theme-tokens: a colour literal in the style block of a .svelte file fails, with the file's own line number", () => {
  assert.deepEqual(checkThemeTokens(fixtureDir("svelte-style-good")), []);
  const problems: string[] = checkThemeTokens(fixtureDir("svelte-style-bad"));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /src\/lib\/A\.svelte:4:.*hex colour/);
});

test("check-theme-tokens: colour words in a .svelte file's markup or script are not styles", () => {
  const root = tmpProject({
    "static/css/theme.css": ":root { --a: #fff; }",
    "src/lib/B.svelte": '<script>const c = "#fff";</script>\n<p class="red">white</p>\n<style>p { color: var(--a); }</style>\n',
  });
  assert.deepEqual(checkThemeTokens(root), []);
});

test("check-breakpoints: a width query in the style block of a .svelte file is checked like a stylesheet", () => {
  assert.deepEqual(checkBreakpoints(fixtureDir("svelte-style-good")), []);
  const problems: string[] = checkBreakpoints(fixtureDir("svelte-style-bad"));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /src\/lib\/A\.svelte:5:.*720px/);
});

test("check-names: a project name in the markup of a .svelte file fails, in its comment it passes", () => {
  const bad = checkNames(tmpProject({ "src/lib/C.svelte": "<p>flagrant</p>\n", "static/manifest.json": "{}" }));
  assert.equal(bad.length, 1);
  assert.match(bad[0]!, /src\/lib\/C\.svelte:1/);
  assert.deepEqual(checkNames(tmpProject({ "src/lib/C.svelte": "<!-- flagrant -->\n<p>ok</p>\n", "static/manifest.json": "{}" })), []);
});
