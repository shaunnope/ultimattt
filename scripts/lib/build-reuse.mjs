// A build made moments ago can be reused by the steps that follow it. The caller says so by setting TTT_BUILD_FRESH=1 (the
// audit does, after it has built); the build is skipped only when every folder the step needs is really there.
import { existsSync } from "node:fs";

export function canReuseBuild(env, argv, exists = existsSync) {
  if (env.TTT_BUILD_FRESH !== "1") return false;
  const needed = argv.includes("--subpath") ? ["build", "build-subpath"] : ["build"];
  return needed.every((dir) => exists(dir));
}
