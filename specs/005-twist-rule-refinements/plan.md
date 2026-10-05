# Implementation Plan: Twist Mode Display Polish and New Logo

**Branch**: `005-twist-rule-refinements` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-twist-rule-refinements/spec.md`

## Summary

Four display changes, no rule, record, save, link or protocol change: (1) a padlock icon replaces the "Locked" word on locked Twist faces; (2) Twist marks the last placed cell with an inset border that follows the mark through layer turns; (3) a two-segment current-player pill replaces the plain turn prompt in every mode, carrying scores in Twist only, and the Twist `#cube-score` line is removed; (4) the logo becomes a 2×2×2 cube of X's and O's with rounded strokes.

Approach: no new dependencies. A pure `pillModel(...)` in `status-text.ts` derives who is highlighted, the scores and the spoken text; a small `pill.ts` DOM adapter renders it and is mounted by `game.ts` (live play) and `replay.ts` (replay), so every mode shares one component. `statusText` drops its plain turn prompts and keeps results, resignation, waiting, where-to-play, thinking, rotate prompts and errors. The last-placed Twist cell is derived by a pure `lastPlacedSticker(state)` in `core/cube.ts` that replays the move list and pushes the index through `rotateTable`; the cube view marks it with `data-last`. The padlock is a decorative inline SVG (new `lock` entry in `icons.ts`); the locked state stays announced via the stickers' names. `optionsNote` gains a Twist-only "lines scoring" so the game info always names the scoring kind. The logo is one hand-written SVG (`site/icons/logo.svg`, inlined in the header) and `scripts/make-icons.mjs` is rewritten to rasterise the same geometry with rounded caps. Service worker `VERSION` bumped 4 → 5.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict, ES2022, `erasableSyntaxOnly`), HTML, CSS. Node 22.18+ for tests and tooling only.

**Primary Dependencies**: None added.

**Storage**: `localStorage`; no schema change. The last-move index and pill are derived, never stored.

**Testing**: `node:test` for pure code (`pillModel`, `statusText`, `lastPlacedSticker`); Playwright for UI (pill in three modes, padlock, last-move border, 320 px layout, offline icons, a11y); scripted checks (`check-names`, `check-precache`, `check-version`, `check-theme-tokens`) kept. Existing e2e tests that assert `#game-status` turn text or `#cube-score` ("Lines · X: n") are rewritten against the pill.

**Target Platform**: Evergreen browsers, installable PWA on static HTTPS under a subpath. Unchanged.

**Project Type**: Static web app (`tsc` emit to `site/js`, hand-written CSS, no bundler).

**Performance Goals**: Pill update touches two elements only; last-move marking touches at most two stickers (clear old, set new) rather than all 150. No added first-load weight beyond a small SVG and a few CSS rules.

**Constraints**: Offline after first load; 001–004 saves, links and seeds open unchanged; no colour-only state; reduced motion respected (no slide); forced-colours safe; Lighthouse accessibility ≥ 90; reference project names absent from visible text.

**Scale/Scope**: About 10 changed source files, 2 new (`pill.ts`, `logo.svg`), CSS edits, icon script rewrite, ~8 updated and ~6 new tests.

## Constitution Check

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Failing unit tests first for `pillModel`, new `statusText` wording and `lastPlacedSticker`; failing Playwright specs first for the pill, padlock and last-move border; `tasks.md` lists each test before its implementation. |
| II. PWA First | PASS | Manifest icons regenerated and still valid; pill, padlock and border are display only, named and not colour-only; checked at 320 px. |
| III. Offline-Capable by Default | PASS | `VERSION` bump; new `logo.svg` and regenerated PNGs listed in precache; the precache check enforces it. |
| IV. Simplicity | PASS | One small component shared by all modes; one derived-index function; no libraries; logo geometry shared between the SVG and the PNG script rather than a new toolchain. |
| V. Pure, Testable Game Logic | PASS | No rule change. `lastPlacedSticker` lives in `core/cube.ts` (pure, no DOM); `pillModel` in a DOM-free module; DOM code only renders them. |

Post-design re-check: unchanged, all PASS. No complexity violations.

## Project Structure

### Documentation (this feature)

```text
specs/005-twist-rule-refinements/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contracts.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
src/
├── core/
│   └── cube.ts            # + lastPlacedSticker(state): number | null (replays moves through rotateTable)
├── ui/
│   ├── status-text.ts     # + pillModel(); statusText loses plain turn prompts
│   ├── pill.ts            # NEW: createPill(): { element, update(model) }; slide via CSS transform, none on reduced motion
│   ├── game.ts            # mount pill above board; status line only for non-turn messages
│   ├── replay.ts          # pill follows the replayed position
│   ├── board-cube.ts      # remove #cube-score and drawScore
│   ├── cube-view.ts       # lock badge -> padlock icon (aria-hidden, no text); data-last on one sticker
│   ├── cube-labels.ts     # scoreLabel kept for game-info text only
│   ├── icons.ts           # + "lock" path (rounded caps)
│   └── ui.ts / app.ts     # inline logo in header and start screen
├── sw.ts                  # VERSION "4" -> "5"
site/
├── index.html, manifest.json   # header logo; icon file names unchanged
├── icons/logo.svg, *.png       # new / regenerated
└── css/style.css, cube.css     # pill, padlock, .sticker[data-last]
scripts/make-icons.mjs          # rewritten: 2x2x2 cube, rounded caps
tests/
├── unit/                  # pill-model, status-text, last-placed
└── e2e/                   # pill.spec, cube lock/last-move cases, logo/offline; old turn-text asserts updated
```

**Structure Decision**: single project, extending the 004 layout. The pill is a new UI component because three boards and the replay all need it; mounting it in `game.ts` and `replay.ts` rather than in each board keeps the boards unchanged.

## Complexity Tracking

No violations to justify.
