import { test as base, expect, type Page } from "@playwright/test";
import { startGame, choose, expectTurn, pillScore, type Variant } from "./helpers.ts";
import { Relay } from "./relay.ts";

// UI contract used by these tests (specs/005-twist-rule-refinements/contracts/ui-contracts.md):
//  - #turn-pill (role group, "Current player") holds [data-mark="X"] then [data-mark="O"]; the mover has aria-current="true"
//    and data-active; Twist adds .pill-score to each; a .pill-thumb slides under the active segment
//  - a plain turn leaves #game-status empty (and hidden); results, waiting and rotate prompts stay there
//  - "You" caption on this device's (or the human's) segment; "Winner" caption and data-winner on the winner

const test = base.extend<{ relay: Relay }>({
  relay: async ({}, use) => {
    const relay = new Relay();
    await use(relay);
    await relay.closeAll();
  },
});

const pill = (page: Page) => page.locator("#turn-pill");
const seg = (page: Page, mark: "X" | "O") => page.locator(`#turn-pill [data-mark="${mark}"]`);
const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const sticker = (page: Page, face: number, c: number) => page.locator(`button.sticker[data-face="${face}"][data-cell="${c}"]`);
const playCells = async (page: Page, cells: number[]) => {
  for (const c of cells) await cell(page, c).click();
};
const LINE: [number, number][] = [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]];

async function startLocal(page: Page, variant: Variant) {
  await startGame(page, { variant, opponent: "This device" });
}

for (const variant of ["Classic", "Ultimate", "Twist"] as const) {
  test(`${variant}: the pill shows X then O, starts on X, and moves to O after a move`, async ({ page }) => {
    await startLocal(page, variant);
    await expect(pill(page)).toHaveAttribute("aria-label", "Current player");
    await expect(pill(page)).toHaveAttribute("role", "group");
    await expect(pill(page).locator("[data-mark]")).toHaveCount(2);
    await expect(pill(page).locator("[data-mark]").first()).toHaveAttribute("data-mark", "X");
    await expect(pill(page).locator("[data-mark]").nth(1)).toHaveAttribute("data-mark", "O");
    await expectTurn(page, "X");
    await expect(seg(page, "O")).not.toHaveAttribute("aria-current", "true");
    if (variant === "Classic") await cell(page, 4).click();
    else if (variant === "Ultimate") await page.locator('button[data-board="4"][data-cell="2"]').click();
    else await sticker(page, 2, 4).dispatchEvent("click");
    await expectTurn(page, "O");
    await expect(seg(page, "X")).not.toHaveAttribute("aria-current", "true");
    // a plain turn leaves the status line empty (Ultimate keeps its where-to-play note)
    if (variant !== "Ultimate") await expect(page.locator("#game-status")).toBeHidden();
    await expect(pill(page)).not.toContainText(/lines|faces/i);
    if (variant === "Twist") {
      await expect(pillScore(page, "X")).toHaveText("0");
      await expect(pillScore(page, "O")).toHaveText("0");
    } else {
      await expect(page.locator("#turn-pill .pill-score")).toHaveCount(0);
    }
  });
}

test("Twist: scores update in the segments, the scorer keeps the highlight through the layer turn, and #cube-score is gone", async ({ page }) => {
  await startLocal(page, "Twist");
  await expect(page.locator("#cube-score")).toHaveCount(0);
  for (const [f, c] of LINE) await sticker(page, f, c).dispatchEvent("click");
  await expect(pillScore(page, "X")).toHaveText("1");
  await expect(pillScore(page, "O")).toHaveText("0");
  await expectTurn(page, "X");
  await expect(page.locator("#game-status")).toContainText(/turn a layer/i);
});

test("Twist with faces scoring shows the same pill and names the scoring in the title", async ({ page }) => {
  await page.goto("./");
  const start = page.getByRole("button", { name: "Start game" });
  const leave = page.getByRole("button", { name: "New game" });
  await expect(start.or(leave)).toBeVisible();
  if (await leave.isVisible()) await leave.click();
  await choose(page, "Twist");
  await page.locator("#opt-faces").check();
  await start.click();
  await expect(page.locator(".cube-board")).toBeVisible();
  await expect(page.locator("#game-title")).toContainText("faces scoring");
  await expect(pillScore(page, "X")).toHaveText("0");
  await expect(pill(page)).not.toContainText(/lines|faces/i);
});

test("the pill is not focusable or clickable", async ({ page }) => {
  await startLocal(page, "Classic");
  await expect(page.locator("#turn-pill button, #turn-pill a, #turn-pill [tabindex], #turn-pill input")).toHaveCount(0);
  await seg(page, "O").click({ force: true });
  await expectTurn(page, "X");
});

test("a win clears the highlight and marks the winner with text, not colour alone", async ({ page }) => {
  await startLocal(page, "Classic");
  await playCells(page, [0, 3, 1, 4, 2]);
  await expect(page.locator("#game-status")).toContainText("X wins");
  await expect(pill(page).locator("[aria-current]")).toHaveCount(0);
  await expect(seg(page, "X")).toHaveAttribute("data-winner", "true");
  await expect(seg(page, "X")).toContainText("Winner");
  await expect(seg(page, "O")).not.toHaveAttribute("data-winner", "true");
});

test("a draw leaves both segments unmarked", async ({ page }) => {
  await startLocal(page, "Classic");
  await playCells(page, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
  await expect(page.locator("#game-status")).toContainText(/draw/i);
  await expect(pill(page).locator("[aria-current], [data-winner]")).toHaveCount(0);
});

test("the live region announces whose move it is", async ({ page }) => {
  await startLocal(page, "Classic");
  await cell(page, 4).click();
  await expect(page.locator("#status")).toHaveText("O to move");
});

test("with reduced motion the highlight does not slide", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startLocal(page, "Classic");
  const duration = await page.locator("#turn-pill .pill-thumb").evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration.split(",").every((d) => parseFloat(d) < 0.001)).toBe(true); // a global rule may set 0.001ms rather than 0
  await cell(page, 4).click();
  await expectTurn(page, "O");
});

test("with motion allowed the highlight is a transform that slides", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await startLocal(page, "Classic");
  const property = await page.locator("#turn-pill .pill-thumb").evaluate((el) => getComputedStyle(el).transitionProperty);
  expect(property).toContain("transform");
});

// ---- replay ----

test("the replay pill follows stepping and the slider; the status line shows only the result", async ({ page }) => {
  await startLocal(page, "Classic");
  await playCells(page, [0, 3, 1, 4, 2]);
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  const slider = page.getByRole("slider", { name: "Replay position" });
  await expect(slider).toBeVisible();
  await page.getByRole("button", { name: /^Pause$/ }).click({ timeout: 2000 }).catch(() => undefined);
  await slider.fill("1");
  await expectTurn(page, "O");
  await expect(page.locator("#game-status")).toBeHidden();
  await slider.fill("2");
  await expectTurn(page, "X");
  await page.getByRole("button", { name: "Step forward" }).click();
  await expectTurn(page, "O");
  await page.getByRole("button", { name: "Step back" }).click();
  await expectTurn(page, "X");
  await slider.fill("5");
  await expect(page.locator("#game-status")).toContainText("X wins");
  await expect(seg(page, "X")).toHaveAttribute("data-winner", "true");
  await expect(pill(page).locator("[aria-current]")).toHaveCount(0);
});

test("the Twist replay pill shows the score of the position stepped to", async ({ page }) => {
  await startLocal(page, "Twist");
  for (const [f, c] of LINE) await sticker(page, f, c).dispatchEvent("click");
  await page.getByRole("group", { name: "Turn a layer" }).getByRole("button", { name: "Turn the left layer up", exact: true }).click();
  await page.getByRole("button", { name: "Confirm turn" }).click();
  await page.getByRole("button", { name: "Resign" }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  const slider = page.getByRole("slider", { name: "Replay position" });
  await expect(slider).toBeVisible();
  await slider.fill("5");
  await expect(pillScore(page, "X")).toHaveText("1");
  await slider.fill("4");
  await expect(pillScore(page, "X")).toHaveText("0");
  await expect(page.locator("#game-status")).toBeHidden();
});

// ---- computer and two-device play ----

test("against the computer the human's segment says You and the highlight sits on the computer while it thinks", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "Computer", level: "1. Beginner", mark: "X" });
  await expect(seg(page, "X")).toContainText("You");
  await expect(seg(page, "O")).not.toContainText("You");
  await cell(page, 4).click();
  await expect(page.locator("#game-status")).toHaveText("Computer is thinking…");
  await expectTurn(page, "O");
  await expectTurn(page, "X"); // and back to the human once it has played
  await expect(page.locator("#game-status")).toBeHidden();
});

async function hostAndJoin(browser: Parameters<Relay["device"]>[0], relay: Relay) {
  const { page: a } = await relay.device(browser);
  const { page: b } = await relay.device(browser);
  await a.goto("./");
  await choose(a, "Classic");
  await choose(a, "Local network");
  await choose(a, "X");
  await a.getByRole("button", { name: "Host game" }).click();
  const code = (await a.locator("#join-code-display").innerText()).trim();
  await b.goto("./");
  await b.locator("#join-code").fill(code);
  await b.getByRole("button", { name: "Join game" }).click();
  await expect(a.locator(".board").first()).toBeVisible();
  await expect(b.locator(".board").first()).toBeVisible();
  return { a, b };
}

test("two devices: X then O on both, the local segment says You, and the highlight follows the shared turn", async ({ browser, relay }) => {
  const { a, b } = await hostAndJoin(browser, relay);
  for (const page of [a, b]) {
    await expect(pill(page).locator("[data-mark]").first()).toHaveAttribute("data-mark", "X");
    await expect(pill(page).locator("[data-mark]").nth(1)).toHaveAttribute("data-mark", "O");
  }
  await expect(seg(a, "X")).toContainText("You");
  await expect(seg(a, "O")).not.toContainText("You");
  await expect(seg(b, "O")).toContainText("You");
  await expect(seg(b, "X")).not.toContainText("You");
  await expectTurn(a, "X");
  await expectTurn(b, "X");
  await expect(b.locator("#game-status")).toContainText(/waiting for your friend/i);
  await cell(a, 4).click();
  await expectTurn(a, "O");
  await expectTurn(b, "O");
  await expect(b.locator("#game-status")).toBeHidden();
});

// ---- 320 px ----

for (const scheme of ["light", "dark"] as const) {
  for (const variant of ["Classic", "Twist"] as const) {
    test(`at 320 px the ${variant} pill fits in ${scheme} appearance`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 320, height: 640 });
      await startLocal(page, variant);
      if (variant === "Twist") for (const [f, c] of LINE) await sticker(page, f, c).dispatchEvent("click");
      else await playCells(page, [0, 3, 1, 4, 2]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      for (const mark of ["X", "O"] as const) {
        const box = (await seg(page, mark).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
      const whole = (await pill(page).boundingBox())!;
      expect(whole.x + whole.width).toBeLessThanOrEqual(320);
    });
  }
}
