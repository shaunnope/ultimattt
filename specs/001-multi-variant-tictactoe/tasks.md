---

description: "Task list for Multi-Variant Tic Tac Toe"
---

# Tasks: Multi-Variant Tic Tac Toe

**Input**: Design documents from `/specs/001-multi-variant-tictactoe/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (core-api, record-format, net-protocol), quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): every implementation task is preceded by its test task; run the test and see it FAIL for the expected reason before implementing. Commit tests before or with their implementation.

**Organization**: Grouped by user story (spec.md priorities P1–P7) so each can be built, tested and demoed alone.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US7, from spec.md
- Paths follow plan.md: authored TypeScript in `src/`, static assets and emitted JS in `site/`, tests in `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, toolchain, scripts

- [X] T001 Create directory skeleton per plan.md (`src/core`, `src/ui`, `src/adapters`, `site/css`, `site/icons`, `tests/unit`, `tests/contract`, `tests/e2e`, `tests/fixtures`, `scripts`) with a `.gitignore` entry for `site/js/` and `site/sw.js` (build output)
- [X] T002 Create `package.json` (`"type": "module"`, engines node >=22.18) with scripts `build`, `typecheck`, `test:unit`, `test:contract`, `test:e2e`, `check`, `audit`, and dev dependencies typescript, @playwright/test, lighthouse, axe-core, http-server
- [X] T003 [P] Create `tsconfig.json` (strict, ES2022, `moduleResolution: bundler`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `erasableSyntaxOnly`, `rootDir: src`, `outDir: site/js`, excludes `src/sw.ts`) and `tsconfig.sw.json` (`lib: webworker`, emits `site/sw.js`)
- [X] T004 [P] Create `playwright.config.ts` (chromium, webServer `http-server site`, mobile + desktop projects) in repo root
- [X] T004a [P] Write failing unit tests for the check scripts using known-good and known-bad fixture directories (`check-version`: asset list changed without version bump fails; `check-precache`: emitted file missing from the precache list fails; `check-sw`: unconditional `skipWaiting` or missing stale-cache cleanup fails) in `tests/unit/check-scripts.test.ts` and `tests/fixtures/check/`
- [X] T005 [P] Create `scripts/check-version.mjs` failing when the emitted asset list changed without a bumped `VERSION` in `src/sw.ts`, until T004a passes for it
- [X] T006 [P] Create `scripts/check-precache.mjs` reading the emitted `site/js` file list and failing if any file is missing from the service worker precache list, until T004a passes for it
- [X] T007 [P] Create `scripts/check-sw.mjs` failing unless the worker only calls `skipWaiting` on a user message and deletes stale caches on `activate`, until T004a passes for it

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, seeds, app shell. No user story may start before this is complete.

**⚠️ CRITICAL**: Tests before implementation in every pair below.

- [X] T008 [P] Write failing unit tests for seeds and PRNG (format `3X3-…`/`ULT-…`/`CUB-…`, alphabet, parse errors, same seed → same sequence, no `Math.random` use) in `tests/unit/seed.test.ts`
- [X] T009 Define shared types (`Variant`, `Mark`, `Move` union, `GameConfig`, `GameState` envelope, `Status`, `Result`) per data-model.md in `src/core/types.ts`
- [X] T010 Implement seeds and integer PRNG (`newSeed`, `parseSeed`, `rngFor`, `hashString`, `randomSource`) in `src/core/seed.ts` until T008 passes
- [X] T011 [P] Create the base page with title, viewport, manifest link, theme pre-paint script, a `<main>` mount point and status `aria-live` region in `site/index.html`, and a `site/404.html`; every URL relative (no leading `/`) so the site works under a project subpath
- [X] T012 [P] Create light/dark design tokens (colours, spacing, focus ring, mark shapes) and `auto` mode via `prefers-color-scheme` in `site/css/theme.css`
- [X] T013 [P] Create base layout, setup-screen, dialog and board-grid styles (mobile first, touch targets ≥ 44 px) in `site/css/style.css`
- [X] T014 [P] Create `src/ui/ui.ts` (modal/dialog helper with focus trap, toast, safe `localStorage` wrapper with try/catch) and `src/ui/icons.ts` (inline SVG marks)
- [X] T015 Create the start screen with variant picker (Classic, Ultimate, Cube) and mode/option form shell in `src/ui/setup.ts` (depends on T009, T014)
- [X] T016 Create the app router/boot (`src/ui/app.ts`): start screen ↔ game screen, `dispatch(move)` wiring contract from core-api.md, status line updates (depends on T015)
- [X] T016a [P] Write failing contract test for `site/manifest.json` (name, short_name, `display`, theme/background colours, icons 192/512/maskable present as files, `start_url`/`scope`/`id` relative) in `tests/contract/manifest.test.ts`
- [X] T017 Create `site/manifest.json` (name, short_name, icons 192/512/maskable, `display: standalone`, relative `start_url`/`scope`/`id` (`./`), theme/background colours) and add placeholder icons under `site/icons/`, until T016a passes

**Checkpoint**: `npm run build && npm run typecheck` pass; start screen renders; seed tests green.

---

## Phase 3: User Story 1 - Classic vs Computer or Friend (Priority: P1) 🎯 MVP

**Goal**: Play Classic 3×3 / 4×4 / 5×5 against five computer levels or a friend on one device, with undo.

**Independent Test**: Master never loses on 3×3; local two-player works on all sizes; win/draw detected; undo removes the player's move and the reply.

### Tests for User Story 1 ⚠️ write first, see them fail

- [X] T018 [P] [US1] Unit tests for Classic rules (line enumeration for 3/4/5, win length 3 vs 4, draw, `isLegal` reasons `occupied`/`game-over`, `undo`, `fromMoves`, `hash`) in `tests/unit/classic.test.ts`
- [X] T019 [P] [US1] Unit tests for the AI (same seed + moves → same move; levels 1–5 ordering by strength in self-play; Master never loses on 3×3 against exhaustive opponent; node budget never exceeded; no clock/`Math.random`) in `tests/unit/ai.test.ts`
- [X] T020 [P] [US1] E2E test: set up and play 3×3 vs level 3, 4×4 and 5×5 local; win highlight, draw result, undo vs computer in `tests/e2e/classic.spec.ts`

### Implementation for User Story 1

- [X] T021 [US1] Implement Classic rules per core-api.md (`newGame`, `legalMoves`, `isLegal`, `apply`, `status`, `undo`, `fromMoves`, `hash`, `lines`) in `src/core/classic.ts`
- [X] T022 [US1] Implement negamax + alpha-beta with position-count budget, five levels, deterministic random-move rate (`chooseMove`) in `src/core/ai.ts` (depends on T021)
- [X] T023 [P] [US1] Implement the AI Web Worker wrapper in `src/ui/ai-worker.ts` and the page-side client (cancel on undo, ignore taps while thinking) in `src/ui/computer.ts` (depends on T022)
- [X] T024 [P] [US1] Implement the Classic board component: buttons with roving tabindex/arrow keys, accessible names, drawn marks, win-line stroke, in `src/ui/board-classic.ts` plus board styles in `site/css/style.css`
- [X] T024a [P] [US1] Unit tests for the refusal-message table (every reason key exported by the variant cores implemented so far has a non-empty user message; unknown key falls back to a generic message; messages name the cause, e.g. which board is required) in `tests/unit/messages.test.ts`
- [X] T024b [US1] Implement `src/ui/messages.ts`: reason key → user text, shown in the status live region and as a brief toast when a move is refused, until T024a passes
- [X] T025 [US1] Implement game screen controller (setup options, mode, level, mark choice, turn status, result dialog, undo, resign, new game) in `src/ui/game.ts` (depends on T021, T023, T024)
- [X] T026 [US1] Wire Classic into setup and app router (`src/ui/setup.ts`, `src/ui/app.ts`) and confirm T018–T020 pass

**Checkpoint**: Classic is fully playable and independently testable. MVP.

---

## Phase 4: User Story 2 - Ultimate Tic Tac Toe (Priority: P2)

**Goal**: Ultimate with forced-board routing, claims, overall result, same-device and computer play.

**Independent Test**: Forced board, free choice on closed target, claim, overall win and draw; computer plays only legal moves and replies < 1 s.

### Tests for User Story 2 ⚠️

- [X] T027 [P] [US2] Unit tests for Ultimate rules (first move free, forced = cell index, closed target → free choice, claim, full-unwon board counts for none, overall win/draw, `isLegal` reasons `not-your-board`/`closed-board`/`occupied`, `undo`, `fromMoves`, `hash`) in `tests/unit/ultimate.test.ts`
- [X] T028 [P] [US2] Unit tests for the Ultimate AI (legal moves only over many seeded self-play games; deterministic; node budget; Master beats level 1 over a seeded match set) in `tests/unit/ai-ultimate.test.ts`
- [X] T029 [P] [US2] E2E test: forced-board outline visible, free-choice highlight, claimed board overlay, overall win; computer reply < 1 s under 4× CPU throttle in `tests/e2e/ultimate.spec.ts`

### Implementation for User Story 2

- [X] T030 [US2] Implement Ultimate rules per core-api.md (`playable`, `claims`, plus shared shape) in `src/core/ultimate.ts`
- [X] T031 [US2] Implement Ultimate evaluation, move ordering and level budgets (`chooseMove` for ultimate) in `src/core/ai-ultimate.ts`; route variant in `src/core/ai.ts` (depends on T030)
- [X] T032 [P] [US2] Implement the Ultimate board component: 3×3 of 3×3 grids, playable-board outline with a non-colour cue, claimed overlays with mark shape, keyboard navigation, in `src/ui/board-ultimate.ts` and styles in `site/css/style.css`
- [X] T033 [US2] Generalise `src/ui/game.ts`/`src/ui/setup.ts` to select the variant's board component and options; add Ultimate to the start screen; add its reason keys to `src/ui/messages.ts`; confirm T027–T029 pass

**Checkpoint**: Classic and Ultimate both work independently.

---

## Phase 5: User Story 3 - 3D Cube Tic Tac Toe (Priority: P3)

**Goal**: Interactive 3D cube, placement on any face, layer rotations (quarter either way or half) after a scoring move, line-count result, flat fallback.

**Independent Test**: Play a full two-player game: marks land on correct faces from any angle, placement blocked until the layer rotation is made, rotations relocate marks and recount lines, 54 cells ends the game.

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Port the original's `rotate_up`, `rotate_left`, `make_turn` and `count_wins` as a throwaway reference script and generate golden rotation/line fixtures (27 rotations × sample positions) into `tests/fixtures/cube-golden.json`; commit both the reference script and the generated fixtures (Python is needed only to regenerate)
- [X] T035 [P] [US3] Unit tests for cube geometry (every rotate table is a permutation; inverse composes to identity; four quarter rotations = identity; half = quarter twice; mark counts conserved; outer layers also rotate their face; matches golden fixtures) in `tests/unit/cube-rotations.test.ts`
- [X] T036 [P] [US3] Unit tests for cube rules (8 lines per face, a move scores one point per completed line, scoring move sets phase `rotate`, `place` refused in phase `rotate` with `rotate-pending`, a rotation can break lines, a rotation never grants another rotation, game ends at 54 filled with no pending rotation, tie, last scoring move still requires its rotation, `undo` reverts placement+rotation as a unit, `fromMoves`, `hash`) in `tests/unit/cube.test.ts`
- [X] T037 [P] [US3] Unit tests for icon validation (1 grapheme, distinct, not blank, reasons) in `tests/unit/icons.test.ts`
- [X] T038 [P] [US3] E2E test: drag-rotate the cube, place on several faces, score, assert placement blocked then rotate via picker, flat view and keyboard-only path each complete a game in `tests/e2e/cube.spec.ts`

### Implementation for User Story 3

- [X] T039 [US3] Implement sticker indexing, face orientation convention and the 27 rotate permutation tables (`FACES`, `rotateTable`, `rotations`) in `src/core/cube.ts` until T035 passes
- [X] T040 [US3] Implement cube rules and phase machine (`newGame`, `isLegal`, `apply`, `lines`, `status`, `undo`, `fromMoves`, `hash`, `phase`) in `src/core/cube.ts` until T036 passes (depends on T039)
- [X] T041 [P] [US3] Implement icon validation (`validateIcons`) in `src/core/icons.ts` until T037 passes
- [X] T042 [P] [US3] Implement the 3D cube view: CSS 3D scene with one element per sticker, pointer-drag/touch/arrow-key view rotation, face-to-front snap, layer-group rotation animation that commits state on end, input held during animation, in `src/ui/cube-view.ts` and `site/css/cube.css`
- [X] T043 [US3] Implement the Cube board adapter: map clicks/Enter on stickers to `place` moves, show per-axis layer picker (3 layers × 3 amounts, labelled controls) when phase is `rotate`, scoreboard with live line totals, in `src/ui/board-cube.ts` (depends on T040, T042)
- [X] T044 [P] [US3] Implement the flat unfolded-net fallback view with the same actions, auto-selected when 3D transforms are unsupported and toggleable for accessibility, in `src/ui/board-cube.ts` and `site/css/cube.css`
- [X] T045 [US3] Add Cube to the start screen: two-player only (no computer option); wire into `src/ui/game.ts`/`src/ui/setup.ts`; add its reason keys to `src/ui/messages.ts`; confirm T034–T038 pass
 
**Checkpoint**: All three variants work on one device.

---

## Phase 6: User Story 4 - Save, Resume and Play Offline (Priority: P4)

**Goal**: Installable PWA; game and settings survive reloads; fully playable offline; update flow keeps the game.

**Independent Test**: Load once, go offline, play each variant, reload mid-game and resume; bump version and see the update bar without losing the game.

### Tests for User Story 4 ⚠️

- [X] T046 [P] [US4] Unit/contract tests for the save format (schema 1 round-trip, unknown schema kept and ignored, corrupt JSON ignored, state rebuilt via `fromMoves`) in `tests/contract/save.test.ts`
- [X] T047 [P] [US4] E2E tests: resume after reload for each variant; offline play after one load; install criteria (manifest, SW registered); update bar appears on new version and game survives, in `tests/e2e/offline.spec.ts`

### Implementation for User Story 4

- [X] T048 [US4] Implement `src/adapters/store.ts` (versioned save, settings, migration hooks, quota/unavailable handling) until T046 passes
- [X] T049 [US4] Persist after every move/rotation and restore on boot, including computer-to-move and mid-animation consistency, in `src/ui/game.ts` and `src/ui/app.ts` (depends on T048)
- [X] T050a [P] [US4] Unit tests for `scripts/gen-precache.mjs` (lists every emitted `site/` file, excludes `sw.js` itself and PeerJS, stable sort order, changes when a file is added) in `tests/unit/gen-precache.test.ts`
- [X] T050b [US4] Implement `scripts/gen-precache.mjs`, run by `npm run build`, writing the precache list that `src/sw.ts` imports, until T050a passes
- [X] T050 [US4] Implement the service worker (`VERSION`, generated precache list of `site/` assets and emitted JS, cache-first with versioned cache, scope and precache URLs resolved relative to the worker's own location, stale cache cleanup on activate, `skipWaiting` only on message) in `src/sw.ts`
- [X] T051 [P] [US4] Implement the update bar (detect waiting worker, "Update" button, reload) in `src/ui/update-bar.ts` and styles; register the worker from `src/ui/app.ts`
- [X] T052 [US4] Run `npm run build && npm run check` and confirm T047 and the three check scripts pass; add `npm run check` to the test workflow

**Checkpoint**: Installable, resilient, offline.

---

## Phase 7: User Story 5 - Replays, Seeds and Sharing (Priority: P5)

**Goal**: Instant replay at end of game, copyable/pasteable seeds, shareable replay links for all variants.

**Independent Test**: Finish a game, copy seed and link, open the link in a fresh context, identical replay, viewer's save untouched.

### Tests for User Story 5 ⚠️

- [X] T053 [P] [US5] Contract tests for `record.ts` per record-format.md (move tokens per variant incl. cube rotations `.x1+`/`.z02`; link pack/unpack round-trip; truncated, illegal and tampered links rejected; result always recomputed; seed paste selects variant and size) in `tests/contract/record.test.ts`
- [X] T054 [P] [US5] E2E tests: auto-replay controls (play/pause/step/scrub/move list, 0.5×/1×/2×/4×, speed remembered); cube replay includes rotations; shared link in a fresh context (also with the network offline after one prior load) replays without changing the host save; bad link shows friendly error in `tests/e2e/replay.spec.ts`

### Implementation for User Story 5

- [X] T055 [US5] Implement token encode/decode, link pack/unpack and replay folding in `src/core/record.ts` until T053 passes
- [X] T056 [P] [US5] Implement the replay player (frames from `fromMoves`, controls, speed, move list, cube rotation frames) in `src/ui/replay.ts` and styles
- [X] T057 [US5] Seed display and copy button during play and at the end; seed field on the start screen that sets variant and size; "Share replay" via Web Share API with clipboard fallback, in `src/ui/game.ts` and `src/ui/setup.ts`
- [X] T058 [US5] Open `?watch=` links read-only without touching the viewer's save, with Close replay and "Play this seed", in `src/ui/app.ts`; confirm T054 passes

**Checkpoint**: Replays and sharing work offline once loaded.

---

## Phase 8: User Story 6 - Hints, Settings and Theme (Priority: P6)

**Goal**: Optional hints, auto-replay toggle, icons, light/dark.

**Independent Test**: Hints off by default; on, winning cells (dot) and must-block cells (dashed ring) show on the player's turn, distinguishable without colour.

### Tests for User Story 6 ⚠️

- [X] T059 [P] [US6] Unit tests for hint queries (Classic win/block cells; Ultimate within playable boards; Cube line-completing cells ignoring rotation effects; none when off) in `tests/unit/hints.test.ts`
- [X] T060a [P] [US6] Tests for icons: chosen icons show on every variant's board, status text, result dialog and replay; invalid icons rejected with a message; icons are absent from `ReplayRecord`, share links, `SaveFile.game.config` and net messages; in `tests/e2e/icons.spec.ts` and `tests/contract/icons-private.test.ts`
- [X] T060 [P] [US6] E2E tests: hints default off; shapes visible; settings persist; theme toggle and `auto`; `scripts/check-theme.mjs` passes, in `tests/e2e/settings.spec.ts`

### Implementation for User Story 6

- [X] T061 [US6] Implement hint queries (`hints(state, mark)`) in `src/core/classic.ts`, `src/core/ultimate.ts`, `src/core/cube.ts` until T059 passes
- [X] T062 [P] [US6] Implement hint rendering (dot and dashed ring) in `src/ui/hints.ts` and board components
- [X] T063a [P] [US6] Implement a display-only mark-to-glyph mapping (`markGlyph`) used by all board components, status text, result dialog and replay, until T060a passes
- [X] T063 [P] [US6] Implement the settings dialog (hints, auto-replay, icons using the shared validation from T041, appearance) in `src/ui/settings.ts` and theme switching with pre-paint script match in `src/ui/theme.ts`
- [X] T063b [P] [US6] Write failing tests for `scripts/check-theme.mjs` with matching and mismatching pre-paint script fixtures in `tests/unit/check-theme.test.ts`
- [X] T064 [P] [US6] Create `scripts/check-theme.mjs` verifying the `index.html` pre-paint script matches `src/ui/theme.ts` logic, until T063b passes

**Checkpoint**: Settings, hints, theme done.

---

## Phase 9: User Story 7 - Play a Friend on Another Device (Priority: P7)

**Goal**: Host/join with a six-character code, link or QR; real-time play in any variant; undo by consent; reconnect.

**Independent Test**: Two browser contexts host and join, play to a result in each variant, screens agree after every move, undo accept/decline works, drop and rejoin resumes.

### Tests for User Story 7 ⚠️

- [X] T065 [P] [US7] Contract tests for `protocol.ts` per net-protocol.md (message validation, unknown/out-of-turn ignored, `hello`/`welcome`/`reject`, hash mismatch → resync, undo ask/answer, max one guest, cube placement+rotation from the same player) in `tests/contract/protocol.test.ts`
- [X] T066 [P] [US7] Unit tests for pairing codes (alphabet, length 6, normalisation, validity) and STUN-only ICE config (no TURN) in `tests/unit/net-codes.test.ts`
- [X] T067 [P] [US7] E2E tests with two browser contexts: host/join, turn enforcement, undo accept and decline, drop and rejoin, wrong/expired code error, offline hides the option while other modes work, each device shows its own chosen icons, in `tests/e2e/network.spec.ts`

### Implementation for User Story 7

- [X] T068 [US7] Implement message types, validation and the host-authoritative state machine in `src/core/protocol.ts` until T065 passes
- [X] T069 [US7] Implement the PeerJS adapter (lazy-load pinned 1.5.4 from CDN, never precached; explicit STUN `iceServers`; `generateCode`/`normaliseCode`/`isValidCode`; timeouts) in `src/adapters/net.ts` until T066 passes
- [X] T070a [P] [US7] Unit tests for the QR encoder (known inputs → expected module matrix; decodes back to the join link; handles the maximum link length) in `tests/unit/qr.test.ts`
- [X] T070 [P] [US7] Port the QR encoder so the join QR renders offline in `src/ui/qr.ts` until T070a passes
- [X] T071 [US7] Implement host/join flows (code, link, QR, waiting state, connection-lost and rejoin, hotspot hint on timeout) and network-mode game wiring (own-turn enforcement, remote undo consent, resign) in `src/multiplayer.ts` and `src/ui/game.ts`
- [X] T072 [US7] Add "Two devices" to the start screen for every variant; disable with message when offline; confirm T065–T067 pass

**Checkpoint**: All stories complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T072a [P] Write failing unit tests for the threshold logic in `scripts/audit.mjs` (accessibility score < 90 fails, axe serious violation fails, first-load interactive time ≥ 3 s fails, passing report passes) using canned Lighthouse and axe result fixtures in `tests/unit/audit.test.ts`
- [X] T073 [P] Create `scripts/audit.mjs` running Lighthouse (accessibility ≥ 90) and axe-core; add an axe pass for each variant screen to `tests/e2e/a11y.spec.ts`, until T072a passes
- [X] T073a [P] Installability e2e (manifest has name, icons 192/512/maskable, display, start_url, theme/background colours; service worker controls the page; app shell loads offline) in `tests/e2e/installable.spec.ts`, run by `npm run audit`
- [X] T074a [P] Add an e2e test that starting a game in each variant from a fresh load takes at most 3 interactions (SC-001) in `tests/e2e/input.spec.ts`
- [X] T074 [P] Add keyboard-only and touch-only full-game e2e runs for each variant in `tests/e2e/input.spec.ts` (SC-009)
- [X] T075 [P] Add AI latency test under 4× CPU throttle for Classic 3×3 and Ultimate at all levels (reply < 1 s, SC-004 and FR-016) in `tests/e2e/perf.spec.ts`, and tune budgets in `src/core/ai.ts`/`src/core/ai-ultimate.ts` if it fails
- [X] T076 [P] Add Cube frame-time test under 4× CPU throttle during view rotation and layer-rotation animation (SC-008: 95th-percentile frame ≤ 20 ms, no frame > 50 ms) in `tests/e2e/perf.spec.ts`
- [X] T077 [P] Create a first-load performance check on throttled 4G (< 3 s interactive) in `scripts/audit.mjs`
- [X] T077a [P] Unit tests for confetti (no particles under `prefers-reduced-motion`; particle count bounded; stops and removes its canvas) in `tests/unit/confetti.test.ts`
- [X] T078 Create the confetti win effect (respecting `prefers-reduced-motion`) in `src/ui/confetti.ts` until T077a passes
- [X] T079 [P] Add final icons, maskable icon and manifest screenshots in `site/icons/`; verify installability
- [X] T080 [P] Write `README.md` (what it is, variants and rules, scripts, release steps: bump `VERSION`, `npm run check`, `npm run audit`, and the manual new-player Cube usability check for SC-007)
- [X] T080a [P] Add GitHub Pages deployment: `.github/workflows/deploy.yml` (on push to main: npm ci, build, typecheck, test:unit, test:contract, check, then upload `site/` with actions/upload-pages-artifact and deploy with actions/deploy-pages), `site/.nojekyll`, and README deploy notes (enable Pages from Actions, Enforce HTTPS)
- [X] T080b Write the failing subpath e2e: serve `site/` under `/ultimattt/` and run the offline, install, resume and share-link checks in `tests/e2e/subpath.spec.ts`
- [X] T080c Make the site subpath-safe until T080b passes: relative `start_url`, `scope` and `id` in `site/manifest.json`, relative asset and worker URLs, service worker scope and precache derived from its own location, share links built from the current base URL, and a relative link back from `site/404.html`
- [X] T081 Run the full quickstart.md validation (steps 0–10) and record results in `specs/001-multi-variant-tictactoe/quickstart.md` notes; fix any failures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** → all user stories → **Polish (10)**.
- Within every story: test tasks first and seen failing, then core logic, then UI, then wiring.

### User Story Dependencies

- **US1 (P1)**: after Phase 2. MVP.
- **US2 (P2)**: after Phase 2; reuses `game.ts`/AI worker from US1 (T033 generalises them), but its core and tests are independent.
- **US3 (P3)**: after Phase 2; core and tests are independent of US1/US2; UI wiring touches `game.ts`/`setup.ts` (T045).
- **US4 (P4)**: needs at least one playable variant (US1); persists all variants present.
- **US5 (P5)**: needs `fromMoves` per variant (US1–US3 core); replay UI after US4's store only for settings (speed).
- **US6 (P6)**: hint queries need each variant's core; rendering after its board component.
- **US7 (P7)**: needs the game controller (US1) and `fromMoves`/`hash` for each variant.

### Within Each User Story

- Tests (written first, failing) → core logic → UI components → controller wiring → pass confirmation.

### Parallel Opportunities

- Setup: T003–T004a, T005–T007 (after T004a).
- Foundational: T008, T011–T014 together.
- After Phase 2, US1, US2 core, and US3 core can be built by different people: core test files are separate (`classic`, `ultimate`, `cube-rotations`, `cube`).
- US3: T034–T038 together; T041, T042, T044 together after T039/T040 begin.
- Polish T072a, T073–T077a, T079, T080, T080a (T080b before T080c).

---

## Parallel Example: User Story 3

```bash
# Tests together:
Task: "Cube golden fixtures in tests/fixtures/cube-golden.json"          # T034
Task: "Cube rotation unit tests in tests/unit/cube-rotations.test.ts"            # T035
Task: "Cube rules unit tests in tests/unit/cube.test.ts"                 # T036
Task: "Icon validation tests in tests/unit/icons.test.ts"                # T037
Task: "Cube e2e test in tests/e2e/cube.spec.ts"                          # T038

# UI pieces together once core exists:
Task: "3D cube view in src/ui/cube-view.ts + site/css/cube.css"          # T042
Task: "Flat fallback view in src/ui/board-cube.ts"                       # T044
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1): red tests → Classic core → AI → UI.
3. **Stop and validate**: `npm run typecheck && npm run test:unit`, then `tests/e2e/classic.spec.ts`; demo Classic.

### Incremental Delivery

1. Setup + Foundational.
2. US1 → demo (MVP).
3. US2 → Ultimate.
4. US4 early if a deployable PWA is wanted before the Cube (it is independent of US3).
5. US3 → Cube (largest effort; start core tests early in parallel).
6. US5, US6, US7, then Polish and the release gate (`npm run check`, `npm run audit`).

### Parallel Team Strategy

After Phase 2: one person US1, one US2 core, one US3 core+geometry; converge on `game.ts`/`setup.ts` at T026/T033/T045.

---

## Notes

- [P] = different files, no dependency on unfinished tasks.
- Commit tests red before or with the implementation (constitution gate); each PR shows the evidence.
- Bump `VERSION` in `src/sw.ts` whenever the asset list changes (enforced by T005).
- Avoid: logic in UI files (rules belong in `src/core`), `Math.random` or clocks in core, hand-editing `site/js`.

---

## Phase 11: Convergence

**Purpose**: Remaining work found by `/speckit-converge` on 2026-10-03, ordered by severity. Test tasks come before the code they cover.

- [X] T082 CRITICAL: Write a failing unit test for a `startStaticServer(dir, port)` helper in `scripts/lib/serve.mjs` (serves a folder, returns `{ url, stop }`, and after `stop()` resolves the port is free and no child process is left, on any operating system) in `tests/unit/serve.test.ts` per Constitution: Development Workflow (release audit) (partial)
- [X] T083 CRITICAL: Implement `scripts/lib/serve.mjs` until T082 passes, and use it in `scripts/audit.mjs` and `scripts/make-screenshots.mjs` in place of `npx http-server` plus the Windows-only `taskkill`, so both scripts run on Linux, macOS and Windows per Constitution: Development Workflow (release audit) (partial)
- [X] T084 CRITICAL: Add an `audit` job to `.github/workflows/deploy.yml` that runs `npm run audit` (Lighthouse accessibility, axe, first load under 3 s, installability, timing) and make `deploy` depend on it as well as `test`; update the workflow comment and the README release steps to say the audit now runs before every deploy per Constitution: Development Workflow (release audit) (partial)
- [X] T085 Record the release baseline so `check-version` can fail: run `npm run build`, then `node scripts/check-version.mjs --update`, commit `scripts/precache.lock.json`, and note in the README that this file must be refreshed at each release per Constitution: Technical Constraints (cache version bump) and plan R10 (partial)
- [X] T086 [P] Write failing e2e tests in `tests/e2e/network.spec.ts` that the host's two-device game survives a reload of the host page (same code, same moves, the guest reconnects and play continues) and that a guest who joins after the reload gets the whole game per FR-035 and Constitution III (partial)
- [X] T087 Persist the host's two-device game (config, moves, code, resignation) in `src/adapters/store.ts` and `src/ui/game.ts`, and on boot resume hosting under the same code in `src/ui/multiplayer.ts` and `src/ui/app.ts`, until T086 passes; a guest's game is not saved, and a finished game is cleared per FR-035 and Constitution III (partial)
- [X] T088 [P] Write failing unit tests that the start screen remembers its last choices (variant, size, opponent, level, mark) after a reload and after New game, and falls back to defaults for anything invalid, in `tests/unit/setup.test.ts` and `tests/contract/save.test.ts` per data-model: Settings `lastConfig` (partial)
- [X] T089 Store the last start-screen choices as `lastConfig` in `src/core/settings.ts` and `src/adapters/store.ts` and pre-select them in `src/ui/setup.ts` until T088 passes per data-model: Settings `lastConfig` (partial)
- [X] T090 Bring `specs/001-multi-variant-tictactoe/plan.md` Project Structure in line with the code: add `src/core/tokens.ts`, `src/core/config.ts`, `src/core/pairing.ts`, `src/adapters/restore.ts`, `scripts/gen-preload.mjs`, `scripts/lib/serve.mjs` and `playwright.perf.config.ts`, correct `src/multiplayer.ts` to `src/ui/multiplayer.ts`, and give a one-line reason for each per plan: Project Structure (unrequested)
