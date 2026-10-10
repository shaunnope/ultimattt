// Which computer-reply levels the timing suite (tests/e2e/perf.spec.ts) runs. By hand (npm run test:perf) it runs every level on
// every board. In CI the audit sets PERF_MATRIX=ci, which runs only the top level: the deepest search is the slowest reply, so it is
// the one that can break the one-second limit, and each board keeps its test.
export const ALL_LEVELS = ["1. Beginner", "2. Casual", "3. Steady", "4. Sharp", "5. Master"];

export function replyLevels(env) {
  if (env.PERF_MATRIX === undefined || env.PERF_MATRIX === "" || env.PERF_MATRIX === "full") return ALL_LEVELS;
  if (env.PERF_MATRIX === "ci") return ALL_LEVELS.slice(-1);
  throw new Error(`PERF_MATRIX must be "ci" or "full" (or unset for full), not "${env.PERF_MATRIX}"`);
}
