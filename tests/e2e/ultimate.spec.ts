import { test, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";
import { chooseMove } from "../../src/core/ai.ts";
import { newGame, apply, status } from "../../src/core/ultimate.ts";
import { rngFor } from "../../src/core/seed.ts";
import type { GameConfig, Level, UltimateMove } from "../../src/core/types.ts";

// UI contract used by these tests:
//  - each small board is [data-board="b"] with data-playable="true" when the player may play there
//    and data-claim="X" | "O" | "tie" once decided; cells are button[data-board][data-cell]
//  - #game-status names where to play ("top right board", "any open board")

const sub = (page: Page, b: number) => page.locator(`.sub-board[data-board="${b}"]`);
const cell = (page: Page, b: number, c: number) => page.locator(`button[data-board="${b}"][data-cell="${c}"]`);
async function playMoves(page: Page, moves: [number, number][]) {
  for (const [b, c] of moves) await cell(page, b, c).click();
}

// A legal opening: O claims board 0 on move 6, then X sends O to the claimed board 0 (free choice).
const OPENING: [number, number][] = [[0, 0], [0, 4], [4, 0], [0, 3], [3, 0], [0, 5], [5, 0]];

test("the cell you play points the opponent at one board, which is outlined and named", async ({ page }) => {
  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await expect(page.locator(".sub-board[data-playable='true']")).toHaveCount(9);
  await cell(page, 4, 2).click();
  await expect(page.locator(".sub-board[data-playable='true']")).toHaveCount(1);
  await expect(sub(page, 2)).toHaveAttribute("data-playable", "true");
  await expect(page.locator("#game-status")).toContainText(/top right/i);
});

test("a move in the wrong board is refused with an explanation", async ({ page }) => {
  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await cell(page, 4, 2).click();
  await cell(page, 5, 5).click();
  await expect(page.locator("#game-status")).toContainText(/highlighted|board/i);
  await expect(cell(page, 5, 5)).toHaveAttribute("data-mark", "");
});

test("a claimed board shows its owner, and being sent there frees the choice", async ({ page }) => {
  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await playMoves(page, OPENING);
  await expect(sub(page, 0)).toHaveAttribute("data-claim", "O");
  await expect(page.locator(".sub-board[data-playable='true']")).toHaveCount(8);
  await expect(page.locator("#game-status")).toContainText(/any open board/i);
  await cell(page, 0, 8).click();
  await expect(cell(page, 0, 8)).toHaveAttribute("data-mark", "");
});

test("a full game played from the computer's own moves ends with the same result as the rules", async ({ page }) => {
  // Build a whole game in the test (Master as X against Beginner as O), replay the clicks, and compare.
  const seed = "ULT-BXK4-M9TR";
  const config: GameConfig = { variant: "ultimate", size: 3, winLength: 3, scoring: "lines", lockFaces: false, mode: "computer", seed };
  let s = newGame(config);
  const moves: [number, number][] = [];
  while (status(s).status === "playing") {
    const level: Level = s.toMove === "X" ? 5 : 1;
    const m = chooseMove("ultimate", s, level, rngFor(seed, s.moves.length)) as UltimateMove;
    moves.push([m.board, m.cell]);
    s = apply(s, m);
  }
  const expected = status(s);
  await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
  await playMoves(page, moves);
  if (expected.status === "won") {
    await expect(page.locator("#game-status")).toContainText(`${expected.winner} wins`);
    for (const b of expected.winLine ?? []) await expect(sub(page, b)).toHaveAttribute("data-claim", expected.winner!);
  } else {
    await expect(page.locator("#game-status")).toContainText("draw");
  }
});

test("the computer replies in under a second on a throttled CPU, even with a free choice of 81 cells", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CPU throttling uses the Chrome DevTools protocol");
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("./");
  // Master as the computer, human plays O: the computer opens with a free choice among all 81 cells.
  const { choose } = await import("./helpers.ts");
  await choose(page, "Ultimate");
  await choose(page, "Computer");
  await page.locator("#level").selectOption({ label: "5. Master" });
  await choose(page, "O");
  const started = Date.now();
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator("button.cell .mark")).toHaveCount(1, { timeout: 5000 });
  expect(Date.now() - started).toBeLessThan(1000);
});
