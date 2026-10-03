import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { join } from "node:path";
import { choose } from "./helpers.ts";

// Two-device play is tested with two pages of one browser, paired through a stand-in for PeerJS
// (tests/e2e/fake-peerjs.js) so no internet is needed.
//
// UI contract used by these tests:
//  - start screen: opponent "A friend on another device" and a "Host game" button; a "Game code" field
//    (#join-code) with "Join game"
//  - the host's waiting screen shows #join-code-display, a join link with ?join=, a QR code, "Cancel"
//  - during the game: #net-status says Connected or Connection lost; a guest can "Reconnect"
//  - a request to take a move back asks the other player ("Allow" / "Not now")

async function install(context: BrowserContext) {
  await context.route("**/peerjs.min.js", (route) => route.fulfill({ path: join(import.meta.dirname, "fake-peerjs.js"), contentType: "text/javascript" }));
}

type Variant = "Classic" | "Ultimate" | "Cube";

async function host(page: Page, variant: Variant = "Classic", mark: "X" | "O" = "X"): Promise<string> {
  await page.goto("./");
  const leave = page.getByRole("button", { name: "New game" });
  if (await leave.isVisible().catch(() => false)) await leave.click();
  await choose(page, variant);
  await choose(page, "A friend on another device");
  await choose(page, mark);
  await page.getByRole("button", { name: "Host game" }).click();
  const code = (await page.locator("#join-code-display").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  return code;
}

async function joinWith(page: Page, code: string) {
  await page.goto("./");
  await page.locator("#join-code").fill(code);
  await page.getByRole("button", { name: "Join game" }).click();
}

// Extra devices in these tests are pages of the same browser, so they share the host's storage and would
// boot into its saved game. A real second device has its own storage; joining by link skips that.
async function joinByLink(page: Page, code: string) {
  await page.goto(`./?join=${code}`);
}

async function pair(context: BrowserContext, variant: Variant = "Classic", mark: "X" | "O" = "X") {
  await install(context);
  const a = await context.newPage();
  const b = await context.newPage();
  const code = await host(a, variant, mark);
  await joinWith(b, code);
  const board = variant === "Cube" ? ".cube-board" : ".board";
  await expect(a.locator(board).first()).toBeVisible();
  await expect(b.locator(board).first()).toBeVisible();
  return { a, b, code };
}

const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`);
const marks = (page: Page, text: string) => page.locator(`button .mark:text-is("${text}")`);

test("the waiting screen shows the code, a join link and a QR code, and Cancel stops hosting", async ({ context }) => {
  await install(context);
  const page = await context.newPage();
  const code = await host(page);
  await expect(page.getByText(/waiting for a friend/i)).toBeVisible();
  await expect(page.locator(".join-link")).toContainText(`?join=${code}`);
  await expect(page.getByRole("img", { name: /QR code/i })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Join game" })).toBeVisible(); // back at the start screen
  // nobody is hosting any more
  const guest = await context.newPage();
  await joinWith(guest, code);
  await expect(guest.locator("#toasts, .net-error, [role=alert]").first()).toContainText(/nobody is hosting/i);
});

test("host and guest play a Classic game to a result, and both screens agree at every move", async ({ context }) => {
  const { a, b } = await pair(context);
  await expect(a.locator("#game-status")).toContainText(/your move/i);
  await expect(b.locator("#game-status")).toContainText(/waiting for your friend/i);
  const moves: [Page, number][] = [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]];
  for (const [page, c] of moves) {
    await cell(page, c).click();
    await expect(cell(a, c).locator(".mark")).toHaveText(page === a ? "X" : "O");
    await expect(cell(b, c).locator(".mark")).toHaveText(page === a ? "X" : "O");
  }
  for (const page of [a, b]) {
    await expect(page.locator("#game-status")).toContainText("X wins");
    await expect(page.getByRole("dialog")).toContainText("X wins");
  }
});

test("an Ultimate game works across devices, and resigning ends it for both", async ({ context }) => {
  const { a, b } = await pair(context, "Ultimate");
  const sq = (page: Page, board: number, c: number) => page.locator(`button[data-board="${board}"][data-cell="${c}"]`);
  await sq(a, 4, 2).click();
  await expect(sq(b, 4, 2).locator(".mark")).toHaveText("X");
  await expect(b.locator("#game-status")).toContainText(/your move/i);
  await sq(b, 2, 0).click();
  await expect(sq(a, 2, 0).locator(".mark")).toHaveText("O");
  await b.getByRole("button", { name: "Resign" }).click();
  await b.getByRole("button", { name: /confirm/i }).click();
  await expect(a.getByRole("dialog")).toContainText(/resigned|X wins/i);
  await expect(b.getByRole("dialog")).toContainText(/resigned|X wins/i);
});

test("a Cube game works across devices: the scoring player turns a layer before the other can move", async ({ context }) => {
  const { a, b } = await pair(context, "Cube");
  const st = (page: Page, f: number, c: number) => page.locator(`button.sticker[data-face="${f}"][data-cell="${c}"]`);
  const play = async (page: Page, f: number, c: number) => {
    await st(page, f, c).dispatchEvent("click");
    await expect(st(a, f, c)).not.toHaveText("");
    await expect(st(b, f, c)).not.toHaveText("");
  };
  await play(a, 2, 0);
  await play(b, 0, 0);
  await play(a, 2, 1);
  await play(b, 0, 1);
  await play(a, 2, 2); // X scores
  await expect(a.getByRole("group", { name: "Turn a layer" })).toBeVisible();
  await expect(b.getByRole("group", { name: "Turn a layer" })).toBeHidden();
  await b.locator('button.sticker[data-face="1"][data-cell="0"]').dispatchEvent("click");
  await expect(st(a, 1, 0)).toHaveText("");
  await a.getByRole("button", { name: "Turn the bottom layer to the right" }).click();
  await expect(b.locator("#game-status")).toContainText(/your move/i);
  await expect(b.locator("#cube-score")).toContainText("X: 1");
});

test("you cannot move on your friend's turn", async ({ context }) => {
  const { a, b } = await pair(context);
  await cell(b, 4).click();
  await expect(marks(a, "O")).toHaveCount(0);
  await expect(marks(b, "O")).toHaveCount(0);
  await expect(b.locator("#game-status")).toContainText(/friend/i); // "It is your friend's turn."
});

test("taking a move back asks the other player, who can agree or say no", async ({ context }) => {
  const { a, b } = await pair(context);
  await cell(a, 0).click();
  await expect(cell(b, 0).locator(".mark")).toHaveText("X");
  await a.getByRole("button", { name: "Undo" }).click();
  await expect(b.getByRole("dialog")).toContainText(/take back/i);
  await b.getByRole("button", { name: "Not now" }).click();
  await expect(a.locator("#toasts")).toContainText(/said no|declined/i);
  await expect(cell(a, 0).locator(".mark")).toHaveText("X");
  await a.getByRole("button", { name: "Undo" }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Allow" }).click();
  await expect(marks(a, "X")).toHaveCount(0);
  await expect(marks(b, "X")).toHaveCount(0);
  await expect(a.locator("#game-status")).toContainText(/your move/i);
});

test("a lost connection is shown to both, and the guest can reconnect and carry on", async ({ context }) => {
  const { a, b } = await pair(context);
  await cell(a, 0).click();
  await cell(b, 4).click();
  await expect(marks(a, "O")).toHaveCount(1);
  await a.evaluate(() => (window as unknown as { __fakePeer: { drop(): void } }).__fakePeer.drop());
  await expect(a.locator("#net-status")).toContainText(/connection lost/i);
  await expect(b.locator("#net-status")).toContainText(/connection lost/i);
  await b.getByRole("button", { name: "Reconnect" }).click();
  await expect(a.locator("#net-status")).toContainText(/connected/i);
  await expect(b.locator("#net-status")).toContainText(/connected/i);
  await expect(marks(b, "X")).toHaveCount(1);
  await expect(marks(b, "O")).toHaveCount(1);
  await cell(a, 2).click();
  await expect(cell(b, 2).locator(".mark")).toHaveText("X");
});

test("a wrong code is explained, and a third device is told the game is full", async ({ context }) => {
  const { code } = await pair(context);
  const stranger = await context.newPage();
  await joinByLink(stranger, code);
  await expect(stranger.locator("#toasts, .net-error, [role=alert]").first()).toContainText(/already has two players|full/i);
  const lost = await context.newPage();
  await joinByLink(lost, "ZZZZZZ");
  await expect(lost.locator("#toasts, .net-error, [role=alert]").first()).toContainText(/nobody is hosting/i);
});

test("a join link opens the game and joins it by itself", async ({ context }) => {
  await install(context);
  const a = await context.newPage();
  const code = await host(a);
  const b = await context.newPage();
  await b.goto(`./?join=${code}`);
  await expect(b.locator(".board")).toBeVisible();
  await expect(a.locator(".board")).toBeVisible();
});

test("each device shows its own icons", async ({ context }) => {
  const { a, b } = await pair(context);
  await a.getByRole("button", { name: "Settings" }).click();
  const dialog = a.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Icon for X").fill("★");
  await dialog.getByLabel("Icon for O").fill("●");
  await dialog.getByRole("button", { name: "Done" }).click();
  await cell(a, 4).click();
  await expect(marks(a, "★")).toHaveCount(1);
  await expect(marks(b, "X")).toHaveCount(1);
  await expect(marks(b, "★")).toHaveCount(0);
});

test("with no connection the two-device options are unavailable, and the other modes still work", async ({ context }) => {
  await install(context);
  const page = await context.newPage();
  await page.goto("./");
  // after one visit: the page has finished installing, as it would for a player who comes back later
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await expect(page.getByText(/needs an internet connection/i)).toBeVisible();
  await expect(page.locator("input#mode-network")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Join game" })).toBeDisabled();
  await choose(page, "A friend on this device");
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board")).toBeVisible();
});

test("the host can reload the page: the game and the code come back, the guest reconnects and play carries on", async ({ context }) => {
  const { a, b, code } = await pair(context);
  await cell(a, 0).click();
  await expect(cell(b, 0).locator(".mark")).toHaveText("X");
  await cell(b, 4).click();
  await expect(cell(a, 4).locator(".mark")).toHaveText("O");

  await a.reload();
  await expect(a.locator("#join-code-display")).toHaveText(code); // the same code, hosting again
  await expect(a.getByText(/2 moves/i)).toBeVisible(); // and it says the game was kept
  await expect(b.locator("#net-status")).toContainText(/lost|left/i);
  await b.getByRole("button", { name: "Reconnect" }).click();

  await expect(a.locator(".board")).toBeVisible();
  await expect(marks(a, "X")).toHaveCount(1);
  await expect(marks(a, "O")).toHaveCount(1);
  await expect(a.locator("#net-status")).toContainText(/connected/i);
  await expect(b.locator("#net-status")).toContainText(/connected/i);
  await expect(a.locator("#game-status")).toContainText(/your move/i);
  await cell(a, 2).click();
  await expect(cell(b, 2).locator(".mark")).toHaveText("X");
});

test("a guest who joins after the host reloaded gets the whole game", async ({ context }) => {
  const { a, code } = await pair(context);
  await cell(a, 0).click();
  await a.reload();
  await expect(a.locator("#join-code-display")).toHaveText(code);
  const newcomer = await context.newPage();
  await joinByLink(newcomer, code);
  await expect(newcomer.locator(".board")).toBeVisible();
  await expect(marks(newcomer, "X")).toHaveCount(1);
  await expect(newcomer.locator("#game-status")).toContainText(/your move/i);
});

test("leaving a hosted game, or finishing one, means a reload does not resume it", async ({ context }) => {
  const { a, b } = await pair(context);
  await cell(a, 0).click();
  await expect(cell(b, 0).locator(".mark")).toHaveText("X");
  await a.getByRole("button", { name: "New game" }).click();
  await a.reload();
  await expect(a.getByRole("button", { name: "Join game" })).toBeVisible();
  await expect(a.locator("#join-code-display")).toHaveCount(0);

  // a finished game is not resumed either
  const c = await context.newPage();
  const d = await context.newPage();
  const code = await host(c);
  await joinWith(d, code);
  await expect(d.locator(".board")).toBeVisible();
  for (const [page, i] of [[c, 0], [d, 3], [c, 1], [d, 4], [c, 2]] as [Page, number][]) {
    await cell(page, i).click();
    await expect(cell(c, i).locator(".mark")).toBeVisible();
  }
  await expect(c.getByRole("dialog")).toContainText("X wins");
  await c.reload();
  await expect(c.getByRole("button", { name: "Join game" })).toBeVisible();
  await expect(c.locator("#join-code-display")).toHaveCount(0);
});
