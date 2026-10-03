import { test, expect, type Page } from "@playwright/test";
import { choose, startGame } from "./helpers.ts";

// SC-004 / FR-016: the computer replies in under a second, at every level, in Classic 3x3 and Ultimate.
// SC-008: the cube stays smooth while it is turned and while a layer turns.
// "A mid-range phone" is stood in for by a 4x CPU slowdown of the browser (see the spec's assumptions).

async function throttle(page: Page, rate = 4): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate });
}

const LEVELS = ["1. Beginner", "2. Casual", "3. Steady", "4. Sharp", "5. Master"];

for (const variant of ["Classic", "Ultimate"] as const) {
  for (const level of LEVELS) {
    test(`${variant}: the computer replies in under a second at level ${level} (4x slower CPU)`, async ({ page }) => {
      await throttle(page);
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" }).or(page.getByRole("button", { name: "New game" }))).toBeVisible();
      await page.evaluate(() => localStorage.clear());
      await page.goto("./");
      await choose(page, variant);
      await choose(page, "Computer");
      await page.locator("#level").selectOption({ label: level });
      await choose(page, "O"); // the computer opens, with every cell (or board) to choose from
      const marks = page.locator("button .mark");
      let started = Date.now();
      await page.getByRole("button", { name: "Start game" }).click();
      await expect(marks).toHaveCount(1, { timeout: 5000 });
      const opening = Date.now() - started;
      expect(opening, `opening move took ${opening} ms`).toBeLessThan(1000);

      // the human replies on any open cell the game points at, and the computer answers
      const reply = variant === "Classic" ? page.locator('button.cell:not(:has(.mark))').first() : page.locator('.sub-board[data-playable="true"] button.cell:not(:has(.mark))').first();
      await reply.click();
      started = Date.now();
      await expect(marks).toHaveCount(3, { timeout: 5000 });
      const answer = Date.now() - started;
      expect(answer, `reply took ${answer} ms`).toBeLessThan(1000);
    });
  }
}

test("the cube stays smooth while the view is dragged and a layer turns (4x slower CPU)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "frame timing is measured in Chromium");
  await throttle(page);
  await startGame(page, { variant: "Cube", opponent: "A friend on this device" });
  test.skip((await page.locator(".cube-scene").count()) === 0, "3D view not available");
  for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]]) await page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`).dispatchEvent("click");
  await expect(page.getByRole("group", { name: "Turn a layer" })).toBeVisible();

  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __raf: number };
    w.__frames = [];
    let last = performance.now();
    const tick = (now: number) => {
      w.__frames.push(now - last);
      last = now;
      w.__raf = requestAnimationFrame(tick);
    };
    w.__raf = requestAnimationFrame(tick);
  });

  const box = (await page.locator(".cube-scene").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy + 40, { steps: 40 });
  await page.mouse.move(cx - 60, cy - 30, { steps: 40 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Turn the left layer up" }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Show right face" }).click();
  await page.waitForTimeout(700);

  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __raf: number };
    cancelAnimationFrame(w.__raf);
    return w.__frames.slice(2); // ignore the first frames while the measuring starts
  });
  expect(frames.length).toBeGreaterThan(60);
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const worst = sorted[sorted.length - 1]!;
  console.log(`cube frames: ${frames.length}, p95 ${p95.toFixed(1)} ms, worst ${worst.toFixed(1)} ms`);
  expect(p95, `95th percentile frame ${p95.toFixed(1)} ms`).toBeLessThanOrEqual(20);
  expect(worst, `slowest frame ${worst.toFixed(1)} ms`).toBeLessThanOrEqual(50);
});
