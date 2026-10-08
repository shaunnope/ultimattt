import { test as base, expect, type Page } from "@playwright/test";
import { startGame, choose } from "../e2e/helpers.ts";
import { Relay } from "../e2e/relay.ts";

// Screenshots of every screen at 320, 480 and 720px wide in light and dark, compared with the baseline taken from
// the app before the SvelteKit migration (playwright.parity.config.ts). Runs are made repeatable by fixing the
// random numbers and the clock's reading, blocking the web font requests (the fallback face is used every time)
// and asking for reduced motion (no confetti, no transitions).

const WIDTHS = [320, 480, 720] as const;
const OPENING: [number, number][] = [[0, 0], [0, 4], [4, 0], [0, 3], [3, 0], [0, 5], [5, 0]];

const test = base.extend<{ relay: Relay }>({
  relay: async ({}, use) => {
    const relay = new Relay();
    await use(relay);
    await relay.closeAll();
  },
});

test.beforeEach(async ({ page }) => {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await fix(page);
});

/** Repeatable runs: a fixed pseudo-random sequence and a fixed Date.now. */
async function fix(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let s = 123456789;
    // the start screen now draws its placeholder seed from the stream; a screen whose pairing code is part of the capture
    // starts the stream over just before the code is made, as it began in the app that took the baseline
    (window as unknown as { restartRandom: () => void }).restartRandom = () => {
      s = 123456789;
    };
    Math.random = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    Date.now = () => 1_700_000_000_000;
    // the pairing code comes from crypto; fix it too
    crypto.getRandomValues = ((a: Uint8Array) => {
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
      return a;
    }) as typeof crypto.getRandomValues;
  });
}

// the seed box shows a placeholder seed that follows the rules and is random, so its box is masked wherever it appears
async function shoot(page: Page, name: string, scheme: string): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    // let layout settle after the resize
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page).toHaveScreenshot(`${name}-${width}-${scheme}.png`, { fullPage: true, mask: [page.locator("#seed-input")] });
  }
}

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const subCell = (page: Page, b: number, c: number) => page.locator(`button[data-board="${b}"][data-cell="${c}"]`);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("setup", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
      await shoot(page, "setup", scheme);
    });

    test("setup, two devices", async ({ page }) => {
      await page.goto("./");
      await choose(page, "Local network");
      await expect(page.getByRole("button", { name: "Host game" })).toBeVisible();
      await shoot(page, "setup-two-devices", scheme);
    });

    test("setup, Twist rules", async ({ page }) => {
      await page.goto("./");
      await choose(page, "Twist");
      await expect(page.locator("#cube-options")).toBeVisible();
      await shoot(page, "setup-twist", scheme);
    });

    test("a Classic game in play", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "This device" });
      for (const c of [4, 0, 8]) await cell(page, c).click();
      await shoot(page, "classic", scheme);
    });

    test("an Ultimate game in play", async ({ page }) => {
      await startGame(page, { variant: "Ultimate", opponent: "This device" });
      for (const [b, c] of OPENING) await subCell(page, b, c).click();
      await shoot(page, "ultimate", scheme);
    });

    test("a Twist game, 3D and flat", async ({ page }) => {
      await startGame(page, { variant: "Twist", opponent: "This device" });
      await shoot(page, "twist-3d", scheme);
      await page.getByRole("button", { name: "Flat view" }).click();
      await shoot(page, "twist-flat", scheme);
    });

    test("the result dialog", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "This device" });
      for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));
      await shoot(page, "result", scheme);
    });

    test("a replay", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "This device" });
      for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click();
      await page.getByRole("dialog").getByRole("button", { name: "Watch replay" }).click();
      await expect(page.getByRole("group", { name: "Replay controls" })).toBeVisible();
      await shoot(page, "replay", scheme);
    });

    test("help", async ({ page }) => {
      await page.goto("./#/help");
      await expect(page.locator("#help-view")).toBeVisible();
      await shoot(page, "help", scheme);
    });

    test("settings, with the palette rows", async ({ page }) => {
      await page.goto("./");
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));
      await shoot(page, "settings", scheme);
    });

    test("the appearance dialog", async ({ page }) => {
      await page.goto("./");
      await page.getByRole("button", { name: "Appearance" }).click();
      await expect(page.getByRole("dialog", { name: "Appearance" })).toBeVisible();
      await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));
      await shoot(page, "appearance", scheme);
    });

    test("the resign confirmation", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "This device" });
      await page.getByRole("button", { name: "Resign" }).click();
      await expect(page.getByRole("dialog", { name: "Resign this game?" })).toBeVisible();
      await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));
      await shoot(page, "resign", scheme);
    });

    test("the update bar", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
      // before the migration the bar is offered through the module; after it, through the window event
      await page.evaluate(async () => {
        const url = "./js/ui/update-bar.js";
        const old = await fetch(url).then((r) => r.ok).catch(() => false);
        if (old) {
          const mod = await import(url);
          mod.offerUpdate(document.getElementById("update-bar")!, { postMessage() {} });
        } else {
          window.dispatchEvent(new CustomEvent("ttt:update-ready", { detail: { postMessage() {} } }));
        }
      });
      await expect(page.locator("#update-bar")).toContainText("A new version is ready.");
      await shoot(page, "update-bar", scheme);
    });

    test("the host's waiting screen", async ({ browser, relay }) => {
      const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: scheme, reducedMotion: "reduce", serviceWorkers: "block" });
      await relay.attach(context);
      const page = await context.newPage();
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
      await fix(page);
      await page.goto("./");
      await choose(page, "Local network");
      await page.evaluate(() => (window as unknown as { restartRandom: () => void }).restartRandom());
      await page.getByRole("button", { name: "Host game" }).click();
      await expect(page.locator("#join-code-display")).toBeVisible();
      await shoot(page, "host-waiting", scheme);
    });
  });
}
