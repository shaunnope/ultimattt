import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
// @ts-expect-error plain .mjs script, no types
import { startStaticServer } from "../../scripts/lib/serve.mjs";

function siteDir() {
  const dir = mkdtempSync(join(tmpdir(), "ttt-serve-"));
  writeFileSync(join(dir, "index.html"), "<h1>home</h1>");
  mkdirSync(join(dir, "js"));
  writeFileSync(join(dir, "js", "app.js"), "export const x = 1;");
  writeFileSync(join(dir, "style.css"), "body{}");
  writeFileSync(join(dir, "manifest.json"), "{}");
  writeFileSync(join(dir, "logo.png"), "png");
  return dir;
}

test("serves files with the right content types, and the index for a folder", async () => {
  const server = await startStaticServer(siteDir(), 0);
  try {
    const home = await fetch(server.url);
    assert.equal(home.status, 200);
    assert.equal(await home.text(), "<h1>home</h1>");
    assert.match(home.headers.get("content-type") ?? "", /text\/html/);
    const js = await fetch(`${server.url}js/app.js`);
    assert.match(js.headers.get("content-type") ?? "", /javascript/);
    assert.match((await fetch(`${server.url}style.css`)).headers.get("content-type") ?? "", /text\/css/);
    assert.match((await fetch(`${server.url}manifest.json`)).headers.get("content-type") ?? "", /json/);
    assert.match((await fetch(`${server.url}logo.png`)).headers.get("content-type") ?? "", /image\/png/);
  } finally {
    await server.stop();
  }
});

test("a missing file is a 404, and nothing outside the folder can be read", async () => {
  const dir = siteDir();
  writeFileSync(join(dir, "..", "secret-outside.txt"), "no");
  const server = await startStaticServer(dir, 0);
  try {
    assert.equal((await fetch(`${server.url}nope.js`)).status, 404);
    const escaped = await fetch(`${server.url}..%2fsecret-outside.txt`);
    assert.equal(escaped.status, 404);
    const raw = await fetch(`${server.url}../secret-outside.txt`);
    assert.notEqual(raw.status, 200);
  } finally {
    await server.stop();
  }
});

test("files are never cached, so a rebuilt site is what the next request gets", async () => {
  const server = await startStaticServer(siteDir(), 0);
  try {
    assert.match((await fetch(server.url)).headers.get("cache-control") ?? "", /no-store|no-cache/);
  } finally {
    await server.stop();
  }
});

test("asking for a port gives that port, and stop() frees it and leaves nothing running", async () => {
  const probe = createServer();
  const port = await new Promise<number>((resolve) => probe.listen(0, () => resolve((probe.address() as { port: number }).port)));
  await new Promise((resolve) => probe.close(resolve));
  const server = await startStaticServer(siteDir(), port);
  assert.equal(new URL(server.url).port, String(port));
  assert.equal((await fetch(server.url)).status, 200);
  await server.stop();
  await assert.rejects(fetch(server.url), "the port no longer answers");
  // the port is free again: another server can take it at once
  const again = await startStaticServer(siteDir(), port);
  await again.stop();
  await server.stop(); // stopping twice is harmless
});
