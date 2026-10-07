import { defineConfig, devices } from "@playwright/test";

// Timing tests (the computer's reply time, the cube's frame times) run alone, one at a time, so other tests
// cannot steal the CPU they measure. Run with: npm run test:perf
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /perf\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://localhost:4173/", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/build.mjs --subpath && npx http-server build -p 4173 -c-1 --silent",
    url: "http://localhost:4173/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
