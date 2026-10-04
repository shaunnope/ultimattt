import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// SC-010: what 001 wrote still opens. Fixtures in tests/fixtures/001 were captured from the 001 code.
const dir = join(import.meta.dirname, "..", "fixtures", "001");
const read = <T>(name: string): T => JSON.parse(readFileSync(join(dir, name), "utf8")) as T;

const saves: { file: string; board: string }[] = [
  { file: "save-classic3.json", board: ".board" },
  { file: "save-classic5.json", board: ".board" },
  { file: "save-ultimate.json", board: ".ultimate" },
  { file: "save-cube.json", board: ".cube-board" },
  { file: "save-icons.json", board: ".board" },
];

for (const { file, board } of saves) {
  test(`a 001 save opens and plays on: ${file}`, async ({ page }) => {
    const text = readFileSync(join(dir, file), "utf8");
    await page.goto("./");
    await page.evaluate((save) => localStorage.setItem("ttt.save", save), text);
    await page.reload();
    await expect(page.locator(board).first()).toBeVisible();
    await expect(page.locator("#toasts")).not.toContainText(/could not be read/i);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("ttt.save")))!).schema).toBe(2);
  });
}

test("every 001 replay link opens and shows the recorded number of moves", async ({ page }) => {
  for (const { name, link, moveCount } of read<{ name: string; link: string; moveCount: number }[]>("links.json")) {
    await page.goto(`./${link}`);
    await expect(page.getByRole("group", { name: "Replay controls" }), name).toBeVisible();
    await expect(page.getByRole("list", { name: "Moves" }).getByRole("listitem"), name).toHaveCount(moveCount);
  }
});

test("every 001 seed is accepted on the start screen with the rules it implied", async ({ page }) => {
  const expected: Record<string, { variant: string; size: string }> = {
    "3X3": { variant: "classic", size: "3" }, "4X4": { variant: "classic", size: "4" }, "5X5": { variant: "classic", size: "5" },
    ULT: { variant: "ultimate", size: "3" }, CUB: { variant: "cube", size: "3" },
  };
  for (const { seed, legacyWinLength } of read<{ seed: string; legacyWinLength: number }[]>("seeds.json")) {
    await page.goto("./");
    await page.locator("#seed-input").fill(seed);
    const want = expected[seed.slice(0, 3)]!;
    await expect(page.locator(`input#variant-${want.variant}`), seed).toBeChecked();
    await expect(page.locator(`input#size-${want.size}`), seed).toBeChecked();
    if (want.size !== "3") await expect(page.locator(`input#winlength-${legacyWinLength}`), seed).toBeChecked();
  }
});
