---

description: "Task list for Cube Rule Options and Preview Polish"
---

# Tasks: Cube Rule Options and Preview Polish

**Input**: Design documents from `/specs/003-cube-rule-options-and-preview-polish/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (core-api, record-format, net-protocol, ui-contracts), quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): every implementation task is preceded by its test task; run the test and see it FAIL for the expected reason before implementing. Commit tests before or with their implementation.

**Organization**: Grouped by user story (spec.md priorities P1–P4) so each can be built, tested and demoed alone. US1 cube rule options (lock, face-count scoring), US2 preview continuity and layer highlight, US3 win-length default on size change, US4 cube notation review.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, from spec.md
- Paths follow plan.md: authored TypeScript in `src/`, static assets in `site/`, tests in `tests/`. `site/js/` and `site/sw.js` are build output: never edit them
- "Update" means change an existing file; "create" means a new file
- Unit tests run with `npm run test:unit` (`node --test`, TypeScript run directly); contract tests with `npm run test:contract`; e2e with `npm run test:e2e`

---

## Phase 1: Setup

**Purpose**: Baseline and compatibility fixtures before any rule change

- [X] T001 Run `npm run build && npm test && npm run check` and record that the 002 baseline is green; fix nothing, just confirm the starting point
- [X] T002 [P] Capture 002 compatibility fixtures into `tests/fixtures/002/`: a schema 2 save with a Cube game in progress (`save-cube.json`), a schema 2 save with `lastSetup` (`save-setup.json`), Cube and Ultimate replay links with `rules=B33`, `rules=U43` (`links.json`), and a welcome message from protocol 2 (`welcome-v2.json`); derive the values from `tests/contract/save.test.ts`, `tests/contract/record.test.ts` and `tests/contract/protocol.test.ts`
- [X] T003 [P] Confirm `tests/fixtures/cube-golden.json` is still read by `tests/unit/cube-rotations.test.ts`; it must stay unchanged and passing through every later task

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Carry `scoring` and `lockFaces` through config, rules code, record, save and protocol, with defaults that leave every existing value unchanged. No user story may start before this is complete.

**⚠️ CRITICAL**: Test task before implementation task in every pair. The tree may fail `typecheck` between T004 and T012; finish the phase before judging.

- [X] T004 Update `tests/unit/rules.test.ts`: add failing tests that `rulesCode("cube", 4, 3, "faces", true)` is `B43FL`, `rulesCode("cube", 3, 3)` is `B33`, `B33F`/`B33L`/`B33FL` parse to `{scoring, lockFaces}` and flags in the wrong order (`B33LF`) or on `C`/`U` codes (`C33F`, `U33L`) give an error; 001/002 codes parse as `scoring: "lines"`, `lockFaces: false`
- [X] T005 Update `src/core/types.ts` and `src/core/rules.ts`: add `scoring: "lines" | "faces"` and `lockFaces: boolean` to `GameConfig` and `Rules` (types `Scoring`), extend `rulesCode(variant, size, winLength, scoring = "lines", lockFaces = false)` and `parseRulesCode` per `contracts/record-format.md`; make T004 pass
- [X] T006 Update `tests/unit/config.test.ts`: add failing tests that `parseConfig` defaults `scoring` to `"lines"` and `lockFaces` to `false`, reads both for a Cube config, and returns null when either is non-default on a Classic or Ultimate config or has the wrong type
- [X] T007 Update `src/core/config.ts`: implement T006; fix every other place that builds a `GameConfig` or `Rules` object so it compiles (`src/ui/setup.ts` `configFromSetup`, `src/core/record.ts` `configFromRecord`/`recordFromGame`, `src/core/seed.ts`) by passing the defaults for now
- [X] T008 Update `tests/contract/record.test.ts`: add failing tests that a record with `scoring: "faces"` and/or `lockFaces: true` packs to `rules=B43F`, `B43L`, `B43FL` and unpacks to the same record; that a 002 link (`rules=B33`) and a 001 link still unpack with `lines`/no lock; and that a flag on a Classic or Ultimate code gives `{error}`
- [X] T009 Update `src/core/record.ts`: add `scoring` and `lockFaces` to `ReplayRecord.rules`, `packLink`, `unpackLink`, `configFromRecord` and `recordFromGame`; make T008 pass
- [X] T010 Update `tests/contract/save.test.ts`: add failing tests that `defaultSave().schema` is 3; that a schema 2 save (fixture `tests/fixtures/002/save-cube.json`) migrates to schema 3 with `scoring: "lines"`, `lockFaces: false` on `game.config` and `settings.lastSetup`; that schema 1 still migrates through 2; that a schema 3 save with both flags round-trips; and that schema 4 is refused as `unknown-schema`. Update the existing assertion at line 30 from 2 to 3
- [X] T011 Update `src/adapters/store.ts` and `src/core/settings.ts`: bump to schema 3, add `migrate2to3`, chain it after `migrate1to2`, extend `SetupChoice`/`normalizeSetup` with `scoring` and `lockFaces` (default `lines`, `false`) and `DEFAULT_SETUP` in `src/ui/setup.ts` to match; make T010 and the existing `tests/unit/settings.test.ts` pass
- [X] T012 Update `tests/contract/protocol.test.ts` then `src/core/protocol.ts`: failing test first that `PROTOCOL_VERSION` is 3, a version 2 `hello` is answered with `reject: "version"`, and a welcome carrying a Cube config with both flags round-trips through `parseMessage`; then change the `v: 2` literals and `hello()` to version 3 and make it pass
- [X] T013 Update `src/ui/multiplayer.ts` (or the file that renders the version-reject message; locate with `grep -rn "version" src/ui/multiplayer.ts src/ui/messages.ts`) so the rejected-version text says both devices need the latest version; add the string to `tests/unit/messages.test.ts` first (failing), then to `src/ui/messages.ts`
- [X] T014 Run `npm run typecheck && npm test`; the whole suite must be green with defaults only (no behaviour change yet)

**Checkpoint**: Foundation ready; old data opens unchanged; user stories can start.

---

## Phase 3: User Story 1 - Cube Rule Options: Face Lock and Face-Count Scoring (Priority: P1) 🎯 MVP

**Goal**: Setup offers "Lock scored faces" and "Count faces, not lines" for Cube. The lock refuses placement on faces holding a line and can end the game; face-count scoring changes the tally and winner; replays and two-device games follow both.

**Independent Test**: Start a Cube game with the lock; make a line, confirm the face refuses marks, break the line with a turn and confirm it reopens. Start a faces-scoring game; make two lines on one face and see Faces 1; open the replay link and see the same result.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T015 [P] [US1] Create `tests/unit/cube-lock.test.ts`: failing tests for `lockedFaces` (a face with a line of either player is locked; no lines → none; recomputed after a rotation), `isLegal` refusing a placement on a locked face with reason `"face-locked"` only when `config.lockFaces`, rotations never refused, the first line on an open face allowed and still setting `phase: "rotate"`, `legalMoves` excluding locked-face placements, `hints` returning nothing on locked faces, the game ending at once with the right winner/tie when no empty sticker lies on an open face (after a non-scoring placement and after a rotation), undo restoring the position and the locks, and `REASONS` including `"face-locked"`; use `winLength` 3 on 3×3 and one 4×4 case
- [X] T016 [P] [US1] Create `tests/unit/cube-scoring.test.ts`: failing tests that `state.scores` equals `state.lines` in lines mode; in faces mode a face with three lines counts once, both players can count the same face, a second line on a counted face leaves the score unchanged but still sets `phase: "rotate"` (trigger unchanged), a rotation that breaks a face's last line lowers the score, the winner at the end is decided by `scores` (more wins, equal ties), and lock + faces together end and score correctly
- [X] T017 [P] [US1] Update `tests/unit/setup.test.ts`: failing tests that `configFromSetup` copies `scoring` and `lockFaces` for a Cube setup and forces both to `"lines"`/`false` for Classic and Ultimate, and that `seedControlsVisible`/`modesFor` are unaffected
- [X] T018 [P] [US1] Update `tests/unit/messages.test.ts` and `tests/unit/cube-labels.test.ts`: failing tests for the `"face-locked"` refusal text (names the lock and says to turn a layer or play another face), the end-by-lock status text ("No open face left to play on"), and a score label helper that returns "Lines" or "Faces" per scoring mode
- [X] T019 [P] [US1] Create `tests/e2e/cube-rules.spec.ts` (use `tests/e2e/helpers.ts` and the patterns in `tests/e2e/cube.spec.ts`): failing Playwright specs for (a) setup shows the two Cube options, off by default, hidden for Classic and Ultimate, and remembered after starting a game; (b) with the lock on, a locked face shows its "Locked" label, its stickers are `aria-disabled`, a press shows the refusal message and places nothing; (c) faces mode shows the "Faces" score label and the result text names faces; (d) a finished faces/lock game's replay link opens with the same score and the same end; (e) a reload keeps the lock enforced

### Implementation for User Story 1

- [X] T020 [US1] Update `src/core/cube.ts`: add `lockedFaces(stickers, size, winLength)` and `scoreOf(stickers, size, winLength, scoring)`; add `scores` to `CubeState` and compute it in `newGame`/`apply`; add `"face-locked"` to `REASONS` and refuse locked-face placements in `isLegal` when `config.lockFaces`; filter `legalMoves` and `hints`; extend `settle` to end the game when `phase === "place"` and (`empty === 0` or no empty sticker is on an open face) using `scores`; make T015 and T016 pass; confirm `tests/unit/cube.test.ts`, `cube-rotations.test.ts` and the golden fixture still pass
- [X] T021 [US1] Update `src/ui/setup.ts`: add the two Cube-only checkboxes ("Lock scored faces", "Count faces, not lines", with `id`s `opt-lock` and `opt-faces`, labels, and a one-line hint each), shown only when the variant is Cube, saved in `lastSetup`, passed through `configFromSetup`; make T017 pass
- [X] T022 [P] [US1] Update `src/ui/messages.ts` and `src/ui/cube-labels.ts`: add the refusal text, end-by-lock status text and score label helper; make T018 pass
- [X] T023 [US1] Update `src/ui/board-cube.ts` and `src/ui/cube-view.ts`: show the score as "Lines" or "Faces" (`score.textContent`), pass `lockedFaces` to the view, mark locked faces in 3D and flat views with a diagonal-stripe pattern (`data-locked`) and a visible "Locked" label element, set `aria-disabled="true"` and append "locked face" to the accessible name of empty stickers on locked faces, and route a press on one to the refusal message instead of `onMove`; add the styles to `site/css/cube.css` (pattern plus text, not colour alone)
- [X] T024 [US1] Update `src/ui/game.ts`, `src/ui/replay.ts` and `src/ui/replay-text.ts`: use `scores` and the faces/lines wording for the live score, the result text (`Final lines:` at `src/ui/game.ts:425` becomes mode-aware), the move list and the replay; show the end-by-lock reason; make hints respect locked faces; ensure the replay and two-device guest build the config from the rules code / welcome including both flags
- [X] T025 [US1] Update `tests/unit/replay.test.ts` with a failing case that a lock game's record replays to the same final state and status, then confirm it passes with T009/T020
- [X] T026 [US1] Run `tests/e2e/cube-rules.spec.ts` (T019) and make it pass; fix UI defects found; run the full e2e suite for `cube.spec.ts`, `replay.spec.ts`, `network.spec.ts` and `compat.spec.ts`

**Checkpoint**: Both options work end to end, including replays and two-device play. MVP.

---

## Phase 4: User Story 2 - Smoother Cube Turn Preview and Layer Highlight (Priority: P2)

**Goal**: Changing the preview within one layer swings straight to the new position; the layer under the pointer (or the tapped layer name on touch) is highlighted, with no preview, and stays highlighted through select, preview and hold.

**Independent Test**: With a turn pending, preview "top layer right" then "top layer left" and watch the layer never return to the start; hover a layer name and see it highlighted with no preview; tap a name on a touch device and see the same.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T027 [P] [US2] Create `tests/unit/turn-path.test.ts`: failing tests for `targetAngle(current, quarters)` and `settleAngle(current)` per `contracts/core-api.md`: the result is congruent to the target mod 360, within 180° of `current`, ties (a quarter to its opposite) continue away from 0, and for every ordered pair of turns on a layer (quarters −1, 1, 2 from starting angles 0, 90, −90, 180) the straight path from `current` to the result never crosses a multiple of 360; `settleAngle(270)` is 360, `settleAngle(-90)` is 0, `settleAngle(180)` is 0 or 360 (either, by the nearest rule: pick 360 for positive input)
- [X] T028 [P] [US2] Update `tests/unit/turn-selection.test.ts`: failing tests that `select` on the same axis and layer with a different direction from `previewing` returns state `animating` with `phase: "retarget"` and effect `{kind: "retarget", from, to}`; `done` then returns `previewing` on the new rotation; `cancel` during a retarget reverses the new rotation; a different layer still gives reverse-then-play; the same turn is a no-op; `reset` discards
- [X] T029 [P] [US2] Update `tests/e2e/cube.spec.ts`: failing specs that (a) sampling the previewed layer's transform every animation frame during a same-layer change never shows an angle near 0 (the original), (b) cancel after a retarget ends at the original orientation, (c) confirm after a retarget applies exactly the last selected turn, (d) hovering a layer name or turn button sets `data-preview="true"` on exactly that layer's stickers with no preview transform, (e) the highlight is present on every sampled frame while a preview starts, changes and ends with the pointer resting on the layer, (f) it clears when the pointer leaves with nothing held, (g) tapping a layer name (emulated touch) highlights it until another name is tapped or the turn is cancelled or confirmed, (h) the same holds in the flat view and (i) with `prefers-reduced-motion` the new position appears at once

### Implementation for User Story 2

- [X] T030 [US2] Create `src/core/turn-path.ts` with `targetAngle` and `settleAngle`; make T027 pass
- [X] T031 [US2] Update `src/core/turn-selection.ts`: add the `retarget` phase and effect and the same-layer branch from `previewing`; make T028 pass without breaking the existing cases
- [X] T032 [US2] Update `src/ui/cube-view.ts`: track the previewed layer's cumulative angle; build the transform from degrees (replace `quartersOf`/`TURN_CSS` use for previews with `rotate*(${angle}deg)`); add `retargetTurn(from, to)` to the `CubeView` interface returning a promise that resolves when the transition ends; make `cancelPreview` and `commitPreview` use `settleAngle` and reset the angle with `no-anim`; flat view just swaps ghosts; reduced motion sets the final angle with transitions off
- [X] T033 [US2] Update `src/ui/board-cube.ts`: handle the `retarget` effect by calling `view.retargetTurn`; add `pointerenter`/`pointerleave`/`focusin`/`focusout` handlers on each row, its name and its turn buttons, and a click handler on `.rotate-name` for touch, computing the highlighted layer as hovered/focused, else tapped, else previewed layer, and calling `view.outline(axis, layer)` (recompute, never clear-and-reapply, when a preview starts, changes or ends); clear the tapped layer on confirm, cancel, reset and when the picker hides; give `.rotate-name` `tabindex="0"`/role button semantics with an accessible name only if needed for keyboard parity; keep `aria-pressed` and the caption as the non-visual selection cue
- [X] T034 [US2] Update `site/css/cube.css`: make the `[data-preview="true"]` outline persist through the layer's transition (no transition on the outline itself), and visible in the flat view
- [X] T035 [US2] Run T029 specs until green; run `tests/unit/turn-selection.test.ts`, `tests/e2e/cube.spec.ts`, `tests/e2e/a11y.spec.ts` and `tests/e2e/input.spec.ts`

**Checkpoint**: Preview and highlight behave as specified; no rule changes.

---

## Phase 5: User Story 3 - Sensible Win-Length Default on Every Size Change (Priority: P3)

**Goal**: Choosing a board size always sets win length to 3 (3×3) or 4 (4×4, 5×5), in every variant; everything saved keeps its own values.

**Independent Test**: Pick 5×5, set win length 5, pick 4×4 (4), 3×3 (fixed 3), 5×5 (4).

### Tests for User Story 3 (write first, confirm they fail)

- [X] T036 [P] [US3] Update `tests/unit/rules.test.ts`: failing tests that `defaultWinLength(3)` is 3 and `defaultWinLength(4)`/`(5)` are 4; `legacyWinLength` still returns the 001 table (Classic 4×4/5×5 → 4, all else 3, including Ultimate and Cube on 4×4/5×5 → 3); `clampWinLength` keeps a valid value and otherwise returns `defaultWinLength(size)`
- [X] T037 [P] [US3] Update `tests/unit/setup.test.ts`: failing tests that `chooseSize` sets the default for every variant on every size change (3→5 gives 4, 5 with 5→4 gives 4, 4 with 3→5 gives 4, →3 gives 3), returns the state unchanged when the size is unchanged, that a size sequence always ends on the default of the last size, that `initialSetup` keeps a remembered valid size and win length, and that `applySeedToSetup` keeps the seed's values
- [X] T038 [P] [US3] Update `tests/e2e/settings.spec.ts` (or `tests/e2e/classic.spec.ts` if setup is covered there): failing spec that the win-length control shows 4 after each of 4×4 and 5×5 is chosen in Classic, Ultimate and Cube, shows the fixed text on 3×3, and that re-clicking the selected size does not reset an edited win length
- [X] T039 [P] [US3] Update `tests/contract/save.test.ts` and `tests/contract/record.test.ts`: tests that a 001/002 save, link or seed with no win length still resolves through `legacyWinLength` (Ultimate and Cube 4×4 → 3), proving the default change did not leak into old data

### Implementation for User Story 3

- [X] T040 [US3] Update `src/core/rules.ts`: `defaultWinLength(size)` (drop the variant parameter; update callers `clampWinLength`), keep `legacyWinLength(variant, size)` as an independent copy of the 001 table; make T036 and T039 pass
- [X] T041 [US3] Update `src/ui/setup.ts`: `chooseSize` returns the state unchanged for the same size and otherwise `{...state, size, winLength: defaultWinLength(size)}`; update `chooseVariant`/`initialSetup` for the new `clampWinLength` fallback; make T037 and T038 pass
- [X] T042 [US3] Update `src/core/seed.ts` only if its tests (`tests/unit/seed.test.ts`) fail after T040 (seeds use `legacyWinLength` for legacy prefixes); no change otherwise. Run `tests/unit/ai-ultimate.test.ts`, `tests/unit/rules-matrix.test.ts` and `tests/unit/seed.test.ts`

**Checkpoint**: Defaults predictable; old data unchanged.

---

## Phase 6: User Story 4 - Review and Correct Cube Notation on 4×4 and 5×5 (Priority: P4)

**Goal**: Inner-layer names follow one documented convention: depth from the nearer face for non-middle inner layers, and M/E/S for the middle layer of any odd cube.

**Independent Test**: In cube notation, list every layer on 4×4 and 5×5 and compare with the help text.

### Tests for User Story 4 (write first, confirm they fail)

- [X] T043 [P] [US4] Update `tests/unit/notation.test.ts`: failing table test for every turn on N=3,4,5 asserting exact names (3×3 identical to before; 4×4: `L 2L 2R R`, `D 2D 2U U`, `B 2B 2F F`; 5×5: `L 2L M 2R R`, `D 2D E 2U U`, `B 2B S 2F F`, with the direction convention unchanged: M like L, E like D, S like F); one name per layer; no `3`-prefixed names; `parseTurnName` round-trips every name on every size and rejects `3L` on 5×5 and `M` on 4×4; `turnsFor` unchanged in order and count (9N)
- [X] T044 [P] [US4] Update `tests/unit/help-content.test.ts` and `tests/e2e/help.spec.ts`: failing checks that the Cube help section includes a notation part naming the convention (single layer, depth from the nearer face, M/E/S for the middle of odd cubes, no wide turns) with the 4×4 and 5×5 example names from T043

### Implementation for User Story 4

- [X] T045 [US4] Update `src/core/notation.ts`: in `base()` return the slice letter for the middle layer of any odd size (`size % 2 === 1 && layer === (size - 1) / 2`), keep the depth-from-nearer-face rule for other inner layers, adjust the header comment and the `parseTurnName` regex digit class (`[2-5]` → `[2-3]`), and make T043 pass; check `src/ui/cube-labels.ts` and `tests/unit/cube-labels.test.ts` still pass
- [X] T046 [US4] Update `src/ui/help-content.ts` (Cube section and the setup section) with the notation paragraph from T044; make T044 pass

**Checkpoint**: Notation consistent and documented.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T047 [P] Update `src/ui/help-content.ts` Cube text for both options: lock (what it blocks, that turns can reopen a face, the early end) and face-count scoring (the score is faces, a second line adds no point but still forces a turn); fix the "more lines" wording in the end-of-game paragraph; add failing assertions to `tests/unit/help-content.test.ts` first
- [X] T048 [P] Update `tests/e2e/compat.spec.ts` with the `tests/fixtures/002/` cases: the schema 2 save opens as lines/no lock, `rules=B33` and `rules=U43` links replay, a protocol 2 peer is refused with the version message
- [X] T049 [P] Update `tests/e2e/perf.spec.ts`: Ultimate 5×5 with win length 4 computer reply under 1 s at 4× slowdown (the new default), and same-layer retarget frame timing on a 5×5 cube within the 20 ms / 50 ms budget
- [X] T050 Bump `VERSION` in `src/sw.ts`; run `npm run build` (regenerates precache and preload lists) then `npm run check`; update `scripts/precache.lock.json` through the repo's normal release step if `check-version` asks
- [X] T051 Run `npm test && npm run test:e2e && npm run test:perf && npm run audit`; all green; Lighthouse accessibility at least 90, offline and install checks pass
- [X] T052 Walk the manual scenarios in `specs/003-cube-rule-options-and-preview-polish/quickstart.md` (lock, faces scoring, preview continuity, highlight, lock replay, defaults, notation) at 320 px and desktop width, in light and dark, and note any gap as a follow-up

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (blocks all stories) → stories → **Phase 7**.
- **US1** needs Phase 2 only. **US2** needs Phase 2 only and does not touch rules; it shares `src/ui/board-cube.ts` and `src/ui/cube-view.ts` with US1 (T023, T033, T032), so run US1's UI tasks (T023–T024) before US2's (T032–T033) or merge carefully. **US3** and **US4** need nothing from US1 or US2 and can run in parallel with them; US3 shares `src/ui/setup.ts` and `tests/unit/setup.test.ts` with US1 (T017/T021 vs T037/T041) and `tests/unit/rules.test.ts` with Phase 2 (T004 vs T036), so sequence those edits; US4 shares `src/ui/help-content.ts` with T047.
- Inside each story: tests → implementation → integration/e2e. Run each new test and see it fail before writing the code.

## Parallel Opportunities

- Phase 1: T002 and T003.
- US1 tests: T015, T016, T017, T018, T019 (different files).
- US2 tests: T027, T028, T029.
- US3 tests: T036, T037, T038, T039 (T036 and T037 touch different files from Phase 2's but T036 shares `rules.test.ts` with T004: do it after Phase 2).
- US4 tests: T043 and T044.
- US3 and US4 can be done by a second person while US1 is in progress.
- Polish: T047, T048, T049.

```text
Example: US1 tests together
  T015 tests/unit/cube-lock.test.ts
  T016 tests/unit/cube-scoring.test.ts
  T017 tests/unit/setup.test.ts
  T018 tests/unit/messages.test.ts + cube-labels.test.ts
  T019 tests/e2e/cube-rules.spec.ts
```

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → US1. That delivers both new rules, replays and two-device play, and can ship alone.

**Incremental delivery**: then US3 (smallest, lowest risk), US4 (display only), US2 (animation work, most DOM risk). Each is releasable alone; bump the service-worker `VERSION` (T050) with each release.

**Compatibility guardrail**: after every phase run `tests/contract/*.test.ts` and `tests/unit/cube-rotations.test.ts`; 001/002 links, saves and the golden cube fixture must keep passing.
