import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { stringLiterals } from "./support/string-literals.ts";

export { stringLiterals };

// The design spec's copy rules (docs/pwa-design-spec.md sections 1 and 11) over the text the interface can show:
// no em dashes, no exclamation marks, no emoji or pictograph characters (icons are inline SVG). Share text copied to
// other apps may use emoji, so a literal that is marked as share text is allowed to; none is yet.

const root = join(import.meta.dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

const EM_DASH = /—/;
const BANG = /!/;
// emoji and pictographs (misc symbols, dingbats, geometric shapes, arrows, supplemental symbols, emoji planes)
const PICTOGRAPH = /[←-⇿■-◿☀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/u;

const files = walk(join(root, "src"));

test("the scanner reads strings, template parts and skips comments", () => {
  const found = stringLiterals('const a = "x!"; // "no"\n/* "no" */ const b = `y ${1 + 2} z`; const c = \'q\';').map((f) => f.text);
  assert.deepEqual(found, ["x!", "y ", " z", "q"]);
});

test("no string the interface can show has an em dash, an exclamation mark or a pictograph", () => {
  const problems: string[] = [];
  for (const file of files) {
    for (const { text, line } of stringLiterals(readFileSync(file, "utf8"))) {
      const where = `${relative(root, file)}:${line}: "${text.slice(0, 60)}"`;
      if (EM_DASH.test(text)) problems.push(`${where} has an em dash`);
      if (BANG.test(text)) problems.push(`${where} has an exclamation mark`);
      if (PICTOGRAPH.test(text)) problems.push(`${where} has a pictograph; use an inline icon`);
    }
  }
  assert.deepEqual(problems, []);
});

test("no em dash in code, comments, stylesheets, the page, scripts or the design docs", () => {
  const targets = [
    ...files,
    ...readdirSync(join(root, "static", "css")).map((f) => join(root, "static", "css", f)),
    join(root, "src", "app.html"),
    ...readdirSync(join(root, "scripts")).filter((f) => f.endsWith(".mjs")).map((f) => join(root, "scripts", f)),
    join(root, "docs", "pwa-design-spec.md"),
  ];
  const problems = targets.filter((file) => EM_DASH.test(readFileSync(file, "utf8"))).map((file) => relative(root, file));
  assert.deepEqual(problems, []);
});

// ---- Svelte components and the page: the same rules over what the markup can show ----

import { svelteCopy } from "./support/svelte-copy.ts";

test("the Svelte scanner reads text nodes, the named attributes, strings in expressions and in the script, and nothing else", () => {
  const found = svelteCopy(readFileSync(join(root, "tests", "fixtures", "check", "svelte-copy-bad", "A.svelte"), "utf8")).map((f) => f.text);
  assert.ok(found.includes("Done—really"), "a string in the script");
  assert.ok(found.includes("Well done — nice game"), "a text node");
  assert.ok(found.includes("Close!"), "aria-label");
  assert.ok(found.includes("Fine"), "title");
  assert.ok(found.includes("Hide!") && found.includes("Show"), "strings in an expression");
  assert.ok(found.includes("Type here"), "placeholder");
  assert.ok(found.includes("a — b"), "alt");
  assert.ok(found.includes("All good"), "text inside a block");
  assert.ok(!found.some((t) => t.includes("a comment")), "markup comments are not shown");
  assert.ok(!found.some((t) => t === "!"), "style blocks are not copy");
});

test("the Svelte scanner reports the line of each piece of text", () => {
  const found = svelteCopy("<p>one</p>\n<p>two\n  three</p>\n<b>four</b>");
  assert.deepEqual(found.map((f) => [f.text, f.line]), [["one", 1], ["two three", 2], ["four", 4]]);
});

test("every kind of violation in a component is found", () => {
  const problems: string[] = [];
  for (const { text } of svelteCopy(readFileSync(join(root, "tests", "fixtures", "check", "svelte-copy-bad", "A.svelte"), "utf8"))) {
    if (EM_DASH.test(text)) problems.push(`dash:${text}`);
    if (BANG.test(text)) problems.push(`bang:${text}`);
    if (PICTOGRAPH.test(text)) problems.push(`picto:${text}`);
  }
  assert.ok(problems.some((p) => p.startsWith("dash:Done")), "dash in the script");
  assert.ok(problems.some((p) => p.startsWith("dash:Well done")), "dash in a text node");
  assert.ok(problems.some((p) => p.startsWith("dash:a ")), "dash in alt");
  assert.ok(problems.some((p) => p === "bang:Close!"), "bang in aria-label");
  assert.ok(problems.some((p) => p === "bang:Hide!"), "bang in an expression");
  assert.ok(problems.some((p) => p.startsWith("picto:Hooray")), "pictograph in the script");
});

function walkSvelte(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkSvelte(path, out);
    else if (entry.name.endsWith(".svelte")) out.push(path);
  }
  return out;
}

test("no component and no page text has an em dash, an exclamation mark or a pictograph", () => {
  const targets = [...walkSvelte(join(root, "src")), join(root, "src", "app.html")];
  assert.ok(targets.length > 20, "the components were found");
  const problems: string[] = [];
  for (const file of targets) {
    for (const { text, line } of svelteCopy(readFileSync(file, "utf8"))) {
      const where = `${relative(root, file)}:${line}: "${text.slice(0, 60)}"`;
      if (EM_DASH.test(text)) problems.push(`${where} has an em dash`);
      if (BANG.test(text)) problems.push(`${where} has an exclamation mark`);
      if (PICTOGRAPH.test(text)) problems.push(`${where} has a pictograph; use an inline icon`);
    }
  }
  assert.deepEqual(problems, []);
});
