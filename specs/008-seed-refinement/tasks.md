---

description: "Task list for Forgiving Seed Entry"
---

# Tasks: Forgiving Seed Entry

**Input**: Design documents from `/specs/008-seed-refinement/`

**Prerequisites**: plan.md, spec.md, research.md (R1 to R8), data-model.md, contracts/seed-entry-contracts.md (C1 to C5), quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): every test task precedes its implementation task, and you run it and see it FAIL for the expected reason before writing the code. Tests that assert the removed "bad seed gives an error" behaviour are rewritten first (contracts C4) and listed with the reason.

**Organization**: One shared core function (Phase 2) serves all four stories. US1 (any text works, blank plays the placeholder) is the MVP. US2 and US3 are then mostly proof that spellings and replays hold, and US4 pins the rules part.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 to US4, from spec.md
- Unit: `npm run test:unit`; contract: `npm run test:contract`; e2e: `npm run test:e2e`; gates: `npm run check`
- No colour literal outside `static/css/theme.css`. No em dashes, emoji or exclamation marks in UI copy, comments or docs
- Do not `git add` or commit unless asked. Move files with the filesystem, not `git mv`
- `parseSeed` in `src/core/seed.ts` is NOT edited by any task: replay links, records and saves depend on its errors (plan R2, contract C2)
- Integer arithmetic only in seed code; no `Math.random`

---

## Phase 1: Setup

**Purpose**: Baselines from the unchanged app before anything moves

- [X] T001 Run `npm run build && npm test && npm run check` and note that the 007 baseline is green; fix nothing
- [X] T002 Make the parity capture ignore the seed placeholder, because it will be random: in `tests/parity/screens.spec.ts` add the `#seed-input` locator to the `mask` list of every setup capture (the 320, 480 and 720 px setup shots in both modes), then run `npm run build && npx playwright test -c playwright.parity.config.ts --update-snapshots` against the UNCHANGED app to retake `.parity/baseline/`, and run it again without `--update-snapshots` until it passes twice
- [X] T003 [P] Run `grep -rn "placeholder\|C53-BXK4-M9TR" tests src` and list every test or file that relies on the fixed placeholder text; record the list in `specs/008-seed-refinement/baseline.md` so T011 and T012 can update each one

---

## Phase 2: Foundational (blocks every story)

**Purpose**: The pure seed reader that all four stories use. No UI yet.

**CRITICAL**: no story phase starts before this checkpoint.

### Tests first

- [X] T004 [P] Write failing unit tests for `normaliseSeedText` in `tests/unit/seed.test.ts` (contract C1): upper-cases; removes spaces, tabs, newlines, `-`, `_`, en dash, em dash, minus sign and U+2010 to U+2015; NFKC folds full-width `ＢＸＫ４` to `BXK4`; keeps other characters so `A.B` and `AB` stay different; empty and separator-only input give `""`
- [X] T005 [P] Write failing unit tests for `resolveSeed` in `tests/unit/seed.test.ts` (contract C1, research R4, R5):
  - blank and separator-only text give `null`
  - `exact`: `C53-BXK4-M9TR`, `c53bxk4m9tr`, ` c53 bxk4 m9tr ` all give `C53-BXK4-M9TR` with rules Classic 5 and 3; legacy `3x3-bxk4-m9tr` gives `3X3-BXK4-M9TR` (prefix kept in its own spelling); `ULT` and `CUB` likewise
  - `body`: `BXK4M9TR` gives `<current prefix>-BXK4-M9TR`; `XYZ-BXK4-M9TR` (unknown prefix, good body) keeps the body with the current prefix; `C34-BXK4-M9TR` (win longer than board) likewise
  - `derived`: `nope`, `3X3-AXK4-M9TR` (vowel), `C53-BXK4-M9T0`, a too-short and a too-long seed, emoji, Chinese text, a lone surrogate, and 100,000 characters each give a seed matching `^[0-9A-Z]{3}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}$` that `parseSeed` accepts, using the fallback rules for the prefix, in under 50 ms for the 100,000 case
  - totality: no input in a list of 30 awkward strings (plus `undefined` and `null` cast to string) throws
  - determinism: the same text and fallback give the same seed on repeated calls; `banana`, `BANANA` and `b-a-n-a-n-a` give the same seed; `banana` and `bananas` give different seeds
  - distinctness: 1,000 generated texts give 1,000 different seeds
  - the body of a derived seed does not depend on the fallback rules, only the prefix does
- [X] T006 Confirm the existing `parseSeed` cases in `tests/unit/seed.test.ts` (lines 44 to 75) are untouched, and add one regression case that `parseSeed("nope")` and `parseSeed("C53BXK4M9TR")` still return `{ error }` (links stay strict)

### Implementation

- [X] T007 Implement `normaliseSeedText`, a private `deriveBody` and `resolveSeed` in `src/core/seed.ts` beside `parseSeed` so T004 and T005 pass: `deriveBody` takes `hashString("seed-a#" + text)` and `hashString("seed-b#" + text)`, feeds each to `randomSource`, takes four values from each, and maps each value modulo `SEED_ALPHABET.length` into the alphabet; `resolveSeed` classifies in the order blank, exact, body, derived using `parseSeed` for the exact check; export the `SeedReading` and `Fallback` types; do not change `parseSeed`
- [X] T008 Run `npm run test:unit`, `npm run test:contract` and `npm run check` (including `check-core-purity`); everything green

**Checkpoint**: `resolveSeed` is total, deterministic and tested. No screen uses it yet.

---

## Phase 3: User Story 1 - Any text in the seed box starts a game (Priority: P1) MVP

**Goal**: No seed error is ever shown. Any text plays a valid seed; a blank box plays the placeholder, which follows the variant, size and win length.

**Independent Test**: spec US1 "Independent Test" plus quickstart sections 2 and 4.

### Tests first

- [X] T009 [P] [US1] Write failing unit tests for `placeholderFor` in `tests/unit/setup.test.ts` (contract C3, research R6): returns `previous` when its prefix equals `rulesCode(variant, size, winLength)`; returns a new valid seed (accepted by `parseSeed`, right prefix) when `previous` is `null` or its prefix differs; changing level, mark choice or mode does not change the result; two calls with no previous differ
- [X] T010 [P] [US1] Write failing unit tests for `applySeedText` in `tests/unit/setup.test.ts` and rewrite the two old error cases (the old assertions are removed because the behaviour is removed: contracts C4): `tests/unit/setup.test.ts` line 160 (`applySeedToSetup(DEFAULT_SETUP, "nope")` is an error) becomes "`applySeedText` returns a `derived` reading and the state unchanged"; `tests/unit/replay.test.ts` lines 106 to 110 (four bad inputs are errors) becomes "each is `derived`, and the empty string gives `null`; `parseSeed` still errors on them"; import `applySeedText` instead of `applySeedToSetup` in both files for these cases only, leaving the valid-seed cases for T020
- [X] T011 [P] [US1] Write failing e2e `tests/e2e/seed-entry.spec.ts` (needs the `choose` helper from `tests/e2e/replay.spec.ts`, copy its few lines): with the computer opponent in Classic, filling the box with each of `nope`, `banana`, `héllo wörld 你好`, an emoji, `---`, and 5,000 characters, then Start game, begins a game, shows no `#seed-error` (the element is gone), and the in-game `#game-seed` matches `Seed: C33-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[...]{4}`; `#seed-note` reads `This plays as <that seed>.` for `nope` and is hidden for `---` and for the empty box; with an empty box, the `placeholder` attribute of `#seed-input` is a valid seed and the game started afterwards shows exactly that seed in `#game-seed`; changing size to 5 changes the placeholder prefix to `C53` or `C54` (whichever default), while changing the level or the mark leaves the placeholder equal; `#seed-input` has `aria-invalid="false"` for every text above
- [X] T012 [US1] Rewrite `tests/e2e/replay.spec.ts` lines 154 to 157 (the `nope` error case, test title "a pasted seed sets the variant, board and win length; a bad one is explained") so the end of the test says: after `fill("nope")` there is no `#seed-error`, `#seed-note` is visible, Start game begins a game, and `#game-seed` equals the seed in the note; rename the test's second clause to "any other text still starts a game"; update every other test or file that relied on the fixed placeholder, from the list in `baseline.md` (T003); then run T009 to T012 and confirm each fails for the expected reason (missing function, missing element, wrong behaviour)

### Implementation

- [X] T013 [US1] Implement `placeholderFor` and `applySeedText` in `src/ui/setup-model.ts` (contract C3): `placeholderFor` uses `rulesCode` and `parseSeed` to test `previous`, else `newSeed`; `applySeedText` calls `resolveSeed(text, choice)` and, for an `exact` reading, returns the state with the seed's variant, size and win length and the mode rule that `applySeedToSetup` had; remove `applySeedToSetup`, its `parseSeed` import if no longer used, and fix its other importers; make T009 and T010 pass
- [X] T014 [US1] Edit `src/lib/components/Setup.svelte` (contract C4): replace the `seed` and `seedError` state with `reading` (a `SeedReading` or `null`) and a `placeholder` state; set `placeholder` once with `placeholderFor(choice, null)`; add a `$effect` that, when `choice.variant`, `choice.size` or `choice.winLength` changes, sets `placeholder = placeholderFor(choice, placeholder)` (read other choice fields with `untrack` so level, mark and mode never trigger it); `readSeed(text)` calls `applySeedText`, sets `choice` for an `exact` reading, sets `reading`; `clearSeed` clears `reading` and the text; bind `placeholder={placeholder}`, set `aria-invalid="false"` always, point `aria-describedby` at `seed-note`; delete the `#seed-error` Banner; add `<p class="hint-text" id="seed-note" aria-live="polite" hidden={...}>This plays as {reading.seed}.</p>` hidden when `reading` is `null` or `reading.seed` equals the trimmed upper-cased text; `start()` no longer blocks or refocuses the box and plays `reading?.seed ?? placeholder` when the mode is `computer` (and `undefined` otherwise); keep the `arrivedSeed` path working; drop unused imports so `svelte-check --fail-on-warnings` stays clean
- [X] T015 [US1] Run T009 to T012: `npm run test:unit`, then `npm run build && npx playwright test tests/e2e/seed-entry.spec.ts tests/e2e/replay.spec.ts`; fix until green, and run `npm run typecheck`

**Checkpoint**: US1 complete. Any text starts a game; a blank box plays the placeholder shown. This is a shippable increment.

---

## Phase 4: User Story 2 - Seed formatting is optional (Priority: P1)

**Goal**: Dashes, case, spaces and other dash characters never change which seed is meant.

**Independent Test**: spec US2 "Independent Test".

### Tests first

- [X] T016 [P] [US2] Write failing-first unit tests in `tests/unit/setup.test.ts`: for the spellings `C53-BXK4-M9TR`, `c53-bxk4-m9tr`, `C53BXK4M9TR`, ` C53 BXK4 M9TR `, tab-separated, en-dash-separated, underscore-separated and full-width forms, `applySeedText` then `configFromSetup(state, reading.seed)` gives identical `seed`, `variant`, `size`, `winLength` and `humanMark` (with the mark choice "random"); a legacy `3x3bxk4m9tr` gives `3X3-BXK4-M9TR`; if any case passes without new code that is fine, but confirm it ran
- [X] T017 [P] [US2] Add failing-first e2e cases to `tests/e2e/seed-entry.spec.ts`: each spelling above, entered and started, shows the same `#game-seed`; `#seed-note` is hidden for the canonical spelling and shows the standard form for every other spelling; a legacy `3x3-bxk4-m9tr` in Classic 3 keeps `3X3-BXK4-M9TR` as the game seed

### Implementation

- [X] T018 [US2] Make T016 and T017 pass; most of this is already built in T007 and T014, so fix only what is red (for example the note's hidden rule, or a separator missing from `normaliseSeedText`)

**Checkpoint**: US2 complete.

---

## Phase 5: User Story 3 - A seed from a past game replays the computer's moves (Priority: P1)

**Goal**: The same seed, level, mark and moves always give the same computer replies, however the seed was spelled or reached.

**Independent Test**: spec US3 "Independent Test".

### Tests first

- [X] T019 [P] [US3] Write `tests/unit/seed-replay.test.ts` (failing first only if a gap exists; otherwise it pins behaviour): using `chooseMove` with `rngFor` as `src/ui/ai-worker.ts` does, play the same scripted human moves through a Classic 3 and an Ultimate game from (a) `C33-BXK4-M9TR`, (b) `c33bxk4m9tr`, (c) the seed derived from `banana` and (d) the shown form of (c) re-entered; (a) equals (b) and (c) equals (d) move for move, and `pickMark` agrees; a different seed gives a different sequence somewhere in the first 10 computer moves for at least one of the two variants
- [X] T020 [P] [US3] Extend `tests/e2e/seed-entry.spec.ts`: type `banana`, start at level 5 as O, record the computer's first three replies over three scripted human moves, start a new game, enter the seed shown in `#game-seed` in lower case without dashes at the same level and mark, make the same human moves, and expect identical replies; also keep the existing `replay.spec.ts` test "the same seed makes the computer open the same way" green and unedited
- [X] T021 [US3] Run `tests/e2e/compat.spec.ts`, `tests/contract/record.test.ts` and `tests/unit/seed.test.ts` with no edits and record that they pass (SC-005, FR-012); fix any red result in the new code, never in those tests

**Checkpoint**: US3 complete.

---

## Phase 6: User Story 4 - Rules in the seed still set up the board (Priority: P2)

**Goal**: A valid seed sets variant, size and win length; text without a rules part keeps the current choices.

**Independent Test**: spec US4 "Independent Test".

### Tests first

- [X] T022 [P] [US4] Move the valid-seed unit cases from `applySeedToSetup` to `applySeedText` without weakening them: `tests/unit/setup.test.ts` lines 112 to 116 and 151 to 157, and `tests/unit/replay.test.ts` lines 89 to 99 (including the Cube case that moves the mode off the computer); then add: a bare body `BXK4M9TR` leaves variant, size and win length as they were; an unknown prefix with a good body (`XYZ-BXK4-M9TR`) leaves them as they were and the reading seed starts with the current rules code; `C34-BXK4-M9TR` leaves them as they were
- [X] T023 [P] [US4] Add e2e cases to `tests/e2e/seed-entry.spec.ts`: entering `U54-BXK4-M9TR` selects Ultimate, size 5, win length 4; entering `BXK4M9TR` with Ultimate 4 selected keeps those and the note reads `This plays as U44-BXK4-M9TR.`; entering `XYZ-BXK4-M9TR` does the same with prefix `U44`; with text present, picking another size clears the box and shows the placeholder again, as before

### Implementation

- [X] T024 [US4] Make T022 and T023 pass (expect small or no code change); confirm `tests/e2e/replay.spec.ts` "Play this seed ... fills in the start screen" and "switching the opponent shows and hides the seed field" still pass unedited

**Checkpoint**: US4 complete.

---

## Phase 7: Polish and Cross-Cutting

- [X] T025 [P] Run `tests/unit/copy-rules.test.ts` and `tests/unit/visible-names.test.ts`; fix the note text in `Setup.svelte` if they flag it (no em dash, emoji or exclamation mark), and confirm `#seed-card` still does not match `/exact game|decides|random/i` (replay.spec.ts line 190)
- [X] T026 [P] Run `tests/e2e/a11y.spec.ts`, `tests/e2e/layout-audit.spec.ts` and `tests/e2e/content-colours.spec.ts` with a non-canonical seed in the box at 320 px; the note must wrap without horizontal scroll and keep contrast; add one case to `layout-audit.spec.ts` for this if none covers the seed card, written first and seen to pass or fail for the right reason
- [X] T027 [P] Search `README.md`, `docs/pwa-design-spec.md` and `specs/007-sveltekit-ui-migration` for text that says a bad seed shows an error (`grep -rn "seed" README.md docs`); update the live docs (not the 007 history) to the new behaviour, with no em dashes
- [X] T028 Run `npm run test:parity` and review each difference; the masked seed box must make setup captures stable, and the only intended visible difference is the missing error banner state (not captured) and the note (not in a default capture); fix any other difference
- [X] T029 Run the whole gate set: `npm run build && npm run check && npm test && npm run test:e2e && npm run test:parity && npm run test:perf && npm run audit`; record the results and the gzipped first-load size from `scripts/check-build.mjs` in `quickstart.md` under a "Results" heading beside the 007 numbers; the size must stay within the 007 budget (70 KB first load, 160 KB total)
- [X] T030 Mutation check once: temporarily make `resolveSeed` throw on `"nope"`, then make it return a different seed for lower-case input, then edit `parseSeed` to return a derived seed; confirm a unit test fails each time with a useful message, and revert each
- [X] T031 Confirm nothing is staged or committed by this work (`git status --short`), and that `parseSeed` is unchanged (`git diff -- src/core/seed.ts` shows only additions)
- [X] T032 Manual walkthrough by a person of quickstart sections 2 and 3; if no person has done it, record that plainly in `quickstart.md` instead of ticking this

---

## Dependencies and Execution Order

- Phase 1: T002 before T012 (the parity baseline must come from the unchanged app); T003 before T012. T001 and T003 can run alongside T002.
- Phase 2 blocks everything: T004, T005 and T006 (tests) before T007; T008 last.
- US1 needs Phase 2. T009, T010 and T011 can be written together; T012 after them; T013 after T009 and T010; T014 after T013; T015 last.
- US2 needs US1 (the note and the start path). T016 and T017 together, then T018.
- US3 needs US1. It can run alongside US2 after T015: T019 and T020 together, then T021.
- US4 needs US1 (it moves tests that use `applySeedText`). T022 and T023 together, then T024.
- Polish needs every story. T025, T026 and T027 together; T028 then T029; T030 and T031 after T029; T032 last.

## Parallel Opportunities

- Phase 2 tests: T004 and T005 together (same file, different `describe` blocks, so write them in one sitting or as separate commits of one file).
- US1 tests: T009, T010 and T011 together (three different files).
- US2: T016 and T017 together. US3: T019 and T020 together. US4: T022 and T023 together.
- US2, US3 and US4 can run in parallel with each other once T015 is green.
- Polish: T025, T026 and T027 together.

## Implementation Strategy

1. **MVP**: Phases 1 to 3. Any text starts a game and a blank box plays the visible placeholder. Ship-ready checkpoint and the point where the riskiest unknowns (the derivation, the placeholder lifecycle, the old tests that must change) are settled.
2. **Increment 2**: Phases 4 and 5 (spelling and replay). Mostly proof, small fixes.
3. **Increment 3**: Phase 6 (rules part), then Phase 7.
4. After each checkpoint: `npm run build && npm run check && npm test`, then the e2e subsets named. Do not start the next phase on a red checkpoint.

---

## Phase 8: Convergence

**Purpose**: Work still open after `/speckit-implement`, found by assessing the code against spec.md, plan.md, tasks.md and the constitution.

- [X] T033 CRITICAL Settle the red gates left by the finished work: `npm run test:perf` fails on the Twist 5x5 frame budget (also on the unchanged HEAD build), `npm run audit` exits 1 because it runs that suite, and `ultimate.spec.ts` "computer replies in under a second on a throttled CPU" (mobile) and `theme-dialog.spec.ts` "route already handled" each failed once under full-suite load; either fix the tests or code, or record in `specs/007-sveltekit-ui-migration/plan.md` Complexity Tracking that `test:perf` is not a merge gate and why, per Constitution Development Workflow ("All tests MUST pass before merge", "Releases MUST pass a PWA audit") (contradicts)
- [X] T034 Add a failing-first case to `tests/e2e/seed-entry.spec.ts` for the edge case "the player types text, then deletes it all": the note disappears, the box's `placeholder` attribute is unchanged from before typing, and Start plays that placeholder, per spec Edge Cases and US1/AC4 (partial)
- [X] T035 Do the manual walkthrough T032 (quickstart sections 2 and 3 on a running app) or record in `specs/008-seed-refinement/quickstart.md` Results that it was waived, then tick T032, per plan: quickstart validation (partial)
