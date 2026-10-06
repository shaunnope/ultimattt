import { test, expect } from "@playwright/test";

// What a browser needs to offer "install": a web app manifest with the right fields and loadable icons,
// a service worker that controls the page, and an app shell that loads with the network off.
// (Lighthouse no longer has a PWA category, so this is the installability check; scripts/audit.mjs runs it.)

test("the manifest has what installation needs, and its icons load", async ({ page }) => {
  await page.goto("./");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();
  const url = new URL(href!, page.url()).toString();
  const response = await page.request.get(url);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  for (const key of ["name", "short_name", "display", "start_url", "scope", "id", "theme_color", "background_color"]) {
    expect(manifest[key], key).toBeTruthy();
  }
  expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);
  const sizes: string[] = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(manifest.icons.some((i: { purpose?: string }) => /maskable/.test(i.purpose ?? ""))).toBe(true);
  for (const icon of manifest.icons) {
    const res = await page.request.get(new URL(icon.src, url).toString());
    expect(res.ok(), icon.src).toBe(true);
    expect(res.headers()["content-type"]).toMatch(/image\/png/);
  }
  // the start address and scope sit inside the site, wherever it is hosted
  expect(new URL(manifest.start_url, url).pathname.startsWith(new URL(manifest.scope, url).pathname)).toBe(true);
});

test("a service worker controls the page, and the app shell loads offline", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Start game" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tic Tac Toe" })).toBeVisible();
  // and a game can be started, so the worker cached the scripts and styles as well as the page
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(page.locator(".board")).toBeVisible();
});

test("the page declares what the browser needs to treat it as an app", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /width=device-width/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("en");
});

test("the logo is in the header and on the start screen, decorative, and every icon is an image of the stated size", async ({ page }) => {
  await page.goto("./");
  const logos = page.locator(".app-logo");
  await expect(logos.first()).toBeVisible();
  await expect(page.locator(".topbar .app-logo")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".start-logo .app-logo")).toBeVisible(); // the start screen shows it too
  await expect(page.locator(".topbar .app-logo [data-mark=X]")).toHaveCount(1);
  await expect(page.locator(".topbar .app-logo [data-mark=O]")).toHaveCount(1);
  const manifestUrl = new URL((await page.locator('link[rel="manifest"]').getAttribute("href"))!, page.url()).toString();
  const manifest = await (await page.request.get(manifestUrl)).json();
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const res = await page.request.get(new URL(icon.src, manifestUrl).toString());
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"], icon.src).toMatch(/image\/png/);
    const body = await res.body();
    const [w, h] = icon.sizes.split("x").map(Number);
    expect([body.readUInt32BE(16), body.readUInt32BE(20)], icon.src).toEqual([w, h]);
  }
  // the favicon link resolves, and the page lists the PNG as a fallback
  const icons = await page.locator('link[rel="icon"]').evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).href));
  expect(icons.some((href) => href.endsWith("icons/logo.svg"))).toBe(true);
  expect(icons.some((href) => href.endsWith("icons/icon-192.png"))).toBe(true);
  for (const href of icons) expect((await page.request.get(href)).status(), href).toBe(200);
});
