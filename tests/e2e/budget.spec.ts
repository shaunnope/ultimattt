import { test, expect } from "@playwright/test";
import { gzipSync } from "node:zlib";

// The size budget (specs/007 research R12): what the browser actually loads to show the start screen, script plus style, gzipped,
// is at most 70 KB. scripts/check-build.mjs checks the shell's own files and the whole build; this one is the real first load, which
// includes the route nodes the framework fetches once the page is running. The 006 build was about 40 KB.

const BUDGET_KB = 70;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the same files load on every device; one project is enough");
});

test("the first load, script plus style, stays within the budget", async ({ page }) => {
  const sizes = new Map<string, number>();
  page.on("response", async (response) => {
    const url = response.url();
    if (!/\.(?:js|css)$/.test(url)) return;
    try {
      sizes.set(url, gzipSync(await response.body(), { level: 9 }).length);
    } catch {
      // a response that was cancelled is not part of the load
    }
  });
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await page.waitForTimeout(500); // let the last files arrive
  const kb = [...sizes.values()].reduce((sum, bytes) => sum + bytes, 0) / 1024;
  expect(kb, `first load ${kb.toFixed(1)} KB gzipped in ${sizes.size} files`).toBeLessThanOrEqual(BUDGET_KB);
});
