# Implementation Plan: Game Refinements and Tweaks

**Branch**: `002-refinements` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-refinements/spec.md`

## Summary

Seven refinements to the 001 app: (1) win length chosen separately from board size, 3 through N; (2) 4×4 and 5×5 boards for Ultimate and Cube; (3) a Cube turn flow of select → animated preview → confirm, cancelled by clicking outside or Escape, with icon direction buttons and an optional cube-solving notation; (4) a help screen for Ultimate and Cube linked from the main menu; (5) the tictactoe-game SVG marks and draw animation replacing custom text icons, with a choice of four fixed X/O colour palettes, each with light and dark variants; (6) the flagrant colour scheme and component styling across the app; (7) seeds exist only for games with a computer player, with no in-game explanation.

Approach: no new runtime or dev dependencies, same `tsc`-only build. The rules modules gain two parameters, board size N (3 to 5) and win length K, carried in `GameConfig` and stored with every game. Cube geometry is generalised from 3 layers per axis to N using doubled integer coordinates, which leaves N=3 byte-identical to the golden fixtures. Seeds become optional and the rules travel as a separate three-character rules code, so share links and saves stay compatible: 001 links and saves load unchanged. New pure modules hold cube notation, the fixed mark-palette table and win-length rules, each tested first. The UI changes are adapters over those: SVG marks, a turn-preview state machine in the cube board, a hash-routed help page, restyled CSS.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict, ES2022 modules, `erasableSyntaxOnly`), HTML, CSS. Node 22.18+ for tests and tooling only. Unchanged from 001.

**Primary Dependencies**: None added. Runtime stays dependency-free for play, with PeerJS lazy-loaded for two-device play as in 001. Dev: TypeScript, Playwright, Lighthouse, axe-core, all as in 001.

**Storage**: `localStorage`. The save file moves from schema 1 to schema 2 (see [data-model.md](data-model.md)): custom icons are dropped, a mark palette id, turn notation and win length are added, and a migration keeps schema 1 saves playable. Cache Storage for the app shell, with the cache version bumped.

**Testing**: `node:test` for pure modules, run on `.ts` directly; Playwright for UI, offline, persistence, two-device and visual checks; the 001 scripted checks (`check-sw`, `check-precache`, `check-version`, `check-theme`) kept and extended. New: a performance probe for large-board computer replies and for cube preview frames.

**Target Platform**: Unchanged: evergreen browsers on phone, tablet, desktop; installable PWA on static HTTPS hosting under a subpath.

**Project Type**: Static web app (single project; `tsc` emit, no bundler).

**Performance Goals**: Computer reply under 1 s on a mid-range phone for every Classic and Ultimate size including Ultimate 5×5 (SC-004); cube preview and confirm frames within 20 ms for 95% of frames, none over 50 ms, on all cube sizes (SC-005); first load budget from 001 still met with the help page lazy-loaded and the larger CSS.

**Constraints**: Offline after first load, with the help page precached; deterministic computer (same seed and moves, same game); 001 saves, seeds and links open unchanged (SC-010); two-device play requires both devices on the same protocol version; no colour-only state; Lighthouse accessibility at least 90.

**Scale/Scope**: Boards up to 5×5; Ultimate up to 625 cells; Cube up to 150 stickers and 45 layer turns (5 layers × 3 axes × 3 amounts); one new screen (help); about 8 new files and 25 changed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Every new pure module (`rules`, `notation`, `palette`, generalised `classic`, `ultimate`, `cube`, `seed`, `record`, `config`, `settings`) gets failing tests first. Cube N=4 and N=5 get property and identity tests before geometry changes. The task list orders each test task before its implementation. UI work follows Playwright specs written first. |
| II. PWA First | PASS | Still installable and responsive; help is a route in the same shell, reachable by keyboard and touch; the restyle keeps contrast and Lighthouse accessibility at least 90, and the existing audit gate runs after it. |
| III. Offline by Default | PASS | Help content ships in the precache list; the cache version is bumped; the migration runs on the local save; the two-device protocol bump degrades to a clear "other device needs the latest version" message and never blocks offline play. |
| IV. Simplicity | PASS | No new dependencies. Cube notation, palette maths and the help text are plain modules. Win length is one shared value, not one per level. Inner-layer notation is the minimum needed. A constant table of four palettes replaces any colour parsing or adjustment. |
| V. Pure Game Logic | PASS | N, K, notation and palette logic live in `src/core` with no DOM, storage or network; the preview state machine's rules (which selections are legal, what a preview produces) are pure and the DOM layer only animates. |
| Technical Constraints | PASS | Client-side only; cache version bumped; keyboard operation and accessible names for every new control; shape plus colour for marks. |

Post-design re-check (after Phase 1): PASS. See Complexity Tracking for the compatibility costs: a protocol version bump, a save schema bump and the rules code in links. The fixed-palette decision removed the former colour-adjustment complexity row.

## Project Structure

### Documentation (this feature)

```text
specs/002-refinements/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core-api.md          # changes to the pure module interfaces
│   ├── record-format.md     # rules code, optional seed, move tokens, save schema 2
│   ├── net-protocol.md      # protocol version 2
│   └── ui-contracts.md      # cube turn flow, notation, palette, setup seed visibility, help route
├── checklists/requirements.md
└── tasks.md                 # produced by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── core/                      # PURE
│   ├── types.ts               # GameConfig gains winLength, seed optional; size stays 3|4|5; CubeRotate.layer is 0..N-1
│   ├── rules.ts               # NEW: win-length options, defaults, legacy defaults, rules code encode/decode
│   ├── classic.ts             # lines(size, winLength); winLength from config
│   ├── ultimate.ts            # N×N small boards on an N×N grid, K at both levels
│   ├── cube.ts                # N layers per axis, doubled-coordinate geometry, K-windows on faces
│   ├── notation.ts            # NEW: cube-solving notation names for any turn, any N; wording names
│   ├── turn-selection.ts      # NEW: pure idle/animating/previewing state machine for cube turns│   ├── palette.ts             # NEW: constant table of 4 fixed X/O palettes with light and dark variants; lookup by id
│   ├── ai.ts, ai-ultimate.ts  # rule-parameterised lines, per-size budgets
│   ├── seed.ts                # seed optional; new prefix scheme; old prefixes still parse
│   ├── config.ts              # parseConfig reads winLength, optional seed, legacy defaults
│   ├── tokens.ts, record.ts   # extended index alphabet; link carries rules, seed only for computer games
│   ├── settings.ts            # markPalette (id), cubeNotation replace icons; lastSetup gains winLength
│   ├── protocol.ts            # protocol v2
│   └── icons.ts               # REMOVED (custom icon validation)
├── ui/
│   ├── mark.ts                # NEW: SVG X and O marks with the draw animation (replaces glyph.ts)
│   ├── glyph.ts               # REMOVED
│   ├── help.ts, help-content.ts   # NEW: hash-routed help page and its static content
│   ├── palette-picker.ts      # NEW: list of the fixed palettes with live X/O sample
│   ├── board-cube.ts          # turn flow: select, preview, confirm, cancel
│   ├── cube-view.ts           # N-sized stickers; previewTurn, cancelPreview, commitPreview; flat-view preview
│   ├── cube-labels.ts         # wording for N layers; notation switch
│   ├── board-classic.ts, board-ultimate.ts   # N and K; SVG marks
│   ├── setup.ts               # size for every variant, win length, seed only for computer games
│   ├── settings.ts, messages.ts, icons.ts    # colour and notation settings; arrow icons for turns; no icon fields
│   ├── game.ts, replay.ts, replay-text.ts, app.ts   # seed shown only when present; help link and route
│   └── theme.ts               # tokens only; mode mechanism unchanged
├── adapters/
│   └── store.ts               # save schema 2 and migration from 1
└── sw.ts                      # precache list gains help files

site/
├── css/theme.css              # tokens taking flagrant's values (light and dark), plus mark and claim tokens; token names stay neutral
├── css/style.css, cube.css    # flagrant component styling; tictactoe-game styling for elements flagrant lacks
└── index.html                 # help link in the menu; pre-paint theme script unchanged

tests/
├── unit/                      # rules, notation, palette, classic/ultimate/cube generalised, seed, record, settings, store migration, ai perf probe
├── contract/                  # record (legacy and v2), save (1 to 2), protocol v2, palette private
├── e2e/                       # win length, large boards, cube preview flow, notation, help, colours, seed visibility, 001 link and save compatibility
└── fixtures/                  # 001 links and saves kept as compatibility fixtures; cube-golden.json unchanged
```

**Structure Decision**: Stay with the single-project layout from 001. New behaviour that is not DOM-dependent goes in `src/core`; every UI module remains an adapter over it, and `tsc` remains the only build step.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Protocol version 2 for two-device play | A 001 peer would read a 4×4 or win-length game with the wrong rules and desync silently | Keeping version 1 and ignoring the new fields breaks the "same game on both devices" guarantee; the 001 version-reject path already gives a clear message |
| Save schema 2 with migration | Settings lose icons and gain colours and notation; saved games gain a win length | Reading schema 1 as-is would leave games without a win length and keep a dead icons field; a migration function is the contract defined in 001 |
| Rules code in links, separate from the seed | Games without a computer must carry their rules but no seed; 001 carried variant and size inside the seed prefix | Keeping the seed mandatory contradicts FR-033; inventing a second mandatory seed for human games hides the same problem |
