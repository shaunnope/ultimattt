import { test as base, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";
import { Relay } from "./relay.ts";

// Addresses and links (specs/007 contracts C1, data-model route table): the hash holds the screen, the query string is never
// moved into it. Start, resume and opening a replay replace the entry; opening help adds one and Back removes it.
//   #/        start screen, or resume   #/play  game   #/replay  a replay opened from a ?watch= link   #/help  help

const test = base.extend<{ relay: Relay }>({
  relay: async ({}, use) => {
    const relay = new Relay();
    await use(relay);
    await relay.closeAll();
  },
});

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const hash = (page: Page) => page.evaluate(() => location.hash);
const historyLength = (page: Page) => page.evaluate(() => history.length);
const startScreen = (page: Page) => page.getByRole("button", { name: "Start game" });
const WIN = [0, 3, 1, 4, 2];

test("a game is at #/play, and a reload there restores it", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "This device" });
  await cell(page, 4).click();
  await cell(page, 0).click();
  await expect.poll(() => hash(page)).toBe("#/play");
  await page.reload();
  await expect(cell(page, 4)).toHaveAttribute("data-mark", "X");
  await expect(cell(page, 0)).toHaveAttribute("data-mark", "O");
  expect(await hash(page)).toBe("#/play");
});

test("a reload on #/play with no saved game shows the start screen at #/", async ({ page }) => {
  await page.goto("./#/play");
  await expect(startScreen(page)).toBeVisible();
  await expect.poll(() => hash(page)).toMatch(/^(#\/)?$/);
});

test("a reload on #/replay without a replay link shows the start screen", async ({ page }) => {
  await page.goto("./#/replay");
  await expect(startScreen(page)).toBeVisible();
  await expect.poll(() => hash(page)).toMatch(/^(#\/)?$/);
});

test("the start screen is at #/, and leaving a game with New game returns there", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "This device" });
  await page.getByRole("button", { name: "New game" }).click();
  await expect(startScreen(page)).toBeVisible();
  await expect.poll(() => hash(page)).toMatch(/^(#\/)?$/);
});

test("a ?join= link joins and then removes the code from the address", async ({ browser, relay }) => {
  const { page } = await relay.device(browser);
  await page.goto("./?join=BXK4M9");
  await expect.poll(() => page.url()).not.toContain("join=");
  await expect.poll(() => hash(page)).toBe("#/play");
});

test("a replay link opens the replay at #/replay, and Close replay leaves it with no watch in the address", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await startGame(page, { variant: "Classic", opponent: "This device" });
  for (const c of WIN) await cell(page, c).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close replay" }).click();
  await page.getByRole("button", { name: "Share replay" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.getByRole("group", { name: "Replay controls" })).toBeVisible();
  await expect.poll(() => hash(other)).toBe("#/replay");
  expect(other.url()).toContain("watch=");
  await other.getByRole("button", { name: "Close replay" }).click();
  expect(other.url()).not.toContain("watch=");
});

test("a replay link that is not good shows its explanation and the start screen", async ({ page }) => {
  await page.goto("./?watch=1&game=classic");
  await expect(page.locator("#toasts")).toContainText(/link/i);
  await expect(startScreen(page)).toBeVisible();
  expect(page.url()).not.toContain("watch=");
});

test("an old #/help address opens help", async ({ page }) => {
  await page.goto("./#/help");
  await expect(page.locator("#help-view h2").first()).toHaveText("Classic rules");
  await expect(page.locator("#main")).toBeHidden();
});

test("starting a game adds no history entry; opening help adds one, and Back returns to the same game", async ({ page }) => {
  await page.goto("./");
  await expect(startScreen(page)).toBeVisible();
  const before = await historyLength(page);
  await startGame(page, { variant: "Classic", opponent: "Computer", level: "1. Beginner", mark: "X" }, "./");
  await cell(page, 4).click();
  await expect(page.locator('button.cell[data-mark="O"]')).toHaveCount(1, { timeout: 10_000 });
  const after = await historyLength(page);
  expect(after).toBeLessThanOrEqual(before + 1); // the one extra entry is the load of "./" that startGame repeats
  const saved = await page.evaluate(() => localStorage.getItem("ttt.save"));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.locator("#help-view h2").first()).toBeVisible();
  expect(await historyLength(page)).toBe(after + 1);
  await page.goBack();
  await expect(cell(page, 4)).toHaveAttribute("data-mark", "X");
  await expect(page.locator('button.cell[data-mark="O"]')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("ttt.save"))).toBe(saved); // the computer did not move again
  expect(await hash(page)).toBe("#/play");
});
