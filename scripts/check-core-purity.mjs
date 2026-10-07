// Fails when src/core or src/adapters import anything from the UI framework: svelte, SvelteKit, its $app, $env and $lib
// modules, the #lib alias, or a .svelte file. The rules and the storage and network adapters stay plain TypeScript, so they
// run in node, in a worker and in the unit tests, and the interface can change without touching them (specs/007, C5).
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "./check-names.mjs";
import { filesUnder } from "./lib/svelte-style.mjs";

const FRAMEWORK = /^(?:svelte(?:\/.*)?|@sveltejs\/.*|\$app\/.*|\$env\/.*|\$lib(?:\/.*)?|#lib(?:\/.*)?|\$service-worker)$/;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`\n]+)\1/g;

export function checkCorePurity(root) {
  const problems = [];
  for (const folder of ["src/core", "src/adapters"]) {
    for (const file of filesUnder(join(root, folder), [".ts", ".js", ".mjs"])) {
      const text = stripComments(readFileSync(file, "utf8"), "ts");
      text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(IMPORT)) {
          const spec = m[2];
          if (FRAMEWORK.test(spec) || spec.endsWith(".svelte")) {
            problems.push(`${relative(root, file).replaceAll("\\", "/")}:${i + 1}: imports "${spec}"; ${folder} must not depend on the UI framework`);
          }
        }
      });
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkCorePurity(process.cwd());
  problems.forEach((p) => console.error("check-core-purity:", p));
  process.exit(problems.length ? 1 : 0);
}
