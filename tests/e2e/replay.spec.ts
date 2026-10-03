import { test, expect, type Page } from "@playwright/test";
import { startGame, choose } from "./helpers.ts";

// UI contract used by these tests:
//  - the game shows its seed in #game-seed, with a "Copy seed" button
//  - when a game ends the result dialog offers "Watch replay"; the controls then offer "Share replay"
//  - the replay has a group "Replay controls": Play/Pause, "Step back", "Step forward", a slider named
//    "Replay position", a "Speed" select (0.5×, 1×, 2×, 4×), a list named "Moves", and "Close replay"
//  - the start screen has #seed-input (with #seed-error) that sets the variant and board size
//  - a link ?watch=...&seed=...&game=...&moves=... opens the replay without touching the saved game

const WIN = [0, 3, 1, 4, 2]; // X wins the top row
const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const marks = (page: Page, text: string) => page.locator(`button.cell .mark:text-is("${text}")`);
const controls = (page: Page) => page.getByRole("group", { name: "Replay controls" });
const slider = (page: Page) => page.getByRole("slider", { name: "Replay position" });

async function playToWin(page: Page) {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  for (const c of WIN) await cell(page, c).click();
  await expect(page.getByRole("dialog")).toContainText("X wins");
}

async function openReplay(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  await expect(controls(page)).toBeVisible();
}

test("the replay steps back and forward, scrubs, and lists every move", async ({ page }) => {
  await playToWin(page);
  await openReplay(page);
  await controls(page).getByRole("button", { name: "Pause" }).click({ timeout: 2000 }).catch(() => undefined);
  await expect(slider(page)).toHaveAttribute("max", "5");
  await expect(page.getByRole("list", { name: "Moves" }).getByRole("listitem")).toHaveCount(5);
  await slider(page).fill("0");
  await expect(marks(page, "X")).toHaveCount(0);
  await controls(page).getByRole("button", { name: "Step forward" }).click();
  await expect(marks(page, "X")).toHaveCount(1);
  await slider(page).fill("3");
  await expect(marks(page, "X")).toHaveCount(2);
  await expect(marks(page, "O")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Moves" }).locator('[aria-current="step"]')).toContainText("3.");
  await controls(page).getByRole("button", { name: "Step back" }).click();
  await expect(slider(page)).toHaveValue("2");
});

test("the replay plays by itself at the chosen speed, which is remembered", async ({ page }) => {
  await playToWin(page);
  await openReplay(page);
  await controls(page).getByLabel("Speed").selectOption("4");
  await slider(page).fill("0");
  await controls(page).getByRole("button", { name: "Play" }).click();
  await expect(slider(page)).toHaveValue("5", { timeout: 6000 });
  await expect(controls(page).getByRole("button", { name: "Play" })).toBeVisible();
  await page.getByRole("button", { name: "Close replay" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(controls(page).getByLabel("Speed")).toHaveValue("4");
});

test("dismissing the result starts the replay by itself", async ({ page }) => {
  await playToWin(page);
  await page.keyboard.press("Escape");
  await expect(controls(page)).toBeVisible();
});

test("a Cube replay includes its layer turns", async ({ page }) => {
  await startGame(page, { variant: "Cube", opponent: "A friend on this device" });
  const sticker = (f: number, c: number) => page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`);
  for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]]) await sticker(f!, c!).dispatchEvent("click");
  await page.getByRole("button", { name: "Turn the bottom layer to the right" }).click();
  await expect(page.locator('.cube-stage[data-busy="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await openReplay(page);
  await expect(page.getByRole("list", { name: "Moves" })).toContainText("turn the bottom layer to the right");
  await slider(page).fill("6");
  await expect(page.locator("#cube-score")).toContainText("X: 1");
});

test("Share replay copies a link; opened in a fresh browser, even offline, it plays the same game without saving anything", async ({ page, browser, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await playToWin(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close replay" }).click();
  await page.getByRole("button", { name: "Share replay" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\?watch=\d+&seed=3X3-[A-Z0-9]{4}-[A-Z0-9]{4}&game=l&moves=03142/);

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(link);
  await expect(controls(other)).toBeVisible();
  await expect(other.getByRole("list", { name: "Moves" }).getByRole("listitem")).toHaveCount(5);
  expect(await other.evaluate(() => localStorage.getItem("ttt.save"))).toBeNull();

  await other.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await other.reload();
  await expect.poll(() => other.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await fresh.setOffline(true);
  await other.goto(link);
  await expect(controls(other)).toBeVisible();
  await fresh.close();
});

test("a bad link is explained and nothing starts", async ({ page }) => {
  await page.goto("./?watch=1&seed=NOPE&game=l&moves=0");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.locator("#toasts")).toContainText(/seed|link|game/i);
});

test("watching a link leaves your own game alone, and Close replay brings it back", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await cell(page, 4).click();
  await cell(page, 0).click();
  const before = await page.evaluate(() => localStorage.getItem("ttt.save"));
  await page.goto("./?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=03142");
  await expect(controls(page)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ttt.save"))).toBe(before);
  await page.getByRole("button", { name: "Close replay" }).click();
  await expect(cell(page, 4).locator(".mark")).toHaveText("X");
  await expect(cell(page, 0).locator(".mark")).toHaveText("O");
  expect(page.url()).not.toContain("watch=");
});

test("Play this seed fills in the start screen", async ({ page }) => {
  await page.goto("./?watch=1&seed=4X4-BXK4-M9TR&game=l&moves=04");
  await page.getByRole("button", { name: "Play this seed" }).click();
  await expect(page.locator("#seed-input")).toHaveValue("4X4-BXK4-M9TR");
  await expect(page.locator("input#size-4")).toBeChecked();
});

test("a pasted seed sets the variant and board; a bad one is explained", async ({ page }) => {
  await page.goto("./");
  await page.locator("#seed-input").fill("4x4-bxk4-m9tr");
  await expect(page.locator("input#size-4")).toBeChecked();
  await choose(page, "A friend on this device");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator("#game-seed")).toContainText("4X4-BXK4-M9TR");
  await expect(page.locator(".board")).toHaveAttribute("aria-label", /4 by 4/);
  await page.getByRole("button", { name: "New game" }).click();

  await page.locator("#seed-input").fill("ULT-BXK4-M9TR");
  await expect(page.locator("input#variant-ultimate")).toBeChecked();

  await page.locator("#seed-input").fill("nope");
  await expect(page.locator("#seed-error")).toContainText(/seed looks like/i);
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("the same seed makes the computer open the same way", async ({ page }) => {
  const firstMove = async () => {
    await page.goto("./");
    await page.locator("#seed-input").fill("3X3-BXK4-M9TR");
    await choose(page, "Computer");
    await page.locator("#level").selectOption({ label: "5. Master" });
    await choose(page, "O");
    await page.getByRole("button", { name: "Start game" }).click();
    await expect(marks(page, "X")).toHaveCount(1, { timeout: 5000 });
    return page.locator('button.cell:has(.mark)').first().getAttribute("data-cell");
  };
  const a = await firstMove();
  await page.getByRole("button", { name: "New game" }).click();
  const b = await firstMove();
  expect(a).toBe(b);
});

test("Copy seed puts the seed on the clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  const seed = (await page.locator("#game-seed").innerText()).replace(/^Seed:\s*/, "").trim();
  await page.getByRole("button", { name: "Copy seed" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(seed);
});
