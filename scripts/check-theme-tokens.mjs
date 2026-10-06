// Fails when a stylesheet other than site/css/theme.css contains a colour literal (a hex colour, rgb(), hsl(),
// oklch() or a colour name), and when theme.css itself has one outside a custom-property declaration. Every colour
// comes from a token defined in theme.css, so the light and dark looks stay consistent and a restyle touches one file. Comments are ignored; `transparent`, `currentColor` and var(--token)
// are fine. (The manifest and the theme-color meta tag need literal colours; tests/contract/manifest.test.ts checks
// those against the tokens.)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const NAMES = "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia|cyan|magenta|brown";
const LITERALS = [
  { pattern: /#[0-9a-fA-F]{3,8}\b/g, what: "hex colour" },
  { pattern: /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(/g, what: "colour function" },
  { pattern: new RegExp(`(?<=:[^;{}]*)\\b(?:${NAMES})\\b(?![-\\w(])`, "gi"), what: "colour name" },
];

/** CSS with comments blanked out (line breaks kept, so line numbers stay right). */
export function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Problems in one stylesheet's text. */
export function checkCssText(css, file) {
  // quoted strings (content: "white") are text, not colours
  const lines = stripCssComments(css)
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, (m) => " ".repeat(m.length))
    .split("\n");
  return scanLines(lines, file);
}

/** theme.css: colour literals are the point of the file, but only as the value of a custom property (--token: ...). */
export function checkThemeCssText(css, file) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  const text = stripCssComments(css)
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank)
    .replace(/--[\w-]+\s*:[^;}]*/g, blank);
  return scanLines(text.split("\n"), file);
}

function scanLines(lines, file) {
  const problems = [];
  lines.forEach((line, i) => {
    for (const { pattern, what } of LITERALS) {
      pattern.lastIndex = 0;
      for (const m of line.matchAll(pattern)) {
        problems.push(`${file}:${i + 1}: ${what} "${m[0].replace(/\($/, "")}" outside a token declaration or another stylesheet; add a token to theme.css and use var(--token)`);
      }
    }
  });
  return problems;
}

export function checkThemeTokens(root) {
  const dir = join(root, "site", "css");
  if (!existsSync(dir)) return ["site/css is missing"];
  const problems = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".css") && n !== "theme.css")) {
    problems.push(...checkCssText(readFileSync(join(dir, name), "utf8"), `site/css/${name}`));
  }
  if (existsSync(join(dir, "theme.css"))) problems.push(...checkThemeCssText(readFileSync(join(dir, "theme.css"), "utf8"), "site/css/theme.css"));
  else problems.push("site/css/theme.css is missing");
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkThemeTokens(process.cwd());
  problems.forEach((p) => console.error("check-theme-tokens:", p));
  process.exit(problems.length ? 1 : 0);
}
