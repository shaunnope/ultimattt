import { test as base, expect, type Page } from "@playwright/test";
import { startGame, choose } from "./helpers.ts";
import { Relay } from "./relay.ts";

// Shared components from docs/pwa-design-spec.md section 8, one case each for the views the layout audit only samples
// (specs/006-pwa-design-rework/contracts/ui-contracts.md):
//  - update bar: "A new version is ready." and an Update button; nothing happens until it is pressed
//  - replay: named controls, a position readout "Move N of M" beside the slider
//  - result: the outcome in words, a check icon on a win, a detail line, then the next actions; share says "copied"
//  - pairing: the code in tabular figures; offline, a banner says what to do and play on this device still starts
//  - palette picker: the chosen row shows a check icon and the word "Selected"
//  - icons are inline SVG marked data-icon="<name>", never emoji

const test = base.extend<{ relay: Relay }>({
  relay: async ({}, use) => {
    const relay = new Relay();
    await use(relay);
    await relay.closeAll();
  },
});

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);

async function finishedGame(page: Page) {
  await startGame(page, { variant: "Classic", opponent: "This device" });
  for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click(); // X takes the top row
  const result = page.getByRole("dialog");
  await expect(result).toBeVisible();
  return result;
}

test("the update bar offers the update and waits for the player", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "This device" });
  await cell(page, 4).click();
  await page.evaluate(() => {
    const worker = { messages: [] as unknown[], postMessage(m: unknown) { this.messages.push(m); } };
    (window as unknown as { __worker: typeof worker }).__worker = worker;
    window.dispatchEvent(new CustomEvent("ttt:update-ready", { detail: worker }));
  });
  const bar = page.locator("#update-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("A new version is ready.");
  const update = bar.getByRole("button", { name: "Update" });
  await expect(update).toBeVisible();
  // nothing has been sent yet, and the game in progress is already saved
  expect(await page.evaluate(() => (window as unknown as { __worker: { messages: unknown[] } }).__worker.messages.length)).toBe(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ttt.save")!).game.moves as string);
  expect(saved.length).toBeGreaterThan(0);
  await update.click();
  expect(await page.evaluate(() => (window as unknown as { __worker: { messages: unknown[] } }).__worker.messages)).toEqual([{ type: "skip-waiting" }]);
  await expect(update).toBeDisabled();
});

test("the replay has named controls and a position readout that follows the slider and the steps", async ({ page }) => {
  const result = await finishedGame(page);
  await result.getByRole("button", { name: "Watch replay" }).click();
  const controls = page.getByRole("group", { name: "Replay controls" });
  await expect(controls).toBeVisible();
  for (const name of ["Step back", "Step forward", "Replay position"]) await expect(controls.getByLabel(name)).toBeVisible();
  const readout = page.locator("#replay-readout");
  await expect(readout).toBeVisible();
  if ((await controls.getByRole("button", { name: "Pause" }).count()) > 0) await controls.getByRole("button", { name: "Pause" }).click();
  await controls.getByLabel("Replay position").fill("0");
  await expect(readout).toHaveText("Move 0 of 5");
  await controls.getByRole("button", { name: "Step forward" }).click();
  await expect(readout).toHaveText("Move 1 of 5");
  await controls.getByLabel("Replay position").fill("5");
  await expect(readout).toHaveText("Move 5 of 5");
  // the buttons are icons: no letters or pictographs as labels
  for (const name of ["Step back", "Step forward"]) {
    const button = controls.getByRole("button", { name });
    await expect(button.locator("svg")).toHaveCount(1);
    expect((await button.innerText()).trim()).toBe("");
  }
});

test("the result says what happened in words, with a check icon on a win and the next actions", async ({ page }) => {
  const result = await finishedGame(page);
  await expect(result.getByRole("heading")).toHaveText("X wins");
  await expect(result.locator('svg[data-icon="check"]')).toBeVisible();
  await expect(result).toContainText("X won.");
  await expect(result.getByRole("button", { name: "Watch replay" })).toHaveClass(/btn-primary/);
  await expect(result.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(result.getByRole("button", { name: "New game" })).toBeVisible();
  expect(await result.innerText()).not.toMatch(/!/);
});

test("a draw has no check icon and still says so plainly", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "This device" });
  for (const c of [0, 1, 2, 4, 3, 5, 7, 6, 8]) await cell(page, c).click(); // no line for either player
  const result = page.getByRole("dialog");
  await expect(result.getByRole("heading")).toHaveText("It's a draw");
  await expect(result.locator('svg[data-icon="check"]')).toHaveCount(0);
  await expect(result).toContainText("Nobody won this one.");
});

test("sharing the replay says it was copied, in a short status toast", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  const result = await finishedGame(page);
  await page.keyboard.press("Escape");
  await expect(result).toHaveCount(0);
  // dismissing the result plays the replay by itself; close it to reach the finished board
  await expect(page.getByRole("group", { name: "Replay controls" })).toBeVisible();
  await page.getByRole("button", { name: "Close replay" }).click();
  await page.getByRole("button", { name: "Share replay" }).click();
  const toast = page.locator("#toasts .toast");
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute("role", "status");
  await expect(toast).toContainText(/copied/i);
  expect((await toast.innerText()).length).toBeLessThanOrEqual(30);
});

test("the game code is shown in tabular figures", async ({ browser, relay }) => {
  const { page } = await relay.device(browser);
  await page.goto("./");
  await choose(page, "Local network");
  await page.getByRole("button", { name: "Host game" }).click();
  const code = page.locator("#join-code-display");
  await expect(code).toBeVisible();
  expect(await code.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toContain("tabular-nums");
  expect(await code.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Nunito/);
});

test("offline, a banner says what to do, two-device play is unavailable, and a game on this device still starts", async ({ page, context }) => {
  await page.goto("./");
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true); // the game is cached
  await context.setOffline(true);
  const banner = page.locator(".banner", { hasText: "You are offline." });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Check your connection to play on two devices.");
  await expect(banner.locator("svg")).toHaveCount(1);
  await expect(page.getByLabel("Local network")).toBeDisabled();
  await choose(page, "This device");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board").first()).toBeVisible();
  await context.setOffline(false);
});

test("an error banner is an alert and says what to do", async ({ page }) => {
  await page.goto("./");
  await page.locator("#join-code").fill("zz");
  await page.getByRole("button", { name: "Join game" }).click();
  const error = page.locator("#join-error");
  await expect(error).toBeVisible();
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toContainText("A game code is six letters and digits, like BXK4M9.");
  await expect(error.locator("svg")).toHaveCount(1);
});

test("the palette picker marks the chosen row with a check icon and the word Selected", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  const chosen = dialog.locator(".palette-picker .choice", { has: page.locator("input:checked") });
  await expect(chosen).toHaveCount(1);
  await expect(chosen.locator('svg[data-icon="check"]')).toBeVisible();
  await expect(chosen).toContainText("Selected");
  await dialog.getByLabel("Colour-blind safe").check({ force: true });
  const next = dialog.locator(".palette-picker .choice", { has: page.locator("input:checked") });
  await expect(next).toContainText("Colour-blind safe");
  await expect(next).toContainText("Selected");
  await expect(dialog.locator(".palette-picker .choice", { hasText: "Selected" })).toHaveCount(1);
  // each row still shows live X and O samples
  await expect(dialog.locator(".palette-sample")).toHaveCount(4);
});

test("icons are inline SVG with a data-icon name, and no emoji appears in the start screen text", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible(); // the app boots after the load event now
  expect(await page.locator("button svg[data-icon]").count()).toBeGreaterThan(0);
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}←-⇿■-◿☀-➿⬀-⯿]/u);
});
