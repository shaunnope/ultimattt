// The browser tests can run whole (the default, as CI does) or as two shards, so a change can be checked without the long
// game-from-start-to-end specs: E2E_SHARD=quick runs everything else, E2E_SHARD=heavy only those. The timing spec (perf.spec.ts)
// is in no shard: it has its own config and runs alone.
export const HEAVY_SPECS = ["cube", "input", "network"];

const heavy = new RegExp("[\\\\/](?:" + HEAVY_SPECS.join("|") + ")\\.spec\\.ts$");
const perf = /perf\.spec\.ts$/;
const either = new RegExp("(?:" + heavy.source + ")|(?:" + perf.source + ")");
// The release audit runs this spec itself (scripts/audit.mjs), so CI sets E2E_SKIP_AUDITED=1 to not run it a second time in the shards.
export const AUDITED_SPECS = ["installable"];
const audited = new RegExp("[\\\\/](?:" + AUDITED_SPECS.join("|") + ")\\.spec\\.ts$");
const orAudited = (re, skip) => (skip ? new RegExp("(?:" + re.source + ")|(?:" + audited.source + ")") : re);

export function e2eShard(name, skipAudited = false) {
  if (name === undefined || name === "") return { testMatch: /\.spec\.ts$/, testIgnore: orAudited(perf, skipAudited) };
  if (name === "heavy") return { testMatch: heavy, testIgnore: orAudited(perf, skipAudited) };
  if (name === "quick") return { testMatch: /\.spec\.ts$/, testIgnore: orAudited(either, skipAudited) };
  throw new Error(`E2E_SHARD must be "quick" or "heavy" (or unset for everything), not "${name}"`);
}
