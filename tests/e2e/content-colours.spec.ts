import { test, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";
import { PALETTES, markColors } from "../../src/core/palette.ts";

// Content colours are drawn exactly (docs/pwa-design-spec.md sections 1 and 2.5): X and O take the chosen palette's
// colour for the mode with no tint or opacity; neighbouring content is separated by a seam in the page colour; what
// a colour says is also said by a shape or pattern.

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "colours do not differ between the two projects");
});

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);

const rgb = (hex: string) => {
  const n = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `rgb(${n(1)}, ${n(3)}, ${n(5)})`;
};

async function choosePalette(page: Page, label: string) {
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel(label).check({ force: true });
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
}

/** The colour the page uses for a token, as the browser computes it. */
const tokenColour = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.cssText = `position:absolute;visibility:hidden;background-color:var(${name})`;
    document.documentElement.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, token);

/** The rim colour as a border colour, the way the browser computes it. */
const rimColour = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;border:2px solid var(--rim)";
    document.documentElement.append(probe);
    const colour = getComputedStyle(probe).borderTopColor;
    probe.remove();
    return colour;
  });

for (const scheme of ["light", "dark"] as const) {
  for (const palette of PALETTES) {
    test(`${palette.label} in ${scheme} mode: X and O are exactly the palette's colours, with no opacity`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("./");
      await choosePalette(page, palette.label);
      await startGame(page, { variant: "Classic", opponent: "This device" });
      await cell(page, 0).click();
      await cell(page, 1).click();
      const { X, O } = markColors(palette.id, scheme);
      const read = (selector: string) =>
        page.evaluate((sel) => {
          const mark = document.querySelector(sel)!;
          let opacity = 1;
          for (let el: Element | null = mark; el && el !== document.documentElement; el = el.parentElement) opacity *= parseFloat(getComputedStyle(el).opacity);
          return { stroke: getComputedStyle(mark).stroke, opacity };
        }, selector);
      const x = await read('[data-cell="0"] svg.mark-x');
      const o = await read('[data-cell="1"] svg.mark-o');
      expect(x.stroke).toBe(rgb(X));
      expect(o.stroke).toBe(rgb(O));
      expect(x.opacity).toBe(1);
      expect(o.opacity).toBe(1);
    });
  }
}

test("small boards of an Ultimate game are separated by a seam in the page colour", async ({ page }) => {
  await startGame(page, { variant: "Ultimate", opponent: "This device" });
  const seam = await tokenColour(page, "--seam");
  const page_ = await tokenColour(page, "--page");
  expect(seam).toBe(page_);
  const grid = await page.locator(".ultimate").evaluate((el) => {
    const s = getComputedStyle(el);
    return { gap: parseFloat(s.columnGap), background: s.backgroundColor };
  });
  expect(grid.gap).toBeGreaterThanOrEqual(2);
  expect(grid.background).toBe(seam);
});

test("a claimed small board shows its owner by a large mark and a ring, not by colour alone", async ({ page }) => {
  await startGame(page, { variant: "Ultimate", opponent: "This device" });
  for (const [b, c] of [[0, 0], [0, 4], [4, 0], [0, 3], [3, 0], [0, 5], [5, 0]] as [number, number][]) {
    await page.locator(`button[data-board="${b}"][data-cell="${c}"]`).click();
  }
  const claimed = page.locator('.sub-board[data-board="0"]');
  await expect(claimed).toHaveAttribute("data-claim", "O");
  await expect(claimed).toHaveAttribute("aria-label", /won by O/);
  await expect(claimed.locator(".claim-overlay svg.mark-o")).toBeVisible();
  const ring = await claimed.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).not.toBe("none");
  // the rim: a 1.5px border in the edge colour (a 1x screen draws it as one device pixel)
  const border = await claimed.evaluate((el) => ({ width: parseFloat(getComputedStyle(el).borderTopWidth), colour: getComputedStyle(el).borderTopColor }));
  expect(border.width).toBeGreaterThanOrEqual(1);
  expect(border.colour).toBe(await rimColour(page));
});

test("Twist faces are drawn in their own colours, seamed and rimmed, and a face in a line is also hatched", async ({ page }) => {
  await startGame(page, { variant: "Twist", opponent: "This device" });
  await page.getByRole("button", { name: "Flat view" }).click();
  const flat = page.locator(".cube-flat");
  await expect(flat).toBeVisible();
  const face0 = await tokenColour(page, "--face-0");
  const seam = await tokenColour(page, "--seam");
  const rim = await rimColour(page);
  const sticker = await page.locator('button.sticker[data-face="0"]').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, border: parseFloat(s.borderTopWidth), borderColour: s.borderTopColor, opacity: s.opacity };
  });
  expect(sticker.background).toBe(face0);
  expect(sticker.opacity).toBe("1");
  expect(sticker.border).toBeGreaterThanOrEqual(1.5);
  expect(sticker.borderColour).toBe(rim);
  const grid = await flat.evaluate((el) => {
    const s = getComputedStyle(el);
    return { gap: parseFloat(s.columnGap), background: s.backgroundColor };
  });
  expect(grid.gap).toBeGreaterThanOrEqual(2);
  expect(grid.background).toBe(seam);
});
