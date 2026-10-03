# Implementation Plan: Multi-Variant Tic Tac Toe

**Branch**: `001-multi-variant-tictactoe` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-multi-variant-tictactoe/spec.md`

## Summary

Installable, offline-first PWA with three variants: Classic (3×3 / 4×4 / 5×5 vs a five-level computer, same-device, or two-device), Ultimate (nine boards, forced-board routing, computer opponent) and Cube (six faces, interactive 3D, layer turns after a scoring move, two-player only). Emulates the reference `tictactoe-game` (seeds, undo, hints, replay, share links, theme, update bar, STUN-only peer-to-peer) minus its scoring and leaderboard.

Approach: TypeScript (strict) compiled by `tsc` alone to a static site of ES modules (no bundler). All rules, AI, seeds, replay encoding and cube geometry are pure modules with no DOM/storage/network, unit-tested first with `node:test`. UI is a thin adapter. Cube 3D uses CSS 3D transforms (no 3D library). Two-device play reuses the reference approach: PeerJS lazily loaded, STUN only, no backend.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict, ES2022 modules, `erasableSyntaxOnly`), HTML, CSS. Node 22.18+ (native type stripping) for tests/tooling only. Compiled output is plain ES modules.

**Primary Dependencies**: None at runtime for play. PeerJS 1.5.4, loaded lazily from a CDN only when hosting or joining two-device games; never precached. Dev only: TypeScript compiler (`tsc`, the only build step), Playwright (e2e, offline, install), Lighthouse CLI (a11y gate), axe-core (a11y checks).

**Storage**: `localStorage` for settings and the in-progress game (JSON, schema-versioned); service worker Cache Storage for the app shell. No server storage.

**Testing**: `node:test` + `node:assert`, run directly on `.ts` via Node type stripping, for pure modules (rules, AI, seed, record, cube geometry, net protocol); Playwright for UI, offline, persistence, two-browser-context network play; scripted checks (`check-sw`, `check-precache`) as in the reference.

**Target Platform**: Current evergreen browsers (Chrome, Safari, Firefox, Edge) on phone, tablet, desktop; installable PWA over HTTPS on static hosting (GitHub Pages, HTTPS enforced, project subpath; all URLs relative).

**Project Type**: Static web app (single project; `tsc` emit, no bundler).

**Performance Goals**: Interactive < 3 s first load on throttled 4G mid-range phone; computer reply < 1 s on 3×3 and Ultimate; Cube rotation and layer-turn animation at 60 fps on mid-range phone; main thread never blocked by AI (Web Worker).

**Constraints**: Fully playable offline after first load; deterministic AI (same seed + moves → same game; integer math, no `Math.random`, no clock); search bounded by position count, not time; WCAG-oriented: keyboard operable, no colour-only state, Lighthouse accessibility ≥ 90 plus an automated installability check (manifest, service worker, offline); no accounts, no own server.

**Scale/Scope**: 3 variants, ~12 screens/dialogs, ~25 JS modules; Ultimate AI search space ≫ Classic, so budgets tuned per level. Cube: 54 cells, 6 faces, 3 layers per axis.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Release scripts have fixture-based tests too; rules/AI/geometry tests written and seen failing before code; tasks.md lists test task before each implementation task; Playwright specs precede UI. CI-style `npm test` runs all. |
| II. PWA First | PASS | Manifest, service worker, HTTPS static hosting, responsive, touch + keyboard; Lighthouse accessibility ≥ 90 and an automated installability check (manifest, service worker, offline) as release gate, satisfying the constitution's PWA pass. |
| III. Offline by Default | PASS | Everything needed to play precached under a versioned cache; stale caches deleted on activate; state in `localStorage`; offline covered by Playwright. Two-device play is the only network feature and degrades to "unavailable" without blocking anything. |
| IV. Simplicity | PASS with note | No framework, no bundler, no 3D library (CSS 3D); `tsc` is the only build tool. Dependencies justified under Complexity Tracking. |
| V. Pure Game Logic | PASS | `src/core/` has no DOM, storage or network; UI and persistence are adapters; core tested before UI depends on it. |
| Technical Constraints | PASS | Client-side only; static hosting; cache version bumped each release (checked by script); a11y rules above. |

Post-design re-check (after Phase 1): PASS. The data model keeps rules pure; contracts define the UI/core/net boundaries; the only third-party runtime is the optional PeerJS broker. See Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-multi-variant-tictactoe/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core-api.md          # pure module interfaces per variant
│   ├── record-format.md     # seed, save, replay-link formats
│   └── net-protocol.md      # two-device messages
└── tasks.md                 # produced by /speckit-tasks
```

### Source Code (repository root)

```text
src/                           # all authored TypeScript
├── core/                      # PURE: no DOM / storage / network
│   ├── types.ts               # Move, GameConfig, hint types (discriminated unions)
│   ├── classic.ts             # N×N, K-in-row rules, hints
│   ├── ultimate.ts            # routing, claims, overall result, hints
│   ├── cube.ts                # faces, sticker mapping, layer turns, line count, hints
│   ├── ai.ts                  # negamax + alpha-beta, levels, node budget (Classic)
│   ├── ai-ultimate.ts         # evaluation for Ultimate
│   ├── seed.ts                # seeds, integer PRNG
│   ├── tokens.ts              # compact move text; split out of record.ts so the start screen loads without the rules
│   ├── record.ts              # replay records and share-link pack/unpack (uses tokens.ts and the rules)
│   ├── replay.ts              # a game as a list of positions
│   ├── variants.ts            # which module implements which variant
│   ├── config.ts              # reading a GameConfig from untrusted data (saves, messages)
│   ├── settings.ts            # settings and the remembered start-screen choices
│   ├── icons.ts               # pure icon validation (display-only icons)
│   ├── pairing.ts             # six-character codes, join links, plain-words connection errors
│   └── protocol.ts            # net messages and the host-authoritative session
├── ui/
│   ├── app.ts  game.ts  setup.ts  settings.ts  theme.ts  ui.ts  icons.ts  glyph.ts  messages.ts
│   ├── boards.ts  board-classic.ts  board-ultimate.ts  board-cube.ts  cube-view.ts  cube-labels.ts
│   ├── replay.ts  replay-text.ts  hints.ts  update-bar.ts  confetti.ts  qr.ts
│   ├── multiplayer.ts         # host and join flows (here, not at src/, because it drives the game screen)
│   └── computer.ts  ai-worker.ts
├── adapters/
│   ├── storage.ts             # localStorage that never throws
│   ├── store.ts               # the save file: settings and the game in progress, schema versioning
│   ├── restore.ts             # rebuilding a saved game by playing its moves; split out of store.ts so the start screen loads without the rules
│   └── net.ts                 # PeerJS lazy load, STUN only
└── sw.ts                      # service worker (own tsconfig, lib: webworker)

site/                          # deployed as-is; js/ and sw.js are tsc output (git-ignored)
├── index.html  404.html  manifest.json  .nojekyll
├── icons/                     # 192, 512, maskable, apple touch
├── screenshots/               # for the install prompt; not precached
├── css/                       # theme.css, style.css, cube.css
├── js/                        # emitted from src/ (never hand-edited)
└── sw.js                      # emitted from src/sw.ts

tests/
├── unit/                      # node:test on src/core/*.ts, one file per module, plus UI logic and scripts
├── contract/                  # record format, save format, manifest, protocol
├── e2e/                       # Playwright: play, offline, persistence, install, a11y, input, two devices, subpath
└── fixtures/                  # golden cube positions from the original game, check-script fixtures

scripts/
├── check-sw.mjs  check-precache.mjs  check-theme.mjs  check-version.mjs
├── gen-precache.mjs           # the offline file list
├── gen-preload.mjs            # modulepreload links for the start screen: flattens the module waterfall to meet the 3 s first-load budget
├── audit.mjs                  # the release gate: Lighthouse accessibility, axe, first load, installability, timing
├── lib/serve.mjs              # in-process static server for the audit and screenshots; works on every operating system
├── make-icons.mjs  make-screenshots.mjs
└── cube-reference/            # Python port of the original game's turn logic, which generated the golden fixtures
tsconfig.json  tsconfig.sw.json  tsconfig.tests.json  package.json
playwright.config.ts           # browser tests
playwright.perf.config.ts      # timing tests, one at a time so other tests cannot steal the CPU they measure
.github/workflows/deploy.yml   # test, audit, then deploy to GitHub Pages
```

**Structure Decision**: Single project, `src/` compiled into a static `site/`. `src/core` is the only place rules live, imported by UI, the AI worker, tests and replay. Mirrors the reference app's layout, which keeps its pure modules DOM-free.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| TypeScript + `tsc` build step | Strict types on move unions, cube sticker indices and the net protocol catch rule and desync bugs at compile time; requested by the user | Plain JS with JSDoc gives weaker checking; a bundler is still avoided: `tsc` alone emits browser-ready ES modules |
| PeerJS runtime dependency (lazy, CDN) | Two-device play requires WebRTC pairing via a broker (FR-033) | Hand-rolling signalling needs our own server, which FR-036 forbids |
| Playwright dev dependency | Offline, install, persistence and two-context network tests are required by the constitution | Node's test runner cannot drive a browser or a service worker |
| Lighthouse + axe-core dev dependencies | Constitution release gate (accessibility ≥ 90; installability is checked by Playwright) | Manual audits are not automated, which the constitution requires |
