# Implementation Plan: Twist-Tac-Toe Rename and UI Polish

**Branch**: `004-twist-rename-and-ui-polish` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-twist-rename-and-ui-polish/spec.md`

## Summary

Display-only rename of the Cube mode to Twist-Tac-Toe ("Twist"), a replay that turns the cube to the face of each placement, `AcB` / `UAcB` replay labels without X/O, a clearer status and score display, a Classic rules section in Help, and a tidier Help layout.

Approach: no new dependencies, `tsc` only, no rule, record, save or protocol change. The stored variant id stays `"cube"`; a single pure `variantName(variant, "full" | "short")` replaces the scattered literals, and every visible "Cube" goes through it or is reworded. Replay labels come from a pure `describeMove` that returns a short label plus a words-only accessible name. The replay face turn is a pure `faceInView(rx, ry, face)` predicate plus an awaitable `turnToFace` on the cube view; the read-only cube board delays `show(state, fresh)` until the turn settles, guarded by the existing `generation` counter so jumps cancel stale turns. Status text moves into a pure `statusText` module so wording is unit-tested. Help gains a leading `classic` section in the existing data-driven `help-content.ts`, and the layout is CSS only. The service worker `VERSION` is bumped 3 → 4 because cached files and manifest text change.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict, ES2022 modules, `erasableSyntaxOnly`), HTML, CSS. Node 22.18+ for tests and tooling only. Unchanged.

**Primary Dependencies**: None added. PeerJS stays lazy-loaded for two-device play.

**Storage**: `localStorage`; no schema change (save schema, protocol and record format untouched, so FR-002 holds by construction).

**Testing**: `node:test` for pure modules; Playwright for UI, offline, a11y and layout; existing scripted checks kept (`npm run check`). New: unit tests for `variantName`, `describeMove`, `faceInView`, `statusText`, help content shape and a visible-text scan for "Cube"; e2e for replay face turn, replay labels, status/score, help section and help layout at 320 px; existing tests that assert old strings are updated.

**Target Platform**: Unchanged: evergreen browsers; installable PWA on static HTTPS under a subpath.

**Project Type**: Static web app (single project, `tsc` emit to `site/js`, hand-written CSS in `site/css`, no bundler).

**Performance Goals**: Replay view turn fits inside one replay step at every speed (turn duration capped to a fraction of the step); no added first-load weight beyond the help text (help stays lazy). Existing budgets unchanged.

**Constraints**: Offline after first load; 001–003 links, seeds and saves open unchanged; no colour-only state; reduced-motion respected; Lighthouse accessibility at least 90.

**Scale/Scope**: About 14 changed source files, 1 new pure module (`status-text.ts`), CSS edits, ~10 updated tests and ~6 new ones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Pure changes (`variantName`, `describeMove`, `faceInView`, `statusText`, help data) get failing unit tests first; UI changes (replay turn, help layout, status) start from failing Playwright specs; `tasks.md` lists each test before its implementation. Updating assertions of old strings is done in the same task as the rename. |
| II. PWA First | PASS | Manifest/title text changes only; still installable; status, score and labels stay keyboard-reachable, named and not colour-only; help layout checked at 320 px. |
| III. Offline-Capable by Default | PASS | Cache version bumped; no new network use; help and replay already precached and stay so. |
| IV. Simplicity | PASS | No dependencies; one new small pure module; rename via one helper, not an i18n layer; layout is CSS only. |
| V. Pure, Testable Game Logic | PASS | No rules change. Labels, names, view-visibility and status wording live in pure, DOM-free functions; DOM code only consumes them. |

Post-design re-check (after Phase 1): unchanged, all PASS. No complexity violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-twist-rename-and-ui-polish/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── ui-contracts.md  # Phase 1: names, labels, status, replay view turn, help
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── core/
│   └── variants.ts        # + variantName(variant, form); id "cube" unchanged
├── ui/
│   ├── status-text.ts     # NEW pure: statusText(...) for move prompts and results
│   ├── replay-text.ts     # describeMove -> { label, name }; AcB / UAcB, no X/O
│   ├── replay.ts          # use label + aria-label; title via variantName; pass step time to board
│   ├── cube-labels.ts     # + FACE_LETTERS, faceInView(); cubeStatus -> via status-text; no "cube" mode wording
│   ├── cube-view.ts       # + turnToFace(face, ms): Promise<void>; aria-labels "Twist, 3D view"
│   ├── board-cube.ts      # read-only update(): turn to hidden face before show(); labelled score row
│   ├── boards.ts          # pass replay step time / readOnly flag through
│   ├── game.ts            # statusText; VARIANT_TITLE via variantName
│   ├── setup.ts           # picker "Twist", "Twist rules", "Twist is for two players."
│   ├── settings.ts        # "Twist turn names" (option "Cube notation" kept: it is the cubing term)
│   ├── help-content.ts    # + classic section first; Cube -> Twist-Tac-Toe wording
│   ├── help.ts            # layout hooks (classes) only
│   └── messages.ts, app.ts, hints.ts  # visible-string sweep
├── sw.ts                  # VERSION "3" -> "4"
site/
├── index.html, manifest.json   # title, description, screenshot label
└── css/style.css, cube.css     # help layout; score/status row

tests/
├── unit/                  # variants-name, replay-text, cube-view-visible, status-text, help-content, visible-names
└── e2e/                   # replay.spec, cube.spec, help.spec, a11y.spec, settings.spec updated; layout at 320 px
```

**Structure Decision**: Existing single-project layout; pure logic stays in `src/core` and DOM-free `src/ui/*-text.ts` / `*-labels.ts` helpers, DOM in the rest of `src/ui`. `site/js` is build output and is never edited by hand.

## Complexity Tracking

No Constitution Check violations; nothing to justify.
