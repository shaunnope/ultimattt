// The release gate for what the constitution asks of a PWA: accessibility and first-load speed.
//
//   node scripts/audit.mjs          build, serve the site, run Lighthouse and axe, and fail below the bar
//
// Thresholds: Lighthouse accessibility >= 90, no serious or critical axe violation, and the first load
// interactive in under 3 seconds on Lighthouse's throttled mobile profile (slow 4G, 4x slower CPU).
// Installability (manifest, service worker, offline) is checked by tests/e2e/installable.spec.ts, which this
// script runs too, because Lighthouse no longer has a PWA category. `npm test` and `npm run check` cover the rest.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startStaticServer } from "./lib/serve.mjs";

export const THRESHOLDS = { accessibility: 0.9, interactiveMs: 3000 };

/** `--skip-perf` leaves out the timing suite, for a run made right after `npm run test:perf`. Releases run it all. */
export function parseAuditArgs(argv) {
  return { perf: !argv.includes("--skip-perf") };
}

/** The two numbers we gate on, out of a Lighthouse result. Missing numbers stay null and fail the gate. */
export function readLighthouse(lhr) {
  const accessibility = lhr?.categories?.accessibility?.score;
  const interactive = lhr?.audits?.interactive?.numericValue;
  return {
    accessibility: typeof accessibility === "number" ? accessibility : null,
    interactiveMs: typeof interactive === "number" ? interactive : null,
  };
}

/** How many nodes break a serious or critical axe rule, and which rules. */
export function summariseAxe(violations) {
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  return { serious: bad.reduce((n, v) => n + v.nodes.length, 0), rules: [...new Set(bad.map((v) => v.id))] };
}

/** Every way the report falls short; empty when it passes. */
export function evaluateAudit({ accessibility, interactiveMs, axe }) {
  const problems = [];
  if (accessibility === null) problems.push("Lighthouse gave no accessibility score.");
  else if (accessibility < THRESHOLDS.accessibility) {
    problems.push(`Accessibility score ${Math.round(accessibility * 100)} is below ${THRESHOLDS.accessibility * 100}.`);
  }
  if (axe.serious > 0) problems.push(`axe found ${axe.serious} serious or critical problem(s): ${axe.rules.join(", ")}.`);
  if (interactiveMs === null) problems.push("Lighthouse gave no time to interactive for the first load.");
  else if (interactiveMs >= THRESHOLDS.interactiveMs) {
    problems.push(`The first load is interactive after ${Math.round(interactiveMs)} ms; it must be under ${THRESHOLDS.interactiveMs} ms on throttled mobile.`);
  }
  return problems;
}

async function main() {
  const root = process.cwd();
  // one build, root and sub-path, which the installability and timing runs below reuse instead of building again
  const build = spawnSync(process.execPath, ["scripts/build.mjs", "--subpath"], { cwd: root, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);

  // Timing runs first, right after the build, while the machine is idle: Lighthouse and the browsers below leave work behind that
  // would otherwise slow the wall-clock limits. The computer replies in under a second and the cube stays smooth on a 4x slower CPU.
  const fresh = { ...process.env, TTT_BUILD_FRESH: "1" };
  if (parseAuditArgs(process.argv.slice(2)).perf) {
    const perf = spawnSync("npm", ["run", "test:perf"], { cwd: root, stdio: "inherit", shell: true, env: fresh });
    if (perf.status !== 0) process.exitCode = 1;
  } else {
    console.log("audit: timing suite skipped (--skip-perf)");
  }

  const server = await startStaticServer(join(root, "build"), 0);
  try {
    const url = server.url;
    const require = createRequire(import.meta.url);
    const { chromium } = await import("@playwright/test");

    // axe on the screens a player meets first
    const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const found = [];
    for (const [name, go] of [
      ["start screen", async () => {}],
      ["classic game", async () => { await page.getByRole("button", { name: "Start game" }).click(); }],
    ]) {
      await page.goto(url);
      await go();
      await page.evaluate(axeSource);
      const result = await page.evaluate(() => globalThis.axe.run());
      found.push(...result.violations.map((v) => ({ ...v, id: `${v.id} (${name})` })));
    }
    await browser.close();

    // Lighthouse: accessibility, and the first load
    const lighthouse = (await import("lighthouse")).default;
    const chromeLauncher = await import("chrome-launcher");
    const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ["--headless=new", "--no-sandbox"] });
    let lhr;
    try {
      const run = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["accessibility", "performance"] });
      lhr = run?.lhr;
    } finally {
      await chrome.kill();
    }

    const problems = evaluateAudit({ ...readLighthouse(lhr), axe: summariseAxe(found) });
    const numbers = readLighthouse(lhr);
    console.log(`Accessibility ${numbers.accessibility === null ? "?" : Math.round(numbers.accessibility * 100)}, first load interactive ${numbers.interactiveMs === null ? "?" : Math.round(numbers.interactiveMs)} ms, axe serious ${summariseAxe(found).serious}`);
    problems.forEach((p) => console.error("audit:", p));
    if (problems.length) process.exitCode = 1;

    // Installability: manifest, service worker, offline
    const installable = spawnSync("npx", ["playwright", "test", "tests/e2e/installable.spec.ts", "--project=desktop"], { cwd: root, stdio: "inherit", shell: true, env: fresh });
    if (installable.status !== 0) process.exitCode = 1;
  } finally {
    await server.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
  process.exit(process.exitCode ?? 0);
}
