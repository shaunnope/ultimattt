import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The constitution says releases must pass the audit before deploy. The workflow is what deploys, so it
// has to make that impossible to skip: an audit job that runs the audit, and a deploy that waits for it.

const text = readFileSync(join(import.meta.dirname, "..", "..", ".github", "workflows", "deploy.yml"), "utf8").replace(/\r\n/g, "\n");

/** The lines of one top-level job under `jobs:`. */
function job(name: string): string {
  const match = new RegExp(`^  ${name}:\n((?:    .*\n|\n)+)`, "m").exec(text + "\n");
  assert.ok(match, `the workflow has no "${name}" job`);
  return match![1]!;
}

test("there is a test job, a sharded browser-test job and an audit job, each building and running its checks", () => {
  assert.match(job("test"), /npm run test:unit/);
  assert.match(job("test"), /npm run check/);
  assert.match(job("e2e"), /playwright test --shard=\$\{\{ matrix\.shard \}\}\/\$\{\{ strategy\.job-total \}\}/);
  assert.match(job("e2e"), /npx playwright install/);
  assert.match(job("audit"), /npm ci/);
  assert.match(job("audit"), /npx playwright install/);
  assert.match(job("audit"), /npm run audit/);
});

test("deploy waits for the tests, the browser tests and the audit", () => {
  const needs = /needs:\s*(?:\[([^\]]*)\]|(\S+))/.exec(job("deploy"));
  assert.ok(needs, "deploy has no needs");
  const list = (needs![1] ?? needs![2] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(list.sort(), ["audit", "e2e", "test"]);
});

test("the audit job does not publish anything", () => {
  assert.doesNotMatch(job("audit"), /upload-pages-artifact|deploy-pages/);
});

test("pull requests run the checks but never deploy, and a pull request cannot cancel a deploy", () => {
  assert.match(text, /^  pull_request:/m);
  assert.match(job("deploy"), /if:.*github\.ref == 'refs\/heads\/main'/);
  assert.match(job("deploy"), /if:.*!= 'pull_request'/);
  assert.match(job("deploy"), /cancel-in-progress: false/);
  assert.doesNotMatch(text.split("\njobs:")[0]!, /pages: write/, "only deploy may write to Pages");
});

test("the audit runs the timing suite with the CI matrix; the full matrix stays a manual run", () => {
  assert.match(job("audit"), /PERF_MATRIX: ci/);
  assert.doesNotMatch(job("e2e"), /PERF_MATRIX/);
});

test("only one job uploads the site, and deploy is the only one that publishes it", () => {
  assert.equal((text.match(/upload-pages-artifact/g) ?? []).length, 1);
  assert.equal((text.match(/deploy-pages/g) ?? []).length, 1);
  assert.match(job("deploy"), /deploy-pages/);
});

test("the comment no longer says the audit is run by hand", () => {
  assert.doesNotMatch(text, /run by hand/i);
});
