import { test, expect, type Page } from "@playwright/test";
import { startGame, choose, turnLayer } from "./helpers.ts";

// UI contract used by these tests:
//  - a game against the computer shows its seed in #game-seed, with a "Copy seed" button; other games have no seed
//  - when a game ends the result dialog offers "Watch replay"; the controls then offer "Share replay"
//  - the replay has a group "Replay controls": Play/Pause, "Step back", "Step forward", a slider named
//    "Replay position", a "Speed" select (0.5×, 1×, 2×, 4×), a list named "Moves", and "Close replay"
//  - the start screen has #seed-input (with #seed-error), only while the opponent is the computer; a seed sets the variant, size and win length
//  - a link ?watch=...&rules=...&game=...&moves=... (plus &seed=... for a computer game) opens the replay without touching the saved game

const WIN = [0, 3, 1, 4, 2]; // X wins the top row
const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const marks = (page: Page, text: string) => page.locator(`button.cell[data-mark="${text}"]`);
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
  await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
  const sticker = (f: number, c: number) => page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`);
  for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]]) await sticker(f!, c!).dispatchEvent("click");
  await turnLayer(page, "Turn the bottom layer to the right");
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
  expect(link).toMatch(/\?watch=\d+&rules=C33&game=l&moves=03142/);
  expect(link).not.toContain("seed=");

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
  await page.goto("./?watch=1&rules=C33&seed=NOPE&game=c3x&moves=0");
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
  await expect(cell(page, 4)).toHaveAttribute("data-mark", "X");
  await expect(cell(page, 0)).toHaveAttribute("data-mark", "O");
  expect(page.url()).not.toContain("watch=");
});

test("Play this seed is offered only when the game has a seed, and fills in the start screen", async ({ page }) => {
  await page.goto("./?watch=1&rules=C44&seed=C44-BXK4-M9TR&game=c3x&moves=04");
  await page.getByRole("button", { name: "Play this seed" }).click();
  await expect(page.locator("#seed-input")).toHaveValue("C44-BXK4-M9TR");
  await expect(page.locator("input#size-4")).toBeChecked();
  await expect(page.locator("input#winlength-4")).toBeChecked();
  // a 001 link with a seed for a two-player game opens, but has no seed to play again
  await page.goto("./?watch=1&seed=3X3-BXK4-M9TR&game=l&moves=03142");
  await expect(controls(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play this seed" })).toHaveCount(0);
  await expect(page.locator("#replay-rules")).not.toContainText(/seed/i);
});

test("a pasted seed sets the variant, board and win length; a bad one is explained", async ({ page }) => {
  await page.goto("./");
  await page.locator("#seed-input").fill("c53-bxk4-m9tr");
  await expect(page.locator("input#size-5")).toBeChecked();
  await expect(page.locator("input#winlength-3")).toBeChecked();
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator("#game-seed")).toContainText("C53-BXK4-M9TR");
  await expect(page.locator(".board")).toHaveAttribute("aria-label", /5 by 5/);
  await page.getByRole("button", { name: "New game" }).click();

  await page.locator("#seed-input").fill("U33-BXK4-M9TR");
  await expect(page.locator("input#variant-ultimate")).toBeChecked();

  await page.locator("#seed-input").fill("nope");
  await expect(page.locator("#seed-error")).toContainText(/seed looks like/i);
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("no seed shows anywhere for a game with no computer: setup, game, replay or share", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await page.goto("./");
  await expect(page.locator("#seed-input")).toBeVisible(); // the computer is the default opponent
  await choose(page, "A friend on this device");
  await expect(page.locator("#seed-input")).toBeHidden();
  await choose(page, "A friend on another device");
  await expect(page.locator("#seed-input")).toBeHidden();
  await choose(page, "A friend on this device");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator("#game-seed")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy seed" })).toHaveCount(0);
  for (const c of WIN) await cell(page, c).click();
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  await expect(controls(page)).toBeVisible();
  await expect(page.locator("#replay-rules")).not.toContainText(/seed/i);
  await page.getByRole("button", { name: "Close replay" }).click();
  await page.getByRole("button", { name: "Share replay" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).not.toContain("seed=");
});

test("switching the opponent shows and hides the seed field, and discards typed text", async ({ page }) => {
  await page.goto("./");
  await page.locator("#seed-input").fill("C33-BXK4-M9TR");
  await choose(page, "A friend on this device");
  await expect(page.locator("#seed-input")).toBeHidden();
  await choose(page, "Computer");
  await expect(page.locator("#seed-input")).toHaveValue("");
  // nothing on the screen explains what a seed is
  await expect(page.locator("#seed-card")).not.toContainText(/exact game|decides|random/i);
});

test("the same seed makes the computer open the same way", async ({ page }) => {
  const firstMove = async () => {
    await page.goto("./");
    await page.locator("#seed-input").fill("C33-BXK4-M9TR");
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

test("Copy seed puts the seed on the clipboard, for a computer game", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startGame(page, { variant: "Classic", opponent: "Computer", level: "1. Beginner", mark: "X" });
  const seed = (await page.locator("#game-seed").innerText()).replace(/^Seed:\s*/, "").trim();
  await page.getByRole("button", { name: "Copy seed" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(seed);
});

// ---- Twist replay turns the view to the face being played (spec 004, US2) ----

// X and O alternate on cell 0 of the front, top, right, back, bottom and left faces: no line, so no layer turns.
const SIX_FACES = [2, 0, 5, 3, 1, 4];
const SIX_LINK = `./?watch=1&rules=B33&game=l&moves=${SIX_FACES.map((f) => `${f}0`).join("")}`;
const stickerAt = (page: Page, face: number, c = 0) => page.locator(`button.sticker[data-face="${face}"][data-cell="${c}"]`);
const sceneView = async (page: Page): Promise<{ rx: number; ry: number }> => {
  const [rx, ry] = (await page.locator(".cube-scene").getAttribute("data-view"))!.split(" ").map(Number);
  return { rx: rx!, ry: ry! };
};
/** Same test as faceInView in src/ui/cube-labels.ts, written out so the test does not share the code under test. */
function inView({ rx, ry }: { rx: number; ry: number }, face: number): boolean {
  const rad = (d: number) => (d * Math.PI) / 180;
  const [x, y, z] = [[0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [-1, 0, 0], [1, 0, 0]][face]!;
  const z1 = -x! * Math.sin(rad(ry)) + z! * Math.cos(rad(ry));
  return y! * Math.sin(rad(rx)) + z1 * Math.cos(rad(rx)) >= 0.4 - 1e-9;
}
async function openSixFaceReplay(page: Page) {
  await page.goto(SIX_LINK);
  await expect(controls(page)).toBeVisible();
  await page.getByRole("button", { name: /^(Pause|Play)$/ }).first().click(); // stop the autoplay, however far it got
  await slider(page).fill("0");
  await expect(page.locator("button.sticker:not([data-mark=''])")).toHaveCount(0);
}
/** Step to a position and return when the view changed and when the new mark appeared (ms on the page clock). */
async function stepTo(page: Page, k: number, face: number) {
  await page.evaluate((f) => {
    const w = window as unknown as { __seen: { view: number; mark: number } };
    w.__seen = { view: 0, mark: 0 };
    const scene = document.querySelector(".cube-scene")!;
    new MutationObserver(() => { w.__seen.view ||= performance.now(); }).observe(scene, { attributes: true, attributeFilter: ["data-view"] });
    const sticker = document.querySelector(`button.sticker[data-face="${f}"][data-cell="0"]`)!;
    new MutationObserver(() => { if ((sticker as HTMLElement).dataset.mark) w.__seen.mark ||= performance.now(); }).observe(sticker, { attributes: true, attributeFilter: ["data-mark"] });
  }, face);
  await slider(page).fill(String(k));
  await expect(stickerAt(page, face)).toHaveAttribute("data-mark", /^[XO]$/);
  return page.evaluate(() => (window as unknown as { __seen: { view: number; mark: number } }).__seen);
}

test("a Twist replay turns to a face that is out of view before its mark appears, and leaves the view alone for a face in view", async ({ page }) => {
  await openSixFaceReplay(page);
  for (const [i, face] of SIX_FACES.entries()) {
    const before = await sceneView(page);
    const seen = await stepTo(page, i + 1, face);
    const after = await sceneView(page);
    expect(inView(after, face), `face ${face} is in view when its mark appears`).toBe(true);
    if (inView(before, face)) {
      expect(after, `face ${face} was already in view`).toEqual(before);
    } else {
      expect(seen.view, `face ${face}: the view changes`).toBeGreaterThan(0);
      expect(seen.mark - seen.view, `face ${face}: the mark waits for the turn`).toBeGreaterThan(100);
    }
  }
});

test("a layer-turn step in a Twist replay does not change the view", async ({ page }) => {
  await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
  for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]]) await stickerAt(page, f!, c!).dispatchEvent("click");
  await turnLayer(page, "Turn the bottom layer to the right");
  await expect(page.locator('.cube-stage[data-busy="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await openReplay(page);
  await page.getByRole("button", { name: /^(Pause|Play)$/ }).first().click();
  await slider(page).fill("5");
  await expect(page.locator(".cube-scene")).toBeVisible();
  const before = await sceneView(page);
  await slider(page).fill("6");
  await expect(page.locator("#cube-score")).toContainText("X: 1");
  expect(await sceneView(page)).toEqual(before);
});

test("jumping across hidden faces and stepping back leaves the view on the last placement's face", async ({ page }) => {
  await openSixFaceReplay(page);
  await slider(page).fill("4"); // back
  await slider(page).fill("5"); // bottom, straight away
  await expect(stickerAt(page, 1)).toHaveAttribute("data-mark", /^[XO]$/);
  await expect.poll(async () => inView(await sceneView(page), 1)).toBe(true);
  await page.getByRole("button", { name: "Step back" }).click(); // position 4: the back face again
  await expect(stickerAt(page, 1)).toHaveAttribute("data-mark", "");
  await expect.poll(async () => inView(await sceneView(page), 3)).toBe(true);
  await slider(page).fill("6");
  await expect.poll(async () => inView(await sceneView(page), 4)).toBe(true);
  await expect(page.locator(".cube-scene")).not.toHaveClass(/dragging/);
});

test("in flat view a replay does not turn anything and the mark shows at once", async ({ page }) => {
  await openSixFaceReplay(page);
  await page.getByRole("button", { name: "Flat view" }).click();
  await slider(page).fill("4");
  await expect(stickerAt(page, 3)).toHaveAttribute("data-mark", /^[XO]$/, { timeout: 150 });
});

test("with reduced motion the face is shown without an animation, before the mark", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSixFaceReplay(page);
  await slider(page).fill("4");
  await expect(stickerAt(page, 3)).toHaveAttribute("data-mark", /^[XO]$/, { timeout: 400 });
  expect(inView(await sceneView(page), 3)).toBe(true);
});

test("at 4× speed every placement still turns, then shows its mark", async ({ page }) => {
  await openSixFaceReplay(page);
  await page.locator("#replay-speed").selectOption("4");
  await slider(page).fill("0");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("button.sticker:not([data-mark=''])")).toHaveCount(6, { timeout: 8000 });
  expect(inView(await sceneView(page), 4)).toBe(true);
});

// ---- replay notation (spec 004, US3) ----

test("the move list reads AcB and UAcB with no X or O, and each entry is named in words with its mover", async ({ page }) => {
  await page.goto("./?watch=1&rules=C33&game=l&moves=03142");
  const entries = page.getByRole("list", { name: "Moves" }).getByRole("button");
  await expect(entries).toHaveText(["1. 1c1", "2. 2c1", "3. 1c2", "4. 2c2", "5. 1c3"]);
  await expect(entries.first()).toHaveAccessibleName("Move 1, X, row 1, column 1");
  await expect(entries.nth(1)).toHaveAccessibleName("Move 2, O, row 2, column 1");

  await page.goto(SIX_LINK);
  const faces = page.getByRole("list", { name: "Moves" }).getByRole("button");
  await expect(faces).toHaveText(["1. F1c1", "2. U1c1", "3. R1c1", "4. B1c1", "5. D1c1", "6. L1c1"]);
  await expect(faces.nth(1)).toHaveAccessibleName("Move 2, O, top face, row 1, column 1");
});

test("the notation setting changes how layer turns are named, not the placements", async ({ page }) => {
  const link = "./?watch=1&rules=B33&game=l&moves=2000210122.y0%2B";
  await page.goto(link);
  const entries = page.getByRole("list", { name: "Moves" }).getByRole("button");
  await expect(entries.first()).toHaveText("1. F1c1");
  await expect(entries.nth(5)).toContainText(/layer/);

  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("ttt.save") ?? "null") ?? { schema: 3, settings: {}, game: null };
    save.settings = { ...save.settings, cubeNotation: "cube" };
    localStorage.setItem("ttt.save", JSON.stringify(save));
  });
  await page.goto(link);
  await expect(entries.first()).toHaveText("1. F1c1");
  await expect(entries.nth(5)).not.toContainText(/layer/);
  await expect(entries.nth(5)).toHaveAccessibleName(/^Move 6, X, turn the .* layer/);
});
