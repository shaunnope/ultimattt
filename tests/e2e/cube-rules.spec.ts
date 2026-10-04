import { test, expect, type Page } from "@playwright/test";
import { startGame, choose, turnLayer } from "./helpers.ts";
import { newGame, legalMoves, apply, status } from "../../src/core/cube.ts";
import { packLink } from "../../src/core/record.ts";
import { randomSource } from "../../src/core/seed.ts";
import type { CubeMove, GameConfig } from "../../src/core/types.ts";

// UI contract used by these tests (specs/003-cube-rule-options-and-preview-polish/contracts/ui-contracts.md):
//  - the start screen shows two Cube-only checkboxes, #opt-lock "Lock scored faces" and #opt-faces "Count faces, not lines"
//  - #cube-score starts with "Lines" or "Faces", then "X: n · O: n"
//  - with the lock on, a face holding a line has data-locked="true" on its stickers, a visible "Locked" label,
//    and its empty stickers are aria-disabled; pressing one gives the refusal message and places nothing

const sticker = (page: Page, face: number, cell: number) => page.locator(`button.sticker[data-face="${face}"][data-cell="${cell}"]`);
const idle = (page: Page) => expect(page.locator('.cube-stage[data-busy="true"]')).toHaveCount(0);
const lock = (page: Page) => page.locator("#opt-lock");
const faces = (page: Page) => page.locator("#opt-faces");

/** X makes a line on the front face's top row; O has two marks on the top face. */
const LINE: [number, number][] = [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]];

async function startCubeWith(page: Page, options: { lock?: boolean; faces?: boolean }) {
  await page.goto("./");
  const start = page.getByRole("button", { name: "Start game" });
  const leave = page.getByRole("button", { name: "New game" });
  await expect(start.or(leave)).toBeVisible();
  if (await leave.isVisible()) await leave.click();
  await choose(page, "Cube");
  await choose(page, "A friend on this device").catch(() => undefined);
  await lock(page).setChecked(options.lock === true);
  await faces(page).setChecked(options.faces === true);
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".cube-board")).toBeVisible();
}

async function makeLine(page: Page) {
  for (const [face, cell] of LINE) await sticker(page, face, cell).dispatchEvent("click");
  await expect(page.locator("#cube-score")).toContainText("X: 1");
  await turnLayer(page, "Turn the bottom layer to the right");
  await idle(page);
}

test("setup offers the two options for Cube only, off by default, and remembers them", async ({ page }) => {
  await page.goto("./");
  const start = page.getByRole("button", { name: "Start game" });
  const leave = page.getByRole("button", { name: "New game" });
  await expect(start.or(leave)).toBeVisible();
  if (await leave.isVisible()) await leave.click();
  await expect(lock(page)).toBeHidden();
  await expect(faces(page)).toBeHidden();
  await choose(page, "Cube");
  await expect(lock(page)).toBeVisible();
  await expect(faces(page)).toBeVisible();
  await expect(lock(page)).not.toBeChecked();
  await expect(faces(page)).not.toBeChecked();
  await expect(page.getByLabel("Lock scored faces")).toBeVisible();
  await expect(page.getByLabel("Count faces, not lines")).toBeVisible();
  await choose(page, "Ultimate");
  await expect(lock(page)).toBeHidden();
  await choose(page, "Cube");
  await lock(page).check();
  await faces(page).check();
  await choose(page, "A friend on this device").catch(() => undefined);
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".cube-board")).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(lock(page)).toBeChecked();
  await expect(faces(page)).toBeChecked();
});

test("a locked face is labelled, refuses marks and says why", async ({ page }) => {
  await startCubeWith(page, { lock: true });
  await makeLine(page);
  const front = page.locator('button.sticker[data-face="2"]');
  await expect(front.first()).toHaveAttribute("data-locked", "true");
  await expect(page.locator(".face-locked-label:not([hidden])").filter({ hasText: "Locked" }).first()).toBeVisible();
  await expect(sticker(page, 2, 3)).toHaveAttribute("aria-disabled", "true");
  await expect(sticker(page, 2, 3)).toHaveAttribute("aria-label", /locked face/);
  await expect(sticker(page, 4, 4)).not.toHaveAttribute("aria-disabled", "true");
  await sticker(page, 2, 3).dispatchEvent("click");
  await expect(page.locator("#toasts")).toContainText(/locked/i);
  await expect(sticker(page, 2, 3)).toHaveAttribute("data-mark", "");
  await expect(page.locator("#game-status")).toContainText(/locked/i);
  await sticker(page, 4, 4).dispatchEvent("click");
  await expect(sticker(page, 4, 4)).toHaveAttribute("data-mark", "O");
});

test("the lock is enforced again after a reload", async ({ page }) => {
  await startCubeWith(page, { lock: true });
  await makeLine(page);
  await page.reload();
  await expect(page.locator(".cube-board")).toBeVisible();
  await expect(sticker(page, 2, 3)).toHaveAttribute("aria-disabled", "true");
  await sticker(page, 2, 3).dispatchEvent("click");
  await expect(sticker(page, 2, 3)).toHaveAttribute("data-mark", "");
});

test("with the lock off a scored face stays open", async ({ page }) => {
  await startCubeWith(page, {});
  await makeLine(page);
  await expect(sticker(page, 2, 3)).not.toHaveAttribute("data-locked", "true");
  await sticker(page, 2, 3).dispatchEvent("click");
  await expect(sticker(page, 2, 3)).toHaveAttribute("data-mark", "O");
});

test("faces scoring shows a Faces label and counts a face once", async ({ page }) => {
  await startCubeWith(page, { faces: true });
  await expect(page.locator("#cube-score")).toContainText("Faces");
  await makeLine(page);
  await expect(page.locator("#cube-score")).toContainText("X: 1");
  await startCubeWith(page, {});
  await expect(page.locator("#cube-score")).toContainText("Lines");
});

// A whole game under the rules, to replay from a link.
function randomGame(config: GameConfig, seed: number) {
  const rand = randomSource(seed);
  let s = newGame(config);
  const moves: CubeMove[] = [];
  while (status(s).status === "playing") {
    const legal = legalMoves(s);
    const m = legal[rand() % legal.length]!;
    moves.push(m);
    s = apply(s, m);
  }
  return { moves, final: s };
}

test("a replay link for a faces and lock game shows the same score and the same end", async ({ page }) => {
  const config: GameConfig = { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: true, mode: "local" };
  const { moves, final } = randomGame(config, 7);
  const link = packLink({ rules: { variant: "cube", size: 3, winLength: 3, scoring: "faces", lockFaces: true }, moves, players: { mode: "local" } }, 1);
  expect(link).toContain("rules=B33FL");
  await page.goto(link);
  const slider = page.getByRole("slider", { name: "Replay position" });
  await expect(slider).toBeVisible();
  await slider.fill(String(moves.length));
  await expect(page.locator("#cube-score")).toContainText(`Faces`);
  await expect(page.locator("#cube-score")).toContainText(`X: ${final.scores.X} · O: ${final.scores.O}`);
  const text = final.status === "tie" ? /tie/i : new RegExp(`${final.winner} wins`);
  await expect(page.locator("#game-status")).toContainText(text);
  if (final.empty > 0) await expect(page.locator("#game-status")).toContainText(/no open face/i);
});

test("a lines game's link still opens with lines", async ({ page }) => {
  await page.goto("?watch=1&rules=B33&game=l&moves=24");
  await expect(page.locator("#cube-score")).toContainText("Lines");
});
