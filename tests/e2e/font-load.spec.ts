import { test, expect } from "@playwright/test";
import { startGame } from "./helpers.ts";

// The web font is the one third-party request. It must never hold up first paint (spec FR-003, SC-007), and the app
// must work with it blocked (offline first use, private networks).

const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;

test("a slow font request does not delay the first render", async ({ page }) => {
  await page.route(FONT_HOSTS, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await route.abort();
  });
  const started = Date.now();
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(2500);
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toMatch(/system-ui/);
});

test("with the font blocked the app renders in the fallback face and a move can be played", async ({ page }) => {
  await page.route(FONT_HOSTS, (route) => route.abort());
  await startGame(page, { variant: "Classic", opponent: "This device" });
  await page.locator('[data-cell="4"]').click();
  await expect(page.locator('[data-cell="4"] svg.mark-x')).toBeVisible();
});
