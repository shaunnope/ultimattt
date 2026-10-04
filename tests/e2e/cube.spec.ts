import { test, expect, type Page } from "@playwright/test";
import { startGame, turnLayer, confirmTurnButton } from "./helpers.ts";
import { newGame, legalMoves, apply, status } from "../../src/core/cube.ts";
import { randomSource } from "../../src/core/seed.ts";
import { rotationLabel } from "../../src/ui/cube-labels.ts";
import type { CubeMove, GameConfig } from "../../src/core/types.ts";

// UI contract used by these tests:
//  - .cube-scene[data-view="rx ry"] is the 3D cube; dragging it, the arrow keys and the "Show <face> face"
//    buttons turn the view. "Flat view" / "3D view" toggles the unfolded net (aria-pressed).
//  - stickers are button.sticker[data-face][data-cell], faces U0 D1 F2 B3 L4 R5
//  - #cube-score reads "X: 1 · O: 0" (lines each player has right now)
//  - after a scoring move a group named "Turn a layer" offers the 27 turns, labelled as in cube-labels.ts

const sticker = (page: Page, face: number, cell: number) => page.locator(`button.sticker[data-face="${face}"][data-cell="${cell}"]`);
const score = (page: Page) => page.locator("#cube-score");
// A layer turn animates; input is ignored until it ends, so tests wait for the cube to settle.
const idle = (page: Page) => expect(page.locator('.cube-stage[data-busy="true"]')).toHaveCount(0);

async function startCube(page: Page) {
  await startGame(page, { variant: "Cube", opponent: "A friend on this device" });
  await expect(page.locator(".cube-scene, .cube-flat").first()).toBeVisible();
}

// Build a full game from the rules (random legal moves, fixed seed) to replay through the UI.
function randomGame(seed: number): { moves: CubeMove[]; end: ReturnType<typeof status> } {
  const config: GameConfig = { variant: "cube", size: 3, winLength: 3, mode: "local" };
  const rand = randomSource(seed);
  let s = newGame(config);
  const moves: CubeMove[] = [];
  while (status(s).status === "playing") {
    const legal = legalMoves(s);
    const m = legal[rand() % legal.length]!;
    moves.push(m);
    s = apply(s, m);
  }
  return { moves, end: status(s) };
}

async function expectResult(page: Page, end: ReturnType<typeof status>) {
  const text = end.status === "tie" ? "tie" : `${end.winner} wins`;
  await expect(page.locator("#game-status")).toContainText(new RegExp(text, "i"));
}

test("dragging turns the 3D view, and the face buttons bring each face to the front", async ({ page }) => {
  await startCube(page);
  const scene = page.locator(".cube-scene");
  test.skip((await scene.count()) === 0, "3D view not available in this browser");
  const before = await scene.getAttribute("data-view");
  const box = (await scene.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 30, { steps: 6 });
  await page.mouse.up();
  expect(await scene.getAttribute("data-view")).not.toBe(before);
  await page.getByRole("button", { name: "Show right face" }).click();
  await expect(scene).toHaveAttribute("data-view", "0 -90");
  await page.getByRole("button", { name: "Show top face" }).click();
  await expect(scene).toHaveAttribute("data-view", "-90 0");
  await page.getByRole("button", { name: "Show front face" }).click();
  await expect(scene).toHaveAttribute("data-view", "0 0");
});

test("arrow keys turn the view when the cube has focus", async ({ page }) => {
  await startCube(page);
  const scene = page.locator(".cube-scene");
  test.skip((await scene.count()) === 0, "3D view not available in this browser");
  await page.getByRole("button", { name: "Show front face" }).click();
  await scene.focus();
  await page.keyboard.press("ArrowRight");
  await expect(scene).not.toHaveAttribute("data-view", "0 0");
});

test("marks can be placed on the front face and, after turning the view, on the back face", async ({ page }) => {
  await startCube(page);
  const scene = page.locator(".cube-scene");
  test.skip((await scene.count()) === 0, "3D view not available in this browser");
  await sticker(page, 2, 4).click();
  await expect(sticker(page, 2, 4)).toHaveAttribute("data-mark", "X");
  await page.getByRole("button", { name: "Show back face" }).click();
  await sticker(page, 3, 4).click();
  await expect(sticker(page, 3, 4)).toHaveAttribute("data-mark", "O");
  await expect(page.locator("#game-status")).toContainText("X to move");
});

test("scoring blocks placement until a layer is turned; turning can break the line", async ({ page }) => {
  await startCube(page);
  for (const [face, cell] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]] as [number, number][]) await sticker(page, face, cell).dispatchEvent("click");
  await expect(score(page)).toContainText("X: 1");
  const picker = page.getByRole("group", { name: "Turn a layer" });
  await expect(picker).toBeVisible();
  await expect(page.locator("#game-status")).toContainText(/turn a layer/i);
  await sticker(page, 4, 4).dispatchEvent("click");
  await expect(sticker(page, 4, 4)).toHaveAttribute("data-mark", "");
  await expect(page.locator("#game-status")).toContainText(/turn a layer/i);
  // The left layer carries one of X's three stickers away from the front face.
  await turnLayer(page, "Turn the left layer up");
  await idle(page);
  await expect(score(page)).toContainText("X: 0");
  await expect(picker).toBeHidden();
  await expect(page.locator("#game-status")).toContainText("O to move");
});

test("a whole game played in 3D by mouse ends with the result the rules give", async ({ page }) => {
  test.setTimeout(120_000);
  await startCube(page);
  const { moves, end } = randomGame(11);
  for (const move of moves) {
    await idle(page);
    if (move.t === "place") await sticker(page, move.face, move.cell).dispatchEvent("click");
    else await turnLayer(page, rotationLabel(move));
  }
  await expectResult(page, end);
});

test("a whole game played in the flat view with the keyboard ends with the result the rules give", async ({ page }) => {
  test.setTimeout(120_000);
  await startCube(page);
  const flat = page.getByRole("button", { name: "Flat view" });
  if ((await flat.getAttribute("aria-pressed")) !== "true") await flat.click();
  await expect(page.locator(".cube-flat")).toBeVisible();
  const { moves, end } = randomGame(23);
  for (const move of moves) {
    await idle(page);
    if (move.t === "place") {
      await sticker(page, move.face, move.cell).focus();
    } else {
      await page.getByRole("group", { name: "Turn a layer" }).getByRole("button", { name: rotationLabel(move), exact: true }).focus();
      await page.keyboard.press("Enter"); // previews the turn
      await expect(confirmTurnButton(page)).toBeEnabled();
      await confirmTurnButton(page).focus();
    }
    await page.keyboard.press("Enter");
  }
  await expectResult(page, end);
});

test("without 3D transforms the flat view is used and the game stays playable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = ((prop: string, value?: string) => (String(prop).includes("transform-style") ? false : value === undefined ? original(prop) : original(prop, value))) as typeof CSS.supports;
  });
  await startCube(page);
  await expect(page.locator(".cube-flat")).toBeVisible();
  await expect(page.locator(".cube-scene")).toHaveCount(0);
  await sticker(page, 2, 4).click();
  await expect(sticker(page, 2, 4)).toHaveAttribute("data-mark", "X");
});

// ---- turn flow: select, preview, confirm or cancel (FR-011 to FR-021) ----

const SCORE: [number, number][] = [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]];
const picker = (page: Page) => page.getByRole("group", { name: "Turn a layer" });
const turnButton = (page: Page, name: string) => picker(page).getByRole("button", { name, exact: true });

async function scoreFront(page: Page) {
  for (const [face, cell] of SCORE) await sticker(page, face, cell).dispatchEvent("click");
  await expect(picker(page)).toBeVisible();
}

async function stickerMarks(page: Page): Promise<string[]> {
  return page.locator("button.sticker").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.mark ?? ""));
}

/** The marks the rules give after the scoring moves and one turn, in sticker order. */
function expectedAfter(turn: CubeMove): string[] {
  let s = newGame({ variant: "cube", size: 3, winLength: 3, mode: "local" });
  for (const [face, cell] of SCORE) s = apply(s, { t: "place", face, cell });
  s = apply(s, turn);
  return s.stickers.map((v) => (v === 0 ? "" : v === 1 ? "X" : "O"));
}

const LEFT_UP: CubeMove = { t: "rotate", axis: "x", layer: 0, dir: -1 };

test("Confirm is disabled until a turn is previewed, and the preview then confirmed equals the result the rules give", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  await expect(confirmTurnButton(page)).toBeDisabled();
  await turnButton(page, "Turn the left layer up").click();
  await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("aria-pressed", "true");
  await idle(page);
  await expect(confirmTurnButton(page)).toBeEnabled();
  await expect(page.locator("#turn-caption")).toContainText(/previewing/i);
  // nothing is committed by a preview
  await expect(score(page)).toContainText("X: 1");
  await confirmTurnButton(page).click();
  await idle(page);
  await expect(picker(page)).toBeHidden();
  expect(await stickerMarks(page)).toEqual(expectedAfter(LEFT_UP));
  await expect(page.locator("#game-status")).toContainText("O to move");
});

test("choosing another turn replaces the preview, and Confirm makes the second one", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await turnButton(page, "Turn the bottom layer to the right").click();
  await idle(page);
  await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("aria-pressed", "false");
  await expect(turnButton(page, "Turn the bottom layer to the right")).toHaveAttribute("aria-pressed", "true");
  await confirmTurnButton(page).click();
  await idle(page);
  expect(await stickerMarks(page)).toEqual(expectedAfter({ t: "rotate", axis: "y", layer: 0, dir: 1 }));
});

test("clicking outside the cube and controls cancels the preview, and the turn stays pending", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  const before = await stickerMarks(page);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await page.locator(".app-title").click();
  await idle(page);
  await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("aria-pressed", "false");
  await expect(confirmTurnButton(page)).toBeDisabled();
  await expect(picker(page)).toBeVisible();
  expect(await stickerMarks(page)).toEqual(before);
  // choosing again and confirming still works
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await confirmTurnButton(page).click();
  await idle(page);
  expect(await stickerMarks(page)).toEqual(expectedAfter(LEFT_UP));
});

test("Escape cancels the preview", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await page.keyboard.press("Escape");
  await idle(page);
  await expect(confirmTurnButton(page)).toBeDisabled();
  await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("aria-pressed", "false");
});

test("pressing another control acts on it and does not cancel; dragging the view keeps the preview", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await page.getByRole("button", { name: "Show right face" }).click();
  await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("aria-pressed", "true");
  const scene = page.locator(".cube-scene");
  if ((await scene.count()) > 0) {
    const box = (await scene.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("aria-pressed", "true");
  }
  await expect(confirmTurnButton(page)).toBeEnabled();
});

test("a reload keeps the pending turn but not the preview; Undo drops the preview and the placement that scored", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await page.reload();
  await expect(picker(page)).toBeVisible();
  await expect(confirmTurnButton(page)).toBeDisabled();
  await expect(page.locator('button[aria-pressed="true"].turn-btn')).toHaveCount(0);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await page.getByRole("button", { name: "Undo" }).click();
  await idle(page);
  await expect(picker(page)).toBeHidden();
  await expect(sticker(page, 2, 2)).toHaveAttribute("data-mark", "");
});

test("in the flat view a preview shows the marks after the turn, dashed", async ({ page }) => {
  await startCube(page);
  const flat = page.getByRole("button", { name: "Flat view" });
  if ((await flat.getAttribute("aria-pressed")) !== "true") await flat.click();
  await scoreFront(page);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  expect(await page.locator("button.sticker[data-ghost]").count()).toBeGreaterThan(0);
  await expect(page.locator("button.sticker[data-ghost] svg.mark-preview").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("button.sticker[data-ghost]")).toHaveCount(0);
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await confirmTurnButton(page).click();
  await idle(page);
  expect(await stickerMarks(page)).toEqual(expectedAfter(LEFT_UP));
});

test("turn buttons are icons in word mode and notation in cube mode, with word names either way, and nothing overflows at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await startCube(page);
  await scoreFront(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(await overflow()).toBe(false);
  await expect(picker(page).locator("button.turn-icon svg").first()).toBeVisible();
  await expect(turnButton(page, "Turn the left layer up")).toHaveText("");
  await expect(turnButton(page, "Turn the left layer up")).toHaveAttribute("title", "Turn the left layer up");
  // switch to cube notation in Settings
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByLabel("Cube turn names").selectOption("cube");
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Done" }).click();
  await expect(picker(page)).toBeVisible();
  await expect(turnButton(page, "Turn the left layer up")).toHaveText("L'");
  await expect(turnButton(page, "Turn the right layer down")).toHaveText("R'");
  await expect(turnButton(page, "Turn the top layer to the left")).toHaveText("U");
  expect(await overflow()).toBe(false);
  for (const text of await picker(page).locator("button.turn-text").allInnerTexts()) expect(text.length).toBeLessThanOrEqual(4);
  // the preview caption and the move list use the same names
  await turnButton(page, "Turn the left layer up").click();
  await idle(page);
  await expect(page.locator("#turn-caption")).toContainText("L'");
  await confirmTurnButton(page).click();
  await idle(page);
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: /confirm resign/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  await expect(page.getByRole("list", { name: "Moves" })).toContainText("X: L'");
});

test("the notation setting changes only the display: the saved moves are the same", async ({ page }) => {
  await startCube(page);
  await scoreFront(page);
  await turnLayer(page, "Turn the left layer up");
  const saved = async () => (await page.evaluate(() => JSON.parse(localStorage.getItem("ttt.save")!).game.moves)) as string;
  const words = await saved();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).getByLabel("Cube turn names").selectOption("cube");
  await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Done" }).click();
  expect(await saved()).toBe(words);
});

// ---- 4×4 and 5×5 cubes ----

for (const size of ["4×4", "5×5"] as const) {
  test(`a ${size} cube: scoring with win length 3 offers every layer, and an inner layer turn works`, async ({ page }) => {
    const n = Number(size[0]);
    await startGame(page, { variant: "Cube", opponent: "A friend on this device", size, winLength: 3 });
    await expect(page.locator("button.sticker")).toHaveCount(6 * n * n);
    await expect(page.locator("#game-title")).toContainText(`${size}, 3 in a row`);
    await scoreFront(page);
    await expect(picker(page).locator("button.turn-btn")).toHaveCount(9 * n);
    const inner = n === 4 ? "Turn the second layer from the left up" : "Turn the vertical middle layer up";
    await turnLayer(page, inner);
    await idle(page);
    await expect(picker(page)).toBeHidden();
    await expect(page.locator("#game-status")).toContainText("O to move");
  });
}
