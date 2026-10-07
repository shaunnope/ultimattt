// Fails when the names of the two reference projects appear in anything a player or the page can see: source text,
// stylesheets, the page, the manifest. They may appear in comments that cite where a value came from, and in the
// spec documents, which this script does not scan. Scans src/ and static/ (never the build output).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const NAMES = /flagrant|tictactoe-game/i;

/** Text with comments removed (line breaks kept). `kind` is "ts", "css", "html" or "json" (which has no comments). */
export function stripComments(text, kind) {
  if (kind === "json") return text;
  if (kind === "css") return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  if (kind === "html") {
    return text
      .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, open, body, close) => open + stripComments(body, "ts") + close)
      .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, body, close) => open + stripComments(body, "css") + close);
  }
  // ts and js: walk the text so a // inside a string (a URL) is not taken for a comment
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

const KINDS = { ".ts": "ts", ".js": "ts", ".mjs": "ts", ".css": "css", ".html": "html", ".svelte": "html", ".json": "json", ".svg": "html" };

export function checkNamesText(text, kind, file) {
  const problems = [];
  stripComments(text, kind).split("\n").forEach((line, i) => {
    const m = NAMES.exec(line);
    if (m) problems.push(`${file}:${i + 1}: "${m[0]}" is a project name and must not appear outside comments`);
  });
  return problems;
}

function walk(dir, skip) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (skip(p)) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, skip));
    else out.push(p);
  }
  return out;
}

export function checkNames(root) {
  const problems = [];
  const skip = (p) => {
    const rel = relative(root, p).replaceAll("\\", "/");
    return rel.startsWith("static/screenshots") || rel.startsWith("static/icons");
  };
  for (const top of ["src", "static"]) {
    const dir = join(root, top);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir, skip)) {
      const kind = KINDS[extname(file)];
      if (!kind) continue;
      problems.push(...checkNamesText(readFileSync(file, "utf8"), kind, relative(root, file).replaceAll("\\", "/")));
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkNames(process.cwd());
  problems.forEach((p) => console.error("check-names:", p));
  process.exit(problems.length ? 1 : 0);
}
