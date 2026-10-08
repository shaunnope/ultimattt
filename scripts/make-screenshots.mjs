// Takes the screenshots listed in the manifest (static/screenshots/) from the running app.
//   node scripts/make-screenshots.mjs
// A narrow one (1080x2340, a phone) and a wide one (1920x1080, a desktop). Run it when the look changes,
// then bump VERSION in src/sw.ts so installed copies pick the new files up (the Twist game is chosen by its name on the setup card).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { startStaticServer } from "./lib/serve.mjs";

const root = process.cwd();
mkdirSync("static/screenshots", { recursive: true });
const server = await startStaticServer(join(root, "build"), 0);
try {
  const browser = await chromium.launch();
  const url = server.url;
  const choose = (page, title) => page.locator("label", { has: page.locator("strong", { hasText: new RegExp(`^${title}$`) }) }).click();

  // narrow: a Twist game, one line scored, in 3D
  const phone = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await phone.goto(url);
  await choose(phone, "Twist");
  await phone.getByRole("button", { name: "Start game" }).click();
  for (const [f, c] of [[2, 0], [0, 0], [2, 1], [0, 4], [2, 2]]) await phone.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`).dispatchEvent("click");
  await phone.waitForTimeout(600);
  await phone.screenshot({ path: "static/screenshots/screen-narrow.png" });

  // wide: an Ultimate game with a board claimed
  const desktop = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await desktop.goto(url);
  await choose(desktop, "Ultimate");
  await choose(desktop, "This device");
  await desktop.getByRole("button", { name: "Start game" }).click();
  for (const [b, c] of [[0, 0], [0, 4], [4, 0], [0, 3], [3, 0], [0, 5], [5, 0], [8, 8], [8, 4]]) {
    await desktop.locator(`button[data-board="${b}"][data-cell="${c}"]`).click();
  }
  await desktop.waitForTimeout(600);
  await desktop.screenshot({ path: "static/screenshots/screen-wide.png" });
  await browser.close();
  console.log("screenshots written to static/screenshots");
} finally {
  await server.stop();
}
process.exit(0);
