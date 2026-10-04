---

description: "Task list for Twist-Tac-Toe Rename and UI Polish"
---

# Tasks: Twist-Tac-Toe Rename and UI Polish

**Input**: Design documents from `/specs/004-twist-rename-and-ui-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): every implementation task is preceded by its test task; run the test and see it FAIL for the expected reason before implementing. Where an existing test asserts an old string, the test update is the failing-test step.

**Organization**: Grouped by user story (spec.md priorities): US1 rename (P1), US2 replay face turn (P1), US3 replay notation (P2), US4 status and score (P2), US5 Classic rules in help (P2), US6 help layout (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US6, from spec.md
- Authored TypeScript lives in `src/`, static assets and CSS in `site/`, tests in `tests/`. `site/js/` and `site/sw.js` are build output: never edit them
- Unit tests: `npm run test:unit` (`node --test`); contract: `npm run test:contract`; e2e: `npm run test:e2e`

---

## Phase 1: Setup

**Purpose**: Baseline and compatibility fixtures before any change

- [X] T001 Run `npm run build && npm test && npm run check` and record that the 003 baseline is green; fix nothing, just confirm the starting point
- [X] T002 [P] Capture 003 compatibility fixtures into `tests/fixtures/003/`: a saved Cube game in progress (`save-cube.json`), a Cube replay link and a seed (`links.json`), and a two-device welcome message (`welcome.json`); derive values from `tests/contract/save.test.ts`, `tests/contract/record.test.ts` and `tests/contract/protocol.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pure helpers that several stories use: the mode name and the face letters.

**⚠️ CRITICAL**: No story starts before this phase is complete.

- [X] T003 [P] Write failing unit tests in `tests/unit/variants-name.test.ts`: `variantName("cube","full")` is `Twist-Tac-Toe`, `("cube","short")` is `Twist`, Classic and Ultimate return their own names in both forms
- [X] T004 [P] Write failing unit test in `tests/unit/cube-labels.test.ts`: `FACE_LETTERS` is `["U","D","F","B","L","R"]` and is index-aligned with `FACE_NAMES`
- [X] T005 Implement `variantName(variant, form)` in `src/core/variants.ts` (stored id `"cube"` unchanged); make T003 pass
- [X] T006 Add `FACE_LETTERS` next to `FACE_NAMES` in `src/ui/cube-labels.ts`; make T004 pass

**Checkpoint**: helpers exist and are tested; stories can start.

---

## Phase 3: User Story 1 - Twist-Tac-Toe Naming (Priority: P1) 🎯 MVP

**Goal**: Every visible mention of the mode says Twist-Tac-Toe or Twist; old saves, links, seeds and invites still work.

**Independent Test**: Walk start screen, setup, game, result, replay link and help with no visible "Cube" as a mode name; open the 003 fixtures and confirm they load and play.

### Tests for User Story 1 ⚠️ write first, see them fail

- [X] T007 [P] [US1] Write failing unit test `tests/unit/visible-names.test.ts`: scan string literals in `src/ui/**` and `src/core/**` (comments stripped) for `\bCube\b`, allow-listing only the settings option text "Cube notation (R, U', F2, 2L)"; fails until the sweep is done
- [X] T008 [P] [US1] Update existing assertions to the new names so they fail before the code change: `tests/unit/setup.test.ts`, `tests/unit/messages.test.ts`, `tests/unit/cube-labels.test.ts`, `tests/unit/help-content.test.ts` (titles `["Classic rules","Ultimate","Twist-Tac-Toe","Setup options"]` is deferred to T039), `tests/contract/palette-private.test.ts`
- [X] T009 [P] [US1] Update e2e helpers and specs to the new visible names (variant button "Twist", "Twist rules", "Twist is for two players."): `tests/e2e/helpers.ts`, `tests/e2e/cube.spec.ts`, `tests/e2e/cube-rules.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/input.spec.ts`, `tests/e2e/network.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/perf.spec.ts`, `tests/e2e/settings.spec.ts`, `tests/e2e/help.spec.ts`, `tests/e2e/replay.spec.ts`
- [X] T010 [P] [US1] Write failing contract test `tests/contract/rename-compat.test.ts`: the T002 fixtures (save, replay link, seed, welcome message) parse and load unchanged and expose `variant === "cube"`

### Implementation for User Story 1

- [X] T011 [US1] Use `variantName` for the picker and note text in `src/ui/setup.ts`: button title "Twist", legend "Twist rules", hint "Twist is for two players."; keep the option values and stored ids
- [X] T012 [P] [US1] Replace `VARIANT_TITLE` in `src/ui/game.ts` with `variantName(..., "short")`; reword remaining Cube strings in the same file
- [X] T013 [P] [US1] Build the replay title in `src/ui/replay.ts` with `variantName(..., "short")`
- [X] T014 [P] [US1] Reword the Cube-mode strings in `src/ui/cube-labels.ts` (`cubeStatus`: "X scored! Turn a layer."), aria-labels in `src/ui/cube-view.ts` ("Twist, 3D view", "Twist, flat view"), and any in `src/ui/board-cube.ts`, `src/ui/hints.ts`, `src/ui/messages.ts`, `src/ui/app.ts`, `src/core/record.ts` ("Twist has no computer opponent."), `src/core/rules.ts` ("Only Twist has scoring and lock options.")
- [X] T015 [P] [US1] Reword `src/ui/settings.ts`: field label "Twist turn names"; keep option text "Cube notation (R, U', F2, 2L)" and value `"cube"`
- [X] T016 [P] [US1] Reword the Cube mentions in `src/ui/help-content.ts` to "Twist-Tac-Toe" (keep lower-case "the cube" for the shape); keep section id `cube`
- [X] T017 [P] [US1] Update `site/index.html` (title, description) and `site/manifest.json` (name, description, screenshot label) to say Twist
- [X] T018 [US1] Bump `VERSION` in `src/sw.ts` from `"3"` to `"4"`
- [X] T019 [US1] Run `npm run build && npm test && npm run check`; T007, T008, T010 pass; run the e2e specs changed in T009

**Checkpoint**: rename complete and compatible. MVP deliverable on its own.

---

## Phase 4: User Story 2 - Replay Turns the Cube to the Played Face (Priority: P1)

**Goal**: A Twist replay turns to the face of a placement that is not in view, then shows the mark.

**Independent Test**: Replay a Twist game with placements on all six faces; at each placement the face is visible when the mark appears.

### Tests for User Story 2 ⚠️ write first, see them fail

- [X] T020 [P] [US2] Write failing unit tests `tests/unit/cube-view-visible.test.ts` for `faceInView(rx, ry, face)`: default angle shows the front face and not the back, bottom or opposite sides; each `faceViewAngles(f)` puts face `f` in view; slivers below 0.5 depth are not in view; agrees with `frontFace` at exact face angles
- [X] T021 [P] [US2] Write failing e2e in `tests/e2e/replay.spec.ts`: replay a scripted Twist game covering all six faces; at each placement assert the played face is the front or visibly in view when the mark appears, that a visible-face placement leaves the view angles unchanged, and that a layer turn step does not change the view
- [X] T022 [P] [US2] Write failing e2e in `tests/e2e/replay.spec.ts`: slider jump across hidden faces then step back ends on the last placement's face with no half-turned state; flat view never turns; reduced-motion emulation sets the face before the mark with no animation; speed 4× still completes turn then mark

### Implementation for User Story 2

- [X] T023 [US2] Implement pure `faceInView(rx, ry, face)` in `src/ui/cube-labels.ts` (depth component of the outward normal ≥ 0.5, same maths as `frontFace`); make T020 pass
- [X] T024 [US2] Add `turnToFace(face, ms): Promise<void>` to the `CubeView` interface and implementation in `src/ui/cube-view.ts`: apply `faceViewAngles` through the existing `applyView(true)`, resolve on `transitionend` with a `ms + 50` timeout fallback, resolve immediately after setting angles under reduced motion, and in flat view
- [X] T025 [US2] Add a `stepMs` option through `src/ui/boards.ts` to `createCubeBoard` in `src/ui/board-cube.ts`; in read-only `update()`, when the last move is a placement and its face is not in view, `await view.turnToFace(face, min(350, 0.6 × stepMs))` then `if (mine === generation) show(state, fresh)`
- [X] T026 [US2] Pass the replay step time (`max(MIN_STEP_MS, STEP_MS / speed)`) to `createBoard` in `src/ui/replay.ts`, updating it when the speed changes
- [X] T027 [US2] Run T020–T022 until green; run `tests/e2e/cube.spec.ts` to confirm the live board is unchanged

**Checkpoint**: replays follow the action; US1 still green.

---

## Phase 5: User Story 3 - Cleaner Replay Notation (Priority: P2)

**Goal**: Placements read `AcB` / `UAcB`; no X/O in labels; words-only accessible names.

**Independent Test**: Replay one game per variant and compare every entry with the format.

### Tests for User Story 3 ⚠️ write first, see them fail

- [X] T028 [P] [US3] Rewrite the `describeMove` assertions in `tests/unit/replay.test.ts` and `tests/contract/palette-private.test.ts` for the `{ label, name }` result: Classic `3. 2c3` / "Move 3, X, row 2, column 3"; Ultimate `2. <centre board> 1c3`; Twist placement `1. F2c2`; Twist turns keep `6. R` (cube style) and `6. turn the right layer up` (words); sizes 4 and 5 use rows and columns up to 5; no label contains X or O as a mark
- [X] T029 [P] [US3] Write failing e2e in `tests/e2e/replay.spec.ts`: list entries show `AcB` / `UAcB` text with no X/O, each button's accessible name is the words form with the mover, and the notation setting still changes turn entries only

### Implementation for User Story 3

- [X] T030 [US3] Change `describeMove` in `src/ui/replay-text.ts` to return `{ label, name }` per data-model.md using `FACE_LETTERS`; make T028 pass
- [X] T031 [US3] Use `label` as text and `name` as `aria-label` of each `.move-item` in `src/ui/replay.ts`; make T029 pass

**Checkpoint**: notation done; US1 and US2 still green.

---

## Phase 6: User Story 4 - Clearer Move and Score Display (Priority: P2)

**Goal**: One consistent status wording and a labelled Twist score row.

**Independent Test**: Start each variant and opponent type; status and score follow the contract at every turn and fit at 320 px.

### Tests for User Story 4 ⚠️ write first, see them fail

- [X] T032 [P] [US4] Write failing unit tests `tests/unit/status-text.test.ts` for `statusText`: computer "Your move (X).", one device "X to move.", two devices "Your move (X)." / "Waiting for your friend (O).", Twist after a score "X scored! Turn a layer.", results (winner, draw, tie, resignation, lock end), Ultimate suffix for where to play
- [X] T033 [P] [US4] Write failing e2e in `tests/e2e/cube.spec.ts`: score row `#cube-score` shows the label (Lines or Faces) then both counts with mark shapes, accessible text "Lines: X 0, O 0", updates after a scoring move; and at 320 px status and score do not clip or overlap the board (bounding boxes)
- [X] T034 [P] [US4] Update status assertions in `tests/e2e/classic.spec.ts`, `tests/e2e/ultimate.spec.ts`, `tests/e2e/network.spec.ts` to the contract phrases where they differ

### Implementation for User Story 4

- [X] T035 [US4] Create `src/ui/status-text.ts` with pure `statusText(ctx)` per data-model.md `StatusContext`; make T032 pass
- [X] T036 [US4] Route `src/ui/game.ts` status (lines near 213–230) and `cubeStatus` in `src/ui/cube-labels.ts` through `statusText`
- [X] T037 [US4] Rebuild the score row in `src/ui/board-cube.ts` (`#cube-score`): label, then mark (shared `createMark`) and count per player, `aria-live="polite"`, accessible text `Label: X n, O n`; style in `site/css/cube.css` so it wraps at 320 px
- [X] T038 [US4] Run T033, T034 until green; confirm the live announcement still fires once per move

**Checkpoint**: status and score consistent; US1–US3 still green.

---

## Phase 7: User Story 5 - Classic Rules and Win Conditions in Help (Priority: P2)

**Goal**: A leading Classic rules section covering goal, turns, draw, lines, and win length per board size.

**Independent Test**: Read the section cold; goal, turn order, win length for 3×3, 4×4, 5×5 and draw are all answered.

### Tests for User Story 5 ⚠️ write first, see them fail

- [X] T039 [P] [US5] Update `tests/unit/help-content.test.ts`: section order and titles `["Classic rules","Ultimate","Twist-Tac-Toe","Setup options"]`, ids `["classic","ultimate","cube","setup"]`; Classic covers goal, turn, end and size topics; text mentions rows, columns, diagonals, draw, "3" for 3×3 and "4" for 4×4 and 5×5; every `example` has a non-empty `alt`
- [X] T040 [P] [US5] Write failing e2e in `tests/e2e/help.spec.ts`: Classic rules is first, `#help-classic` exists, contains its examples with accessible text, and the page works offline

### Implementation for User Story 5

- [X] T041 [US5] Add `"classic"` to `HelpSection["id"]` and a first `classic` section to `HELP_SECTIONS` in `src/ui/help-content.ts`: goal, steps (X first, alternate), draw on a full board, rows/columns/diagonals, default win length per size, win length adjustable in setup; examples (3×3 diagonal win; 4×4 row of four, and three in a row that does not win) with `alt` text; make T039 pass
- [X] T042 [US5] Confirm `src/ui/help.ts` renders the new section with no code change (add one only if a type error forces it); make T040 pass

**Checkpoint**: help content complete.

---

## Phase 8: User Story 6 - Help Page Layout and Padding (Priority: P3)

**Goal**: Comfortable reading width, even spacing, no horizontal scroll, both themes.

**Independent Test**: Help at 320 px and desktop in light and dark: margins, separation, no sideways scroll, keyboard focus visible.

### Tests for User Story 6 ⚠️ write first, see them fail

- [X] T043 [P] [US6] Write failing e2e in `tests/e2e/help.spec.ts`: at 320 px `document.documentElement.scrollWidth <= clientWidth`; `.help` side gutter ≥ 16 px; at 1280 px `.help` width ≤ about 42 rem; consecutive `.help-section` gaps are equal; light and dark both render with axe contrast clean
- [X] T044 [P] [US6] Extend `tests/e2e/a11y.spec.ts` for the help page: axe run in both themes, every control focusable with a visible focus ring and an accessible name

### Implementation for User Story 6

- [X] T045 [US6] Style `.help`, `.help-section`, `.help-top`, `.help-example`, `.help-boards` in `site/css/style.css`: max-width ~42rem centred, gutters `max(1rem, env(safe-area-inset-*))`, consistent vertical rhythm with a rule between sections, heading size steps, examples wrap and never overflow; theme tokens only (no raw colours)
- [X] T046 [US6] Add any class hooks needed in `src/ui/help.ts`; run T043, T044 until green; run `node scripts/check-theme-tokens.mjs` and `node scripts/check-theme.mjs`

**Checkpoint**: all six stories done.

---

## Phase 9: Polish & Cross-Cutting

- [X] T047 Re-run the T007 name scan and an e2e text sweep over start, setup, game, result, replay, settings and help in light and dark; fix any visible "Cube" mode name left
- [X] T048 [P] Run `npm run build && npm test && npm run check && npm run test:e2e`; all green
- [X] T049 [P] Run `npm run audit` (Lighthouse PWA and accessibility ≥ 90) and `npm run test:perf`; confirm no regression
- [ ] T050 Execute the manual walk-through in `specs/004-twist-rename-and-ui-polish/quickstart.md` (rename, replay face turn with reduced motion, notation, status at 320 px, help offline)
- [X] T051 Update `README.md` mentions of the Cube mode to Twist-Tac-Toe

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → stories. Phase 2 blocks all stories (T005 for US1, T006 for US3).
- **US1** first (MVP): its e2e/unit renames touch files other stories also edit, so landing it first avoids rework.
- **US2** depends on US1 only for names in tests. **US3** depends on T006. **US4** has no story dependency beyond US1's wording. **US5** and **US6** are independent of US2–US4; US6 follows US5 only because both edit `help.spec.ts` and the help page.
- Order inside every story: tests (fail) → pure code → DOM code → green run.
- Phase 9 after all stories.

### Parallel opportunities

- T003 ∥ T004; T007 ∥ T008 ∥ T009 ∥ T010; T012–T017 are different files, run together after T011 settles the helper use.
- T020 ∥ T021 ∥ T022; T028 ∥ T029; T032 ∥ T033 ∥ T034; T039 ∥ T040; T043 ∥ T044.
- After US1, US2, US3, US4 and US5 can be done by different people at once (watch shared `replay.ts`: T013, T026, T031 touch it, so sequence those three).

## Implementation Strategy

**MVP**: Phases 1–3 (setup, helpers, US1 rename). Ship-able alone: name, compat, cache bump.

**Incremental**: add US2 (replay turn), then US3 (notation), US4 (status/score), US5 (Classic help), US6 (layout); validate each with its Independent Test and re-run `npm test` before moving on.

**Total**: 51 tasks (Setup 2, Foundational 4, US1 13, US2 8, US3 4, US4 7, US5 4, US6 4, Polish 5).

---

## Phase 10: Convergence

**Purpose**: Remaining gaps found by `/speckit-converge` after the implement pass. T050 (manual walk-through) is still open from Phase 9 and is not repeated here.

- [X] T052 CRITICAL Show red-then-green for `tests/unit/status-text.test.ts`: it was written in the same step as `src/ui/status-text.ts`, so no failing run exists. Temporarily break each phrase in `statusText` (one at a time), confirm the matching test fails for the expected reason, then restore the code and re-run `npm run test:unit` per Constitution I (contradicts)
- [X] T053 [P] Extend the 320 px status/score/board test in `tests/e2e/cube.spec.ts` to run in both light and dark appearance (`page.emulateMedia({ colorScheme })`) and assert no clipping or overlap in each, per SC-006 (partial)
- [X] T054 [P] Add a 320 px run of the help page in light and dark to `tests/e2e/a11y.spec.ts` (axe clean, no horizontal scroll, controls reachable) per SC-007 and US6/AC1 (partial)
- [X] T055 [P] Remove `cubeStatus` from `src/ui/cube-labels.ts` (no production code calls it any more since `game.ts` uses `statusText`) and move its assertions in `tests/unit/cube-labels.test.ts` to `tests/unit/status-text.test.ts`, or record why it is kept, per plan: status wording has one source (unrequested)
