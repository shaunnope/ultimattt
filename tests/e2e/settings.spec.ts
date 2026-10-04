import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { choose, startGame } from "./helpers.ts";

// UI contract used by these tests:
//  - a "Settings" button in the header opens a dialog named "Settings" with "Show hints",
//    "Replay a finished game automatically", an "Appearance" select (Auto, Light, Dark),
//    "Icon for X" and "Icon for O", and "Done"; changes apply at once and are remembered
//  - with hints on, the player's winning cells get data-hint="win" (a dot) and the cells they must
//    block get data-hint="block" (a dashed ring)

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function closeSettings(page: Page) {
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Done" }).click();
}

test("hints are off by default", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  for (const c of [0, 3, 1, 4]) await cell(page, c).click(); // X: 0,1  O: 3,4  X to move
  for (let i = 0; i < 9; i++) await expect(cell(page, i)).not.toHaveAttribute("data-hint", /.+/);
  const dialog = await openSettings(page);
  await expect(dialog.getByLabel("Show hints")).not.toBeChecked();
});

test("with hints on, winning and must-block cells are marked with shapes, and it is remembered", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  for (const c of [0, 3, 1, 4]) await cell(page, c).click();
  const dialog = await openSettings(page);
  await dialog.getByLabel("Show hints").check();
  await closeSettings(page);
  await expect(cell(page, 2)).toHaveAttribute("data-hint", "win");
  await expect(cell(page, 5)).toHaveAttribute("data-hint", "block");
  // shapes, not just colour: a dot for a win and a dashed ring for a block
  const dot = await cell(page, 2).evaluate((el) => getComputedStyle(el, "::after").content);
  expect(dot).not.toBe("none");
  expect(dot).not.toBe("normal");
  const ring = await cell(page, 5).evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(ring).toBe("dashed");
  await page.reload();
  await expect(cell(page, 2)).toHaveAttribute("data-hint", "win");
  const again = await openSettings(page);
  await expect(again.getByLabel("Show hints")).toBeChecked();
});

test("hints follow the move: they disappear when the game is over", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  const dialog = await openSettings(page);
  await dialog.getByLabel("Show hints").check();
  await closeSettings(page);
  for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close replay" }).click();
  await expect(page.locator("[data-hint]")).toHaveCount(0);
});

test("Ultimate hints cover the board you must play", async ({ page }) => {
  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  const dialog = await openSettings(page);
  await dialog.getByLabel("Show hints").check();
  await closeSettings(page);
  // O must play board 0 and holds cells 1 and 4 there: cell 7 wins the board.
  for (const [b, c] of [[0, 0], [0, 1], [1, 0], [0, 4], [4, 0]]) await page.locator(`button[data-board="${b}"][data-cell="${c}"]`).click();
  await expect(page.locator('button[data-board="0"][data-cell="7"]')).toHaveAttribute("data-hint", "win");
});

test("Cube hints mark the cell that completes a line and the one to block", async ({ page }) => {
  await startGame(page, { variant: "Cube", opponent: "A friend on this device" });
  const dialog = await openSettings(page);
  await dialog.getByLabel("Show hints").check();
  await closeSettings(page);
  for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1]]) await page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`).dispatchEvent("click");
  await expect(page.locator('button.sticker[data-face="2"][data-cell="2"]')).toHaveAttribute("data-hint", "win");
  await expect(page.locator('button.sticker[data-face="0"][data-cell="2"]')).toHaveAttribute("data-hint", "block");
});

test("with automatic replay off, dismissing the result leaves the board", async ({ page }) => {
  await page.goto("./");
  const dialog = await openSettings(page);
  await dialog.getByLabel("Replay a finished game automatically").uncheck();
  await closeSettings(page);
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Replay controls" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
});

test("appearance: Dark, Light, and Auto following the system, remembered across reloads", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  const mode = () => page.evaluate(() => document.documentElement.getAttribute("data-mode"));
  expect(await mode()).toBe("light");
  let dialog = await openSettings(page);
  await dialog.getByLabel("Appearance").selectOption("dark");
  expect(await mode()).toBe("dark");
  await closeSettings(page);
  await page.reload();
  expect(await mode()).toBe("dark");
  dialog = await openSettings(page);
  await expect(dialog.getByLabel("Appearance")).toHaveValue("dark");
  await dialog.getByLabel("Appearance").selectOption("light");
  expect(await mode()).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await mode()).toBe("light"); // fixed light ignores the system
  await dialog.getByLabel("Appearance").selectOption("auto");
  expect(await mode()).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(mode).toBe("light");
});

test("the pre-paint theme script and the app agree (scripts/check-theme.mjs)", async () => {
  expect(() => execFileSync("node", ["scripts/check-theme.mjs"], { cwd: join(import.meta.dirname, "..", ".."), stdio: "pipe" })).not.toThrow();
});

test("the start screen remembers the last choices, after New game and after a reload", async ({ page }) => {
  await page.goto("./");
  await choose(page, "Ultimate");
  await choose(page, "A friend on this device");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board")).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.locator("input#variant-ultimate")).toBeChecked();
  await expect(page.locator("input#mode-local")).toBeChecked();
  await page.reload();
  await expect(page.locator("input#variant-ultimate")).toBeChecked();
  await expect(page.locator("input#mode-local")).toBeChecked();

  // Classic with a board size and a computer level
  await choose(page, "Classic");
  await choose(page, "Computer");
  await choose(page, "5×5");
  await page.locator("#level").selectOption({ label: "5. Master" });
  await choose(page, "O");
  await page.getByRole("button", { name: "Start game" }).click();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.locator("input#size-5")).toBeChecked();
  await expect(page.locator("input#mark-O")).toBeChecked();
  await expect(page.locator("#level")).toHaveValue("5");
});

// ---- win length default follows every size choice (003) ----

async function startScreen(page: Page) {
  await page.goto("./");
  const start = page.getByRole("button", { name: "Start game" });
  const leave = page.getByRole("button", { name: "New game" });
  await expect(start.or(leave)).toBeVisible();
  if (await leave.isVisible()) await leave.click();
}

for (const variant of ["Classic", "Ultimate", "Cube"] as const) {
  test(`${variant}: choosing 4×4 or 5×5 sets the win length to 4, and 3×3 shows it fixed`, async ({ page }) => {
    await startScreen(page);
    await choose(page, variant);
    for (const size of ["5×5", "4×4"] as const) {
      await choose(page, size);
      await expect(page.locator("#winlength-4")).toBeChecked();
    }
    await choose(page, "5×5");
    await choose(page, "5"); // edit the win length
    await expect(page.locator("#winlength-5")).toBeChecked();
    await choose(page, "4×4");
    await expect(page.locator("#winlength-4")).toBeChecked();
    await choose(page, "3×3");
    await expect(page.locator("#win-fixed")).toContainText("3 in a row");
    await choose(page, "5×5");
    await expect(page.locator("#winlength-4")).toBeChecked();
  });

  test(`${variant}: choosing the size that is already selected keeps an edited win length`, async ({ page }) => {
    await startScreen(page);
    await choose(page, variant);
    await choose(page, "5×5");
    await choose(page, "5");
    await choose(page, "5×5");
    await expect(page.locator("#winlength-5")).toBeChecked();
  });
}
