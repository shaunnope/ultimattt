// Fails when the pre-paint theme script in site/index.html disagrees with resolveMode in src/ui/theme.ts.
// The script is run against every stored value (under the current key ttt.mode and under the legacy key ttt.theme,
// which a returning player may still have) and every system theme, and its answers are compared: the resolved
// data-mode and the recorded data-mode-preference.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const PREFS = ["system", "light", "dark", "blue", ""];
const LEGACY_PREFS = ["auto", "light", "dark", "blue", ""];

/** The preference a stored value stands for: light and dark as themselves, everything else (auto, junk, nothing) system. */
const preferenceOf = (value) => (value === "light" || value === "dark" ? value : "system");

function runScript(source, stored, prefersDark) {
  const attributes = {};
  const sandbox = {
    localStorage: { getItem: (key) => (Object.hasOwn(stored, key) ? stored[key] : null) },
    window: { matchMedia: () => ({ matches: prefersDark }) },
    document: { documentElement: { setAttribute: (name, value) => (attributes[name] = value) } },
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.matchMedia = sandbox.window.matchMedia;
  vm.runInNewContext(source, sandbox);
  return attributes;
}

export function checkThemeHtml(html, resolveMode) {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match) return ["index.html has no inline pre-paint theme script"];
  const problems = [];

  const cases = [];
  for (const value of PREFS) cases.push({ stored: value === "" ? {} : { "ttt.mode": value }, key: "ttt.mode", value, mode: value || null, preference: preferenceOf(value) });
  for (const value of LEGACY_PREFS) {
    // the legacy value "auto" stood for system
    cases.push({ stored: value === "" ? {} : { "ttt.theme": value }, key: "ttt.theme", value, mode: value === "auto" || value === "" ? null : value, preference: preferenceOf(value) });
  }
  // the current key wins over the legacy one
  cases.push({ stored: { "ttt.mode": "light", "ttt.theme": "dark" }, key: "ttt.mode over ttt.theme", value: "light", mode: "light", preference: "light" });

  for (const c of cases) {
    for (const prefersDark of [false, true]) {
      const expectedMode = resolveMode(c.mode, prefersDark);
      let actual;
      try {
        actual = runScript(match[1], c.stored, prefersDark);
      } catch (e) {
        actual = { error: e.message };
      }
      const where = `stored "${c.value}" under ${c.key} with system ${prefersDark ? "dark" : "light"}`;
      if (actual["data-mode"] !== expectedMode) {
        problems.push(`${where}: the page script gives data-mode "${actual["data-mode"] ?? actual.error}", resolveMode gives "${expectedMode}"${c.mode === null || c.mode === "system" ? " (system)" : ""}`);
      }
      if (actual["data-mode-preference"] !== c.preference) {
        problems.push(`${where}: the page script gives data-mode-preference "${actual["data-mode-preference"]}", expected "${c.preference}"`);
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const { resolveMode } = await import(pathToFileURL(join(root, "src", "ui", "theme.ts")).href);
  const problems = checkThemeHtml(readFileSync(join(root, "site", "index.html"), "utf8"), resolveMode);
  problems.forEach((p) => console.error("check-theme:", p));
  process.exit(problems.length ? 1 : 0);
}
