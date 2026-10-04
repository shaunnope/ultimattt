---

description: "Task list for Game Refinements and Tweaks"
---

# Tasks: Game Refinements and Tweaks

**Input**: Design documents from `/specs/002-refinements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (core-api, record-format, net-protocol, ui-contracts), quickstart.md

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): every implementation task is preceded by its test task; run the test and see it FAIL for the expected reason before implementing. Commit tests before or with their implementation.

**Organization**: Grouped by user story (spec.md priorities P1–P5) so each can be built, tested and demoed alone. Stories are numbered by spec priority: US1 win length and larger boards, US2 cube rotation controls, US3 help screen, US4 palettes, marks and look, US5 seeds.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5, from spec.md
- Paths follow plan.md: authored TypeScript in `src/`, static assets in `site/`, tests in `tests/`. `site/js/` and `site/sw.js` are build output: never edit them
- "Update" means change the existing 001 file; "create" means a new file
- Naming rule (ui-contracts.md): no user-visible text, id, CSS name or identifier may name the flagrant or tictactoe-game projects

---

## Phase 1: Setup

**Purpose**: Baseline and compatibility fixtures before any rule changes

- [X] T001 Run `npm run build && npm test && npm run check` and record that the 001 baseline is green; fix nothing, just confirm the starting point
- [X] T002 [P] Capture 001 compatibility fixtures into `tests/fixtures/001/`: a schema 1 `ttt.save` for each variant (`save-classic3.json`, `save-classic5.json`, `save-ultimate.json`, `save-cube.json`, one with a custom `icons` setting), replay links for each variant (`links.json`, with and without a seed for a non-computer game), and 001 seeds (`seeds.json`: `3X3-…`, `4X4-…`, `5X5-…`, `ULT-…`, `CUB-…`); derive the values from the existing `tests/contract/record.test.ts` and `tests/contract/save.test.ts`
- [X] T003 [P] Confirm `tests/fixtures/cube-golden.json` exists and is read by `tests/unit/cube-rotations.test.ts`; it must stay unchanged and passing through every later task

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rules code, win length in config, widened tokens, seed parsing, record and save migration, protocol v2. No user story may start before this is complete.

**⚠️ CRITICAL**: Tests before implementation in every pair below. The tree may fail `typecheck` between T006 and the end of this phase because `GameConfig` changes; finish the phase before judging.

- [X] T004 [P] Write failing unit tests for rules (win-length options 3..N, defaults per variant and size, legacy defaults, `clampWinLength`, `rulesCode`/`parseRulesCode` round trip, bad codes return `{ error }`, K>N invalid) in `tests/unit/rules.test.ts`
- [X] T005 Create `src/core/rules.ts` (`winLengthOptions`, `defaultWinLength`, `legacyWinLength`, `clampWinLength`, `rulesCode`, `parseRulesCode`) per contracts/core-api.md until T004 passes
- [X] T006 Update `src/core/types.ts`: `GameConfig` gains `winLength`, `seed` optional; `CubeRotate.layer` documented as `0..N-1`; `ClassicState.winLength: number`; no behaviour yet
- [X] T007 [P] Write failing unit tests for `parseConfig` (winLength required in range, absent → legacy default, size 3..5 for every variant, Cube with mode `computer` invalid, seed required only for `computer` and ignored otherwise) in `tests/unit/config.test.ts`
- [X] T008 Update `src/core/config.ts` (`parseConfig`, defaults) until T007 passes
- [X] T009 [P] Write failing unit tests for the widened token alphabet (`0-9a-o`, Classic cell, Ultimate board+cell, Cube face+cell, rotate `.`+axis+layer 0-4+way; 001 tokens decode identically using `tests/fixtures/001/links.json`) in `tests/unit/tokens.test.ts`
- [X] T010 Update `src/core/tokens.ts` until T009 passes
- [X] T011 [P] Write failing unit tests for seed parsing (rules-code prefix `C53`/`U44`; 001 prefixes `3X3` `4X4` `5X5` `ULT` `CUB` yield legacy win lengths; `newSeed(variant,size,winLength)` prefix; parse errors) in `tests/unit/seed.test.ts` (extend the 001 file)
- [X] T012 Update `src/core/seed.ts` (`parseSeed` returns `{ variant, size, winLength, body }`, `newSeed(variant,size,winLength)`) until T011 passes; leave `pickMark` behaviour for T086 in US5
- [X] T013 [P] Write failing contract tests for records and links (`rules=` always present on new links, 001 link without `rules` reads rules from the seed prefix, mismatch between `rules` and seed prefix gives an error, `tests/fixtures/001/links.json` all open, results recomputed not carried) in `tests/contract/record.test.ts` (extend)
- [X] T014 Update `src/core/record.ts` and `src/core/replay.ts` (`ReplayRecord.rules`, `packLink`, `unpackLink`, `configFromRecord`) until T013 passes (depends on T005, T008, T010, T012)
- [X] T015 [P] Write failing contract tests for protocol v2 (`v: 2` on every message, host rejects `v` ≠ 2 with `reject{reason:"version"}`, `welcome.config` carries `winLength` and no seed, `parseConfig` validates it) in `tests/contract/protocol.test.ts` (extend)
- [X] T016 Update `src/core/protocol.ts` until T015 passes (depends on T008)
- [X] T017 [P] Write failing unit tests for settings (`markPalette` id default `default`, unknown or missing id falls back, stored `icons` and `markColors` ignored, `cubeNotation` `words|cube` default `words`, `lastSetup.winLength` validated against `size`) in `tests/unit/settings.test.ts`
- [X] T018 Update `src/core/settings.ts` (`normalizeSettings`, `normalizeSetup`) until T017 passes; reference palette ids as string literals until `palette.ts` exists in US4 (depends on T005)
- [X] T019 [P] Write failing contract tests for save schema 2 and migration 1→2 (drop `icons`, add `markPalette: "default"` and `cubeNotation: "words"`, add `winLength` to `lastSetup` and saved `game.config` using the legacy default, remove `seed` from non-computer configs, every file in `tests/fixtures/001/save-*.json` loads and plays on, unknown newer schema kept untouched with notice, failed migration behaves the same) in `tests/contract/save.test.ts` (extend)
- [X] T020 Update `src/adapters/store.ts` and `src/adapters/restore.ts` (schema 2, `migrate1to2`) until T019 passes (depends on T008, T018)

**Checkpoint**: `npm test` green; 001 links, saves and seeds load through the new parsers; `cube-golden.json` untouched and passing.

---

## Phase 3: User Story 1 - Choose Win Length and Larger Boards (Priority: P1) 🎯 MVP

**Goal**: Win length chosen separately from board size (3..N); Classic, Ultimate and Cube all support 3×3, 4×4, 5×5; computer opponents keep working within 1 s.

**Independent Test**: Classic 5×5 with win length 3 wins on three in a row; Ultimate 4×4 and Cube 5×5 each play to a result; 3×3 Ultimate and Cube show win length fixed at 3; a 001 game resumes with its original rules.

### Tests for User Story 1 ⚠️ write first, watch fail

- [X] T021 [P] [US1] Write failing unit tests for Classic with K<N (`lines(size, winLength)` windows, three in a row wins on 5×5 K=3, three in a row does not win on 4×4 K=4, longer run wins, draw, hints) in `tests/unit/classic.test.ts` (extend)
- [X] T022 [P] [US1] Write failing unit tests for Ultimate N×N (N² boards of N² cells, forced board = cell index on 4×4 and 5×5, closed-board free choice, K small-board claim, K claims on the grid wins, draw, `fromMoves`/`undo`/`hash`) in `tests/unit/ultimate.test.ts` (extend)
- [X] T023 [P] [US1] Write failing unit tests for Cube scoring and sizes (6·N² stickers, 9N legal turns, one line per exact-K window so a run of L scores L−K+1, score then forced turn on 4×4, recount after a turn) in `tests/unit/cube.test.ts` (extend)
- [X] T024 [P] [US1] Write failing property and cross-check tests for cube geometry at N=3,4,5 (four quarters identity, quarter then reverse identity, half = two quarters, every turn is a permutation, all N layers of an axis = whole-cube turn, R U R' U' has order 6 on every N, inner-layer turns on N=4,5 against an independent facelet simulator written inside the test file; N=3 still equals `cube-golden.json`) in `tests/unit/cube-rotations.test.ts` (extend)
- [X] T025 [P] [US1] Write failing unit tests for the computer on larger rules (only legal moves, deterministic for same seed and moves, Master on 3×3 K=3 never loses, per-size node budgets present for every level) in `tests/unit/ai.test.ts` and `tests/unit/ai-ultimate.test.ts` (extend)
- [X] T026 [P] [US1] Write failing unit tests for setup logic (win-length options for the chosen size, size change keeps a valid win length else sets the default, 3×3 Ultimate and Cube report win length fixed, size choice offered for every variant, start within 4 interactions) in `tests/unit/setup.test.ts` (extend)
- [X] T027 [P] [US1] Write failing Playwright specs: Classic 5×5 K=3 win and highlight, Classic 4×4 K=4 no win on three, Ultimate 4×4 routing and claim, Ultimate 5×5 forced board, Cube 4×4 score then turn any of four layers, 3×3 fixed win length display, a 001 save resumes with its rules, in `tests/e2e/classic.spec.ts`, `tests/e2e/ultimate.spec.ts`, `tests/e2e/cube.spec.ts` (extend)
- [X] T028 [P] [US1] Write failing Playwright spec for two-device play of a 4×4 Ultimate game with win length 3 (both devices agree each move, a v1 peer is refused with the update message) in `tests/e2e/network.spec.ts` (extend)
- [X] T029a [P] [US1] Write failing matrix test over every supported combination (variant × size 3,4,5 × winLength 3..size: 6 per variant, 18 in total) that plays scripted games through `newGame`/`apply` and checks win detection, small-board claims and grid wins, forced-board routing, Cube scoring per exact-K window and layer-turn mapping against the rule definitions, reporting any discrepancy (SC-001) in `tests/unit/rules-matrix.test.ts`
- [X] T029 [P] [US1] Write failing perf probe: Ultimate 5×5 reply under 1 s at 4× CPU slowdown at every level, and Classic 5×5 K=3 likewise (SC-004), in `tests/e2e/perf.spec.ts` (extend)

### Implementation for User Story 1

- [X] T030 [P] [US1] Update `src/core/classic.ts`: `lines(size, winLength)` cached by pair, remove `winLengthFor`, read K from config in `newGame`/`hints` until T021 passes
- [X] T031 [US1] Update `src/core/ultimate.ts` for N×N small boards on an N×N grid with K at both levels until T022 passes (depends on T030)
- [X] T032 [US1] Update `src/core/cube.ts` and the cube geometry helpers: doubled-integer coordinates, N layers per axis, `rotateTable(size, …)`, `rotateStickers(…, size, …)`, `layerStickers(size, …)`, `rotations(size)`, `cubeLines(stickers, size, winLength)`; N=3 equals 001 until T023 and T024 pass (depends on T030)
- [X] T033 [US1] Update `src/core/variants.ts` so every variant is created from `(size, winLength)` and exposes the shared shape (depends on T030, T031, T032)
- [X] T034 [US1] Update `src/core/ai.ts`, `src/core/ai-ultimate.ts` and the per-size node-budget table (positions, not milliseconds) until T025 passes (depends on T031)
- [X] T035 [US1] Update `src/ui/hints.ts`, `src/ui/computer.ts` and `src/ui/ai-worker.ts` to pass `(size, winLength)` through; confirm T029 passes (depends on T034)
- [X] T036 [US1] Update `src/ui/setup.ts` and `site/css/style.css`: size selector for every variant, separate win-length selector (3..N, fixed display at 3×3), clamp on size change, remember in `lastSetup` until T026 passes (depends on T018)
- [X] T037 [P] [US1] Update `src/ui/board-classic.ts` and `src/ui/board-ultimate.ts` to render N×N and N²×N² grids at phone width, and generalise the `boardName` and `whereToPlay` helpers in `board-ultimate.ts` to N×N (update `tests/unit/ultimate-text.test.ts` first, watching it fail)
- [X] T038 [US1] Update `src/ui/cube-view.ts` and `site/css/cube.css` for N-sized faces (`--n` custom property drives sticker size and offsets, only the chosen layer's stickers animate, flat fallback view for N) (depends on T032)
- [X] T039 [US1] Update `src/ui/board-cube.ts` and `src/ui/cube-labels.ts` so the turn picker offers N layers on each axis with layer names in wording mode (depends on T038)
- [X] T040 [US1] Update `src/ui/game.ts`, `src/ui/boards.ts`, `src/ui/replay.ts`, and `src/ui/replay-text.ts` to show board size and win length and to build games and replays from stored rules (depends on T033, T014)
- [X] T041 [US1] Update `src/ui/multiplayer.ts`, `src/core/pairing.ts` and `src/adapters/net.ts` for protocol v2 and the version-refused message until T028 passes (depends on T016)
- [X] T042 [US1] Make T027 pass end to end; fix remaining failures in the UI adapters (depends on T036–T041)

**Checkpoint**: User Story 1 fully functional: all 3 variants play on 3×3, 4×4, 5×5 with any valid win length, computer replies under 1 s, two-device 4×4 works, 001 saves resume.

---

## Phase 4: User Story 2 - Refined Cube Rotation Controls (Priority: P2)

**Goal**: Select a layer and direction → animated preview → Confirm applies it, clicking outside or Escape cancels; icon direction buttons; optional cube-solving notation.

**Independent Test**: Score a line in Cube, select a turn, watch the preview, cancel by clicking outside, select again, confirm; final position equals the preview; keyboard-only works.

Depends on US1 for N-sized cubes (T032, T038, T039).

### Tests for User Story 2 ⚠️ write first, watch fail

- [X] T043 [P] [US2] Write failing unit tests for notation (`turnName` words and cube styles, R/U/F `dir −1` and L/D/B `dir +1`, `'` and `2` suffixes, M/E/S on 3×3, numbered inner layers `2R`, `3L` on 4×4 and 5×5, `parseTurnName` inverse for every turn on N=3,4,5, `layerLabel`, `turnsFor(size)` has 9N turns) in `tests/unit/notation.test.ts`
- [X] T044 [P] [US2] Write failing unit tests for the pure turn-selection state machine (`idle → animating → previewing`, switching turns, cancel returns to `idle` with turn pending, confirm yields exactly the previewed rotation, input ignored while `animating`, undo/reload/new game force `idle`) in `tests/unit/turn-selection.test.ts`
- [X] T045 [P] [US2] Update failing unit tests for cube labels (wording names match accessible names one-to-one with notation names) in `tests/unit/cube-labels.test.ts`
- [X] T046 [P] [US2] Write failing Playwright specs: preview then Confirm matches preview, switch turn reverses and plays new, outside pointer-down and Escape cancel, click on another control acts on it, view drag keeps preview, Confirm disabled with no preview, input held during animation, undo cancels preview, reload restores pending turn without preview, flat view preview shown dashed, keyboard-only select/confirm/cancel, direction buttons at 320 px width without overflow in both notation modes, notation names shown in controls, move list and replay, only the confirmed turn reaches the other device, in `tests/e2e/cube.spec.ts` and `tests/e2e/network.spec.ts` (extend)

### Implementation for User Story 2

- [X] T046a [P] [US2] Write failing contract test that the notation setting is display-only: the same game played with `cubeNotation` `words` and `cube` yields identical saved moves, replay link, save file and network messages (FR-018), in `tests/contract/notation-private.test.ts`
- [X] T047 [P] [US2] Create `src/core/notation.ts` (`turnName`, `parseTurnName`, `layerLabel`, `turnsFor`) per research R15 until T043 passes
- [X] T048 [P] [US2] Create `src/core/turn-selection.ts` (pure state machine, no DOM) until T044 passes
- [X] T049 [US2] Update `src/ui/cube-labels.ts` to take its names from `notation.ts` for both styles until T045 passes (depends on T047)
- [X] T050 [P] [US2] Update `src/ui/icons.ts` with turn icons: up/down, left/right, clockwise/anticlockwise curved arrows, half turn, each with accessible name and tooltip support
- [X] T051 [US2] Update `src/ui/cube-view.ts` with `previewTurn`, `cancelPreview`, `commitPreview` (reuse the layer animation, hold-then-commit without replay) and the flat-view dashed preview via `rotateStickers` (depends on T048)
- [X] T052 [US2] Update `src/ui/board-cube.ts` for the select → preview → confirm/cancel flow: Confirm control, pointer-down outside the cube, picker and any interactive element cancels, Escape cancels, input held while animating, preview discarded on undo/reload/new game, keyboard operation, aria-live caption using the notation name (depends on T049, T050, T051)
- [X] T053 [P] [US2] Update `site/css/cube.css` and `site/css/style.css` for icon turn buttons (no overflow from 320 px), pressed state, dashed preview, Confirm button
- [X] T054 [US2] Update `src/ui/settings.ts` with the turn-notation setting (words default, cube) stored via `settings.cubeNotation`, display only (depends on T018)
- [X] T055 [US2] Update `src/ui/game.ts`, `src/ui/replay.ts`, `src/ui/replay-text.ts` and `src/ui/messages.ts` to name turns through `notation.ts` in the move list, replay and messages (depends on T047, T054)
- [X] T056 [US2] Make T046 and T046a pass end to end; fix remaining adapter failures (depends on T052–T055)

**Checkpoint**: Cube turns are previewed and confirmed; notation switches every place a turn is named; US1 still green.

---

## Phase 5: User Story 3 - Learn the Game from a Help Screen (Priority: P3)

**Goal**: A Help link on the main menu opens a static, offline, accessible help page covering Ultimate and Cube and the new setup options.

**Independent Test**: From the menu open Help, read Ultimate and Cube, press Back; repeat offline; the game in progress is unchanged.

### Tests for User Story 3 ⚠️ write first, watch fail

- [X] T057 [P] [US3] Write failing unit tests for help content (sections in order Ultimate, Cube, Setup options; each of Ultimate and Cube covers goal, turn, special rules, end, size and win length effect; the Cube section mentions layer turns, preview and confirm, and both naming styles; examples carry a text alternative) in `tests/unit/help-content.test.ts`
- [X] T058 [P] [US3] Write failing Playwright spec: menu link labelled "Help" opens `#/help` in one interaction, real headings in order, Back returns to the previous screen, help mid-game leaves the game untouched, works offline after first load, keyboard and screen-reader reachability, examples readable in light and dark and not by colour alone, in `tests/e2e/help.spec.ts`
- [X] T059 [P] [US3] Extend the axe audit for the help route in `tests/e2e/a11y.spec.ts`

### Implementation for User Story 3

- [X] T060 [P] [US3] Create `src/ui/help-content.ts` (static `HelpSection[]`, English, example blocks as data with text alternatives) until T057 passes; reflect the final rules from US1 and US2
- [X] T061 [US3] Create `src/ui/help.ts` (hash-routed, lazily loaded renderer, Back control, example boards drawn with the shared mark renderer once it exists, until then with the current glyphs) (depends on T060)
- [X] T062 [US3] Update `src/ui/app.ts` and `site/index.html`: "Help" link on the menu, `#/help` route that keeps the game screen state, return handling (depends on T061)
- [X] T063 [P] [US3] Update `site/css/style.css` for the help page (centred column of at most 34 rem, headings, ordered steps, light and dark)
- [X] T064 [US3] Make T058 and T059 pass; confirm help files are in the precache list via `npm run build && npm run check` (depends on T062, T063)

**Checkpoint**: Help works online and offline; US1 and US2 still green.

---

## Phase 6: User Story 4 - Fixed Palettes, Default Animated Marks, Shared Look (Priority: P4)

**Goal**: Custom icon removed; marks are the animated default SVGs in one of four fixed X/O palettes (light and dark variants); whole app restyled to the flagrant scheme without naming it anywhere user-facing.

**Independent Test**: Settings shows no icon field and no colour input, only four palettes; marks animate in the chosen palette in light and dark; reduced motion disables the animation; 001 saves with custom icons still open.

### Tests for User Story 4 ⚠️ write first, watch fail

- [X] T065 [P] [US4] Write failing unit tests for the palette table (exactly `default`, `cbsafe`, `forest`, `sunset`; every X and O variant has contrast ≥ 3:1 on `--bg` and `--surface` of its appearance read from `site/css/theme.css`; Lab distance between X and O at or above a threshold fixed in the test for every palette and appearance; `cbsafe` present; `paletteById` unknown → default; `markColors(id, appearance)`) in `tests/unit/palette.test.ts`
- [X] T066 [P] [US4] Write failing unit tests for the token check and the naming check (token check: a colour literal outside `theme.css` fails; naming check: "flagrant" or "tictactoe-game" in `src/` or `site/` outside comments fails, inside a comment passes) with good and bad fixture directories in `tests/unit/check-scripts.test.ts` and `tests/fixtures/check/`
- [X] T067 [P] [US4] Write failing unit tests for the mark renderer data (X is two strokes, O is one circle, `pathLength="1"`, animation class only on newly placed marks, none under reduced motion, plain-letter accessible names) in `tests/unit/mark.test.ts`
- [X] T068 [P] [US4] Write failing Playwright specs: settings has no icon input and no colour input, four palette choices with a live X/O sample, choice applies at once and survives reload, appearance switch swaps variants, reduced-motion appears without animation, a 001 save with custom icons opens with default marks and no error, unknown saved palette id shows the default, marks differ by shape, palette id absent from links and network messages, in `tests/e2e/settings.spec.ts` and a new `tests/e2e/marks.spec.ts` (replaces `tests/e2e/icons.spec.ts`)
- [X] T069 [P] [US4] Write failing contract test that links, seeds, saved games and protocol messages never contain a palette id or colour (replaces `tests/contract/icons-private.test.ts`) in `tests/contract/palette-private.test.ts`
- [X] T070 [P] [US4] Update `tests/unit/check-theme.test.ts` and `tests/unit/theme.test.ts` for the new token names (neutral names, no project names)

### Implementation for User Story 4

- [X] T071 [US4] Update `site/css/theme.css`: tokens `--bg`, `--fg`, `--surface`, `--border`, `--accent`, `--accent-muted`, `--accent-contrast`, `--success` with flagrant's light and dark values per research R12, mark tokens `--mark-x` `--mark-o`, claim tokens; keep `data-mode` and the pre-paint script; neutral token names
- [X] T072 [P] [US4] Create `scripts/check-theme-tokens.mjs` (colour literals only in `theme.css`) and `scripts/check-names.mjs` (project names only in comments) until T066 passes; add both to the `check` script in `package.json`
- [X] T073 [US4] Create `src/core/palette.ts` (`PALETTES`, `DEFAULT_PALETTE`, `paletteById`, `markColors`, `contrast`) with the values from research R11 until T065 passes; if a pair fails the distance rule change its values, not the test (depends on T071 for the surface tokens)
- [X] T074 [US4] Update `src/ui/theme.ts` to apply the current palette's `--mark-x`/`--mark-o` on load and on appearance change; also switch `src/core/settings.ts` from the string literal to `DEFAULT_PALETTE` (depends on T071, T073)
- [X] T075 [P] [US4] Create `src/ui/mark.ts` (SVG X and O marks, draw animation 0.22 s with second stroke delayed 0.1 s, only on newly placed marks, suppressed by `prefers-reduced-motion`) until T067 passes
- [X] T076 [US4] Update `src/ui/board-classic.ts`, `src/ui/board-ultimate.ts`, `src/ui/cube-view.ts`, `src/ui/replay.ts` and `src/ui/game.ts` to use `mark.ts` and plain letters in names and aria-labels; delete `src/ui/glyph.ts` (depends on T075)
- [X] T077 [US4] Delete `src/core/icons.ts`, `src/ui/icons.ts` marks (keep turn icons from T050), `tests/unit/icons.test.ts`, `tests/e2e/icons.spec.ts`, `tests/contract/icons-private.test.ts`; update every import until `npm run typecheck` passes (depends on T076)
- [X] T078 [P] [US4] Create `src/ui/palette-picker.ts` (list of the four palettes, one selected, live X/O sample; no colour input) and wire it in `src/ui/settings.ts`, removing the icon fields (depends on T073, T074)
- [X] T079 [US4] Restyle `site/css/style.css` and `site/css/cube.css` to the flagrant tokens (menu, setup, game, replay, settings, help, dialogs, toasts, update bar, QR panel); elements flagrant has no equivalent for use the tictactoe-game styling rewritten against the tokens; contrast of every text and background pair meets the minimum in both appearances (depends on T071)
- [X] T080 [US4] Update `site/manifest.json` and `site/index.html` theme and background colours to the new tokens and refresh `site/icons/*` if they clash (depends on T071)
- [X] T081 [US4] Make T068, T069 and T070 pass; run `npm run check` and fix findings (depends on T074–T080)

**Checkpoint**: Marks animate in a fixed palette; no custom icon or colour input; look is consistent; no user-facing project names; US1–US3 green.

---

## Phase 7: User Story 5 - Seeds Only Where They Matter (Priority: P5)

**Goal**: Seed exists and is shown only for games with a computer player; no explanatory text; old seeds and links keep working.

**Independent Test**: Two-player Classic shows no seed anywhere; against the computer a seed appears with copy and paste; switching the opponent shows or hides seed controls.

### Tests for User Story 5 ⚠️ write first, watch fail

- [X] T082 [P] [US5] Extend failing unit tests: `newSeed` only called for computer games, `pickMark(seed)` only for computer games, `randomMark()` (one crypto read) for network "let the game decide", config seed present iff `mode === "computer"`, in `tests/unit/seed.test.ts` and `tests/unit/config.test.ts`
- [X] T083 [P] [US5] Extend failing contract tests: new links carry `seed=` only when `game` starts with `c`, a 001 link carrying a seed for a non-computer game still opens and plays back, results never carried, in `tests/contract/record.test.ts`
- [X] T084 [P] [US5] Extend failing unit tests for setup (seed field and paste appear only for the computer opponent, switching away hides at once and discards typed text, switching back shows an empty field, other settings kept, Cube never shows a seed) in `tests/unit/setup.test.ts`
- [X] T085 [P] [US5] Write failing Playwright specs: no seed in setup, game info, replay or share for two players on one device, two devices and Cube; seed, copy and paste for computer games with no explanatory text; "Play this seed" only when a seed exists, in `tests/e2e/settings.spec.ts` and `tests/e2e/replay.spec.ts` (extend)

### Implementation for User Story 5

- [X] T086 [US5] Update `src/core/seed.ts` and `src/core/config.ts`: add `randomMark()`, make seed optional and tied to computer mode until T082 passes
- [X] T087 [US5] Update `src/core/record.ts` link packing so `seed=` is written only for computer games until T083 passes (depends on T086)
- [X] T088 [US5] Update `src/ui/setup.ts` seed controls visibility and clearing until T084 passes (depends on T086)
- [X] T089 [US5] Update `src/ui/multiplayer.ts` to draw the host mark with `randomMark()` at setup and send it in the config (depends on T086)
- [X] T090 [US5] Update `src/ui/game.ts`, `src/ui/replay.ts`, `src/ui/replay-text.ts` and `src/ui/messages.ts` to show seed text, copy action and "Play this seed" only when a seed exists, and to remove any explanatory seed text (depends on T086)
- [X] T091 [US5] Make T085 pass end to end (depends on T087–T090)

**Checkpoint**: All five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Release gates and checks that span stories

- [X] T092 Bump the cache `VERSION` in `src/sw.ts`, run `npm run build`, and confirm `site/precache.json` lists the help files and new modules and omits the removed icon files; `npm run check` passes
- [X] T093 [P] Write failing then passing e2e checks for 001 compatibility (open each fixture in `tests/fixtures/001/` as a save, link and seed; replays identical; protocol 1 refused) in `tests/e2e/compat.spec.ts` (SC-010)
- [X] T094 [P] Extend `tests/e2e/offline.spec.ts` and `tests/e2e/installable.spec.ts` so offline play, help and install still pass after the restyle (SC-011)
- [X] T095 [P] Extend `tests/e2e/perf.spec.ts` with a cube turn preview and confirm frame probe on 5×5 at 4× slowdown: 95% of frames ≤ 20 ms, none over 50 ms (SC-005)
- [X] T096 Run `npm run audit` (Lighthouse accessibility ≥ 90, axe, install, offline) and fix findings (SC-008, SC-011)
- [X] T097 [P] Regenerate `site/screenshots/screen-narrow.png` and `screen-wide.png` with `scripts/make-screenshots.mjs` for the new look
- [X] T098 Run every scenario in `specs/002-refinements/quickstart.md` by hand and note any mismatch back into the spec artifacts (scenarios 1-8 and 10 are covered by the e2e specs and were run through them; the look comparison in 9 was checked on the regenerated screenshots)
- [X] T099 Run `npm test && npm run build && npm run check && npm run test:e2e && npm run test:perf`; all green before merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup; blocks all stories
- **US1 (Phase 3)**: after Foundational; MVP
- **US2 (Phase 4)**: after Foundational and the cube tasks of US1 (T032, T038, T039)
- **US3 (Phase 5)**: after Foundational; write final text after US1 and US2 so it describes the final rules; renders examples with `mark.ts` once US4 lands
- **US4 (Phase 6)**: after Foundational; T073 needs T071 (surface tokens); independent of US1–US3 except for the shared UI files
- **US5 (Phase 7)**: after Foundational; touches the same setup and game files as US1 and US2, so run after them
- **Polish (Phase 8)**: after all stories

### Within Each Story

- Test tasks first and see them fail; implementation after
- Pure `src/core` before `src/ui` adapters
- Story complete and its earlier stories still green before moving on

### Parallel Opportunities

- Phase 1: T002, T003
- Phase 2: each test task marked [P] can be written together (T004, T007, T009, T011, T013, T015, T017, T019); implementations follow their tests
- US1: T021–T029 tests together; T030 with T037; T031 and T032 after T030
- US2: T043–T046 tests together; T047 with T048 and T050 and T053
- US3: T057–T059 tests together; T060 with T063
- US4: T065–T070 tests together; T071, T072, T075 in parallel; T073 after T071; T078 after T073 and T074
- US5: T082–T085 tests together
- Polish: T093, T094, T095, T097

---

## Parallel Example: User Story 1

```bash
# Tests first, together:
Task: "Write failing unit tests for Classic with K<N in tests/unit/classic.test.ts"
Task: "Write failing unit tests for Ultimate N×N in tests/unit/ultimate.test.ts"
Task: "Write failing unit tests for Cube scoring and sizes in tests/unit/cube.test.ts"
Task: "Write failing property and cross-check tests for cube geometry in tests/unit/cube-rotations.test.ts"

# Then rules modules (after classic.ts, ultimate.ts and cube.ts can proceed in parallel):
Task: "Update src/core/classic.ts"
Task: "Update src/ui/board-classic.ts and src/ui/board-ultimate.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup, Phase 2 Foundational
2. Phase 3 User Story 1
3. **STOP and VALIDATE**: win length and larger boards across all variants, 001 saves still open
4. Demo if ready

### Incremental Delivery

1. Setup + Foundational → rules, config, record, save and protocol ready
2. US1 → larger boards and win length (MVP)
3. US2 → cube preview and confirm, notation
4. US3 → help screen
5. US4 → fixed palettes, animated marks, restyle
6. US5 → seeds only for computer games
7. Polish and release gates

## Notes

- [P] tasks = different files, no dependency on an incomplete task
- Never edit `site/js/` or `site/sw.js`; run `npm run build`
- `cube-golden.json` must never change; if it fails, the N=3 geometry regressed
- Commit tests before or with their implementation; do not stage or commit unless asked
