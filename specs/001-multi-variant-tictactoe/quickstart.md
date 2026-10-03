# Quickstart: Validation Guide

Prerequisites: Node 22.18+, a Chromium build for Playwright. Details of each artifact: [data-model.md](data-model.md), [contracts/](contracts/).

## Setup

```text
npm install            # dev dependencies only (Playwright, Lighthouse, axe-core)
npx playwright install chromium
npm run build         # tsc: src/ -> site/js, src/sw.ts -> site/sw.js
```

## Run

```text
npm run build && npx http-server site -p 8080   # or any static server; open http://localhost:4173
```

## Validate

0. **Types**: `npm run typecheck` (`tsc --noEmit`, strict) passes with no errors. It covers the source, the unit, contract and browser tests, the Playwright configs and the service worker.
1. **Pure logic (Constitution I, V)**: `npm run test:unit` — rules for all variants, cube turn tables, AI determinism and Master-never-loses on 3×3, seed and link round-trips. Expect all green; every new rule test must have been committed red first.
2. **Contracts**: `npm run test:contract` — golden games and cube fixtures (derived from the original 1D game) replay to expected states; net messages validate.
3. **Classic (US1)**: e2e plays 3×3, 4×4, 5×5; Master on 3×3 never loses across a scripted set; undo removes move + reply.
4. **Ultimate (US2)**: e2e forces boards, checks free choice on closed board, claims, overall win/draw; computer replies legal and < 1 s under 4× CPU throttle.
5. **Cube (US3)**: e2e drags the cube, places on each face, scores a line, asserts placement is blocked until a layer turn, asserts totals after turns that break lines, finishes at 54 cells; flat view and keyboard-only path complete a game.
6. **Offline and persistence (US4)**: load once, go offline, play each variant, reload mid-game and expect same position; bump `VERSION` and expect the update bar without losing the game.
7. **Replay, seeds, share (US5)**: finish a game, copy seed and link, open link in a fresh context, expect identical replay without changing the host save.
8. **Settings (US6)**: hints off by default; marks shown with shapes; theme toggle.
9. **Two-device (US7)**: two browser contexts host and join (STUN-only config; loopback allowed in test); play to a result, decline and accept undo, drop and rejoin.
10. **Release gate**: `npm run check` (service worker, precache coverage, version bump) then `npm run audit` — Lighthouse accessibility ≥ 90, axe has no serious violations, and the installability e2e passes (manifest, service worker, offline).

Expected: all steps pass; SC-001…SC-010 are mapped to these steps in tasks.md.

## Validation run (2026-10-03)

Every step above was run from a clean build (`site/js`, `site/sw.js` and `site/precache.json` deleted first).

| Step | Result |
| --- | --- |
| 0. Types | `npm run typecheck`: no errors (source, unit, contract and browser tests, Playwright configs, service worker) |
| 1–2. Pure logic and contracts | `npm test`: 186 unit and 47 contract tests pass, including Master never losing on 3×3 against every line of play, the 408 golden cube positions from the original game, an independent QR decoder, and the two-device protocol |
| 3. Classic | e2e: 3×3, 4×4, 5×5, undo, resign, computer first move |
| 4. Ultimate | e2e: forced boards, free choice, claims, a whole game replayed from the computer's moves |
| 5. Cube | e2e: drag and keyboard turn the view, placement blocked until the layer is turned, a turn can break a line, whole games in 3D and in the flat view, flat fallback without 3D |
| 6. Offline and persistence | e2e: every variant plays offline after one visit, games resume after a reload, the update bar appears and keeps the game, a corrupt save is set aside |
| 7. Replay, seeds, share | e2e: steps, scrubbing, speed remembered, share link opened in a fresh browser (offline too), bad links explained, seed paste, same seed same computer opening |
| 8. Settings | e2e: hints off by default and shown as shapes, icons everywhere and never in links, appearance Auto/Light/Dark |
| 9. Two devices | e2e with a stand-in for PeerJS: host and join, turn enforcement, undo agree and decline, lost connection and reconnect, wrong code, third device, offline hides the option |
| 10. Release gate | `npm run check` passes; `npm run audit`: Lighthouse accessibility 100, axe 0 serious or critical on every screen in light and dark, first load interactive in 1.65 s on Lighthouse's throttled mobile profile, installability checks, computer reply under 1 s at every level in Classic and Ultimate and cube frames p95 16.8 ms with the worst 33 ms on a 4× slower CPU |

Browser tests: 178 pass on the desktop and phone projects (`npm run test:e2e`), 11 timing tests pass on their own (`npm run test:perf`).

### Success criteria

| | Evidence |
| --- | --- |
| SC-001 start in ≤ 3 interactions | `input.spec.ts`: 1 for Classic, 2 for Ultimate and Cube |
| SC-002 Master never loses on 3×3 | `ai.test.ts`, as X and as O against every opponent line |
| SC-003 same seed, same computer | `ai.test.ts`, `ai-ultimate.test.ts`, `replay.spec.ts` |
| SC-004 reply < 1 s | `perf.spec.ts`, all levels, Classic and Ultimate, 4× slower CPU |
| SC-005 offline and resume | `offline.spec.ts`, `subpath.spec.ts` |
| SC-006 rules match definitions | `classic`, `ultimate`, `cube`, `cube-rotations` tests, golden fixtures |
| SC-007 new players finish a Cube game | **Manual**, before release; not run |
| SC-008 smooth cube | `perf.spec.ts`: p95 16.8 ms, worst 33 ms (≤ 20 and ≤ 50) on a 4× slower CPU in headless Chrome |
| SC-009 keyboard only and touch only | `input.spec.ts`: whole games in all three variants both ways |
| SC-010 shared replay reproduces the game | `record.test.ts`, `replay.spec.ts` |

### Not covered, and why

* **Real PeerJS.** The public broker is not reachable from a test run, so two-device tests use a stand-in that implements the part of the PeerJS API the app uses. The real library, the real broker and real network paths (NAT, hotspot) need a hand test on two devices.
* **A real phone.** "Mid-range phone" is stood in for by a 4× CPU slowdown of headless Chrome; frame times on real hardware need a spot check.
* **SC-007** needs people.
* **First moments of a first visit.** The game code loads when it is first needed (to keep the first load fast); if the network goes away before the service worker has finished its first install (about a second), starting a game says it could not be loaded and works once connected.
