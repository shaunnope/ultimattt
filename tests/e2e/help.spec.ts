import { test, expect } from "@playwright/test";
import { startGame, expectTurn } from "./helpers.ts";

test("the menu has a Help link that opens the help page in one interaction, with real headings in order", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page).toHaveURL(/#\/help$/);
  await expect(page.locator("#help-view h2")).toHaveText(["Classic rules", "Ultimate", "Twist-Tac-Toe", "Setup options"]);
  await expect(page.getByRole("heading", { name: "Ultimate" })).toBeVisible();
  await expect(page.locator("#help-view")).toContainText(/preview/i);
  await expect(page.locator("#help-view")).toContainText(/notation/i);
  await expect(page.locator("#main")).toBeHidden();
});

test("Back returns to the screen the player came from", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.locator("#help-back").click();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.locator("#help-view")).toBeHidden();
  expect(page.url()).not.toContain("#/help");
});

test("the browser back button also leaves help", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible(); // the app boots after the load event
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("help opened in the middle of a game leaves the game untouched", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "This device" });
  await page.locator('[data-cell="4"]').click();
  await page.locator('[data-cell="0"]').click();
  const before = await page.evaluate(() => localStorage.getItem("ttt.save"));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.locator("#help-view h2").first()).toHaveText("Classic rules");
  await page.locator("#help-back").click();
  await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X");
  await expect(page.locator('[data-cell="0"]')).toHaveAttribute("data-mark", "O");
  await expectTurn(page, "X");
  expect(await page.evaluate(() => localStorage.getItem("ttt.save"))).toBe(before);
});

test("help works offline after the first load", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(page.locator("#help-view h2")).toHaveText(["Classic rules", "Ultimate", "Twist-Tac-Toe", "Setup options"]);
});

test("help can be reached and left by keyboard", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Help", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#help-view")).toBeVisible();
  await page.locator("#help-back").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
});

test("examples have text alternatives, and point at a cell with a dashed ring as well as a colour", async ({ page }) => {
  await page.goto("./#/help");
  const examples = page.locator("#help-view .help-example");
  await expect(examples).toHaveCount(4);
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

test("the Cube help explains the notation convention with the larger cubes' layer names", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  const view = page.locator("#help-view");
  await expect(view).toContainText(/single layer/i);
  await expect(view).toContainText(/nearer face/i);
  await expect(view).toContainText(/middle layer of an odd cube is M, E or S/i);
  await expect(view).toContainText("L, 2L, M, 2R, R");
  await expect(view).not.toContainText("3L");
});

test("Classic rules comes first, states the win length per board size, and its examples have text alternatives", async ({ page }) => {
  await page.goto("./#/help");
  const classic = page.locator("#help-classic");
  await expect(classic).toBeVisible();
  await expect(page.locator("#help-view h2").first()).toHaveText("Classic rules");
  const section = page.locator("section[aria-labelledby='help-classic']");
  await expect(section).toContainText("3 in a row");
  await expect(section).toContainText("4 in a row");
  await expect(section).toContainText(/draw/i);
  const examples = section.locator(".help-example");
  expect(await examples.count()).toBeGreaterThanOrEqual(2);
  for (const label of await examples.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""))) expect(label.length).toBeGreaterThan(20);
});

// ---- layout (spec 004, US6) ----

const REM = 16;

test("help at 320 px has a side gutter (10px under 480px, per the design spec), no sideways scroll, and examples that stay inside the page", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("./#/help");
  await expect(page.locator(".help")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const box = (await page.locator(".help").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(10);
  expect(box.x + box.width).toBeLessThanOrEqual(320 - 10 + 1);
  for (const example of await page.locator(".help-example").all()) {
    const b = (await example.boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(320);
  }
});

test("help on a wide screen keeps one centred page column, no wider than 720px (design spec section 4)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./#/help");
  const box = (await page.locator(".help").boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(720 + 1);
  expect(box.width).toBeGreaterThanOrEqual(30 * REM);
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThanOrEqual(2);
});

test("help sections are visibly separated and evenly spaced, with headings clearly larger than the text", async ({ page }) => {
  await page.goto("./#/help");
  const sections = page.locator(".help-section");
  await expect(sections).toHaveCount(4);
  const style = await sections.evaluateAll((els) => els.map((el) => {
    const s = getComputedStyle(el);
    return { rule: parseFloat(s.borderTopWidth), pad: parseFloat(s.paddingTop) };
  }));
  for (const [i, s] of style.entries()) {
    if (i === 0) continue;
    expect(s.rule, `section ${i} has a rule above it`).toBeGreaterThanOrEqual(1);
    expect(s.pad, `section ${i} has space under the rule`).toBeGreaterThanOrEqual(16);
  }
  const boxes = await sections.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
  const gaps = boxes.slice(1).map((b, i) => Math.round(b.top - boxes[i]!.bottom));
  expect(new Set(gaps).size, `gaps ${gaps}`).toBe(1);
  const sizes = await page.evaluate(() => ({ h2: parseFloat(getComputedStyle(document.querySelector(".help h2")!).fontSize), p: parseFloat(getComputedStyle(document.querySelector(".help p")!).fontSize) }));
  expect(sizes.h2).toBeGreaterThanOrEqual(sizes.p * 1.2); // heading 18px over body 15px in the type scale
});

test("every help control shows a focus ring and has an accessible name", async ({ page }) => {
  await page.goto("./#/help");
  await expect(page.locator("#help-view h2").first()).toBeVisible(); // the app boots after the load event
  const controls = page.locator("#help-view button, #help-view a");
  expect(await controls.count()).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    await expect(control).toHaveAccessibleName(/\S/);
    await control.focus();
    const outline = await control.evaluate((el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow }; });
    expect(outline.style !== "none" && outline.width > 0 || outline.shadow !== "none").toBe(true);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`help section text and rules keep contrast in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("./#/help");
    const colours = await page.locator(".help-section").nth(1).evaluate((el) => ({ rule: getComputedStyle(el).borderTopColor, bg: getComputedStyle(document.body).backgroundColor }));
    expect(colours.rule).not.toBe(colours.bg);
  });
}
