# Implementation Plan: Forgiving Seed Entry

**Branch**: `008-seed-refinement` (not created; work stays on `main` unless the user branches) | **Date**: 2026-10-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-seed-refinement/spec.md`. Authority for look and behaviour: `docs/pwa-design-spec.md`.

## Summary

Make reading the seed box total. Any text becomes a playable seed, spelling of a valid seed (case, dashes, spaces) does not matter, and a blank box plays the placeholder shown, which follows the chosen variant, board size and win length.

Approach (details in research.md R1 to R6):

1. **One new pure function in `src/core/seed.ts`**, `resolveSeed(text, fallback)`, that never fails. It normalises the text, then returns one of: an exact seed (valid, rules part kept), a body-only seed (eight good characters, current rules put in front), or a derived seed (a deterministic hash of the text fills the eight characters, current rules in front). Blank text returns `null`.
2. **`parseSeed` is not touched.** Replay links, shared records and saved games keep their strict reading, so everything valid before stays byte-identical (FR-012, SC-005). The new function is used only by the start screen.
3. **The canonical string is what the game hashes.** `rngFor(seed, moveIndex)` and `pickMark(seed)` already depend only on the seed string, so guideline 1 (same seed, same moves, same computer replies) holds once every spelling maps to one canonical string. Legacy prefixes (`3X3`, `ULT`, ...) stay in their own spelling, as they are hashed today.
4. **Start screen**: the error banner goes; a quiet note under the box shows the seed that will be played when it differs from what was typed (FR-010). The placeholder is a real seed kept by a small pure helper in `setup-model.ts`: it is kept while the rules prefix is unchanged and made again when it changes. A blank box starts with that seed.
5. **No change** to game rules, the AI, the saved-game format, the replay link format, or the multiplayer protocol.

## Technical Context

**Language/Version**: TypeScript 6, Svelte 5 (runes), Node 22.18+ for tooling and tests (unchanged from 007).

**Primary Dependencies**: none added.

**Storage**: unchanged. Seeds already persist as strings in saves and records.

**Testing**: `node:test` for `src/core/seed.ts` and `src/ui/setup-model.ts` (unit, written first); Playwright e2e for the start screen (`replay.spec.ts`, `compat.spec.ts`, a new `seed-entry.spec.ts`); parity capture for the note and placeholder (`npm run test:parity`).

**Target Platform**: evergreen browsers, installable PWA, static hosting (unchanged).

**Project Type**: static web app, SvelteKit static build.

**Performance Goals**: reading text is a few string passes and two 32-bit hashes; it runs on each keystroke with no visible cost, including for thousands of characters (a test with 100,000 characters stays under 50 ms). First-load budget: the change measured about +0.4 KB gzipped, which breaks the 007 limit of 70 KB; raised to 71 KB (Complexity Tracking).

**Constraints**: integer-only arithmetic in the seed code, no `Math.random` (replays must match across browsers); only `newSeed` and the placeholder read crypto, once each; copy rules (no em dashes, emoji, exclamation marks); the seed alphabet and standard form `PPP-XXXX-XXXX` do not change.

**Scale/Scope**: 1 core module extended, 1 UI model extended, 1 component edited, 4 test files edited, 2 new test files, 0 new components.

## Constitution Check

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Every change starts as a failing test: seed reading and placeholder rules as unit tests, start-screen behaviour as e2e. The three existing tests that assert an error for bad text are rewritten first and seen failing, then the code changes (listed in contracts C4). |
| II. PWA First | PASS | No manifest, worker or install change. |
| III. Offline-Capable by Default | PASS | Pure client code; nothing fetched. The cache name changes with the build, as in 007. |
| IV. Simplicity | PASS | No dependency. One function, one helper, one component edit. Reuses `hashString`, `randomSource` and `newSeed`. No fuzzy matching or correction of typos (rejected in R4). |
| V. Pure, Testable Game Logic | PASS | `resolveSeed` lives in `src/core/seed.ts`, pure, no DOM, storage or clock, and covered by unit tests before the screen uses it. `check-core-purity` keeps framework imports out. |
| Design spec | PASS | The note reuses the existing `hint-text` style. No new colour, size or breakpoint. The error banner it replaces was the only red element in this field. Contrast and breakpoint checks are unaffected. |
| Technical constraints | PASS | Static, client-side. Accessibility: the note is a polite live region with an accessible name through `aria-describedby`; the input is no longer `aria-invalid` for any text. |

Post-design re-check: unchanged. All PASS, no Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-seed-refinement/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── seed-entry-contracts.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
src/
├── core/
│   └── seed.ts                  # + normaliseSeedText, resolveSeed, deriveBody; parseSeed unchanged
├── ui/
│   └── setup-model.ts           # + applySeedText (replaces applySeedToSetup), placeholderFor; configFromSetup unchanged
└── lib/components/
    └── Setup.svelte             # placeholder from state, note in place of error banner, blank start plays placeholder
tests/
├── unit/
│   ├── seed.test.ts             # + resolveSeed cases; parseSeed cases kept as they are
│   ├── setup.test.ts            # applySeedToSetup error case rewritten; + placeholderFor, applySeedText
│   └── replay.test.ts           # bad-seed case at line 106 rewritten
└── e2e/
    ├── replay.spec.ts           # "nope" error case (line 154) rewritten; placeholder cases added
    ├── compat.spec.ts           # unchanged in what it asserts (seed fixtures still load)
    └── seed-entry.spec.ts       # NEW: spellings, junk text, blank start, placeholder follows rules
```

**Structure Decision**: single project, edit in place. `parseSeed` stays strict because three other readers depend on its errors (`record.ts` link reading, the saved-game restore path, and the legacy tests). The forgiving reader is a new function beside it, so a change to one cannot loosen the other.

## Complexity Tracking

No constitution departures. Recorded design choices that a reader might question:

| Choice | Why | Rejected alternative |
|---|---|---|
| Derived body is a function of the text only, not of the rules | Same text always gives the same body, whatever the board. The rules prefix still differs, so seeds differ by board | Mixing rules into the hash makes one text give unrelated bodies on different boards, which is harder to explain and to share |
| Legacy prefixes stay in their legacy spelling | The game's random stream is the hash of the seed string, so rewriting `3X3` to `C33` would change an old seed's game (FR-007) | Canonicalising to the new prefix breaks old seeds |
| Typed text is discarded when variant, size or win length changes | It is the current behaviour, and a seed whose rules part disagrees with the visible choices would be confusing | Keeping text and re-deriving under the new rules silently changes the seed the player sees |
| First-load budget raised from 70 KB to 71 KB gzipped (`tests/e2e/budget.spec.ts`, `scripts/check-build.mjs`) | The feature adds about 0.4 KB gzipped (69.9 KB before, 70.3 KB after). The earlier estimate of about 80 lines was too low in bytes. Trimming did not shrink the minified output, and lazy-loading would save about 0.2 KB at the cost of an async read racing Start. Chosen by the user | Keeping 70 KB leaves a red gate for a feature that fits the 3 s target |
| Rematch from the result dialog still makes a fresh seed (`game-session.ts:225`) | Out of scope: the spec covers the start screen's seed box. Changing it would alter games that finish without the box | Reusing the seed on rematch would repeat the same computer behaviour |
