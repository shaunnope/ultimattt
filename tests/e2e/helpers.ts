import { expect, type Page } from "@playwright/test";

/** Pick a card on the start screen by the bold line of its label. */
export async function choose(page: Page, title: string): Promise<void> {
  await page.locator("label", { has: page.locator("strong", { hasText: new RegExp(`^${title}$`) }) }).click();
}

export type Variant = "Classic" | "Ultimate" | "Cube";

export interface StartOptions {
  variant: Variant;
  opponent: "Computer" | "A friend on this device";
  size?: "3×3" | "4×4" | "5×5";
  /** Cells in a row that win; only for sizes above 3×3 */
  winLength?: 3 | 4 | 5;
  level?: string;
  mark?: "X" | "O";
}

export async function startGame(page: Page, opts: StartOptions, url = "./"): Promise<void> {
  await page.goto(url);
  // The app reopens a game left in progress; leave it to reach the start screen.
  const start = page.getByRole("button", { name: "Start game" });
  const leave = page.getByRole("button", { name: "New game" });
  await expect(start.or(leave)).toBeVisible();
  if (await leave.isVisible()) await leave.click();
  await choose(page, opts.variant);
  if (opts.opponent === "Computer" || opts.variant !== "Cube") await choose(page, opts.opponent);
  if (opts.size) await choose(page, opts.size);
  if (opts.winLength) await choose(page, String(opts.winLength));
  if (opts.opponent === "Computer") {
    if (opts.level) await page.locator("#level").selectOption({ label: opts.level });
    await choose(page, opts.mark ?? "X");
  }
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board, .cube-board").first()).toBeVisible();
}

export const confirmTurnButton = (page: Page) => page.getByRole("button", { name: "Confirm turn" });

/** Pick a Cube layer turn by its accessible name, wait for the preview, and confirm it. */
export async function turnLayer(page: Page, label: string, how: "click" | "tap" = "click"): Promise<void> {
  const button = page.getByRole("group", { name: "Turn a layer" }).getByRole("button", { name: label, exact: true });
  if (how === "tap") await button.tap();
  else await button.click();
  await expect(confirmTurnButton(page)).toBeEnabled();
  if (how === "tap") await confirmTurnButton(page).tap();
  else await confirmTurnButton(page).click();
}
