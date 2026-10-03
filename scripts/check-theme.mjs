// Fails when the pre-paint theme script in site/index.html disagrees with resolveMode in src/ui/theme.ts.
// The script is run against every stored value and system theme and its answer compared.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const PREFS = ["auto", "light", "dark", "blue", ""];

function runScript(source, stored, prefersDark) {
  const attributes = {};
  const sandbox = {
    localStorage: { getItem: (key) => (key === "ttt.theme" && stored !== null ? stored : null) },
    window: { matchMedia: () => ({ matches: prefersDark }) },
    document: { documentElement: { setAttribute: (name, value) => (attributes[name] = value) } },
  };
  sandbox.window.localStorage = sandbox.localStorage;
  vm.runInNewContext(source, sandbox);
  return attributes["data-mode"];
}

export function checkThemeHtml(html, resolveMode) {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match) return ["index.html has no inline pre-paint theme script"];
  const problems = [];
  for (const pref of PREFS) {
    for (const prefersDark of [false, true]) {
      const expected = resolveMode(pref === "" ? "auto" : pref, prefersDark);
      let actual;
      try {
        actual = runScript(match[1], pref === "" ? null : pref, prefersDark);
      } catch (e) {
        actual = `error: ${e.message}`;
      }
      if (actual !== expected) {
        problems.push(`stored "${pref}" with system ${prefersDark ? "dark" : "light"}: the page script gives "${actual}", resolveMode gives "${expected}"${pref === "auto" || pref === "" ? " (auto)" : ""}`);
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
