import { defineConfig, devices } from "@playwright/test";

// Visual parity harness for the SvelteKit migration (specs/007). The baseline is captured from the app as it was
// before the migration and then compared with the migrated build:
//   PARITY_DIR=site  npm run test:parity -- --update-snapshots   (baseline, old layout; no longer buildable)
//   PARITY_DIR=build npm run test:parity                          (after the migration)
// PARITY_DIR names the folder to serve; the default is `build`. The pre-migration baseline was taken with PARITY_DIR=site.
const dir = process.env.PARITY_DIR ?? "build";

export default defineConfig({
  testDir: "tests/parity",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.002, threshold: 0.2 },
  },
  snapshotPathTemplate: ".parity/baseline/{arg}{ext}",
  use: { baseURL: "http://localhost:4175/", trace: "off", serviceWorkers: "block", reducedMotion: "reduce" },
  webServer: {
    command: `npx http-server ${dir} -p 4175 -c-1 --silent`,
    url: "http://localhost:4175/",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
