import { test, expect, type Page } from "@playwright/test";
import { choose } from "./helpers.ts";

// UI contract used by these tests (spec 008, contracts C4):
//  - the start screen has #seed-input while the opponent is the computer in Classic or Ultimate; its placeholder is a real seed
//    that follows the chosen variant, board size and win length, and an empty box plays that seed
//  - any text in the box starts a game: there is no #seed-error. #seed-note ("This plays as <seed>.") shows the seed that will
//    be played whenever it differs from what was typed
//  - the game shows the seed it plays in #game-seed ("Seed: <seed>")

const SEED = "[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}";
const seedFormat = (prefix: string) => new RegExp(`^${prefix}-${SEED}$`);

const input = (page: Page) => page.locator("#seed-input");
const note = (page: Page) => page.locator("#seed-note");

async function openStart(page: Page): Promise<void> {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
}

async function seedPlayed(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board").first()).toBeVisible();
  return ((await page.locator("#game-seed").innerText()).replace(/^Seed:\s*/, "")).trim();
}

const JUNK: [string, string][] = [
  ["a plain word", "nope"],
  ["another word", "banana"],
  ["accents and Chinese", "héllo wörld 你好"],
  ["an emoji", "😀"],
  ["a seed with a banned letter", "C33-AXK4-M9TR"],
  ["a seed that is too short", "C33-BXK4-M9"],
  ["5,000 characters", "x".repeat(5000)],
];

for (const [name, text] of JUNK) {
  test(`${name} in the seed box starts a game with a valid seed and no error`, async ({ page }) => {
    await openStart(page);
    await input(page).fill(text);
    await expect(page.locator("#seed-error")).toHaveCount(0);
    await expect(input(page)).toHaveAttribute("aria-invalid", "false");
    await expect(note(page)).toBeVisible();
    const promised = /This plays as (\S+)\./.exec(await note(page).innerText())?.[1];
    expect(promised).toMatch(seedFormat("C33"));
    expect(await seedPlayed(page)).toBe(promised);
  });
}

test("the same text gives the same seed every time, and different text gives a different one", async ({ page }) => {
  const played = async (text: string) => {
    await openStart(page);
    await input(page).fill(text);
    const seed = await seedPlayed(page);
    await page.getByRole("button", { name: "New game" }).click();
    return seed;
  };
  const a = await played("banana");
  expect(await played("banana")).toBe(a);
  expect(await played("BANANA")).toBe(a);
  expect(await played("b-a-n-a-n-a")).toBe(a);
  expect(await played("bananas")).not.toBe(a);
});

test("separator-only text counts as blank: no note, and the placeholder is played", async ({ page }) => {
  await openStart(page);
  const placeholder = (await input(page).getAttribute("placeholder"))!;
  await input(page).fill("---");
  await expect(note(page)).toBeHidden();
  expect(await seedPlayed(page)).toBe(placeholder);
});

test("typing text and then deleting it all hides the note, keeps the placeholder and plays it", async ({ page }) => {
  await openStart(page);
  const placeholder = (await input(page).getAttribute("placeholder"))!;
  await input(page).fill("banana");
  await expect(note(page)).toBeVisible();
  await input(page).fill("");
  await expect(note(page)).toBeHidden();
  await expect(input(page)).toHaveAttribute("placeholder", placeholder);
  expect(await seedPlayed(page)).toBe(placeholder);
});

test("an empty box shows a real seed as its placeholder and plays exactly that seed",async ({ page }) => {
  await openStart(page);
  const placeholder = await input(page).getAttribute("placeholder");
  expect(placeholder).toMatch(seedFormat("C33"));
  await expect(input(page)).toHaveValue("");
  await expect(note(page)).toBeHidden();
  expect(await seedPlayed(page)).toBe(placeholder);
});

test("the placeholder follows the board size and win length, and ignores the level and the mark", async ({ page }) => {
  await openStart(page);
  const first = (await input(page).getAttribute("placeholder"))!;
  await page.locator("#level").selectOption({ label: "5. Master" });
  await choose(page, "O");
  await expect(input(page)).toHaveAttribute("placeholder", first);

  await choose(page, "5×5");
  const five = (await input(page).getAttribute("placeholder"))!;
  expect(five).toMatch(seedFormat("C54"));
  await choose(page, "3");
  const fiveThree = (await input(page).getAttribute("placeholder"))!;
  expect(fiveThree).toMatch(seedFormat("C53"));
  expect(fiveThree).not.toBe(five);

  await choose(page, "Ultimate");
  expect(await input(page).getAttribute("placeholder")).toMatch(seedFormat("U53"));
  expect(await seedPlayed(page)).toMatch(seedFormat("U53"));
});

test("the placeholder is made again when the screen is loaded again", async ({ page }) => {
  const seen = new Set<string>();
  for (let i = 0; i < 4; i++) {
    await openStart(page);
    seen.add((await input(page).getAttribute("placeholder"))!);
  }
  expect(seen.size).toBeGreaterThan(1);
});

test("changing the board size discards typed text and brings the placeholder back", async ({ page }) => {
  await openStart(page);
  await input(page).fill("banana");
  await expect(note(page)).toBeVisible();
  await choose(page, "4×4");
  await expect(input(page)).toHaveValue("");
  await expect(note(page)).toBeHidden();
  expect(await input(page).getAttribute("placeholder")).toMatch(seedFormat("C44"));
});

const SPELLINGS = ["C53-BXK4-M9TR", "c53-bxk4-m9tr", "C53BXK4M9TR", " C53 BXK4 M9TR ", "c53–bxk4–m9tr", "C53_BXK4_M9TR"];

for (const text of SPELLINGS) {
  test(`the seed spelled ${JSON.stringify(text)} starts C53-BXK4-M9TR`, async ({ page }) => {
    await openStart(page);
    await input(page).fill(text);
    await expect(page.locator("input#size-5")).toBeChecked();
    if (text === "C53-BXK4-M9TR") await expect(note(page)).toBeHidden();
    else {
      await expect(note(page)).toHaveText("This plays as C53-BXK4-M9TR.");
    }
    expect(await seedPlayed(page)).toBe("C53-BXK4-M9TR");
  });
}

test("a legacy seed keeps its own prefix in any spelling", async ({ page }) => {
  await openStart(page);
  await input(page).fill("3x3-bxk4-m9tr");
  await expect(note(page)).toHaveText("This plays as 3X3-BXK4-M9TR.");
  expect(await seedPlayed(page)).toBe("3X3-BXK4-M9TR");
});

// the same seed, level, mark and human moves give the same computer replies, however the seed was typed
async function playedBoard(page: Page, text: string): Promise<{ seed: string; board: string }> {
  await openStart(page);
  await choose(page, "5×5");
  await page.locator("#level").selectOption({ label: "5. Master" });
  await choose(page, "O");
  await input(page).fill(text);
  const seed = await seedPlayed(page);
  const marks = page.locator("button.cell:has(.mark)");
  await expect(marks).toHaveCount(1, { timeout: 15000 }); // the computer, as X, opens
  for (let n = 1; n < 5; n += 2) {
    await page.locator("button.cell:not(:has(.mark))").first().click();
    await expect(marks).toHaveCount(n + 2, { timeout: 15000 });
  }
  const board = (await marks.evaluateAll((els) => els.map((e) => `${e.getAttribute("data-cell")}${e.getAttribute("data-mark")}`))).join(",");
  await page.getByRole("button", { name: "New game" }).click();
  return { seed, board };
}

test("a seed made from text, entered again as shown in another spelling, plays the same computer moves", async ({ page }) => {
  const first = await playedBoard(page, "banana");
  expect(first.seed).toMatch(seedFormat("C54"));
  const again = await playedBoard(page, first.seed.toLowerCase().replaceAll("-", ""));
  expect(again.seed).toBe(first.seed);
  expect(again.board).toBe(first.board);
  const spaced = await playedBoard(page, ` ${first.seed.replaceAll("-", " ")} `);
  expect(spaced.board).toBe(first.board);
  const other = await playedBoard(page, "a different seed");
  expect(other.seed).not.toBe(first.seed);
});

test("a seed sets the variant, board size and win length on the screen", async ({ page }) => {
  await openStart(page);
  await input(page).fill("U54-BXK4-M9TR");
  await expect(page.locator("input#variant-ultimate")).toBeChecked();
  await expect(page.locator("input#size-5")).toBeChecked();
  await expect(page.locator("input#winlength-4")).toBeChecked();
  await expect(note(page)).toBeHidden();
  expect(await seedPlayed(page)).toBe("U54-BXK4-M9TR");
});

test("eight good characters keep the choices on the screen and take their rules code", async ({ page }) => {
  await openStart(page);
  await choose(page, "Ultimate");
  await choose(page, "4×4");
  await input(page).fill("BXK4M9TR");
  await expect(page.locator("input#variant-ultimate")).toBeChecked();
  await expect(page.locator("input#size-4")).toBeChecked();
  await expect(note(page)).toHaveText("This plays as U44-BXK4-M9TR.");
  expect(await seedPlayed(page)).toBe("U44-BXK4-M9TR");
});

test("a good eight after an unknown rules part also keeps the choices", async ({ page }) => {
  await openStart(page);
  await choose(page, "4×4");
  await input(page).fill("XYZ-BXK4-M9TR");
  await expect(page.locator("input#size-4")).toBeChecked();
  await expect(page.locator("input#variant-classic")).toBeChecked();
  await expect(note(page)).toHaveText("This plays as C44-BXK4-M9TR.");
  expect(await seedPlayed(page)).toBe("C44-BXK4-M9TR");
});
