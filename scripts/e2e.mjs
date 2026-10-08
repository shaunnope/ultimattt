// Runs the browser tests as one shard: node scripts/e2e.mjs quick|heavy [playwright arguments...]
// (set E2E_SHARD in a shell yourself if you prefer; this only exists so the npm scripts work on every platform).
import { spawnSync } from "node:child_process";

const [shard, ...rest] = process.argv.slice(2);
const result = spawnSync("npx", ["playwright", "test", ...rest], { stdio: "inherit", shell: true, env: { ...process.env, E2E_SHARD: shard } });
process.exit(result.status ?? 1);
