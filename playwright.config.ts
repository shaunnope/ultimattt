import { defineConfig, devices } from "@playwright/test";
import { e2eShard } from "./scripts/lib/e2e-shard.mjs";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // many browsers run at once; give the page time to settle before an expectation gives up
  expect: { timeout: 15_000 },
  // timing tests have their own config (playwright.perf.config.ts) and run alone; E2E_SHARD=quick|heavy runs half of the rest
  ...e2eShard(process.env.E2E_SHARD),
  reporter: "list",
  use: { baseURL: "http://localhost:4173/", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/build.mjs --subpath && npx http-server build -p 4173 -c-1 --silent",
    url: "http://localhost:4173/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
