import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

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

/** The text of every string literal in a TypeScript source: comments are skipped and template literals give their static parts. */
export function stringLiterals(source: string): { text: string; line: number }[] {
  const found: { text: string; line: number }[] = [];
  let i = 0;
  let line = 1;
  const n = source.length;
  const readTemplate = (): void => {
    // after the opening backtick
    let text = "";
    const start = line;
    while (i < n && source[i] !== "`") {
      if (source[i] === "\\") {
        text += source[i + 1] ?? "";
        if (source[i + 1] === "\n") line++;
        i += 2;
      } else if (source[i] === "$" && source[i + 1] === "{") {
        found.push({ text, line: start });
        text = "";
        i += 2;
        let depth = 1;
        while (i < n && depth > 0) {
          const c = source[i];
          if (c === "{") depth++;
          else if (c === "}") depth--;
          else if (c === "`") {
            i++;
            readTemplate();
            continue;
          } else if (c === '"' || c === "'") readQuoted(c);
          if (c === "\n") line++;
          i++;
        }
      } else {
        if (source[i] === "\n") line++;
        text += source[i];
        i++;
      }
    }
    i++; // closing backtick
    found.push({ text, line: start });
  };
  const readQuoted = (quote: string): void => {
    let text = "";
    const start = line;
    i++;
    while (i < n && source[i] !== quote && source[i] !== "\n") {
      if (source[i] === "\\") {
        text += source[i + 1] ?? "";
        i += 2;
      } else {
        text += source[i];
        i++;
      }
    }
    found.push({ text, line: start });
    // the loop in the caller steps past the closing quote
  };
  while (i < n) {
    const c = source[i]!;
    if (c === "\n") {
      line++;
      i++;
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
    } else if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++;
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'") {
      readQuoted(c);
      i++;
    } else if (c === "`") {
      i++;
      readTemplate();
    } else i++;
  }
  return found;
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
    ...readdirSync(join(root, "site", "css")).map((f) => join(root, "site", "css", f)),
    join(root, "site", "index.html"),
    ...readdirSync(join(root, "scripts")).filter((f) => f.endsWith(".mjs")).map((f) => join(root, "scripts", f)),
    join(root, "docs", "pwa-design-spec.md"),
  ];
  const problems = targets.filter((file) => EM_DASH.test(readFileSync(file, "utf8"))).map((file) => relative(root, file));
  assert.deepEqual(problems, []);
});
