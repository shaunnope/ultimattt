# Baseline for the SvelteKit migration

Taken from the app as it stood before the migration (commit 30e4f92, 2026-10-08).

## Gates (T001)

- `npm run build`, `npm test`, `npm run check` all green.
- Unit 467 passed, contract 89 passed.

## End to end (T002)

- `npm run test:e2e`: 565 passed, 53 skipped, 0 failed, 3.4 min. No flaky specs seen.

## Performance (T002, `npm run test:perf` alone)

- 46 passed, 2 failed, 2.1 min.
- Cube 3x3: 210 frames, p95 16.8 ms, worst 16.8 ms.
- Cube 5x5: 215 frames, p95 16.8 ms, worst 66.6 ms. Fails the 50 ms budget. Known, present before the migration.
- Cube 5x5 retarget: 193 frames, p95 16.8 ms, worst 50.1 ms (passes).
- Classic 5x5 K=4 level 5 Master: the opening move took 1003 ms against the 1000 ms limit (an edge case that varies from run to run).
- Anything beyond these two is a regression.

## Parity baseline (T003, T004)

- `.parity/baseline/`: 90 captures from the pre-migration `site/` build (setup, two-device setup, Twist setup, Classic, Ultimate, Twist 3D and flat, result, replay, help, settings, appearance, resign, update bar, host waiting; 320, 480, 720 px; light and dark). Gitignored.
- Two further runs without `--update-snapshots` passed (28 tests each). `maxDiffPixelRatio` 0.002, `threshold` 0.2, fonts blocked, reduced motion, fixed random numbers and clock.
- The palette picker is part of the settings dialog, so it is covered by the settings capture.

## Skeleton (T030)

- `npm run build`, `npm run check` green. `npm test`: 480 unit, 93 contract (includes the build contract test), typecheck clean.
- `npm run test:e2e`: 548 passed, 17 failed, 53 skipped. All 17 are the C6 specs that wait for later tasks: the update bar cases in `a11y`, `components`, `layout-audit`, the `offline` update test and the three `subpath` cases (they serve `site/`). Fixed on the way: help Back after a route change cleared the legacy screen (route children now render outside `<main>`).

## US2 delivery (T036, T037, T038)

- Audit on the skeleton: accessibility 100, axe serious 0, first load interactive 2914 ms (gate 3000; the pre-migration run was 2588 ms). The audit run also runs the perf specs, where the known Twist 5x5 frame budget failure (66.6 ms) is the one failure, as before.
- Size (gzipped), with the legacy UI inside: all script 89.4 KB (budget 160), style 10.1 KB. `check-build` counts the first load as the shell files plus everything they import statically; route nodes Kit loads on demand are covered by the all-script cap.
- Offline play against the computer (Classic, Ultimate) passes from the root build and from the sub-path build; the worker is in the cache. Twist has no computer opponent.
- Extra e2e edits beyond the C6 table: none except the icons test wait (added to C6).

## Components (T046 to T073)

- Checkpoints 4a to 4h: build, check (with the final DOM-builder guard), `npm test`, e2e and parity were green at each; at 4h: unit 540+, e2e 595 passed 53 skipped, parity 28 of 28 (90 captures), perf as before (see below).
- Perf: only the known Twist 5x5 frame budget failure remains; its worst frame was 66.6 ms before the migration and 83.3 ms after the cube port (p95 16.8 ms in both). The Classic 5x5 Master opening move edge case (1003 ms before) passed in the later runs.
- e2e specs changed (SC-001): every hunk is in contracts C6 or is a new test (git diff against the starting commit reviewed): update bar seam, entry script path, build folders, waits for the app to boot after the load event, the relay ignoring a #/ only address change, and added specs (`routes`, `shell`, offline against the computer, help and leaving in a two-device game).
- Flaky under full parallel load, stable alone: `network` guest reload and host gone, `motion` computer waits, parity update bar.
- Departures from the plan text: `Help.svelte` is mounted from the shell beside `<main>` (contracts C4 needs `#help-view` there), so `routes/help/+page.svelte` is empty; there is no ShareCard (the game had none); `decideBoot(search, save, notice)` takes no hash or clock because the routes decide by address; the Bridge was deleted with the imperative modules; `$lib` is `#lib` in Kit 3.
