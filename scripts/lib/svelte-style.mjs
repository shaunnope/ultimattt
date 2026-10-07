// Helpers for checks that read the style blocks of .svelte files as if they were stylesheets.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/** The text with everything outside `<style>` blocks blanked (line breaks kept, so line numbers stay the file's own). */
export function styleOnly(text) {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  let out = "";
  let i = 0;
  const open = /<style\b[^>]*>/gi;
  for (let m = open.exec(text); m; m = open.exec(text)) {
    const bodyStart = m.index + m[0].length;
    const close = text.indexOf("</style>", bodyStart);
    const bodyEnd = close < 0 ? text.length : close;
    out += blank(text.slice(i, bodyStart)) + text.slice(bodyStart, bodyEnd);
    i = bodyEnd;
    open.lastIndex = bodyEnd;
  }
  return out + blank(text.slice(i));
}

/** Every file under `dir` whose name ends with one of `extensions` (paths absolute), or none when `dir` is missing. */
export function filesUnder(dir, extensions) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...filesUnder(p, extensions));
    else if (extensions.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

/** The `.svelte` files under src/, as { file: root-relative path with forward slashes, style: its style blocks only }. */
export function svelteStyles(root) {
  return filesUnder(join(root, "src"), [".svelte"]).map((p) => ({
    file: relative(root, p).replaceAll("\\", "/"),
    style: styleOnly(readFileSync(p, "utf8")),
  }));
}
