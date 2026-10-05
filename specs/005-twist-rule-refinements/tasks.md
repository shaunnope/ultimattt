---

description: "Task list for Twist Mode Display Polish and New Logo"
---

# Tasks: Twist Mode Display Polish and New Logo

**Input**: Design documents from `/specs/005-twist-rule-refinements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): every implementation task is preceded by its test task; run the test and see it FAIL for the expected reason before implementing. Where an existing test asserts an old string, the test update is the failing-test step.

**Organization**: Grouped by user story (spec.md priorities): US1 lock icon (P1), US2 last-move indicator (P1), US3 current-player pill (P2), US4 logo (P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, from spec.md
- Authored TypeScript lives in `src/`, static assets and CSS in `site/`, tests in `tests/`. `site/js/` and `site/sw.js` are build output: never edit them
- Unit tests: `npm run test:unit` (`node --test`); contract: `npm run test:contract`; e2e: `npm run test:e2e`
- Spec-kit scripts resolve to the wrong feature folder on branch `main`; the feature folder is always `specs/005-twist-rule-refinements/`

---

## Phase 1: Setup

**Purpose**: Baseline before any change

- [X] T001 Run `npm run build && npm test && npm run check` and record that the 004 baseline is green; fix nothing, just confirm the starting point
- [X] T002 [P] Run `npm run test:e2e` once and record which specs pass, so later failures can be told apart from pre-existing ones

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared piece more than one story could need: the padlock icon path.

**⚠️ CRITICAL**: No story starts before this phase is complete.

- [X] T003 [P] Write a failing unit test in `tests/unit/mark.test.ts` (or a new `tests/unit/icons.test.ts`) that `icon("lock")` returns an SVG whose paths exist and whose stroke attributes include `stroke-linecap="round"`
- [X] T004 Add the `lock` path (padlock body and shackle, 24×24 box, round caps and joins) to `PATHS` in `src/ui/icons.ts` so T003 passes
- [X] T005 Dropped: no screen-reader-only text is added (the padlock is decorative; stickers announce "locked face"), so no `.sr-only` work is needed

**Checkpoint**: `icon("lock")` available.

---

## Phase 3: User Story 1 - Lock Icon on Locked Faces (Priority: P1) 🎯 MVP

**Goal**: A locked Twist face shows a padlock icon instead of the visible word "Locked".

**Independent Test**: Twist game with lock on, score a line: the face shows a padlock, no visible "Locked" text, in 3D and flat view, on 3×3, 4×4 and 5×5.

### Tests for User Story 1 (write first, confirm they FAIL)

- [X] T006 [US1] In `tests/e2e/cube-rules.spec.ts` replace the assertion at line ~76 (`.face-locked-label … hasText "Locked"` visible) with: `.face-locked-label:not([hidden]) .lock-icon` is visible, the label has no text at all (`textContent` is empty) and is `aria-hidden="true"`
- [X] T007 [P] [US1] Add e2e cases in `tests/e2e/cube-rules.spec.ts`: padlock shown in flat view; an unlocked face has no visible padlock; stepping a replay back before the lock hides the padlock (spec scenario 6); the locked stickers still carry `data-locked="true"` and an accessible name containing "locked face" (this is how a screen reader learns a face is locked)
- [X] T008 [P] [US1] Add an e2e case in `tests/e2e/cube-rules.spec.ts` on a 5×5 board at a 390 px wide viewport: the padlock is visible and a click on an unlocked face's empty sticker still places a mark (it is not covered)

### Implementation for User Story 1

- [X] T009 [US1] In `src/ui/cube-view.ts` (the `lockLabels` block, ~line 118) replace `h("span", null, "Locked")` with the `lock` icon (class `lock-icon`) only (no text, no sr-only span); keep `aria-hidden="true"` and the `hidden` toggle in `applyLocks`; update the doc comment above it
- [X] T010 [US1] In `site/css/cube.css` restyle `.face-locked-label span` (~lines 97–108): a round badge sized from `--E` so it stays small on 5×5, border and `var(--surface)` fill, `.lock-icon` stroke `currentColor`; keep `pointer-events: none` and the 3D and flat-view positioning rules; add a forced-colours safe border
- [X] T011 [US1] Update the comment in `site/css/cube.css` ("a text badge") to say icon badge
- [X] T012 [US1] Run T006–T008 and `tests/unit/visible-names.test.ts`; confirm they pass and nothing visible says "Locked" on a face

**Checkpoint**: US1 complete and independently verifiable.

---

## Phase 4: User Story 2 - Last Move Indicator in Twist (Priority: P1)

**Goal**: The cell of the latest placement carries an inset border, following the mark through layer turns.

**Independent Test**: Play placements on several faces with layer turns between; exactly one sticker has `data-last` and it is the latest placement's mark.

### Tests for User Story 2 (write first, confirm they FAIL)

- [X] T013 [P] [US2] Write failing unit tests in `tests/unit/cube-last-placed.test.ts` for `lastPlacedSticker(state)`: `null` for a new game; the placed index after one placement; unchanged after a layer turn that does not include it; moved to the correct new index (checked against `rotateTable`) after a layer turn that does include it; follows two successive turns; correct after `undo`; correct on 3×3, 4×4 and 5×5; a game with only rotations after the last placement still returns the mark's current index
- [X] T014 [P] [US2] Write failing e2e tests in `tests/e2e/cube.spec.ts`: zero `[data-last]` stickers on a new game; exactly one after a placement and it is that sticker; still one and on the carried mark after a layer turn; moves back after undo; present after a reload of a saved game; present after loading a replay link and stepping to a move; present together with `data-locked` and `data-line` (ring still visible via its computed style)

### Implementation for User Story 2

- [X] T015 [US2] Add `lastPlacedSticker(state: CubeState): number | null` to `src/core/cube.ts` (pure; walks `state.moves`, sets the index on a `place`, and on a `rotate` moves it to the `dst` with `rotateTable(size, axis, layer, dir)[dst] === idx`, leaving it alone if untouched); export it so T013 passes
- [X] T016 [US2] In `src/ui/cube-view.ts` add `setLast(index: number | null): void` to the `CubeView` interface and implementation: remove `data-last` from the previous sticker, set it on the new one, touch no others; reset it in `reset`/`update` paths that clear the board
- [X] T017 [US2] In `src/ui/board-cube.ts` `show()` call `view.setLast(lastPlacedSticker(state))` so play, undo, load and replay all use the same path
- [X] T018 [US2] In `site/css/cube.css` add `.sticker[data-last]` (full inset ring via `box-shadow: inset 0 0 0 3px var(--fg)` plus an inner offset ring, readable on both themes) and a `forced-colors` outline fallback; ensure it does not clash with `[data-locked]` hatch, `[data-line]`, `[data-ghost]` or hint styles; add any new token to both themes if needed so `check-theme-tokens` passes
- [X] T019 [US2] Run T013–T014 and `tests/unit/cube-view-visible.test.ts`; confirm they pass

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Current Player Pill in All Modes (Priority: P2)

**Goal**: Every mode shows a two-segment pill with the mover highlighted; Twist also shows scores in it; the plain turn prompt and `#cube-score` are gone.

**Independent Test**: Play Classic, Ultimate and Twist (lines and faces): the highlight tracks the mover, Twist scores update in the segments, no "Lines"/"Faces" text in the pill, no `#cube-score`, status line empty for plain turns.

### Tests for User Story 3 (write first, confirm they FAIL)

- [X] T020 [P] [US3] Write failing unit tests in `tests/unit/pill-model.test.ts` for `pillModel`: X first and O second always; mover active while playing; same mover kept through a Twist `rotate` phase; neither active when over; winner flagged on a win, none on tie or draw; resignation marks the other player the winner; `score` present only for Twist; `you` set for the human in computer games and for `myMark` in two-device games; `spoken` text ("O to move, X 2, O 1", "O to move", "X wins, X 3, O 1")
- [X] T021 [P] [US3] Update `tests/unit/status-text.test.ts`: plain turns ("X to move", "Your move (X)") now return `""` in one-device, computer and two-device modes and for Ultimate (where-to-play note alone remains when set); results, resignation, "Waiting for your friend (O).", the Twist rotate prompts, "Computer is thinking…" and lock notes unchanged
- [X] T022 [P] [US3] Write failing e2e tests in a new `tests/e2e/pill.spec.ts`: `#turn-pill` present in Classic, Ultimate and Twist with X then O; X `aria-current` at start; moves to O after a move; Classic and Ultimate have no `.pill-score`; Twist shows `0` and `0` then the scorer's count after scoring and keeps the highlight through the layer turn; no "Lines" or "Faces" text in the pill; `#cube-score` does not exist; the pill is not focusable or clickable; neither segment is active and the winner has `data-winner` plus visible text after a win; both segments unmarked on a draw; the live region announces "O to move"; with `prefers-reduced-motion: reduce` the `.pill-thumb` has no transition
- [X] T023 [P] [US3] Add e2e cases in `tests/e2e/pill.spec.ts` for replay (the pill and Twist scores follow stepping and the slider), two-device play (segment order X then O on both devices, local segment captioned "You"), computer play (human segment captioned "You", highlight sits on the computer while it thinks and the status line says "Computer is thinking…"), a replay case that the replay view's `#game-status` is empty at a plain turn and shows the result at the end, and a 320 px viewport in light and dark (no overflow: `scrollWidth <= clientWidth`, both segments fully inside the viewport)
- [X] T024 [US3] Update the existing e2e assertions that read plain turn text from `#game-status` to read the pill instead: `tests/e2e/cube.spec.ts` (lines ~83, 101, 190, 349), `tests/e2e/help.spec.ts` (~41), `tests/e2e/offline.spec.ts` (~57, 69, 77), `tests/e2e/classic.spec.ts` (~35), `tests/e2e/input.spec.ts` (~43 where it asserts a turn), `tests/e2e/network.spec.ts` ("your move" lines ~74, 93, 120, 145, 264, 278, 382); keep assertions for results, "waiting for your friend", "turn a layer", where-to-play and errors on `#game-status`. Add a helper `expectTurn(page, "X" | "O")` to `tests/e2e/helpers.ts` that asserts `#turn-pill [data-mark=X]` or `[data-mark=O]` has `aria-current="true"`
- [X] T025 [US3] Update the `#cube-score` assertions in `tests/e2e/cube.spec.ts` (~577), `tests/e2e/cube-rules.spec.ts` (~10–12, 106–147) and `tests/e2e/compat.spec.ts` (~63, 92) to read `#turn-pill .pill-score` for X and O; remove assertions on the "Lines"/"Faces" label text and the `#cube-score` comment block; assert instead that `#game-title` of a Twist game contains "lines scoring" or "faces scoring" (see T051–T053)

### Implementation for User Story 3

- [X] T026 [US3] Add `PillModel`, `Segment` and `pillModel(ctx)` to `src/ui/status-text.ts` (pure, no DOM) per data-model.md so T020 passes
- [X] T027 [US3] In `src/ui/status-text.ts` make `statusText` return `""` for plain turns in every mode, keeping every other branch; update the file's header comment; T021 passes
- [X] T028 [P] [US3] Create `src/ui/pill.ts`: `createPill()` returning `{ element, update(model) }`; builds `#turn-pill` (`role="group"`, `aria-label="Current player"`), two segments with `createMark`, optional `.pill-score`, a `.pill-thumb`, `aria-current` and `data-active` on the mover, `data-winner` plus a visible "Winner" text cue, a "You" caption; non-interactive; updates only changed nodes
- [X] T029 [US3] Add pill styles to `site/css/style.css` (new `.turn-pill` block): pill container, two equal segments, `.pill-thumb` moved by `transform: translateX(...)` with a transition removed under `prefers-reduced-motion`, active state not by colour alone (bold text plus outline plus filled thumb), forced-colours fallback, fits 320 px, both themes with existing tokens only
- [X] T030 [US3] In `src/ui/game.ts` mount the pill (from `createPill`) above the board in `start()`, update it in `render()` from `pillModel(...)` using `this.config`, `this.state`, `this.net?.myMark`, `this.human`, `this.resigned`; hide `#game-status` when its text is empty; send `pillModel(...).spoken` to `announce()` when the status text is empty, and the status text otherwise
- [X] T031 [US3] In `src/ui/replay.ts` (and `src/ui/boards.ts` only if needed) mount a pill for the replay view and update it for every shown position, including slider jumps and stepping backwards; also apply the same status-line rule in the replay view: its `#game-status` (created at ~line 53) stays empty and hidden for a plain turn and shows only results, resignation and similar messages
- [X] T032 [US3] In `src/ui/board-cube.ts` remove the `score` element, `drawScore`, and the `scoreLabel` score line from `element`; in `src/ui/cube-labels.ts` KEEP `scoreLabel`: `src/ui/game.ts` (~line 425) still uses it for the end-of-game dialog ("Final lines: …")
- [X] T051 [P] [US3] Write failing unit tests in `tests/unit/cube-labels.test.ts` for `optionsNote`: update the existing cases (lines 99–101) to the new signature `optionsNote({ variant, scoring, lockFaces })`; Twist lines is `", lines scoring"`, Twist faces is `", faces scoring"`, Twist faces plus lock is `", faces scoring, locked faces"`, Twist lines plus lock is `", lines scoring, locked faces"`; Classic and Ultimate return `""` regardless of `scoring`
- [X] T052 [US3] Update `optionsNote` in `src/ui/cube-labels.ts` to take `variant` and always name the scoring kind for Twist only; pass `config.variant` from its two callers, `src/ui/game.ts` (~line 188) and `src/ui/replay.ts` (~line 163); T051 passes
- [X] T053 [P] [US3] Add e2e assertions: in `tests/e2e/cube-rules.spec.ts` a Twist game's `#game-title` contains "lines scoring" by default and "faces scoring" with Faces scoring, in live play and in the replay title; in `tests/e2e/classic.spec.ts` and `tests/e2e/ultimate.spec.ts` the title contains neither; `tests/e2e/compat.spec.ts` (~line 65) keeps passing for a pre-change Lines save
- [X] T033 [US3] In `src/ui/setup.ts` and `src/ui/help-content.ts` check whether any help or setup text refers to the score line or a turn prompt; reword to mention the pill if so (help text change only; update `tests/unit/help-content.test.ts` first if its assertions break)
- [X] T034 [US3] Run T020–T025 and the full `npm run test:e2e` for the rewritten specs; confirm the pill, status line and scores behave per contracts/ui-contracts.md

**Checkpoint**: US1–US3 work independently; every mode shows the pill.

---

## Phase 6: User Story 4 - New Logo (Priority: P2)

**Goal**: A 2×2×2 cube logo with X's and O's, all strokes round-capped, in the header, favicon and install icons.

**Independent Test**: View header logo (light and dark), favicon at 16 px, and install and maskable icons; every referenced icon exists offline.

### Tests for User Story 4 (write first, confirm they FAIL)

- [X] T035 [P] [US4] Write failing unit tests in `tests/unit/logo.test.ts`: `site/icons/logo.svg` exists, parses as SVG, every stroked element has `stroke-linecap="round"` and `stroke-linejoin="round"` (no `butt`, `miter` or `square`), has no `<text>`, and contains at least one X and one O shape (identified by `data-mark` attributes on their groups)
- [X] T036 [P] [US4] Write failing unit tests in `tests/unit/make-icons.test.ts` for the pure helpers exported from `scripts/make-icons.mjs` (a `renderLogo(size, pad)` that returns an RGB buffer): the 192, 512, 180 and maskable sizes have the right dimensions; the maskable version has only background colour in the outer 10% border (safe zone); the artwork has non-background pixels for both the X colour and the O colour
- [X] T037 [P] [US4] Write failing e2e tests in `tests/e2e/installable.spec.ts` and `tests/e2e/offline.spec.ts`: `.app-logo` is visible in the header and start screen and has `aria-hidden="true"`; every icon in `manifest.json` returns 200 and an image with the stated size; offline reload still shows the logo and loads the icons; `<link rel="icon">` resolves
- [X] T038 [P] [US4] Add an accessibility case in `tests/e2e/a11y.spec.ts` that the header with the logo has no axe violations in light and dark and the logo contrast against the header background is at least 3:1 (non-text contrast)

### Implementation for User Story 4

- [X] T039 [US4] Design the logo geometry (isometric cube, three visible faces, each split 2×2, X's and O's on cells, round caps and joins, 64×64 viewBox) and write `site/icons/logo.svg` using `currentColor` for the ink and the existing accent and O colour as CSS variables with fallbacks so T035 passes
- [X] T040 [US4] Rewrite `scripts/make-icons.mjs`: keep the dependency-free PNG writer, replace `artwork()` with a distance-to-rounded-segment rasteriser using the same coordinates as `logo.svg` (extract the shared segment list into one constant), export `renderLogo(size, pad)` for tests, and write `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180) and `icon-maskable-512.png` (pad 0.2); make the main write step run only when executed directly so T036 can import it
- [X] T041 [US4] Run `node scripts/make-icons.mjs`; open the four PNGs and `logo.svg` and check visually at 16, 32, 192 and 512 px that the cube, the X and the O read clearly
- [X] T042 [US4] In `site/index.html` add the inline `.app-logo` SVG beside the `h1` in `.app-header`, set the favicon `<link rel="icon">` to `icons/logo.svg` (keep the PNG as a fallback), and in `src/ui/setup.ts` (start screen) show the same logo; add `.app-logo` sizing and colours to `site/css/style.css` using tokens only
- [X] T043 [US4] Add `icons/logo.svg` to the precache list (run `node scripts/gen-precache.mjs`; do not hand-edit `site/precache.json` or `scripts/precache.lock.json` beyond what the script writes) and confirm `manifest.json` icon entries still point to existing files with correct `sizes`
- [X] T044 [US4] Run T035–T038 and `npm run check`

**Checkpoint**: All four stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T045 Bump `VERSION` from `"4"` to `"5"` in `src/sw.ts` (changed CSS, JS, icons, manifest); run `npm run build` and `node scripts/check-version.mjs`
- [X] T046 [P] Run the full gate: `npm run build && npm test && npm run check && npm run test:e2e`; everything must pass, including `check-names` (no reference project names in visible text) and `check-theme-tokens`
- [X] T047 [P] Run `npm run audit` (Lighthouse) and confirm accessibility ≥ 90 and installability still passes with the new icons
- [X] T048 [P] Compatibility check for FR-017: `tests/contract/rename-compat.test.ts` and the 002/003 fixtures (`tests/fixtures/`) still pass unchanged; open a saved Twist game, replay link and seed from before this change and confirm they load with the pill, padlock and last-move ring
- [X] T049 [P] Update `README.md` where it describes the turn or score display or the logo, if it does
- [X] T050 Walk through every scenario in `specs/005-twist-rule-refinements/quickstart.md` (including 320 px in both themes and reduced motion) and note any deviation

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** → user stories. Foundational blocks US1 only in practice (the icon path); US2, US3 and US4 do not need it.
- **US1** needs T003–T005. **US2**, **US3** and **US4** are mutually independent and may run in parallel after Phase 1.
- **US2 → US3 (soft)**: both edit `src/ui/board-cube.ts`; do T017 before T032 or merge carefully.
- **US1 → US2 (soft)**: both edit `src/ui/cube-view.ts` and `site/css/cube.css`; do T009–T011 before T016 and T018 or merge carefully.
- **Phase 7** runs last. T045 needs all stories done; the precache lock needs T043.
- Inside each story: tests (fail) → pure code → DOM → CSS → run tests.

## Parallel Opportunities

- Phase 1: T001 and T002 (T002 after T001's build).
- Foundational: T003 and T005.
- US1: T007 and T008 together.
- US2: T013 and T014 together.
- US3: T020, T021, T022, T023 together (separate files); T028 alongside T026/T027.
- US4: T035, T036, T037, T038 together.
- Phase 7: T046–T049 together.
- Across stories: US2, US3 and US4 by different people, with the shared-file notes above.

### Parallel Example: User Story 3 tests

```text
Task: "Write failing unit tests in tests/unit/pill-model.test.ts"        (T020)
Task: "Update tests/unit/status-text.test.ts"                            (T021)
Task: "Write failing e2e tests in tests/e2e/pill.spec.ts"                (T022)
Task: "Add replay/two-device/320px cases in tests/e2e/pill.spec.ts"      (T023: same file as T022, run in order)
```

## Implementation Strategy

### MVP First

US1 and US2 are both P1 and small, and both touch only Twist. Do Phases 1–2, then US1, then US2, then validate and stop for review.

### Incremental Delivery

1. Setup and Foundational.
2. US1 (padlock) → test → demo.
3. US2 (last move) → test → demo.
4. US3 (pill, the largest: it rewrites about 40 existing assertions) → test → demo.
5. US4 (logo) → test → demo.
6. Polish, version bump and the full gate.

### Notes

- The size of US3 comes from the test rewrite (T024, T025), not the code; do those two tasks first, see them fail, then implement.
- Never edit `site/js/` or `site/sw.js`; they come from `npm run build`.
- Do not stage or commit unless asked.
