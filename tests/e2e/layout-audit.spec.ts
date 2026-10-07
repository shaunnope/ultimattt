import { test as base, expect, type Page } from "@playwright/test";
import { startGame, choose } from "./helpers.ts";
import { Relay } from "./relay.ts";
import { auditAtWidths, auditPage } from "./audit.ts";

// The design spec's measurable rules (tests/e2e/audit.ts) on every screen, at 320, 480 and 720px wide, in both modes,
// plus how dialogs behave (docs/pwa-design-spec.md section 8, "Modal / sheet"; contracts/ui-contracts.md).
// UI contract used by these tests:
//  - dialogs have a "Close" icon button, close on Escape and on a click on the backdrop, and lock page scroll
//    while open (body.modal-open)
//  - under 640px a dialog is a bottom sheet; from 640px it is centred

const test = base.extend<{ relay: Relay }>({
  relay: async ({}, use) => {
    const relay = new Relay();
    await use(relay);
    await relay.closeAll();
  },
});

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "the audit resizes the window itself; one project is enough");
});

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test("start screen", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
      await auditAtWidths(page, "start screen");
    });

    test("start screen with the opponent set to another device", async ({ page }) => {
      await page.goto("./");
      await choose(page, "A friend on another device");
      await expect(page.getByRole("button", { name: "Host game" })).toBeVisible();
      await auditAtWidths(page, "start screen, two devices");
    });

    test("start screen with the Twist rules and with a seed field", async ({ page }) => {
      await page.goto("./");
      await expect(page.locator("#seed-card")).toBeVisible();
      await auditAtWidths(page, "start screen, seed field");
      await choose(page, "Twist");
      await expect(page.locator("#cube-options")).toBeVisible();
      await auditAtWidths(page, "start screen, Twist rules");
    });

    test("start screen offline: two-device play says what to do", async ({ page, context }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible(); // the app boots after the load event
      await context.setOffline(true);
      await expect(page.locator(".banner", { hasText: "You are offline." })).toBeVisible();
      await auditAtWidths(page, "start screen offline");
      await context.setOffline(false);
    });

    test("a Classic game", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
      await cell(page, 4).click();
      await auditAtWidths(page, "classic game");
    });

    test("a 5x5 Classic game", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device", size: "5×5", winLength: 4 });
      await auditAtWidths(page, "classic 5x5 game");
    });

    test("an Ultimate game", async ({ page }) => {
      await startGame(page, { variant: "Ultimate", opponent: "A friend on this device" });
      await auditAtWidths(page, "ultimate game");
    });

    test("a Twist game", async ({ page }) => {
      await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
      await auditAtWidths(page, "twist game");
    });

    test("a game against the computer", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "Computer" });
      await auditAtWidths(page, "computer game");
    });

    test("help", async ({ page }) => {
      await page.goto("./#/help");
      await expect(page.locator("#help-view")).toBeVisible();
      await auditAtWidths(page, "help");
    });

    test("the result dialog, the finished game and its replay", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
      for (const c of [0, 3, 1, 4, 2]) await cell(page, c).click();
      const result = page.getByRole("dialog");
      await expect(result).toBeVisible();
      await auditAtWidths(page, "result dialog");
      await result.getByRole("button", { name: "Watch replay" }).click();
      await expect(page.getByRole("group", { name: "Replay controls" })).toBeVisible();
      await auditAtWidths(page, "replay");
      await page.getByRole("button", { name: "Close" }).click();
      await expect(page.getByRole("button", { name: "Share replay" })).toBeVisible();
      await auditAtWidths(page, "finished game");
    });

    test("Settings, Appearance and the resign confirmation", async ({ page }) => {
      await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
      await auditAtWidths(page, "settings dialog");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Appearance" }).click();
      await expect(page.getByRole("dialog", { name: "Appearance" })).toBeVisible();
      await auditAtWidths(page, "appearance dialog");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Resign" }).click();
      await expect(page.getByRole("dialog", { name: "Resign this game?" })).toBeVisible();
      await auditAtWidths(page, "resign dialog");
    });

    test("the update bar", async ({ page }) => {
      await page.goto("./");
      await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("ttt:update-ready", { detail: { postMessage() {} } })));
      await expect(page.locator("#update-bar")).toContainText("A new version is ready.");
      await auditAtWidths(page, "update bar");
    });

    test("the host's waiting screen", async ({ browser, relay }) => {
      const { page } = await relay.device(browser, { colorScheme: scheme });
      await page.goto("./");
      await choose(page, "A friend on another device");
      await page.getByRole("button", { name: "Host game" }).click();
      await expect(page.locator("#join-code-display")).toBeVisible();
      await auditAtWidths(page, "waiting screen");
    });
  });
}

// ---- the audit itself must be able to fail ----

test("the audit catches a small target, a second primary button, glass on glass, a stray font and tiny text", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "audit-probe";
    host.innerHTML = [
      '<button id="probe-small" style="width:20px;height:20px;padding:0">x</button>',
      '<button class="btn btn-primary" id="probe-primary">Second primary</button>',
      '<div class="glass"><div class="glass" id="probe-glass">nested</div></div>',
      '<p id="probe-font" style="font-family:monospace">mono</p>',
      '<p id="probe-tiny" style="font-size:10px">tiny</p>',
    ].join("");
    document.getElementById("main")!.append(host);
  });
  const problems = (await auditPage(page)).join(" | ");
  expect(problems).toMatch(/hit area under 44px: button#probe-small/);
  expect(problems).toMatch(/primary buttons in one view/);
  expect(problems).toMatch(/glass on glass/);
  expect(problems).toMatch(/font-family/);
  expect(problems).toMatch(/text 10px/);
});

// ---- dialogs ----

test.describe("dialogs", () => {
  async function openResign(page: Page) {
    await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
    await page.getByRole("button", { name: "Resign" }).click();
    const dialog = page.getByRole("dialog", { name: "Resign this game?" });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test("under 640px a dialog is a bottom sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const dialog = await openResign(page);
    await expect.poll(async () => {
      const box = (await dialog.boundingBox())!;
      return 800 - (box.y + box.height);
    }).toBeLessThanOrEqual(16);
    const box = (await dialog.boundingBox())!;
    expect(box.y).toBeGreaterThan(200); // a small dialog sits low, not in the middle
  });

  test("from 640px a dialog is centred", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    const dialog = await openResign(page);
    await expect.poll(async () => {
      const box = (await dialog.boundingBox())!;
      return Math.abs(box.y + box.height / 2 - 400);
    }).toBeLessThan(40);
    const box = (await dialog.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - 450)).toBeLessThan(2);
    expect(box.width).toBeLessThanOrEqual(420 + 2);
  });

  test("a dialog closes by its Close button", async ({ page }) => {
    const dialog = await openResign(page);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("a dialog closes on Escape", async ({ page }) => {
    const dialog = await openResign(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("a dialog closes on a click on the backdrop", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    const dialog = await openResign(page);
    await page.mouse.click(5, 5);
    await expect(dialog).toHaveCount(0);
  });

  test("a click inside the dialog does not close it", async ({ page }) => {
    const dialog = await openResign(page);
    await dialog.getByRole("heading", { name: "Resign this game?" }).click();
    await expect(dialog).toBeVisible();
  });

  test("page scroll is locked while a dialog is open, and free again after", async ({ page }) => {
    const dialog = await openResign(page);
    await expect(page.locator("body")).toHaveClass(/modal-open/);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/modal-open/);
  });

  test("a dialog opens and closes with a short transition", async ({ page }) => {
    const dialog = await openResign(page);
    const timing = await dialog.evaluate((el) => {
      const s = getComputedStyle(el);
      return { duration: s.transitionDuration, property: s.transitionProperty };
    });
    const longest = Math.max(...timing.duration.split(",").map((d) => (d.trim().endsWith("ms") ? parseFloat(d) : parseFloat(d) * 1000)));
    expect(longest).toBeGreaterThanOrEqual(150);
    expect(longest).toBeLessThanOrEqual(220);
  });
});
