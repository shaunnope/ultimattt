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

    test("header with the logo", async ({ page }) => {
      await page.goto("./");
      await expect(page.locator(".topbar .app-logo")).toBeVisible();
      await clean(page, "header with logo");
      // non-text contrast: the logo's ink against the page behind the header is at least 3:1
      const [ink, back] = await page.evaluate(() => {
        // a canvas turns any computed colour (rgb, color-mix, oklch) into plain RGB
        const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const rgb = (value: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = value;
          ctx.fillRect(0, 0, 1, 1);
          return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
        };
        const logo = document.querySelector(".topbar .app-logo")!;
        const page = getComputedStyle(document.documentElement).getPropertyValue("--page").trim();
        return [rgb(getComputedStyle(logo).color), rgb(page)];
      });
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => { const x = v! / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const [hi, lo] = [Math.max(lum(ink!), lum(back!)), Math.min(lum(ink!), lum(back!))];
      expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(3);
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

    test("help page at 320 px wide", async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto("./#/help");
      await expect(page.locator("#help-view h2").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await clean(page, "help page at 320 px");
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toBeVisible();
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

// ---- the design spec's accessibility checklist (docs/pwa-design-spec.md section 12) ----

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} appearance, dialogs and banners`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test("the Appearance dialog", async ({ page }) => {
      await page.goto("./");
      await page.getByRole("button", { name: "Appearance" }).click();
      await expect(page.getByRole("dialog", { name: "Appearance" })).toBeVisible();
      await clean(page, "appearance dialog");
    });

    test("the result dialog and the finished game", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
      for (const c of [0, 3, 1, 4, 2]) await page.locator(`[data-cell="${c}"]`).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await clean(page, "result dialog");
    });

    test("the update bar and an error banner on the start screen", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("ttt:update-ready", { detail: { postMessage() {} } })));
      await page.locator("#join-code").fill("zz");
      await page.getByRole("button", { name: "Join game" }).click();
      await expect(page.locator("#join-error")).toBeVisible();
      await clean(page, "update bar and error banner");
    });

    test("the offline banner", async ({ page, context }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible(); // the app boots after the load event
      await context.setOffline(true);
      await expect(page.locator(".banner", { hasText: "You are offline." })).toBeVisible();
      await clean(page, "offline banner");
      await context.setOffline(false);
    });
  });
}

test("the skip link is the first thing Tab reaches, and it jumps to the game", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible(); // the app boots after the load event
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to the game" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("every focusable control shows a 2px brand-ink ring with a 2px offset, and has an accessible name", async ({ page }) => {
  await page.goto("./");
  const ring = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;outline:2px solid var(--brand-ink)";
    document.documentElement.append(probe);
    const colour = getComputedStyle(probe).outlineColor;
    probe.remove();
    return colour;
  });
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // a radio or checkbox is hidden and its label carries the ring
      const target = el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox") && el.labels?.[0] && getComputedStyle(el).opacity === "0" ? el.labels[0] : el;
      const s = getComputedStyle(target);
      const name = el.getAttribute("aria-label") || el.textContent?.trim() || (el instanceof HTMLInputElement ? el.labels?.[0]?.textContent?.trim() : "") || "";
      return { id: `${el.tagName}#${el.id}:${name}`, width: s.outlineWidth, style: s.outlineStyle, colour: s.outlineColor, offset: s.outlineOffset, name };
    });
    if (!stop || seen.has(stop.id)) continue;
    seen.add(stop.id);
    expect(stop.name, `${stop.id} has an accessible name`).toMatch(/\S/);
    expect(stop.style, stop.id).toBe("solid");
    expect(stop.width, stop.id).toBe("2px");
    expect(stop.offset, stop.id).toBe("2px");
    expect(stop.colour, stop.id).toBe(ring);
  }
  expect(seen.size).toBeGreaterThan(8);
});
