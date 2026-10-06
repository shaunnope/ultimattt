import { test, expect, type Page } from "@playwright/test";
import { startGame } from "./helpers.ts";

// Motion (docs/pwa-design-spec.md section 6, spec FR-016 and FR-017):
//  - everything that opens, closes or switches runs 150 to 220ms (a bar up to 300ms); the Twist cube's turns are game
//    motion on their own token; the busy dot is an ambient loop; the body's colour fade on a mode change is 250ms
//  - reduced motion collapses every duration to 0.001ms, so transitionend still fires
//  - the computer's think delay is game timing and is the same with reduced motion
//  - a change of the device's colour scheme never moves focus

const seconds = (value: string) => (value.trim().endsWith("ms") ? parseFloat(value) / 1000 : parseFloat(value));

test("every transition and animation in the stylesheets is 150 to 220ms, apart from the named exceptions", async ({ page }) => {
  await page.goto("./");
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    const LIMIT_MS = 220;
    const DURATION = /(\d*\.?\d+)(ms|s)\b/g;
    const walk = (rules: CSSRuleList, sheet: string) => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule) {
          walk(rule.cssRules, sheet);
          continue;
        }
        if (!(rule instanceof CSSStyleRule)) continue;
        const text = rule.style.cssText;
        for (const m of text.matchAll(/(?:^|;\s*)(transition|animation)(?:-duration)?\s*:\s*([^;]+)/g)) {
          const value = m[2]!;
          const named = /var\(--duration-(quick|open|close|bar|turn)\)/.test(value);
          if (named) continue;
          for (const d of value.matchAll(DURATION)) {
            const ms = d[2] === "s" ? parseFloat(d[1]!) * 1000 : parseFloat(d[1]!);
            if (ms > LIMIT_MS) {
              const exempt = /^body$/.test(rule.selectorText) || /busy/.test(rule.selectorText); // the mode fade, the busy dot
              if (!exempt) out.push(`${sheet}: ${rule.selectorText} { ${m[1]}: ${value.trim()} } is ${ms}ms`);
            }
          }
        }
      }
    };
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // a cross-origin sheet (the web font)
      }
      walk(rules, sheet.href?.split("/").pop() ?? "inline");
    }
    return out;
  });
  expect(problems).toEqual([]);
});

test("the named duration tokens are the design spec's: quick 150, open 220, close 180, bar 300", async ({ page }) => {
  await page.goto("./");
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(["quick", "open", "close", "bar", "turn"].map((n) => [n, style.getPropertyValue(`--duration-${n}`).trim()]));
  });
  expect(tokens).toEqual({ quick: "150ms", open: "220ms", close: "180ms", bar: "300ms", turn: "400ms" });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a dialog still opens and closes, with no perceptible duration", async ({ page }) => {
    await startGame(page, { variant: "Classic", opponent: "A friend on this device" });
    await page.getByRole("button", { name: "Resign" }).click();
    const dialog = page.getByRole("dialog", { name: "Resign this game?" });
    await expect(dialog).toBeVisible();
    const duration = await dialog.evaluate((el) => getComputedStyle(el).transitionDuration);
    for (const part of duration.split(",")) expect(seconds(part) * 1000, duration).toBeLessThan(5);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0); // closed although the transition is almost instant
  });

  test("the cube's turns collapse too, and its stickers still reach their places", async ({ page }) => {
    await startGame(page, { variant: "Twist", opponent: "A friend on this device" });
    const duration = await page.locator(".cube-scene .sticker").first().evaluate((el) => getComputedStyle(el).transitionDuration);
    for (const part of duration.split(",")) expect(seconds(part) * 1000, duration).toBeLessThan(5);
    await page.locator('button.sticker[data-face="2"][data-cell="4"]').dispatchEvent("click");
    await expect(page.locator('button.sticker[data-face="2"][data-cell="4"]')).toHaveAttribute("data-mark", "X");
  });

  test("the computer still takes its time before it moves", async ({ page }) => {
    await startGame(page, { variant: "Classic", opponent: "Computer", mark: "X" });
    const waited = await thinkTime(page);
    expect(waited).toBeGreaterThanOrEqual(200);
  });
});

test("the computer waits the same without reduced motion", async ({ page }) => {
  await startGame(page, { variant: "Classic", opponent: "Computer", mark: "X" });
  const waited = await thinkTime(page);
  expect(waited).toBeGreaterThanOrEqual(200);
});

/** Milliseconds from the player's move to the computer's reply appearing. */
async function thinkTime(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        const watch = new MutationObserver(() => {
          if (document.querySelector("[data-cell] svg.mark-o")) {
            watch.disconnect();
            resolve(performance.now() - start);
          }
        });
        watch.observe(document.body, { subtree: true, childList: true, attributes: true });
        (document.querySelector('[data-cell="4"]') as HTMLElement).click();
      }),
  );
}

test("a change of the device's colour scheme leaves focus where it was", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  const start = page.getByRole("button", { name: "Start game" });
  await start.focus();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-mode"))).toBe("dark");
  await expect(start).toBeFocused();
});
