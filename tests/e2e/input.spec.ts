import { test, expect, type Page } from "@playwright/test";
import { choose, turnLayer } from "./helpers.ts";
import { moduleFor } from "../../src/core/variants.ts";
import { randomSource } from "../../src/core/seed.ts";
import { rotationLabel } from "../../src/ui/cube-labels.ts";
import type { CubeRotate, GameConfig, Move } from "../../src/core/types.ts";

// SC-001: a first-time visitor can start a game in any variant within three interactions.
// SC-009: every game can be played start to end with the keyboard only, and with touch only.

type Variant = "classic" | "ultimate" | "cube";
const TITLES: Record<Variant, string> = { classic: "Classic", ultimate: "Ultimate", cube: "Cube" };

async function fresh(page: Page) {
  await page.goto("./");
  // The app finishes starting up after the page has loaded (it restores a saved game); wait for that
  // before clearing storage, or the old page could save its game again afterwards.
  await expect(page.getByRole("button", { name: "Start game" }).or(page.getByRole("button", { name: "New game" }))).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
}

// A whole game from random legal moves (fixed seed), to replay through the interface.
function randomGame(variant: Variant, seed: number): { moves: Move[]; config: GameConfig } {
  const config: GameConfig = { variant, size: 3, winLength: 3, mode: "local" };
  const mod = moduleFor(config);
  const rand = randomSource(seed);
  let state = mod.newGame(config);
  const moves: Move[] = [];
  while (state.status === "playing") {
    const legal = mod.legalMoves(state);
    const move = legal[rand() % legal.length]!;
    moves.push(move);
    state = mod.apply(state, move);
  }
  return { moves, config };
}

async function expectResult(page: Page, config: GameConfig, moves: Move[]) {
  const state = moduleFor(config).fromMoves(config, moves);
  const text = state.status === "won" ? `${state.winner} wins` : state.status === "tie" ? "tie" : "draw";
  await expect(page.locator("#game-status")).toContainText(new RegExp(text, "i"));
}

test("starting a game takes at most three interactions in every variant (SC-001)", async ({ page }) => {
  const count: Record<Variant, number> = { classic: 0, ultimate: 0, cube: 0 };
  for (const variant of ["classic", "ultimate", "cube"] as Variant[]) {
    await fresh(page);
    if (variant !== "classic") {
      await choose(page, TITLES[variant]);
      count[variant]++;
    }
    await page.getByRole("button", { name: "Start game" }).click();
    count[variant]++;
    await expect(page.locator(".board, .cube-board").first()).toBeVisible();
    expect(count[variant], variant).toBeLessThanOrEqual(3);
  }
});

// ---- keyboard only ----

interface Focus {
  tag: string;
  text: string;
  label: string;
  name: string;
  cell: number | null;
  board: number | null;
  face: number | null;
}

async function focused(page: Page): Promise<Focus | null> {
  return page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    if (!a || a === document.body) return null;
    const num = (v: string | undefined) => (v === undefined ? null : Number(v));
    return {
      tag: a.tagName,
      text: (a.textContent ?? "").trim(),
      label: a.getAttribute("aria-label") ?? "",
      name: (a as HTMLInputElement).name ?? "",
      cell: num(a.dataset.cell),
      board: num(a.dataset.board),
      face: num(a.dataset.face),
    };
  });
}

async function tabUntil(page: Page, found: (f: Focus) => boolean, limit = 90): Promise<void> {
  for (let i = 0; i < limit; i++) {
    const f = await focused(page);
    if (f && found(f)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("the keyboard never reached the control");
}

async function pressTimes(page: Page, key: string, n: number) {
  for (let i = 0; i < n; i++) await page.keyboard.press(key);
}

async function keyboardStart(page: Page, variant: Variant) {
  await fresh(page);
  if (variant !== "classic") {
    await tabUntil(page, (f) => f.tag === "INPUT" && f.name === "variant");
    await page.keyboard.press("ArrowRight"); // Classic -> Ultimate
    if (variant === "cube") await page.keyboard.press("ArrowRight"); // -> Cube
  }
  await tabUntil(page, (f) => f.tag === "INPUT" && f.name === "mode");
  if (variant !== "cube") await page.keyboard.press("ArrowRight"); // Computer -> a friend on this device (Cube already is)
  await tabUntil(page, (f) => f.text === "Start game");
  await page.keyboard.press("Enter");
}

test("Classic, start to end, with the keyboard only", async ({ page }) => {
  const { moves, config } = randomGame("classic", 12);
  await keyboardStart(page, "classic");
  await tabUntil(page, (f) => f.cell !== null);
  for (const move of moves) {
    const target = (move as { cell: number }).cell;
    const now = (await focused(page))!.cell!;
    const dr = Math.floor(target / 3) - Math.floor(now / 3);
    const dc = (target % 3) - (now % 3);
    await pressTimes(page, dr > 0 ? "ArrowDown" : "ArrowUp", Math.abs(dr));
    await pressTimes(page, dc > 0 ? "ArrowRight" : "ArrowLeft", Math.abs(dc));
    await page.keyboard.press("Enter");
  }
  await expectResult(page, config, moves);
});

test("Ultimate, start to end, with the keyboard only", async ({ page }) => {
  test.setTimeout(180_000);
  const { moves, config } = randomGame("ultimate", 6);
  await keyboardStart(page, "ultimate");
  await tabUntil(page, (f) => f.cell !== null && f.board !== null);
  const globalOf = (board: number, cell: number) => [Math.floor(board / 3) * 3 + Math.floor(cell / 3), (board % 3) * 3 + (cell % 3)] as const;
  for (const move of moves) {
    const { board, cell } = move as { board: number; cell: number };
    const now = (await focused(page))!;
    const [r0, c0] = globalOf(now.board!, now.cell!);
    const [r1, c1] = globalOf(board, cell);
    await pressTimes(page, r1 > r0 ? "ArrowDown" : "ArrowUp", Math.abs(r1 - r0));
    await pressTimes(page, c1 > c0 ? "ArrowRight" : "ArrowLeft", Math.abs(c1 - c0));
    await page.keyboard.press("Enter");
  }
  await expectResult(page, config, moves);
});

test("Cube, start to end, with the keyboard only (flat view, layer turns from the picker)", async ({ page }) => {
  test.setTimeout(240_000);
  const { moves, config } = randomGame("cube", 17);
  await keyboardStart(page, "cube");
  await tabUntil(page, (f) => f.text === "Flat view");
  if ((await page.getByRole("button", { name: "Flat view" }).getAttribute("aria-pressed")) !== "true") await page.keyboard.press("Enter");
  for (const move of moves) {
    await expect(page.locator('.cube-stage[data-busy="true"]')).toHaveCount(0);
    if (move.t === "rotate") {
      const label = rotationLabel(move as CubeRotate);
      await tabUntil(page, (f) => f.label === label);
      await page.keyboard.press("Enter"); // previews the turn
      await expect(page.getByRole("button", { name: "Confirm turn" })).toBeEnabled();
      await tabUntil(page, (f) => f.text === "Confirm turn");
      await page.keyboard.press("Enter");
      continue;
    }
    const { face, cell } = move as { face: number; cell: number };
    // one tab stop per face: reach the face, then arrows to the cell
    const now = await focused(page);
    if (!now || now.face === null) await tabUntil(page, (f) => f.face !== null);
    let here = (await focused(page))!;
    while (here.face !== face) {
      await page.keyboard.press(face > here.face! ? "Tab" : "Shift+Tab");
      here = (await focused(page))!;
      if (here.face === null) await tabUntil(page, (f) => f.face !== null);
      here = (await focused(page))!;
    }
    const dr = Math.floor(cell / 3) - Math.floor(here.cell! / 3);
    const dc = (cell % 3) - (here.cell! % 3);
    await pressTimes(page, dr > 0 ? "ArrowDown" : "ArrowUp", Math.abs(dr));
    await pressTimes(page, dc > 0 ? "ArrowRight" : "ArrowLeft", Math.abs(dc));
    await page.keyboard.press("Enter");
  }
  await expectResult(page, config, moves);
});

// ---- touch only ----

test.describe("touch only", () => {
  test.use({ hasTouch: true });

  async function touchStart(page: Page, variant: Variant) {
    await fresh(page);
    if (variant !== "classic") await page.locator("label", { has: page.locator("strong", { hasText: new RegExp(`^${TITLES[variant]}$`) }) }).tap();
    if (variant !== "cube") await page.locator("label", { has: page.locator("strong", { hasText: /^A friend on this device$/ }) }).tap();
    await page.getByRole("button", { name: "Start game" }).tap();
  }

  test("Classic, start to end, by touch only", async ({ page }) => {
    const { moves, config } = randomGame("classic", 12);
    await touchStart(page, "classic");
    for (const move of moves) await page.locator(`[data-cell="${(move as { cell: number }).cell}"]`).tap();
    await expectResult(page, config, moves);
  });

  test("Ultimate, start to end, by touch only", async ({ page }) => {
    test.setTimeout(120_000);
    const { moves, config } = randomGame("ultimate", 6);
    await touchStart(page, "ultimate");
    for (const move of moves) {
      const { board, cell } = move as { board: number; cell: number };
      await page.locator(`button[data-board="${board}"][data-cell="${cell}"]`).tap();
    }
    await expectResult(page, config, moves);
  });

  test("Cube, start to end, by touch only (flat view)", async ({ page }) => {
    test.setTimeout(180_000);
    const { moves, config } = randomGame("cube", 17);
    await touchStart(page, "cube");
    const flat = page.getByRole("button", { name: "Flat view" });
    if ((await flat.getAttribute("aria-pressed")) !== "true") await flat.tap();
    for (const move of moves) {
      await expect(page.locator('.cube-stage[data-busy="true"]')).toHaveCount(0);
      if (move.t === "rotate") {
        await turnLayer(page, rotationLabel(move as CubeRotate), "tap");
      } else {
        const { face, cell } = move as { face: number; cell: number };
        await page.locator(`button.sticker[data-face="${face}"][data-cell="${cell}"]`).tap();
      }
    }
    await expectResult(page, config, moves);
  });

  test("the 3D cube can be played by touch too: turn the view with a button, tap a face", async ({ page }) => {
    await touchStart(page, "cube");
    await expect(page.locator(".cube-board")).toBeVisible(); // the game loads when it is first needed
    test.skip((await page.locator(".cube-scene").count()) === 0, "3D view not available");
    await page.getByRole("button", { name: "Show front face" }).tap();
    await page.locator('button.sticker[data-face="2"][data-cell="4"]').tap();
    await expect(page.locator('button.sticker[data-face="2"][data-cell="4"]')).toHaveAttribute("data-mark", "X");
    await page.getByRole("button", { name: "Show back face" }).tap();
    await page.locator('button.sticker[data-face="3"][data-cell="4"]').tap();
    await expect(page.locator('button.sticker[data-face="3"][data-cell="4"]')).toHaveAttribute("data-mark", "O");
  });
});
