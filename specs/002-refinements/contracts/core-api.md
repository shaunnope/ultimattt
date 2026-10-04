# Contract: Pure Module Interfaces (delta to 001)

Baseline: [001 core-api](../../001-multi-variant-tictactoe/contracts/core-api.md). The shared per-variant shape (`newGame`, `legalMoves`, `isLegal`, `apply`, `status`, `undo`, `fromMoves`, `hash`, `hints`) is unchanged. Everything below stays free of DOM, storage, network and clock.

## `rules.ts` (new)

| Function | Returns |
|---|---|
| `winLengthOptions(size)` | `[3 … size]` |
| `defaultWinLength(variant, size)` | See [data-model.md](../data-model.md) |
| `legacyWinLength(variant, size)` | Win length a 001 config implied |
| `clampWinLength(variant, size, current)` | `current` if valid for `size`, else the default |
| `rulesCode(variant, size, winLength)` | e.g. `"C53"` |
| `parseRulesCode(text)` | `{ variant, size, winLength }` or `{ error }` |

## `classic.ts`

- `lines(size, winLength)`: every window of exactly `winLength` cells; cached by the pair. 001's `lines(size)` and `winLengthFor` are removed; callers pass the win length from the config.
- `newGame` and `hints` use `config.winLength`.

## `ultimate.ts`

- `UltimateState` shapes follow [data-model.md](../data-model.md). `playable`, `legalMoves` and `isLegal` use N instead of 3: board and cell indexes range over `0 … N²−1`. The REASONS list is unchanged.
- Small-board and grid wins both use `lines(config.size, config.winLength)`.

## `cube.ts`

| Function | Change |
|---|---|
| `rotateTable(size, axis, layer, dir)` | Gains `size`; layer `0 … size−1` |
| `rotateStickers(stickers, size, axis, layer, dir)` | Gains `size` |
| `layerStickers(size, axis, layer)` | Gains `size`; outer layers include their face |
| `rotations(size)` | `9 × size` turns |
| `cubeLines(stickers, size, winLength)`, `countLines(…)` | K-windows per face; one line per window |
| `FACES` | Unchanged (U, D, F, B, L, R) |

For `size = 3` every result equals 001's, which `tests/fixtures/cube-golden.json` continues to prove.

## `notation.ts` (new)

| Function | Meaning |
|---|---|
| `turnName(rotation, size, style)` | `style` is `"words"` or `"cube"`. Words: plain wording matching the controls' accessible names. Cube: `R`, `U'`, `F2`, `M`, `2R`, `3L'`… |
| `parseTurnName(text, size)` | Inverse of the cube style; `{ error }` for anything else |
| `layerLabel(axis, layer, size, style)` | Row label for the turn picker |
| `turnsFor(size)` | All `9 × size` turns in picker order |

Rules: see [research.md R15](../research.md). `parseTurnName(turnName(r, n, "cube"), n)` equals `r` for every turn and size.

## `palette.ts` (new)

| Function | Meaning |
|---|---|
| `PALETTES` | Constant list of `{ id, label, X: { light, dark }, O: { light, dark } }`: `default`, `cbsafe`, `forest`, `sunset` |
| `DEFAULT_PALETTE` | `"default"` |
| `paletteById(id)` | The palette, or the default for an unknown id |
| `markColors(id, appearance)` | `{ X, O }` hex for `"light"` or `"dark"` |
| `contrast(a, b)` | WCAG contrast ratio of two hex colours (used by tests and the token check, not at runtime) |

No parsing of user input and no colour adjustment: users cannot enter a colour.

## `seed.ts`

- `newSeed(variant, size, winLength)` returns a seed with a rules-code prefix. Called only for computer games.
- `parseSeed(text)` returns `{ variant, size, winLength, body }`; 001 prefixes yield legacy win lengths.
- `pickMark(seed)` is called only for computer games. Network setup uses `randomMark()` (new, reads crypto once) instead.

## `config.ts`, `record.ts`, `settings.ts`

- `parseConfig` follows [data-model.md](../data-model.md); `winLength` defaults via `legacyWinLength`.
- `ReplayRecord`, `packLink`, `unpackLink` and `configFromRecord` follow [record-format.md](record-format.md).
- `normalizeSettings` produces `markPalette` (unknown or missing id becomes the default) and `cubeNotation` and ignores any stored `icons` or `markColors`; `normalizeSetup` validates `winLength` against `size`.

## AI

- `chooseMove(variant, state, level, rng)` is unchanged in shape. Evaluation reads the line list for `(size, winLength)`.
- Per-size budgets (positions, not time) are tabled beside the existing level specs. Determinism is unchanged: the same seed and moves give the same choices.
- Guarantee kept: Master on 3×3 with K=3 never loses. No guarantee is made for other sizes.

## Removed

`core/icons.ts` (`validateIcons`, `ICON_REASONS`) and `ui/glyph.ts` (`markGlyph`, `setGlyphs`).
