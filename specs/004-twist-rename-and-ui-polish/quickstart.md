# Quickstart: validating Twist-Tac-Toe Rename and UI Polish

Prerequisites: Node 22.18+, `npm install`, Playwright browsers installed.

## Automated

```text
npm test                 # typecheck + unit + contract
npm run build            # tsc, preload and precache generation
npm run check            # sw version bump, precache, theme, names scripts
npm run test:e2e         # replay, cube, help, a11y, settings, offline specs
```

Expected: all pass. `check-version` fails if `src/sw.ts` `VERSION` is not above the previous release.

## Manual walk-through

1. **Rename (US1)**: open the start screen. Third mode reads "Twist". Open its setup: group "Twist rules", note "Twist is for two players." Play to a result; no "Cube" as a mode name anywhere. Open help, Settings, and a shared replay link: same. Open a replay link, seed and saved game made before this change: all load.
2. **Replay face turn (US2)**: finish a Twist game with marks on all six faces and open its replay. Press Play: before each mark on a face not facing you, the cube turns to it; marks on the facing face do not move the view. Jump with the slider across faces, step back, change speed to 4×, switch to flat view, and turn on reduced motion in the OS: the face is always visible when the mark appears.
3. **Notation (US3)**: replay one game per variant. Entries read `2c3`, board name plus cell for Ultimate, `U1c2` for Twist, no X/O. Turn entries still follow Settings → "Twist turn names". With a screen reader or the accessibility tree, each entry has a words-only name.
4. **Status and score (US4)**: play vs computer ("Your move (X)."), on one device, and across two devices (fake peer in e2e or two tabs). In Twist, the score row reads `Lines · X 0 · O 0`; switch to faces scoring and it reads `Faces`. Check at 320 px.
5. **Help (US5, US6)**: open help. First section "Classic rules" states win length 3 for 3×3 and 4 for 4×4 and 5×5 and has an example. Check 320 px and desktop widths, light and dark, keyboard focus order, and offline reload.

## Done when

Spec success criteria SC-001 to SC-007 hold: zero visible "Cube" as a mode name, old data loads, every replay placement is on a visible face, labels match `AcB`/`UAcB`, no clipping at 320 px, help has no horizontal scroll and accessibility score is at least 90.
