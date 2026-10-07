// The final gate of the SvelteKit migration (specs/007, C5): once every screen is a component, nothing in src/ui, src/lib or
// src/routes may assemble markup by hand again. Fails on the h() element builder, document.createElement, the temporary
// Bridge, and an import of any of the imperative modules the components replaced. It does nothing until it is run with
// --final, so the staged migration can keep the legacy modules in place while it works.
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./check-names.mjs";
import { filesUnder } from "./lib/svelte-style.mjs";

/** The imperative modules in src/ui that components replaced. DOM-free helpers are not on the list. */
export const DELETED_MODULES = [
  "app", "setup", "settings", "palette-picker", "theme-modal", "help", "replay", "game", "multiplayer",
  "boards", "board-classic", "board-ultimate", "board-cube", "cube-view", "pill", "update-bar",
];

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`\n]+)\1/g;

export function checkNoDomBuilders(root, { final = false } = {}) {
  if (!final) return [];
  const problems = [];
  const deleted = new Set(DELETED_MODULES.flatMap((name) => [`src/ui/${name}.ts`, `src/ui/${name}.js`]));
  for (const folder of ["src/ui", "src/lib", "src/routes"]) {
    for (const file of filesUnder(join(root, folder), [".ts", ".js", ".svelte"])) {
      const rel = relative(root, file).replaceAll("\\", "/");
      const text = stripComments(readFileSync(file, "utf8"), file.endsWith(".svelte") ? "html" : "ts");
      const report = (line, what) => problems.push(`${rel}:${line}: ${what}`);
      text.split("\n").forEach((line, i) => {
        const at = i + 1;
        if (/(?<![\w$.])h\s*\(/.test(line)) report(at, "calls h(), the imperative element builder");
        if (/import\s*\{[^}]*\bh\b[^}]*\}/.test(line)) report(at, "imports h, the imperative element builder");
        if (/\bdocument\s*\.\s*createElement\b/.test(line)) report(at, "builds markup with document.createElement");
        if (/\bBridge\b/.test(line)) report(at, "uses the temporary Bridge");
        for (const m of line.matchAll(IMPORT)) {
          if (!m[2].startsWith(".")) continue;
          const target = relative(root, resolve(dirname(file), m[2])).replaceAll("\\", "/");
          if (deleted.has(target)) report(at, `imports ${m[2]}, an imperative module the components replaced`);
        }
      });
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkNoDomBuilders(process.cwd(), { final: process.argv.includes("--final") });
  problems.forEach((p) => console.error("check-no-dom-builders:", p));
  process.exit(problems.length ? 1 : 0);
}
