import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const site = join(import.meta.dirname, "..", "..", "site");
const manifest = JSON.parse(readFileSync(join(site, "manifest.json"), "utf8")) as {
  name?: string;
  short_name?: string;
  display?: string;
  start_url?: string;
  scope?: string;
  id?: string;
  theme_color?: string;
  background_color?: string;
  icons?: { src: string; sizes: string; type: string; purpose?: string }[];
  screenshots?: { src: string; sizes: string; type: string; form_factor?: string; label?: string }[];
};

test("manifest has the fields installability needs", () => {
  for (const key of ["name", "short_name", "display", "start_url", "theme_color", "background_color"] as const) {
    assert.ok(manifest[key], `missing ${key}`);
  }
  assert.ok(["standalone", "fullscreen", "minimal-ui"].includes(manifest.display!));
  assert.match(manifest.theme_color!, /^#[0-9a-fA-F]{6}$/);
  assert.match(manifest.background_color!, /^#[0-9a-fA-F]{6}$/);
});

test("start_url, scope and id are relative so the site works under a project subpath", () => {
  for (const key of ["start_url", "scope", "id"] as const) {
    const value = manifest[key];
    assert.ok(value, `missing ${key}`);
    assert.ok(!value!.startsWith("/"), `${key} must not start with "/": ${value}`);
    assert.ok(!/^[a-z]+:/i.test(value!), `${key} must not be absolute: ${value}`);
  }
});

test("icons 192 and 512 exist as files, and a maskable icon is declared", () => {
  const icons = manifest.icons ?? [];
  for (const size of ["192x192", "512x512"]) {
    assert.ok(icons.some((i) => i.sizes === size), `no ${size} icon`);
  }
  assert.ok(icons.some((i) => /maskable/.test(i.purpose ?? "")), "no maskable icon");
  for (const icon of icons) {
    assert.ok(!icon.src.startsWith("/"), `icon src must be relative: ${icon.src}`);
    const path = join(site, icon.src);
    assert.ok(existsSync(path) && statSync(path).size > 100, `icon file missing or empty: ${icon.src}`);
  }
});

test("a narrow and a wide screenshot are declared, exist, and are the size the manifest says", () => {
  const shots = manifest.screenshots ?? [];
  assert.ok(shots.some((s) => s.form_factor === "narrow"), "no narrow screenshot");
  assert.ok(shots.some((s) => s.form_factor === "wide"), "no wide screenshot");
  for (const shot of shots) {
    assert.ok(shot.label && shot.label.length > 0, `${shot.src} needs a label`);
    assert.ok(!shot.src.startsWith("/"), `screenshot src must be relative: ${shot.src}`);
    const bytes = readFileSync(join(site, shot.src));
    assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${shot.src} is not a PNG`);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    assert.equal(shot.sizes, `${width}x${height}`, shot.src);
  }
});

test("the manifest and the theme-color meta tag use the light background token", () => {
  const theme = readFileSync(join(site, "css", "theme.css"), "utf8");
  const bg = /--bg:\s*(#[0-9a-fA-F]{6})/.exec(theme)?.[1];
  assert.ok(bg, "theme.css defines --bg");
  assert.equal(manifest.background_color!.toLowerCase(), bg!.toLowerCase());
  assert.equal(manifest.theme_color!.toLowerCase(), bg!.toLowerCase());
  const html = readFileSync(join(site, "index.html"), "utf8");
  assert.match(html, new RegExp(`<meta name="theme-color" content="${bg}"`, "i"));
});
