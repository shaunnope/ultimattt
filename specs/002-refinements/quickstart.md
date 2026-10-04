# Quickstart: Validating the Refinements

How to prove the feature works end to end. Contracts: [contracts/](contracts/). Data: [data-model.md](data-model.md).

## Prerequisites

- Node 22.18 or newer; `npm install`; Playwright browsers installed (`npx playwright install`).
- The reference projects at `C:\Users\yapzh\CodeProjects\tictactoe` and `C:\Users\yapzh\CodeProjects\flagrant` for visual comparison (read only).

## Automated

```text
npm test            # typecheck, unit, contract
npm run build       # tsc, preload and precache lists
npm run check       # service worker, precache, version, theme, token checks
npm run test:e2e    # Playwright
npm run test:perf   # large-board reply time and cube frame timing
npm run audit       # Lighthouse accessibility, axe, install, offline
```

Expected: all pass. Notable tests by requirement:

| Area | Where | Proves |
|---|---|---|
| Win length and sizes (FR-001 to FR-010) | `tests/unit/classic`, `ultimate`, `cube`, `rules` | K windows, 4×4 and 5×5 routing, 9N turns, scoring per window |
| Cube geometry N=4,5 (research R4) | `tests/unit/cube-rotations.test.ts` | Identities, inverse, whole-cube equivalence, order-6 sequence, facelet cross-check; N=3 golden unchanged |
| Notation (FR-016, FR-017) | `tests/unit/notation.test.ts` | Round trip for all turns, N=3,4,5 |
| Palette (FR-027, FR-028) | `tests/unit/palette.test.ts` | Every palette, light and dark: contrast on `--bg` and `--surface`, X/O distinctness, colour-blind-safe palette present, unknown id falls back |
| Seeds (FR-033 to FR-036) | `tests/unit/seed.test.ts`, `tests/e2e/settings.spec.ts` | Seed only for computer games; legacy seeds parse |
| Compatibility (FR-009, FR-030, FR-035, SC-010) | `tests/contract/record`, `save`, `protocol` | 001 links, seeds and saves open; schema 1 → 2; protocol 1 refused |
| Cube flow (FR-011 to FR-021) | `tests/e2e/cube.spec.ts` | Preview, switch, cancel by outside click and Escape, confirm, flat view, keyboard, only the confirmed turn is sent |
| Help (FR-022 to FR-025) | `tests/e2e/help.spec.ts` | Link, headings, back, offline, game untouched |
| Performance (SC-004, SC-005) | `tests/e2e/perf.spec.ts` | Ultimate 5×5 replies under 1 s at 4× slowdown; cube frames within budget on 5×5 |

## Manual scenarios

1. **Win length**: new Classic 5×5, set win length 3, play three in a row on an edge: win declared. Set size 3: win length shows fixed at 3.
2. **Large Ultimate**: Ultimate 4×4, win length 3. Play a cell and confirm the opponent is sent to the matching small board; send them to a claimed board and confirm free choice.
3. **Large Cube**: Cube 5×5, win length 3. Score a line, then pick the second layer from the right, anticlockwise: it previews. Click outside: it reverses. Pick again and press Confirm: marks match the preview.
4. **Notation**: switch Cube notation on; the picker shows `R`, `R'`, `R2`, `2R`, `3L`. Switch off: icons only. Check both at 320 px width without clipping.
5. **Help**: from the menu open Help, read Ultimate and Cube, go Back. Repeat offline.
6. **Colours**: open Settings: no icon field and no custom colour input, only the four palettes. Pick "Colour-blind safe": marks change at once. Toggle dark mode: marks switch to that palette's dark variant and stay legible. Reload: the choice is kept.
7. **Seeds**: a two-player game shows no seed; against the computer it shows a seed and copy action with no explanation text. Switch the setup opponent: the seed field appears and disappears.
8. **Compatibility**: open a saved 001 game, a 001 share link and a 001 seed; all load and replay identically.
9. **Look**: compare menu, setup, game, replay, settings and help in light and dark against flagrant; palette, type and component styling match, and elements flagrant lacks use the same tokens.
10. **Two devices**: host a 4×4 Ultimate game and join from a second device; both agree each move. Host a Cube game and preview a turn on one device; the other sees nothing until Confirm.
