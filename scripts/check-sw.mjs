// Fails unless the service worker only calls skipWaiting from its message handler
// and deletes stale caches in its activate handler. Reads src/sw.ts as text.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function checkSw(source) {
  const problems = [];
  const parts = source.split(/addEventListener\(\s*["'`]/).slice(1);
  const handlers = new Map();
  for (const part of parts) {
    const name = part.match(/^[^"'`]+/)?.[0] ?? "";
    handlers.set(name, (handlers.get(name) ?? "") + part);
  }
  for (const [name, body] of handlers) {
    if (name !== "message" && /skipWaiting/.test(body)) {
      problems.push(`skipWaiting is called in the "${name}" handler; it may only run from the "message" handler`);
    }
  }
  if (!/skipWaiting/.test(source)) problems.push("skipWaiting is never called; the update bar cannot apply an update");
  const activate = handlers.get("activate") ?? "";
  if (!/caches\.delete/.test(activate)) problems.push("the activate handler does not delete stale caches (caches.delete)");
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkSw(readFileSync(join(process.cwd(), "src", "sw.ts"), "utf8"));
  problems.forEach((p) => console.error("check-sw:", p));
  process.exit(problems.length ? 1 : 0);
}
