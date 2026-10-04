# Quickstart: Validating Cube Rule Options and Preview Polish

Contracts: [contracts/](contracts/). Data: [data-model.md](data-model.md).

## Prerequisites

Node 22.18+, `npm install`, Playwright browsers (`npx playwright install`).

## Automated

```text
npm test            # typecheck, unit, contract
npm run build       # tsc, preload and precache lists
npm run check       # service worker, precache, version, theme, token checks
npm run test:e2e    # Playwright
npm run test:perf   # computer reply times (K=4 defaults) and cube frame timing
npm run audit       # Lighthouse accessibility, axe, install, offline
```

| Area | Where | Proves |
|---|---|---|
| Lock (FR-002 to FR-007) | `tests/unit/cube-lock.test.ts` | Refusal, lock and unlock by turns, first line allowed, end-by-lock, hints, undo |
| Face scoring (FR-008 to FR-011) | `tests/unit/cube-scoring.test.ts`, `tests/contract/record.test.ts` | Single and shared faces, extra line adds nothing, trigger unchanged, rules code `F` and `L`, replay of a lock game ends at the same move, old links open as lines and no lock |
| Turn path (FR-014, FR-015, SC-003) | `tests/unit/turn-path.test.ts`, `turn-selection.test.ts` | Every ordered turn pair on a layer: no crossing of the original, congruent end, state machine retarget |
| Highlight (FR-017, FR-018, SC-005) | `tests/e2e/cube.spec.ts` | Present on every sampled frame through select, retarget, hold; 3D, flat, touch |
| Win-length defaults (FR-019 to FR-021, SC-006) | `tests/unit/setup.test.ts`, `rules.test.ts` | Any size sequence, all variants; legacy table intact |
| Notation (FR-022 to FR-025, SC-007) | `tests/unit/notation.test.ts` | Table for N=3,4,5; 5×5 middle is M/E/S; round trip; 3×3 unchanged |
| Compatibility (SC-002) | `tests/contract/save.test.ts`, `protocol.test.ts` | Schema 2→3, protocol 2 refused, 001/002 links open |

## Manual scenarios

1. **Lock**: Cube 3×3, lock on. Make a line on the top face, turn a layer. Try a cell on the top face: refused. Turn a layer that breaks the line: top face accepts marks again.
2. **Faces scoring**: Cube 3×3, faces on. Make two lines on one face: score shows Faces 1. Finish a game, copy the replay link, open it: same scores.
3. **Preview continuity**: Turn pending, preview "top layer right", then "top layer left": the layer swings straight through, never back to the start. Cancel: it returns the short way.
4. **Highlight**: Hover a layer name or turn button: the layer is outlined, nothing previews. Select, change and hold: the outline never drops; move the pointer away: it clears. On a touch device, tap a layer name: it highlights until you tap another.
5. **Lock replay**: finish a lock game (including one that ends because no open face is left), copy the replay link, open it: same refusals, same end.
6. **Defaults**: Pick 5×5, set 5, pick 4×4 (shows 4), pick 3×3 (fixed 3), pick 5×5 (shows 4).
7. **Notation**: Cube 5×5, cube notation: middle layers read M, E, S; others 2L, 2R, 2U, 2D, 2F, 2B.
