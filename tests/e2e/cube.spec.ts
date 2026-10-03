import { test, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";
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
  const config: GameConfig = { variant: "cube", size: 3, mode: "local", seed: "CUB-BXK4-M9TR" };
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
  await expect(sticker(page, 2, 4)).toContainText("X");
  await page.getByRole("button", { name: "Show back face" }).click();
  await sticker(page, 3, 4).click();
  await expect(sticker(page, 3, 4)).toContainText("O");
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
  await expect(sticker(page, 4, 4)).toHaveText("");
  await expect(page.locator("#game-status")).toContainText(/turn a layer/i);
  // The left layer carries one of X's three stickers away from the front face.
  await picker.getByRole("button", { name: "Turn the left layer up" }).click();
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
    else await page.getByRole("group", { name: "Turn a layer" }).getByRole("button", { name: rotationLabel(move), exact: true }).click();
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
  await expect(sticker(page, 2, 4)).toContainText("X");
});
