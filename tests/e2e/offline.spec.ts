import { test, expect, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { startGame, expectTurn } from "./helpers.ts";

// UI contract used by these tests:
//  - a service worker is registered for the site, and the page works offline once it controls it
//  - an interrupted game is restored on load (same marks, same side to move)
//  - when a new version of the worker is waiting, #update-bar shows an "Update" button

async function controlled(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // The first load is not controlled; a reload under the worker is.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

const mark = (page: Page, text: string) => page.locator(`button.cell[data-mark="${text}"], button.sticker[data-mark="${text}"]`);

test("the manifest is linked and a service worker is registered", async ({ page }) => {
  await page.goto("./");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const manifest = await page.request.get(new URL(href!, page.url()).toString());
  expect(manifest.ok()).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBe(true);
});

test("every variant is playable offline after one visit", async ({ page, context }) => {
  await page.goto("./");
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();

  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="4"]').click();
  await expect(mark(page, "X")).toHaveCount(1);

  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await page.locator('button[data-board="4"][data-cell="4"]').click();
  await expect(mark(page, "X")).toHaveCount(1);

  await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
  await page.locator('button.sticker[data-face="2"][data-cell="4"]').click();
  await expect(mark(page, "X")).toHaveCount(1);
});

test("a game in progress comes back after a reload, in every variant", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="4"]').click();
  await page.locator('[data-cell="0"]').click();
  await page.reload();
  await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X");
  await expect(page.locator('[data-cell="0"]')).toHaveAttribute("data-mark", "O");
  await expectTurn(page, "X");

  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await page.locator('button[data-board="4"][data-cell="2"]').click();
  await page.reload();
  await expect(page.locator('button[data-board="4"][data-cell="2"]')).toHaveAttribute("data-mark", "X");
  await expect(page.locator("#game-status")).toContainText(/top right/i);

  await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
  await page.locator('button.sticker[data-face="2"][data-cell="4"]').dispatchEvent("click");
  await page.reload();
  await expect(page.locator('button.sticker[data-face="2"][data-cell="4"]')).toHaveAttribute("data-mark", "X");
  await expectTurn(page, "O");
});

test("a reload while the computer is to move makes it move again", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "Computer", level: "1. Beginner", mark: "O" });
  await expect(mark(page, "X")).toHaveCount(1, { timeout: 5000 });
  await page.reload();
  await expect(mark(page, "X")).toHaveCount(1);
  await expectTurn(page, "O");
});

test("leaving a game with New game forgets it", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="4"]').click();
  await page.getByRole("button", { name: "New game" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("a corrupt save is set aside, a notice is shown, and the game starts fresh", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ttt.save", "{not json"));
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.locator("#toasts")).toContainText(/could not be read/i);
  expect(await page.evaluate(() => localStorage.getItem("ttt.save.backup"))).toBe("{not json");
});

// A tiny static server for the site, so the test can start serving a changed worker (a "new version")
// without touching any file.
function serveSite(port: number): Promise<{ suffix: { sw: string }; close: () => Promise<void> }> {
  const root = join(import.meta.dirname, "..", "..", "site");
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
  const suffix = { sw: "" };
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    const file = join(root, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    let body: Buffer | string = readFileSync(file);
    if (path === "/sw.js") body = body.toString() + suffix.sw;
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ suffix, close: () => new Promise((r) => server.close(() => r())) })));
}

test("a new version shows the update bar, and updating keeps the game", async ({ page }, testInfo) => {
  const port = 4174 + (testInfo.project.name === "mobile" ? 1 : 0);
  const site = await serveSite(port);
  try {
    const url = `http://localhost:${port}/`;
    await startGame(page, { variant: "Classic", opponent: "A friend on this device" }, url);
    await page.locator('[data-cell="4"]').click();
    await controlled(page);
    site.suffix.sw = "\n// a newer build\n";
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    const bar = page.locator("#update-bar");
    await expect(bar).toBeVisible({ timeout: 10_000 });
    await bar.getByRole("button", { name: "Update" }).click();
    await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X", { timeout: 10_000 });
    await expect(bar).toBeHidden();
  } finally {
    await site.close();
  }
});

test("offline, the logo still shows and every icon is served from the cache", async ({ page, context }) => {
  await page.goto("./");
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".app-header .app-logo")).toBeVisible();
  const hrefs = ["icons/logo.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
  for (const href of hrefs) {
    const status = await page.evaluate(async (path) => (await fetch(path)).status, href);
    expect(status, href).toBe(200);
  }
});
