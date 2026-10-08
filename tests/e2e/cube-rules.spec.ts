import { test, expect, type Page } from "@playwright/test";
import { startGame, choose, turnLayer, pillScore } from "./helpers.ts";
import { newGame, legalMoves, apply, status } from "../../src/core/cube.ts";
import { packLink } from "../../src/core/record.ts";
import { randomSource } from "../../src/core/seed.ts";
import type { CubeMove, GameConfig } from "../../src/core/types.ts";

// UI contract used by these tests (specs/003-cube-rule-options-and-preview-polish/contracts/ui-contracts.md):
//  - the start screen shows two Cube-only checkboxes, #opt-lock "Lock scored faces" and #opt-faces "Count faces, not lines"
//  - the Twist scores are in the pill (#turn-pill .pill-score); the game title names "lines scoring" or "faces scoring"
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
  await choose(page, "Twist");
  await choose(page, "This device").catch(() => undefined);
  await lock(page).setChecked(options.lock === true);
  await faces(page).setChecked(options.faces === true);
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".cube-board")).toBeVisible();
}

async function makeLine(page: Page) {
  for (const [face, cell] of LINE) await sticker(page, face, cell).dispatchEvent("click");
  await expect(pillScore(page, "X")).toHaveText("1");
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
  await choose(page, "Twist");
  await expect(lock(page)).toBeVisible();
  await expect(faces(page)).toBeVisible();
  await expect(lock(page)).not.toBeChecked();
  await expect(faces(page)).not.toBeChecked();
  await expect(page.getByLabel("Lock scored faces")).toBeVisible();
  await expect(page.getByLabel("Count faces, not lines")).toBeVisible();
  await choose(page, "Ultimate");
  await expect(lock(page)).toBeHidden();
  await choose(page, "Twist");
  await lock(page).check();
  await faces(page).check();
  await choose(page, "This device").catch(() => undefined);
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
  const badge = page.locator(".face-locked-label:not([hidden])").first();
  await expect(badge.locator(".lock-icon")).toBeVisible();
  await expect(badge).toHaveAttribute("aria-hidden", "true");
  expect(await badge.evaluate((el) => el.textContent?.trim() ?? "")).toBe("");
  await expect(page.getByText("Locked", { exact: true })).toHaveCount(0);
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

test("the padlock shows in the flat view, an open face has none, and stickers still say locked face", async ({ page }) => {
  await startCubeWith(page, { lock: true });
  await expect(page.locator(".face-locked-label:not([hidden])")).toHaveCount(0);
  await makeLine(page);
  await expect(page.locator(".face-locked-label:not([hidden])")).toHaveCount(1);
  await page.getByRole("button", { name: "Flat view" }).click();
  const flat = page.locator(".cube-flat");
  await expect(flat.first()).toBeVisible();
  await expect(flat.locator(".face-locked-label:not([hidden]) .lock-icon")).toBeVisible();
  await expect(page.locator('button.sticker[data-face="2"][data-locked="true"]')).toHaveCount(9);
  await expect(sticker(page, 2, 3)).toHaveAttribute("aria-label", /locked face/);
  await expect(sticker(page, 4, 4)).not.toHaveAttribute("data-locked", "true");
});

test("stepping a replay back before the lock hides the padlock", async ({ page }) => {
  const rules = { variant: "cube", size: 3, winLength: 3, scoring: "lines", lockFaces: true } as const;
  const moves: CubeMove[] = [
    { t: "place", face: 2, cell: 0 }, { t: "place", face: 0, cell: 0 }, { t: "place", face: 2, cell: 1 },
    { t: "place", face: 0, cell: 1 }, { t: "place", face: 2, cell: 2 }, { t: "rotate", axis: "z", layer: 1, dir: 1 },
  ];
  await page.goto(packLink({ rules, moves, players: { mode: "local" } }, 1));
  const slider = page.getByRole("slider", { name: "Replay position" });
  await expect(slider).toBeVisible();
  await slider.fill("5");
  await expect(page.locator(".face-locked-label:not([hidden]) .lock-icon")).toHaveCount(1);
  await slider.fill("4");
  await expect(page.locator(".face-locked-label:not([hidden])")).toHaveCount(0);
});

test("on a 5×5 cube at 390 px the padlock stays small and does not cover an open face", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("./");
  const start = page.getByRole("button", { name: "Start game" });
  const leave = page.getByRole("button", { name: "New game" });
  await expect(start.or(leave)).toBeVisible();
  if (await leave.isVisible()) await leave.click();
  await choose(page, "Twist");
  await choose(page, "This device").catch(() => undefined);
  await choose(page, "5×5");
  await choose(page, "3");
  await lock(page).check();
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".cube-board")).toBeVisible();
  // X makes a line of three on the front face's top row; O plays elsewhere
  for (const [face, cell] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]] as const) await sticker(page, face, cell).dispatchEvent("click");
  const icon = page.locator(".face-locked-label:not([hidden]) .lock-icon");
  await expect(icon).toHaveCount(1);
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box!.width).toBeLessThan(40);
  await page.getByRole("button", { name: "Flat view" }).click();
  await expect(icon).toBeVisible();
  // the badge does not take clicks: the pointer goes straight through to the sticker under it
  expect(await icon.evaluate((el) => getComputedStyle(el.closest(".face-locked-label")!).pointerEvents)).toBe("none");
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

test("faces scoring is named in the game title and counts a face once", async ({ page }) => {
  await startCubeWith(page, { faces: true });
  await expect(page.locator("#game-title")).toContainText("faces scoring");
  await makeLine(page);
  await expect(pillScore(page, "X")).toHaveText("1");
  await startCubeWith(page, {});
  await expect(page.locator("#game-title")).toContainText("lines scoring");
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
  await expect(page.locator("#replay-rules")).toContainText("faces scoring");
  await expect(pillScore(page, "X")).toHaveText(String(final.scores.X));
  await expect(pillScore(page, "O")).toHaveText(String(final.scores.O));
  const text = final.status === "tie" ? /tie/i : new RegExp(`${final.winner} wins`);
  await expect(page.locator("#game-status")).toContainText(text);
  if (final.empty > 0) await expect(page.locator("#game-status")).toContainText(/no open face/i);
});

test("a lines game's link still opens with lines", async ({ page }) => {
  await page.goto("?watch=1&rules=B33&game=l&moves=24");
  await expect(page.locator("#replay-rules")).toContainText("lines scoring");
});
