# Implementation Plan: Cube Rule Options and Preview Polish

**Branch**: `003-cube-rule-options-and-preview-polish` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-cube-rule-options-and-preview-polish/spec.md`

## Summary

Two optional Cube rules (lock faces that hold a winning line; score by faces instead of lines), a smoother same-layer turn preview, a layer highlight that survives hover, select, preview and hold, a win-length reset on every board-size choice, and a review of the 4×4 and 5×5 turn names.

Approach: no new dependencies, `tsc` only. `GameConfig` gains `scoring` (`lines` | `faces`) and `lockFaces`. Both options travel with the rules: the rules code takes optional trailing flags `F` (faces scoring) and `L` (lock), so replays and share links reproduce the score and the moves exactly. The Cube rules module gains a derived `lockedFaces`, a `scores` tally and an end-by-lock check. Same-layer preview is a pure angle-path function (`turn-path.ts`) plus one new effect in the turn state machine; the view tracks the layer's cumulative angle and transitions straight to the target. The notation module changes one thing: the middle layer of any odd cube is M, E or S. The win-length default becomes a function of size alone, with the 001 table split off as the legacy default so old data is untouched. Save schema 2→3 and protocol 2→3 keep older builds from silently playing with the wrong rules.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict, ES2022 modules, `erasableSyntaxOnly`), HTML, CSS. Node 22.18+ for tests and tooling only. Unchanged.

**Primary Dependencies**: None added. PeerJS stays lazy-loaded for two-device play.

**Storage**: `localStorage`; save schema 2 → 3 (trivial migration: games get `scoring: "lines"`, `lockFaces: false`; `lastSetup` gets the same). Cache version bumped.

**Testing**: `node:test` for pure modules; Playwright for UI, offline, persistence, two-device and visual checks; existing scripted checks kept. New: unit tests for lock, scoring, turn paths, notation and defaults; contract tests for record, save 2→3 and protocol 3; e2e for setup defaults, preview continuity, highlight and locked faces.

**Target Platform**: Unchanged: evergreen browsers; installable PWA on static HTTPS under a subpath.

**Project Type**: Static web app (single project, `tsc` emit, no bundler).

**Performance Goals**: Preview frames within 20 ms for 95% and none over 50 ms, including same-layer retargets (SC-004). Ultimate 5×5 computer reply under 1 s still holds with the new default win length 4 (the 002 probe is re-run with K=4).

**Constraints**: Offline after first load; 001 and 002 links, seeds and saves open unchanged; deterministic rules; no colour-only state; Lighthouse accessibility at least 90.

**Scale/Scope**: Cube-only rules; about 2 new files and 20 changed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Each pure change (lock, scoring, rules code, turn path, state machine, notation, defaults, save, protocol) gets a failing test before code; tasks order test before implementation; UI changes start from Playwright specs. |
| II. PWA First | PASS | Still installable and responsive; new setup controls and locked-face marking are keyboard operable, named, and not colour-only. |
| III. Offline by Default | PASS | Nothing needs the network; help text is in the precache; cache version bumped; the protocol bump degrades to a clear "update the other device" message. |
| IV. Simplicity | PASS | No dependencies. The lock is derived, never stored. Scoring is one extra field. The highlight needs no new module. See Complexity Tracking. |
| V. Pure Game Logic | PASS | `lockedFaces`, scoring, end-by-lock, rules code, turn path and notation live in `src/core` with no DOM, storage or network. The view only animates and highlights. |
| Technical Constraints | PASS | Client only; cache version bumped; accessible names; text or pattern plus colour. |

Post-design re-check: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-cube-rule-options-and-preview-polish/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── core-api.md        # cube rules, scoring, turn path, notation, win-length defaults
│   ├── record-format.md   # rules code with scoring flag, save schema 3
│   ├── net-protocol.md    # protocol version 3
│   └── ui-contracts.md    # setup options, locked faces, preview path, highlight
├── checklists/requirements.md
└── tasks.md               # produced by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── types.ts           # GameConfig gains scoring, lockFaces
│   ├── rules.ts           # Rules gains scoring; defaultWinLength(size); legacyWinLength keeps the 001 table; code suffix F
│   ├── cube.ts            # lockedFaces, scores, face-lock refusal, end-by-lock, hints skip locked faces
│   ├── config.ts          # parseConfig reads scoring and lockFaces (Cube only), defaults lines / false
│   ├── record.ts          # scoring and lockFaces in the rules and the link
│   ├── settings.ts        # SetupChoice gains scoring, lockFaces
│   ├── protocol.ts        # PROTOCOL_VERSION 3
│   ├── notation.ts        # odd-cube middle layer is M / E / S
│   ├── turn-path.ts       # NEW: pure cumulative-angle path for a preview change on one layer
│   └── turn-selection.ts  # same-layer select produces a retarget effect
├── ui/
│   ├── setup.ts           # chooseSize resets win length; Cube options
│   ├── board-cube.ts      # hover/focus highlight with no preview, tap-on-name highlight on touch; retarget; scores label; lock messages
│   ├── cube-view.ts       # per-layer cumulative angle; retargetTurn; locked-face marking
│   ├── cube-labels.ts, messages.ts, game.ts, replay*.ts   # faces wording, lock refusal reason, end-by-lock text
│   └── help-content.ts    # options and inner-layer naming
├── adapters/store.ts      # schema 3 and migration 2→3
└── sw.ts                  # cache version bump
site/css/cube.css          # locked-face pattern and badge, highlight continuity
tests/{unit,contract,e2e}  # per the quickstart table
```

**Structure Decision**: Single-project layout from 001. Behaviour that needs no DOM goes in `src/core`; UI modules stay adapters.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Save schema 3 and protocol 3 | A save or peer from the previous build would play a lock or face-count game by the wrong rules | Optional fields on schema 2 would let an older build silently ignore the lock; both bumps give a clean refusal |
| `turn-path.ts` as its own pure module | Same-layer path logic (shortest route, tie broken away from zero) must be testable without the DOM (SC-003) | Burying angle maths in the view makes SC-003 testable only through the DOM |
| Two flags in the rules code | Replays must reproduce both the tally and the lock, including an end caused by the lock | Omitting the lock leaves a lock game's replay unable to show its refusals or its early end |
