// Fails when a declared colour pairing in scripts/contrast-pairs.json falls below its contrast ratio in light or dark.
// Tokens come from static/css/theme.css, resolved per mode (:root first, then :root[data-mode="light"|"dark"], as the
// cascade does). A pair is { fg, bg: [layer, ...], min, why }: bg lists the surfaces bottom first, so a control on a
// card on the page is ["page", "surface", "surface-strong"], and translucent layers are composited down the stack
// before the foreground is laid over the result and measured. min is 4.5 for text and 3 for edges, focus rings, bar
// fills and meaningful icons.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { composite, evalColour, ratio } from "./lib/colour.mjs";

const MODES = ["light", "dark"];

/** Top-level rules of a stylesheet as { selectors, body }, skipping at-rules (their blocks are not tokens). */
function topLevelRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import[^;]*;/g, "");
  const rules = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) break;
    const head = text.slice(i, open).trim();
    let depth = 0;
    let end = open;
    for (; end < text.length; end++) {
      if (text[end] === "{") depth++;
      else if (text[end] === "}" && --depth === 0) break;
    }
    if (!head.startsWith("@")) rules.push({ selectors: head.split(",").map((s) => s.trim()), body: text.slice(open + 1, end) });
    i = end + 1;
  }
  return rules;
}

function declarations(body) {
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g)) out[m[1]] = m[2];
  return out;
}

/** Custom properties in force for a mode: plain :root rules first, then the mode's own rules (higher specificity). */
export function resolveTokens(css, mode) {
  const rules = topLevelRules(css);
  const modeSelector = `:root[data-mode="${mode}"]`;
  const tokens = {};
  for (const rule of rules) if (rule.selectors.includes(":root")) Object.assign(tokens, declarations(rule.body));
  for (const rule of rules) if (rule.selectors.includes(modeSelector)) Object.assign(tokens, declarations(rule.body));
  return tokens;
}

const dashed = (name) => (name.startsWith("--") ? name : `--${name}`);

/** Problems for every pair in both modes; an empty list means every pairing holds. */
export function checkContrast(css, pairs) {
  const problems = [];
  for (const mode of MODES) {
    const tokens = resolveTokens(css, mode);
    const lookup = (name) => tokens[name];
    for (const pair of pairs) {
      const fg = dashed(pair.fg);
      const stack = pair.bg.map(dashed);
      const label = `${pair.why}: ${fg} on ${stack.join(" over ")} in ${mode}`;
      try {
        let backdrop = evalColour(`var(${stack[0]})`, lookup);
        if (backdrop.a < 1) {
          problems.push(`${label}: the bottom layer ${stack[0]} must be opaque`);
          continue;
        }
        for (const layer of stack.slice(1)) backdrop = composite(evalColour(`var(${layer})`, lookup), backdrop);
        const text = composite(evalColour(`var(${fg})`, lookup), backdrop);
        const got = ratio(text, backdrop);
        if (got < pair.min) problems.push(`${label} is ${got.toFixed(2)}:1, needs ${pair.min}:1`);
      } catch (e) {
        problems.push(`${label}: ${e.message}`);
      }
    }
  }
  return problems;
}

/** The declared pairs against static/css/theme.css in a project folder. */
export function checkContrastProject(root) {
  const themePath = join(root, "static", "css", "theme.css");
  if (!existsSync(themePath)) return ["static/css/theme.css is missing"];
  const pairsPath = join(root, "scripts", "contrast-pairs.json");
  if (!existsSync(pairsPath)) return ["scripts/contrast-pairs.json is missing"];
  return checkContrast(readFileSync(themePath, "utf8"), JSON.parse(readFileSync(pairsPath, "utf8")));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkContrastProject(process.cwd());
  problems.forEach((p) => console.error("check-contrast:", p));
  process.exit(problems.length ? 1 : 0);
}
