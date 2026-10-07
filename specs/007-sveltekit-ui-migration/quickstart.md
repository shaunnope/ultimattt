# Quickstart: validating the SvelteKit UI migration

Prerequisites: Node 22.18+, `npm install` (installs the new dev dependencies), Playwright browsers (`npx playwright install chromium`).

## 1. Automated gates

```bash
npm run build         # svelte-kit sync + vite build -> build/ (root base)
npm run check         # sw, build contract + size budget, core purity, no DOM builders, theme, tokens, contrast, breakpoints, names
npm test              # svelte-check + tsc for tests, unit, contract
npm run test:e2e      # builds build/ and build-subpath/, serves build/, runs every spec on desktop and mobile
npm run audit         # Lighthouse accessibility >= 90, axe, first load < 3 s, installability
npm run test:perf     # computer reply time and cube frame budget (run alone)
```

Expected: all pass. The baseline for comparison is the 006 result: 467 unit, 89 contract, 564 e2e passed, accessibility 100, first load interactive 2588 ms, and the one known perf failure (Twist 5x5 frame budget, 66.7 ms against 50) that also fails on the pre-migration build.

`check` fails when: a built file is missing from the precache, the worker cache name does not use the build version, the shell loads from an unexpected origin or a root-absolute URL in the sub-path build, first-load script plus style exceeds 70 KB gzipped (all script 160 KB), `src/core` or `src/adapters` import the framework, any imperative DOM builder remains (final phase), a colour literal or width query appears in a component's style block, or the pre-paint script and `resolveMode` disagree.

## 2. Parity walkthrough (30 minutes, two people or two passes)

Serve `build/` (`npx http-server build -p 8080 -c-1`). For Classic, Ultimate and Twist: setup, play to a win and a draw, resign, undo, hints, replay, share text, settings, help, theme dialog, palette picker. Compare with the pre-migration app (check out the 006 commit in a second folder, `npm run build`, serve `site/` on 8081) at 320, 480 and 720 px in both modes. Expect no visible difference in layout, colour, copy, icons or motion. Record any difference and either fix it or add it to the plan.

## 3. Links and saves

1. Host a two-device game and open the `?join=` link in a second window. Expected: joins, plays, results match.
2. Finish a game, share the replay link, open it in a private window. Expected: replay opens at `/?watch=...`, Close returns to the start screen with no `watch` in the URL.
3. Open `tests/fixtures/001` to `003` saves and an older seed link. Expected: all load unchanged (the compat e2e covers it).
4. Open the app, play three moves, press Help, press Back. Expected: the game is exactly as it was and the computer has not restarted its turn.
5. Reload on `#/help`, `#/play` and `#/replay` (with and without a saved game or `?watch=`). Expected: help opens; play restores the game or shows setup; replay opens or shows setup.

## 4. Static hosting, sub-path and offline

1. `npm run build` then serve `build/` with any static server that has no rewrite rules. Expected: the app loads, every route works after a hard reload.
2. Build for a sub-path (`node scripts/build.mjs --subpath`), serve `build-subpath/` under `/ultimattt/` (the subpath e2e does this). Expected: manifest, icons, worker and every asset resolve under the prefix; nothing is requested at `/`.
3. Load once, go offline, reload, play a full game of each mode, including against the computer. Expected: all work; multiplayer shows its offline banner.
4. Update flow: serve a build, load, rebuild, reload without closing. Expected: "A new version is ready." with Update; nothing changes until pressed; the game survives.
5. First paint on a dark device with scripts delayed 2 s (the theme-dialog e2e). Expected: dark from the first frame.

## 5. Reference: the working spike configuration

The spike (scratch directory, outside the repo) built a hash-routed static app with this `vite.config.ts`; the real one adds the service worker settings, the version and `BASE_PATH` handling in `scripts/build.mjs`:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [sveltekit({
    adapter: adapter(),                       // pages: "build" by default
    router: { type: "hash" },
    serviceWorker: { register: false },        // the app registers it, to keep the update bar flow
    paths: { base: process.env.BASE_PATH ?? "" },
  })],
});
```

`tsconfig.json` extends `$app/tsconfig` with `exclude: ["src/service-worker", "src/service-worker.ts"]`. Run `svelte-kit sync` before the first type check or build.

## Results

Run on 2026-10-08 against the final tree, with the 006 numbers beside them.

| Gate | 006 (before) | 007 (after) |
|---|---|---|
| Unit tests | 467 passed | 597 passed |
| Contract tests | 89 passed | 93 passed |
| Type check | tsc | svelte-check (warnings fail) and tsc, clean |
| `npm run check` | green | green, with the build contract, core purity and no hand-built DOM guards |
| End to end | 565 passed, 53 skipped | 596 passed, 54 skipped, in two runs in a row (the extra skip is the budget spec, desktop only) |
| Parity screenshots | not taken | 28 tests, 90 captures, no difference |
| Accessibility (Lighthouse) | 100 | 100 |
| axe serious violations | 0 | 0 |
| First load interactive | 2588 ms | 2743 ms |
| First load script plus style (measured, gzipped) | about 40 KB | 69.9 KB (budget 70; the budget spec is `tests/e2e/budget.spec.ts`) |
| All script (gzipped) | 99.7 KB | 103.5 KB (budget 160) |
| Perf | one known failure (Twist 5x5 frame budget, 66.7 ms against 50) | the same failure at 66.7 ms; nothing else |

Notes:

- The first load is close to the budget. The framework runtime is about 45 KB of it; the two dialogs and the replay, help and game screens load on demand.
- Before the expectation timeout went from 10 s to 15 s (contracts C6), a full parallel run lost one or two specs to the machine each time, a different pair each run (`input` start screen, `network` rejoin, `a11y` help page with `net::ERR_NO_BUFFER_SPACE` from the local server, `motion`, the parity update bar). Every one passed alone on repeat. With the longer timeout two full runs in a row were clean.
- Departures from the plan are in `baseline.md` (section Components) and in the Complexity Tracking table of `plan.md`.

### Manual walkthrough (sections 2 to 4)

Not done by a person. What stands in for it: the parity screenshots (section 2, at 320, 480 and 720 px in both modes), the compat, routes, replay and network specs (section 3, including two browser contexts through the relay stand-in), and the offline, subpath, installable and audit gates (section 4). Not covered by anything automated: pairing the pre-migration app (a 006 build) with the migrated one for a two-device game, and a real phone install. The wire protocol and the rules code behind it (`src/core/protocol.ts`, version 3) are unchanged by this work, so a cross-version game is expected to work, but nobody has tried it.
