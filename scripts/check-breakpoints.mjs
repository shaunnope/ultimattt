// Fails when a stylesheet has a width media query other than the two the design spec allows: the narrow breakpoint
// (max-width: 480px) and the point where dialogs move from a bottom sheet to the centre (min-width: 640px). Every
// other width is handled by flexible layout, not by another breakpoint. Other media features (reduced motion, forced
// colours) are not width queries and are ignored; comments are ignored.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { svelteStyles } from "./lib/svelte-style.mjs";

const ALLOWED = new Set(["max-width:480px", "min-width:640px"]);

/** CSS with comments blanked out (line breaks kept, so line numbers stay right). */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Problems in one stylesheet's text. */
export function checkBreakpointsText(css, file) {
  const text = stripComments(css);
  const problems = [];
  for (const m of text.matchAll(/@media([^{]*)\{/g)) {
    const line = text.slice(0, m.index).split("\n").length;
    const prelude = m[1];
    const found = [];
    // (min-width: 720px) and (max-width: 480px)
    for (const q of prelude.matchAll(/\(\s*(min|max)-width\s*:\s*([\d.]+)\s*([a-z]*)\s*\)/gi)) found.push({ key: `${q[1].toLowerCase()}-width:${q[2]}${q[3].toLowerCase()}`, shown: `(${q[1]}-width: ${q[2]}${q[3]})` });
    // range syntax: (width >= 720px), (width < 480px)
    for (const q of prelude.matchAll(/\(\s*width\s*(>=|<=|>|<)\s*([\d.]+)\s*([a-z]*)\s*\)/gi)) found.push({ key: `range:${q[1]}${q[2]}${q[3]}`, shown: `(width ${q[1]} ${q[2]}${q[3]})` });
    for (const q of prelude.matchAll(/\(\s*([\d.]+)\s*([a-z]*)\s*(>=|<=|>|<)\s*width\s*\)/gi)) found.push({ key: `range:${q[1]}${q[2]}${q[3]}`, shown: `(${q[1]}${q[2]} ${q[3]} width)` });
    for (const q of found) {
      if (!ALLOWED.has(q.key)) problems.push(`${file}:${line}: width query ${q.shown} is not one of the allowed breakpoints (max-width: 480px, min-width: 640px); use flexible layout instead`);
    }
  }
  return problems;
}

export function checkBreakpoints(root) {
  const dir = join(root, "static", "css");
  if (!existsSync(dir)) return ["static/css is missing"];
  const problems = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".css"))) {
    problems.push(...checkBreakpointsText(readFileSync(join(dir, name), "utf8"), `static/css/${name}`));
  }
  for (const { file, style } of svelteStyles(root)) problems.push(...checkBreakpointsText(style, file));
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkBreakpoints(process.cwd());
  problems.forEach((p) => console.error("check-breakpoints:", p));
  process.exit(problems.length ? 1 : 0);
}
