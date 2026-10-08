import { test, expect, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { startGame } from "./helpers.ts";

// GitHub Pages serves a project site under /<repo>/, not at the root. Everything must work from there:
// scripts and styles, the manifest, the service worker's scope and cache, offline play, saved games and
// share links. This serves the built site under /ultimattt/ (and nothing at the root) and checks it all.

const PREFIX = "/ultimattt/";

function serveUnderPrefix(port: number): Promise<{ requests: string[]; close: () => Promise<void> }> {
  const root = join(import.meta.dirname, "..", "..", "build-subpath");
  const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
  const requests: string[] = [];
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    requests.push(path);
    if (!path.startsWith(PREFIX)) {
      res.writeHead(404).end("not found");
      return;
    }
    const rest = path.slice(PREFIX.length);
    const file = join(root, rest === "" || rest.endsWith("/") ? rest + "index.html" : rest);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ requests, close: () => new Promise((r) => server.close(() => r())) })));
}

async function withSite(testInfo: { parallelIndex: number }, run: (url: string, requests: string[]) => Promise<void>) {
  const port = 4200 + testInfo.parallelIndex; // tests run at once in different workers, so each worker has its own port
  const site = await serveUnderPrefix(port);
  try {
    await run(`http://localhost:${port}${PREFIX}`, site.requests);
  } finally {
    await site.close();
  }
}

async function controlled(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test("everything loads from under the project path, and nothing is asked for at the root", async ({ page }, testInfo) => {
  await withSite(testInfo, async (url, requests) => {
    const failed: string[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await startGame(page, { variant: "Classic", opponent: "This device" }, url);
    await page.locator('[data-cell="4"]').click();
    await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X");
    expect(failed, failed.join("\n")).toEqual([]);
    expect(requests.filter((p) => !p.startsWith(PREFIX)), "requests outside the project path").toEqual([]);
  });
});

test("the manifest, its icons and the service worker scope all sit under the project path", async ({ page }, testInfo) => {
  await withSite(testInfo, async (url) => {
    await page.goto(url);
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const manifestUrl = new URL(href!, page.url()).toString();
    expect(new URL(manifestUrl).pathname).toBe(`${PREFIX}manifest.json`);
    const manifest = await (await page.request.get(manifestUrl)).json();
    for (const key of ["start_url", "scope", "id"] as const) expect(new URL(manifest[key], manifestUrl).pathname, key).toBe(PREFIX);
    for (const icon of manifest.icons) expect((await page.request.get(new URL(icon.src, manifestUrl).toString())).ok(), icon.src).toBe(true);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? null);
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? null)).toBe(url);
    void scope;
  });
});

test("offline play and resuming a game work from under the project path", async ({ page, context }, testInfo) => {
  await withSite(testInfo, async (url) => {
    await startGame(page, { variant: "Classic", opponent: "This device" }, url);
    await page.locator('[data-cell="4"]').click();
    await controlled(page);
    await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X"); // the game came back
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('[data-cell="4"]')).toHaveAttribute("data-mark", "X");
    await page.locator('[data-cell="0"]').click();
    await expect(page.locator('[data-cell="0"]')).toHaveAttribute("data-mark", "O");
  });
});

test("the computer plays offline from under the project path", async ({ page, context }, testInfo) => {
  await withSite(testInfo, async (url) => {
    await startGame(page, { variant: "Classic", opponent: "This device" }, url);
    await controlled(page);
    await context.setOffline(true);
    await startGame(page, { variant: "Classic", opponent: "Computer", level: "1. Beginner" }, url);
    await page.locator('[data-cell="4"]').click();
    await expect(page.locator('button.cell[data-mark="O"]')).toHaveCount(1, { timeout: 10_000 });
  });
});

test("a shared replay link keeps the project path and opens", async ({ page, context }, testInfo) => {
  await withSite(testInfo, async (url) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
    await startGame(page, { variant: "Classic", opponent: "This device" }, url);
    for (const c of [0, 3, 1, 4, 2]) await page.locator(`[data-cell="${c}"]`).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Close replay" }).click();
    await page.getByRole("button", { name: "Share replay" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(new URL(link).pathname).toBe(PREFIX);
    expect(link).toContain("?watch=");
    const other = await context.newPage();
    await other.goto(link);
    await expect(other.getByRole("group", { name: "Replay controls" })).toBeVisible();
    // closing the replay stays inside the project path
    await other.getByRole("button", { name: "Close replay" }).click();
    expect(new URL(other.url()).pathname).toBe(PREFIX);
    expect(other.url()).not.toContain("watch=");
  });
});

test("a join link keeps the project path", async ({ page }, testInfo) => {
  await withSite(testInfo, async (url) => {
    await page.goto(url);
    const base = await page.evaluate(() => `${location.origin}${location.pathname}`);
    expect(base).toBe(url);
    // the link the host shares is this page plus ?join=CODE
    await page.route("**/peerjs.min.js", (route) => route.fulfill({ path: join(import.meta.dirname, "fake-peerjs.js"), contentType: "text/javascript" }));
    await page.goto(url);
    await page.locator("label", { has: page.locator("strong", { hasText: /^Local network$/ }) }).click();
    await page.getByRole("button", { name: "Host game" }).click();
    await expect(page.locator(".join-link")).toContainText(`${url}?join=`);
  });
});
