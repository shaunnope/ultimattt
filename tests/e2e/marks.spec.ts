import { test, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";

// Marks are SVG (X two strokes, O a circle) in one of four fixed palettes; Settings has no icon or colour input.

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  return dialog;
}
const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const markX = (page: Page) => page.locator("html").evaluate((el) => el.style.getPropertyValue("--mark-x"));

test("settings has no icon field and no colour input, only the four palettes with an X and O sample", async ({ page }) => {
  await page.goto("./");
  const dialog = await openSettings(page);
  await expect(dialog.getByLabel(/icon for/i)).toHaveCount(0);
  await expect(dialog.locator('input[type="color"]')).toHaveCount(0);
  await expect(dialog.locator('input[name="mark-palette"]')).toHaveCount(4);
  await expect(dialog.locator('input[name="mark-palette"]:checked')).toHaveCount(1);
  await expect(dialog.locator(".palette-sample")).toHaveCount(4);
  await expect(dialog.locator(".palette-sample svg.mark-x")).toHaveCount(4);
  await expect(dialog.locator(".palette-sample svg.mark-o")).toHaveCount(4);
  await expect(dialog.getByText("Colour-blind safe")).toBeVisible();
});

test("a palette applies at once, survives a reload, and follows the appearance", async ({ page }) => {
  await page.goto("./");
  const before = await markX(page);
  let dialog = await openSettings(page);
  await dialog.getByLabel("Colour-blind safe").check({ force: true });
  const light = await markX(page);
  expect(light).not.toBe(before);
  await dialog.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("dialog", { name: "Appearance" }).getByRole("radio", { name: "Dark" }).click();
  const dark = await markX(page);
  expect(dark).not.toBe(light);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible(); // the app boots after the load event
  expect(await markX(page)).toBe(dark);
  dialog = await openSettings(page);
  await expect(dialog.getByLabel("Colour-blind safe")).toBeChecked();
});

test("marks are drawn SVG shapes: X has two strokes, O a circle, and a new mark draws itself in", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await cell(page, 0).click();
  await cell(page, 1).click();
  await expect(cell(page, 0).locator("svg.mark-x path")).toHaveCount(2);
  await expect(cell(page, 1).locator("svg.mark-o circle")).toHaveCount(1);
  await expect(cell(page, 1).locator("svg.mark-o")).toHaveClass(/mark-new/);
  await expect(cell(page, 0)).toHaveAttribute("aria-label", /X/);
  // after a reload the marks are in place with no draw-in
  await page.reload();
  await expect(cell(page, 0).locator("svg.mark-x")).not.toHaveClass(/mark-new/);
});

test("with reduced motion a new mark appears with no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await cell(page, 4).click();
  await expect(cell(page, 4).locator("svg.mark-x")).not.toHaveClass(/mark-new/);
});

test("a 001 save with custom icons opens with the default marks and no error; an unknown palette shows the default", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    localStorage.setItem("ttt.save", JSON.stringify({
      schema: 1,
      settings: { hints: false, autoReplay: true, replaySpeed: 1, theme: "auto", icons: { X: "★", O: "●" }, lastSetup: null },
      game: { config: { variant: "classic", size: 3, mode: "local", seed: "3X3-BXK4-M9TR" }, moves: "40", startedAt: 1 },
    }));
  });
  await page.reload();
  await expect(cell(page, 4).locator("svg.mark-x")).toBeVisible();
  await expect(cell(page, 0).locator("svg.mark-o")).toBeVisible();
  await expect(page.locator("#toasts")).not.toContainText(/could not be read/i);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("ttt.save")!);
    save.settings.markPalette = "neon";
    localStorage.setItem("ttt.save", JSON.stringify(save));
  });
  await page.reload();
  const dialog = await openSettings(page);
  await expect(dialog.getByLabel("Default")).toBeChecked();
});

test("the palette never appears in a share link", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  const dialog = await openSettings(page);
  await dialog.getByLabel("Forest and berry").check({ force: true });
  await dialog.getByRole("button", { name: "Done" }).click();
  for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click();
  await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
  await page.getByRole("button", { name: "Close replay" }).click();
  await page.getByRole("button", { name: "Share replay" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).not.toMatch(/forest|palette|color|colour/i);
});

test("marks differ by shape as well as colour", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await cell(page, 0).click();
  await cell(page, 1).click();
  expect(await cell(page, 0).locator("svg *").evaluateAll((els) => els.map((e) => e.tagName.toLowerCase()))).toEqual(["path", "path"]);
  expect(await cell(page, 1).locator("svg *").evaluateAll((els) => els.map((e) => e.tagName.toLowerCase()))).toEqual(["circle"]);
});
