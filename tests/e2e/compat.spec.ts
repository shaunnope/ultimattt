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
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("ttt.save")))!).schema).toBe(3);
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

// 003: what 002 wrote still opens, with lines scoring and no lock. Fixtures in tests/fixtures/002.
const dir2 = join(import.meta.dirname, "..", "fixtures", "002");
const read2 = <T>(name: string): T => JSON.parse(readFileSync(join(dir2, name), "utf8")) as T;

test("a schema 2 save with a Cube game opens as lines with no lock, and is written back as schema 3", async ({ page }) => {
  const text = readFileSync(join(dir2, "save-cube.json"), "utf8");
  await page.goto("./");
  await page.evaluate((save) => localStorage.setItem("ttt.save", save), text);
  await page.reload();
  await expect(page.locator(".cube-board")).toBeVisible();
  await expect(page.locator("#toasts")).not.toContainText(/could not be read/i);
  await expect(page.locator("#cube-score")).toContainText("Lines");
  await expect(page.locator('button.sticker[data-locked="true"]')).toHaveCount(0);
  await expect(page.locator("#game-title")).not.toContainText(/locked|faces scoring/);
  await page.locator("button.sticker").first().dispatchEvent("click"); // any move makes the app write the save back
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem("ttt.save")))!);
  expect(saved.schema).toBe(3);
  expect(saved.game.config.scoring).toBe("lines");
  expect(saved.game.config.lockFaces).toBe(false);
});

test("a schema 2 remembered setup opens the start screen with the Cube options off", async ({ page }) => {
  const text = readFileSync(join(dir2, "save-setup.json"), "utf8");
  await page.goto("./");
  await page.evaluate((save) => localStorage.setItem("ttt.save", save), text);
  await page.reload();
  await expect(page.locator("input#variant-cube")).toBeChecked();
  await expect(page.locator("input#size-4")).toBeChecked();
  await expect(page.locator("input#winlength-3")).toBeChecked();
  await expect(page.locator("#opt-lock")).not.toBeChecked();
  await expect(page.locator("#opt-faces")).not.toBeChecked();
});

test("002 replay links (rules=B33, rules=U43) still replay", async ({ page }) => {
  for (const { name, link } of read2<{ name: string; link: string }[]>("links.json")) {
    await page.goto(`./${link}`);
    await expect(page.getByRole("group", { name: "Replay controls" }), name).toBeVisible();
    await expect(page.getByRole("list", { name: "Moves" }).getByRole("listitem"), name).toHaveCount(name.startsWith("cube") ? 1 : 2);
  }
  await page.goto(`./${read2<{ link: string }[]>("links.json")[0]!.link}`);
  await expect(page.locator("#cube-score")).toContainText("Lines");
});
