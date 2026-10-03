import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // many browsers run at once; give the page time to settle before an expectation gives up
  expect: { timeout: 10_000 },
  // timing tests have their own config (playwright.perf.config.ts) and run alone
  testIgnore: /perf\.spec\.ts/,
  reporter: "list",
  use: { baseURL: "http://localhost:4173/", trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npx http-server site -p 4173 -c-1 --silent",
    url: "http://localhost:4173/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
