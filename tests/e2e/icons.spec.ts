import { test, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";

// UI contract used by these tests: Settings has "Icon for X" and "Icon for O" (one character each,
// different from each other). Icons are shown wherever a mark or its name is shown, on this device only.

async function setIcons(page: Page, x: string, o: string) {
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Icon for X").fill(x);
  await dialog.getByLabel("Icon for O").fill(o);
  return dialog;
}
const done = (page: Page) => page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Done" }).click();
const mark = (page: Page, text: string) => page.locator(`button .mark:text-is("${text}")`);

test("icons replace X and O on the board, in the status line, the result and the replay", async ({ page }) => {
  await page.goto("./");
  await setIcons(page, "★", "●");
  await done(page);
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="0"]').click();
  await expect(mark(page, "★")).toHaveCount(1);
  await expect(page.locator("#game-status")).toContainText("● to move");
  for (const c of [3, 1, 4, 2]) await page.locator(`[data-cell="${c}"]`).click();
  await expect(page.locator("#game-status")).toContainText("★ wins");
  await expect(page.getByRole("dialog")).toContainText("★ wins");
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  await expect(page.getByRole("list", { name: "Moves" })).toContainText("1. ★: row 1, column 1");
  await expect(mark(page, "●")).not.toHaveCount(0);
});

test("icons show in Ultimate and the Cube too", async ({ page }) => {
  await page.goto("./");
  await setIcons(page, "♥", "♦");
  await done(page);
  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await page.locator('button[data-board="4"][data-cell="2"]').click();
  await expect(mark(page, "♥")).toHaveCount(1);
  await expect(page.locator("#game-status")).toContainText("♦ to move");
  await startGame(page, { variant: "Cube", opponent: "A friend on this device" });
  await page.locator('button.sticker[data-face="2"][data-cell="4"]').click();
  await expect(mark(page, "♥")).toHaveCount(1);
  await expect(page.locator("#game-status")).toContainText("♦ to move");
});

test("an icon that is blank, longer than one character, or the same as the other is refused, and not used", async ({ page }) => {
  await page.goto("./");
  // Each step is an invalid pair, so nothing is saved along the way (a valid pair applies at once).
  const dialog = await setIcons(page, "ab", "O");
  await expect(dialog.getByRole("alert")).toContainText(/one character/i);
  await dialog.getByLabel("Icon for X").fill("o");
  await expect(dialog.getByRole("alert")).toContainText(/different/i);
  await dialog.getByLabel("Icon for X").fill("");
  await expect(dialog.getByRole("alert")).toContainText(/blank|empty|one character/i);
  await done(page);
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="0"]').click();
  await expect(mark(page, "X")).toHaveCount(1);
});

test("chosen icons are remembered across reloads", async ({ page }) => {
  await page.goto("./");
  await setIcons(page, "★", "●");
  await done(page);
  await page.reload();
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="4"]').click();
  await expect(mark(page, "★")).toHaveCount(1);
});
