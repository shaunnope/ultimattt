// The browser tests can run whole (the default, as CI does) or as two shards, so a change can be checked without the long
// game-from-start-to-end specs: E2E_SHARD=quick runs everything else, E2E_SHARD=heavy only those. The timing spec (perf.spec.ts)
// is in no shard: it has its own config and runs alone.
export const HEAVY_SPECS = ["cube", "input", "network"];

const heavy = new RegExp("[\\\\/](?:" + HEAVY_SPECS.join("|") + ")\\.spec\\.ts$");
const perf = /perf\.spec\.ts$/;
const either = new RegExp("(?:" + heavy.source + ")|(?:" + perf.source + ")");

export function e2eShard(name) {
  if (name === undefined || name === "") return { testMatch: /\.spec\.ts$/, testIgnore: perf };
  if (name === "heavy") return { testMatch: heavy, testIgnore: perf };
  if (name === "quick") return { testMatch: /\.spec\.ts$/, testIgnore: either };
  throw new Error(`E2E_SHARD must be "quick" or "heavy" (or unset for everything), not "${name}"`);
}
