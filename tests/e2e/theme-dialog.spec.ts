import { test, expect, type Page } from "@playwright/test";

// UI contract used by these tests (specs/006-pwa-design-rework/contracts/ui-contracts.md, "Theme modal"):
//  - an "Appearance" icon button in the top bar opens a dialog named "Appearance"
//  - the dialog holds a radiogroup named "Colour mode" with radios Light, Dark and System (aria-checked)
//  - the pressed radio is the saved preference, not the resolved mode; with System pressed, a note
//    (#theme-note) says "Following your device. Currently dark." (or light)
//  - choosing applies at once and never closes the dialog
//  - <html> carries data-mode (resolved: light or dark) and data-mode-preference (light, dark or system)

const mode = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-mode"));
const preference = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-mode-preference"));

async function openTheme(page: Page) {
  await page.getByRole("button", { name: "Appearance" }).click();
  const dialog = page.getByRole("dialog", { name: "Appearance" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("a dark device is dark before any module script has run", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ colorScheme: "dark", baseURL });
  const page = await context.newPage();
  // hold the app module back, so what shows at DOMContentLoaded is only what the page itself set
  await page.route("**/js/ui/app.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.goto("./", { waitUntil: "domcontentloaded" });
  expect(await mode(page)).toBe("dark");
  expect(await preference(page)).toBe("system");
  const painted = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--page)";
    document.documentElement.append(probe);
    const page = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { body: getComputedStyle(document.body).backgroundColor, page };
  });
  expect(painted.body).toBe(painted.page);
  await context.close();
});

test("the Appearance button opens Light, Dark and System, with System pressed by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  const dialog = await openTheme(page);
  const group = dialog.getByRole("radiogroup", { name: "Colour mode" });
  await expect(group.getByRole("radio")).toHaveCount(3);
  await expect(group.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "false");
  await expect(group.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "false");
  await expect(dialog.locator("#theme-note")).toHaveText("Following your device. Currently dark.");
});

test("choosing applies at once, keeps the dialog open, and the pressed radio follows the preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  const dialog = await openTheme(page);
  const group = dialog.getByRole("radiogroup", { name: "Colour mode" });

  await group.getByRole("radio", { name: "Light" }).click();
  expect(await mode(page)).toBe("light");
  expect(await preference(page)).toBe("light");
  await expect(dialog).toBeVisible();
  await expect(group.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio", { name: "System" })).toHaveAttribute("aria-checked", "false");
  await expect(dialog.locator("#theme-note")).toBeHidden();

  await group.getByRole("radio", { name: "Dark" }).click();
  expect(await mode(page)).toBe("dark");
  expect(await preference(page)).toBe("dark");

  await page.emulateMedia({ colorScheme: "light" });
  expect(await mode(page)).toBe("dark"); // pinned: the device does not move it

  await group.getByRole("radio", { name: "System" }).click();
  await expect.poll(() => mode(page)).toBe("light");
  expect(await preference(page)).toBe("system");
  await expect(dialog.locator("#theme-note")).toHaveText("Following your device. Currently light.");
  await expect(dialog).toBeVisible();
});

test("the choice is remembered across a reload, and the pressed radio shows the preference", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  let dialog = await openTheme(page);
  await dialog.getByRole("radio", { name: "Dark" }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  expect(await mode(page)).toBe("dark");
  dialog = await openTheme(page);
  await expect(dialog.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => localStorage.getItem("ttt.mode"))).toBe("dark");
});

test("a change of the device scheme while System is chosen updates the mode without moving focus", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  const dialog = await openTheme(page);
  const system = dialog.getByRole("radio", { name: "System" });
  await system.focus();
  const before = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => mode(page)).toBe("dark");
  await expect(dialog.locator("#theme-note")).toHaveText("Following your device. Currently dark.");
  await expect(system).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "")).toBe(before);
});

test("a choice made under the old key (ttt.theme) is dark on first paint, then moves to ttt.mode", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ colorScheme: "light", baseURL });
  const page = await context.newPage();
  await page.goto("./");
  // what the previous version left behind: the saved theme and its pre-paint mirror under the old key
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("ttt.save") ?? "null") ?? { schema: 1, settings: {}, game: null };
    save.settings.theme = "dark";
    localStorage.setItem("ttt.save", JSON.stringify(save));
    localStorage.setItem("ttt.theme", "dark");
    localStorage.removeItem("ttt.mode");
  });
  await page.route("**/js/ui/app.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await mode(page)).toBe("dark");
  expect(await preference(page)).toBe("dark");
  await page.unroute("**/js/ui/app.js");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ttt.mode"))).toBe("dark");
  expect(await page.evaluate(() => localStorage.getItem("ttt.theme"))).toBeNull();
  await context.close();
});

test("an old auto choice reads as system", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ colorScheme: "dark", baseURL });
  const page = await context.newPage();
  await page.goto("./");
  await page.evaluate(() => {
    localStorage.removeItem("ttt.mode");
    localStorage.setItem("ttt.theme", "auto");
  });
  await page.reload();
  expect(await mode(page)).toBe("dark");
  expect(await preference(page)).toBe("system");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ttt.mode"))).toBe("system");
  await context.close();
});

test("with storage blocked the choice still applies for the visit", async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new Error("blocked");
    };
    Object.defineProperty(window, "localStorage", { get: boom });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  const dialog = await openTheme(page);
  await dialog.getByRole("radio", { name: "Dark" }).click();
  expect(await mode(page)).toBe("dark");
  await expect(dialog.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
});

test("the Appearance button is reachable from the start screen and from a game", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Appearance" })).toBeVisible();
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board, .cube-board").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Appearance" })).toBeVisible();
});
