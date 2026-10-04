import { test, expect, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { startGame } from "./helpers.ts";

// axe-core on every screen a player meets, in light and dark: no serious or critical violation.
// Each screen is checked at phone and desktop width through the two Playwright projects.

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

async function violations(page: Page): Promise<string[]> {
  await page.evaluate(axeSource);
  const result = await page.evaluate(() =>
    (globalThis as unknown as { axe: { run(): Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run(),
  );
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`);
}

async function clean(page: Page, name: string) {
  const found = await violations(page);
  expect(found, `${name}\n${found.join("\n")}`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} appearance`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test("start screen", async ({ page }) => {
      await page.goto("./");
      await clean(page, "start screen");
    });

    test("Classic game and its result", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
      await clean(page, "classic game");
      for (const c of [0, 3, 1, 4, 2]) await page.locator(`[data-cell="${c}"]`).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await clean(page, "classic result dialog");
    });

    test("Ultimate game", async ({ page }) => {
      await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
      await page.locator('button[data-board="4"][data-cell="2"]').click();
      await clean(page, "ultimate game");
    });

    test("Cube, in 3D and flat, with the layer picker", async ({ page }) => {
      await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
      for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]]) await page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`).dispatchEvent("click");
      await expect(page.getByRole("group", { name: "Turn a layer" })).toBeVisible();
      await clean(page, "cube 3D with picker");
      await page.getByRole("button", { name: "Flat view" }).click();
      await clean(page, "cube flat with picker");
    });

    test("Replay", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
      for (const c of [0, 3, 1, 4, 2]) await page.locator(`[data-cell="${c}"]`).click();
      await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
      await expect(page.getByRole("group", { name: "Replay controls" })).toBeVisible();
      await clean(page, "replay");
    });

    test("Settings", async ({ page }) => {
      await page.goto("./");
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      await clean(page, "settings dialog");
    });
  });
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} appearance, help and larger boards`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test("help page", async ({ page }) => {
      await page.goto("./#/help");
      await expect(page.locator("#help-view h2").first()).toBeVisible();
      await clean(page, "help page");
    });

    test("Ultimate 4×4 game", async ({ page }) => {
      await startGame(page, { variant: "Ultimate", opponent: "A friend on this device", size: "4×4", winLength: 3 });
      await page.locator('button[data-board="5"][data-cell="9"]').click();
      await clean(page, "ultimate 4x4");
    });

    test("Cube 4×4 with the picker, in notation mode", async ({ page }) => {
      await startGame(page, { variant: "Twist", opponent: "A friend on this device", size: "4×4", winLength: 3 });
      for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 1], [2, 2]]) await page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`).dispatchEvent("click");
      await expect(page.getByRole("group", { name: "Turn a layer" })).toBeVisible();
      await clean(page, "cube 4x4 with picker");
      await page.getByRole("button", { name: "Settings" }).click();
      await page.getByRole("dialog", { name: "Settings" }).getByLabel("Twist turn names").selectOption("cube");
      await clean(page, "settings with palette picker");
      await page.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Done" }).click();
      await clean(page, "cube 4x4 notation picker");
    });
  });
}
