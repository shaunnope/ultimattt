import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs script, no types
import { canReuseBuild } from "../../scripts/lib/build-reuse.mjs";
import { e2eShard, HEAVY_SPECS } from "../../scripts/lib/e2e-shard.mjs";
import { ALL_LEVELS, replyLevels } from "../../scripts/lib/perf-matrix.mjs";

// The slow stages of the release gates are made cheaper without changing what they check: a build made moments ago is reused
// instead of repeated, and the browser tests can run as two shards.

test("a build is reused only when the caller says it is fresh and every folder it needs is there", () => {
  const has = (...dirs: string[]) => (dir: string) => dirs.includes(dir);
  assert.equal(canReuseBuild({ TTT_BUILD_FRESH: "1" }, ["--subpath"], has("build", "build-subpath")), true);
  assert.equal(canReuseBuild({ TTT_BUILD_FRESH: "1" }, [], has("build")), true);
  assert.equal(canReuseBuild({ TTT_BUILD_FRESH: "1" }, ["--subpath"], has("build")), false, "the sub-path build is missing");
  assert.equal(canReuseBuild({ TTT_BUILD_FRESH: "1" }, [], has()), false, "nothing is built");
  assert.equal(canReuseBuild({}, [], has("build")), false, "nobody said it is fresh");
  assert.equal(canReuseBuild({ TTT_BUILD_FRESH: "0" }, [], has("build")), false);
});

test("e2e shards: heavy runs only the long game specs, quick runs everything else, none runs everything but the timing spec", () => {
  const heavy = e2eShard("heavy");
  const quick = e2eShard("quick");
  const all = e2eShard(undefined);
  for (const name of ["input", "cube", "network"]) {
    const path = `C:\\repo\\tests\\e2e\\${name}.spec.ts`;
    assert.ok(heavy.testMatch.test(path), `${name} is heavy`);
    assert.ok(!quick.testMatch.test(path) || quick.testIgnore.test(path), `${name} is not quick`);
  }
  for (const name of ["cube-rules", "classic", "a11y", "replay", "seed-entry", "inputs", "networking"]) {
    const path = `/repo/tests/e2e/${name}.spec.ts`;
    assert.ok(!heavy.testMatch.test(path), `${name} is not heavy`);
    assert.ok(!quick.testIgnore.test(path), `${name} is quick`);
  }
  assert.ok(all.testIgnore.test("/repo/tests/e2e/perf.spec.ts"));
  assert.ok(!all.testIgnore.test("/repo/tests/e2e/cube.spec.ts"));
  assert.ok(quick.testIgnore.test("/repo/tests/e2e/perf.spec.ts"), "timing tests stay out of every shard");
  assert.ok(heavy.testIgnore.test("/repo/tests/e2e/perf.spec.ts"));
  assert.deepEqual([...HEAVY_SPECS].sort(), ["cube", "input", "network"]);
});

test("an unknown shard name is an error, so a typo cannot silently run nothing", () => {
  assert.throws(() => e2eShard("heavyy"), /E2E_SHARD/);
});

test("the audited spec is left out of the shards only when asked, in every shard", () => {
  const path = "/repo/tests/e2e/installable.spec.ts";
  for (const name of [undefined, "quick", "heavy"]) {
    assert.ok(!e2eShard(name).testIgnore.test(path), `${name ?? "all"} runs it by default`);
    assert.ok(e2eShard(name, true).testIgnore.test(path), `${name ?? "all"} leaves it to the audit`);
    assert.ok(e2eShard(name, true).testIgnore.test("/repo/tests/e2e/perf.spec.ts"), "timing tests stay out");
    assert.ok(!e2eShard(name, true).testIgnore.test("/repo/tests/e2e/cube.spec.ts") || name === "quick", "other specs still run");
  }
});

test("the timing suite runs every computer level by hand and only the top one in CI", () => {
  assert.deepEqual(replyLevels({}), ALL_LEVELS);
  assert.deepEqual(replyLevels({ PERF_MATRIX: "full" }), ALL_LEVELS);
  assert.deepEqual(replyLevels({ PERF_MATRIX: "ci" }), ["5. Master"]);
  assert.equal(ALL_LEVELS.length, 5);
  assert.throws(() => replyLevels({ PERF_MATRIX: "cii" }), /PERF_MATRIX/);
});
