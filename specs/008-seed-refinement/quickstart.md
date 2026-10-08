# Quickstart: Forgiving Seed Entry

Run from the repo root. Node 22.18+.

## 1. Unit and contract checks

```text
npm run test:unit
npm run test:contract
npm run check
```

Expected: green. New cases in `tests/unit/seed.test.ts` (`resolveSeed`) and `tests/unit/setup.test.ts` (`placeholderFor`, `applySeedText`) pass. The `parseSeed` cases are unchanged and pass.

## 2. By hand on the start screen

```text
npm run dev
```

Open the app, keep Classic against the computer, and try each in the Seed box. Press Start game each time and read the `Seed:` line in the game.

| Type | Expect |
|---|---|
| (nothing) | box shows a seed like `C33-XXXX-XXXX`; the game plays exactly that seed |
| `c33bxk4m9tr` | note `This plays as C33-BXK4-M9TR.`; game seed `C33-BXK4-M9TR` |
| ` C33 BXK4 M9TR ` and `C33-BXK4-M9TR` | the same seed as the line above |
| `banana` | no error; a note with a seed; the same seed every time for `banana` and for `BANANA`, `b-a-n-a-n-a` |
| `BXK4M9TR` | seed `C33-BXK4-M9TR` (current rules in front) |
| `U54-BXK4-M9TR` | the screen switches to Ultimate, 5 by 5, win length 4 |
| `3X3-BXK4-M9TR` | seed stays `3X3-BXK4-M9TR` |
| `---` | treated as blank; the placeholder is played |
| 5,000 pasted characters | no delay, a valid seed |

Change the board size with the box empty: the placeholder's first three characters change. Change only the level or mark: the placeholder stays. Reload: the placeholder is new.

## 3. Same seed, same game

Play three moves of a game against the computer at a fixed level, copy its `Seed:`. Start again from that seed (typed in lower case without dashes) at the same level and mark, play the same three moves. The computer's replies match.

## 4. End-to-end and parity

```text
npm run build && npm run test:e2e
npm run test:parity
```

Expected: green. The parity capture of the start screen shows the placeholder, which is masked in the capture because it is random; the note appears only with typed text, in the hint style.

## 5. Old data

`tests/e2e/compat.spec.ts` and `tests/contract/record.test.ts` pass unedited: saved games, replay links and the legacy-prefix seeds load as before.

## Results

Run on 2026-10-08 against the finished work.

| Gate | Result | 007 / baseline |
|---|---|---|
| `npm run build && npm run check && npm test` | green (622 unit and contract assertions in the final block, 0 failures) | green |
| `npm run test:e2e` | 645 passed in the full run, 1 timing-sensitive failure (`ultimate.spec.ts` "computer replies in under a second on a throttled CPU", mobile) that passed 10 of 10 reruns on its own; an earlier run had 1 failure in `theme-dialog.spec.ts` (route already handled race) that passed 54 of 54 reruns | 564 at 007 |
| `npm run test:parity` | 28 of 28 (baseline retaken from the unchanged app with `#seed-input` masked; the host screen restarts the fixed random stream before its code is made) | 28 |
| `npm run test:perf` | 2 Twist 5x5 frame-budget failures, the same one that fails on the unchanged HEAD build (known since 007) | known failure |
| `npm run audit` | accessibility 100, first load interactive 2748 ms, axe serious 0 (the command exits 1 only because it runs the same two perf failures) | 100, 2588 ms |
| First-load script plus style, gzipped | 70.3 KB (69.9 KB before); budget raised to 71 KB, see plan.md Complexity Tracking | 69.9 KB |

Mutation check (T030): making `resolveSeed` throw on `nope`, making normalisation keep case, and making `parseSeed` accept anything each fail unit tests with a clear message, and were reverted.

Manual walkthrough (T032): not done by a person. The sections 2 and 3 above are covered by `tests/e2e/seed-entry.spec.ts` and `tests/unit/seed-replay.test.ts`, but nobody has used the screen by hand.
