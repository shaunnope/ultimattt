// Builds the app with SvelteKit (a static single-page app): node scripts/build.mjs [--subpath]
//   build/            the root build, for a host that serves the app at the site root
//   build-subpath/    with --subpath, a second build for a host that serves it under /ultimattt/ (the sub-path e2e uses it)
// The base path is a build-time setting (research R3). It is passed to Vite through the child's environment here, in
// process, because a shell can rewrite a value that starts with a slash (Git Bash turns /ultimattt into a Windows path).
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const bin = (pkg, file) => join(dirname(require.resolve(`${pkg}/package.json`, { paths: [root] })), file);

function run(label, script, args, env = {}) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.status !== 0) {
    console.error(`build: ${label} failed`);
    process.exit(result.status ?? 1);
  }
}

const kit = bin("@sveltejs/kit", "svelte-kit.js");
const vite = bin("vite", "bin/vite.js");

run("svelte-kit sync", kit, ["sync"]);
run("vite build", vite, ["build"], { BUILD_DIR: "build", BASE_PATH: "" });
if (process.argv.includes("--subpath")) run("vite build (sub-path)", vite, ["build"], { BUILD_DIR: "build-subpath", BASE_PATH: "/ultimattt" });
