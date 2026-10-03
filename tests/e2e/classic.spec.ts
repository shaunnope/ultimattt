import { test, expect, type Page } from "@playwright/test";

// UI contract used by these tests:
//  - start screen: radios labelled by text, #level select, "Start game" button
//  - board: role="grid" with buttons [data-cell="i"]; winning cells get data-win="true"
//  - #game-status shows the turn or result; result dialog has "Play again" and "New game"
//  - "Undo" and "Resign" buttons

// Pick a card on the start screen by its title (the bold line of its label).
async function choose(page: Page, title: string) {
  await page.locator("label", { has: page.locator("strong", { hasText: new RegExp(`^${title}$`) }) }).click();
}

async function start(page: Page, opts: { size?: "3×3" | "4×4" | "5×5"; opponent: "Computer" | "A friend on this device"; level?: string; mark?: "X" | "O" }) {
  await page.goto("./");
  await choose(page, "Classic");
  await choose(page, opts.opponent);
  if (opts.size) await choose(page, opts.size);
  if (opts.opponent === "Computer") {
    if (opts.level) await page.locator("#level").selectOption({ label: opts.level });
    await choose(page, opts.mark ?? "X");
  }
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
}

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
async function playCells(page: Page, cells: number[]) {
  for (const c of cells) await cell(page, c).click();
}

test("3×3 two players: X wins with a row and the line is highlighted", async ({ page }) => {
  await start(page, { opponent: "A friend on this device" });
  await expect(page.locator("#game-status")).toContainText("X");
  await playCells(page, [0, 3, 1, 4, 2]);
  await expect(page.locator("#game-status")).toContainText("X wins");
  for (const c of [0, 1, 2]) await expect(cell(page, c)).toHaveAttribute("data-win", "true");
  await expect(page.getByRole("dialog")).toContainText("X wins");
});

test("3×3 two players: a full board with no line is a draw", async ({ page }) => {
  await start(page, { opponent: "A friend on this device" });
  await playCells(page, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
  await expect(page.locator("#game-status")).toContainText("draw");
  await expect(page.getByRole("dialog")).toContainText("draw");
});

test("4×4: three in a row does not win, four does", async ({ page }) => {
  await start(page, { opponent: "A friend on this device", size: "4×4" });
  await playCells(page, [0, 4, 1, 5, 2]);
  await expect(page.locator("#game-status")).not.toContainText("wins");
  await playCells(page, [8, 3]);
  await expect(page.locator("#game-status")).toContainText("X wins");
});

test("5×5: four in a row wins", async ({ page }) => {
  await start(page, { opponent: "A friend on this device", size: "5×5" });
  await playCells(page, [0, 5, 1, 6, 2, 7, 3]);
  await expect(page.locator("#game-status")).toContainText("X wins");
});

test("an occupied cell is refused with an explanation and the turn does not change", async ({ page }) => {
  await start(page, { opponent: "A friend on this device" });
  await cell(page, 0).click();
  await cell(page, 0).click();
  await expect(page.locator("#game-status")).toContainText(/taken|occupied/i);
  await cell(page, 1).click();
  await expect(cell(page, 1)).toContainText("O");
});

test("against the computer: it replies, and Undo takes back the move and the reply", async ({ page }) => {
  await start(page, { opponent: "Computer", level: "3. Steady", mark: "X" });
  await cell(page, 4).click();
  await expect(page.locator('[data-cell] >> text="O"')).toHaveCount(1, { timeout: 5000 });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator('[data-cell] >> text="X"')).toHaveCount(0);
  await expect(page.locator('[data-cell] >> text="O"')).toHaveCount(0);
});

test("playing as O, the computer moves first", async ({ page }) => {
  await start(page, { opponent: "Computer", level: "1. Beginner", mark: "O" });
  await expect(page.locator('[data-cell] >> text="X"')).toHaveCount(1, { timeout: 5000 });
});

test("Resign ends the game for the player who resigns", async ({ page }) => {
  await start(page, { opponent: "A friend on this device" });
  await cell(page, 0).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: /confirm|resign/i }).last().click();
  await expect(page.getByRole("dialog")).toContainText(/resigned|wins/i);
});

test("New game returns to the start screen", async ({ page }) => {
  await start(page, { opponent: "A friend on this device" });
  await playCells(page, [0, 3, 1, 4, 2]);
  await page.getByRole("dialog").getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});
