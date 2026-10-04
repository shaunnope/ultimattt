# Contract: Core API changes

Pure modules (no DOM, storage, network or clock). Each item has a unit test written first.

## `core/cube.ts`

- `lockedFaces(stickers, size, winLength): number[]` — faces with at least one line of either player.
- `scoreOf(stickers, size, winLength, scoring): {X: number, O: number}` — lines mode counts lines; faces mode counts faces per player.
- `isLegal(state, move)` — placing on a locked face when `config.lockFaces` returns `{ok: false, reason: "face-locked"}`. `REASONS` gains `"face-locked"`. Rotations are never affected.
- `legalMoves(state)` — no placements on locked faces.
- `hints(state, mark)` — no cells on locked faces.
- `apply` — `phase` trigger unchanged (uses `lines`); `settle` uses `scores` and ends the game on `empty = 0` or no placeable cell.
- `undo`, `fromMoves`, `hash` — hash includes nothing new (locks are derived from stickers).

## `core/rules.ts`

- `defaultWinLength(size): number` — 3 for 3, else 4.
- `legacyWinLength(variant, size): number` — the 001 table.
- `clampWinLength(variant, size, current)` — valid current kept, else `defaultWinLength(size)`.
- `rulesCode(variant, size, winLength, scoring?, lockFaces?)` / `parseRulesCode` — optional trailing `F` then `L`, Cube only.

## `core/config.ts`

`parseConfig` reads `scoring` and `lockFaces`; rejects them on non-Cube configs; defaults `lines` and `false`.

## `core/turn-path.ts` (new)

- `targetAngle(current: number, quarters: -1 | 1 | 2): number`
- `settleAngle(current: number): number`

Properties tested: result is congruent to the target mod 360; its distance from `current` is at most 180; the path from `current` to the result never crosses a multiple of 360 other than at its ends (for any ordered pair of turns on a layer, SC-003).

## `core/turn-selection.ts`

`step` adds effect `{kind: "retarget", from: CubeRotate, to: CubeRotate}` as described in [data-model.md](../data-model.md).

## `core/notation.ts`

`turnName`, `layerLabel`, `parseTurnName`, `turnsFor`: the odd-cube middle layer is `M`/`E`/`S` for every odd size; the `3`-prefixed middle names are gone. 3×3 output is byte-identical to before.
