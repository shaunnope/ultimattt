import { test, expect } from "@playwright/test";
import { startGame } from "./helpers.ts";

test("the menu has a Help link that opens the help page in one interaction, with real headings in order", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Help" }).click();
  await expect(page).toHaveURL(/#\/help$/);
  await expect(page.locator("#help-view h2")).toHaveText(["Ultimate", "Cube", "Setup options"]);
  await expect(page.getByRole("heading", { name: "Ultimate" })).toBeVisible();
  await expect(page.locator("#help-view")).toContainText(/preview/i);
  await expect(page.locator("#help-view")).toContainText(/notation/i);
  await expect(page.locator("#main")).toBeHidden();
});

test("Back returns to the screen the player came from", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Help" }).click();
  await page.locator("#help-back").click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.locator("#help-view")).toBeHidden();
  expect(page.url()).not.toContain("#/help");
});

test("the browser back button also leaves help", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Help" }).click();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("help opened in the middle of a game leaves the game untouched", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
  await page.locator('[data-cell="4"]').click();
  await page.locator('[data-cell="0"]').click();
  const before = await page.evaluate(() => localStorage.getItem("ttt.save"));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.locator("#help-view h2").first()).toHaveText("Ultimate");
  await page.locator("#help-back").click();
  await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X");
  await expect(page.locator('[data-cell="0"]')).toHaveAttribute("data-mark", "O");
  await expect(page.locator("#game-status")).toContainText("X to move");
  expect(await page.evaluate(() => localStorage.getItem("ttt.save"))).toBe(before);
});

test("help works offline after the first load", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("link", { name: "Help" }).click();
  await expect(page.locator("#help-view h2")).toHaveText(["Ultimate", "Cube", "Setup options"]);
});

test("help can be reached and left by keyboard", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("link", { name: "Help" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#help-view")).toBeVisible();
  await page.locator("#help-back").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("examples have text alternatives, and point at a cell with a dashed ring as well as a colour", async ({ page }) => {
  await page.goto("./#/help");
  const examples = page.locator("#help-view .help-example");
  await expect(examples).toHaveCount(2);
  for (const label of await examples.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))) expect(label.length).toBeGreaterThan(30);
  await expect(page.locator('#help-view .help-cell[data-point="true"]').first()).toHaveCSS("outline-style", "dashed");
});

for (const scheme of ["light", "dark"] as const) {
  test(`help text is readable in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./#/help");
    const colours = await page.locator("#help-view p").first().evaluate((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(document.body).backgroundColor }));
    expect(colours.fg).not.toBe(colours.bg);
  });
}
