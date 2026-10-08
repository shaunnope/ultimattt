import { test, expect } from "@playwright/test";
import { startGame } from "./helpers.ts";

// The shell: what the page shows before or without its scripts (spec 007 FR-010), and where it asks for files (FR-016).

test("with scripts blocked the page still has its colour and says the game needs JavaScript", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto("./");
  await expect(page.locator(".noscript")).toContainText("This game needs JavaScript.");
  await expect(page.locator("body")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await context.close();
});

test("a full game and a settings change ask only the app's own origin and Google Fonts", async ({ page, baseURL }) => {
  const origins = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") origins.add(url.origin);
  });
  await startGame(page, { variant: "Classic", opponent: "This device" });
  for (const c of [0, 3, 1, 4, 2]) await page.locator(`[data-cell="${c}"]`).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  const allowed = new Set([new URL(baseURL!).origin, "https://fonts.googleapis.com", "https://fonts.gstatic.com"]);
  expect([...origins].filter((o) => !allowed.has(o))).toEqual([]);
});
