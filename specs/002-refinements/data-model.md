# Data Model: Game Refinements and Tweaks

Changes to the 001 model ([../001-multi-variant-tictactoe/data-model.md](../001-multi-variant-tictactoe/data-model.md)). Anything not listed is unchanged. Everything here is pure data; no storage or DOM access.

## GameRules (new, part of GameConfig)

| Field | Type | Rule |
|---|---|---|
| `variant` | `classic \| ultimate \| cube` | As 001 |
| `size` | `3 \| 4 \| 5` | N. Board edge for Classic; small-board edge and grid edge for Ultimate; face edge for Cube |
| `winLength` | integer | K. `3 ≤ K ≤ size`. Fixed at 3 when `size` is 3 |

Defaults (`rules.defaultWinLength`): 3×3 any variant 3; Classic 4×4 and 5×5: 4; Ultimate and Cube 4×4 and 5×5: 3.
Legacy default (`rules.legacyWinLength`, for a 001 config with none): Classic 3×3 → 3, Classic 4×4 and 5×5 → 4; Ultimate and Cube → 3.
Rules code: three characters `<V><N><K>` with V = `C`, `U`, `B` (Cube), e.g. `C53`, `U43`, `B33`.

## GameConfig (changed)

| Field | Change |
|---|---|
| `size` | Now meaningful for every variant (001: only Classic) |
| `winLength` | **New**, required after parsing |
| `seed` | **Optional.** Present if and only if `mode === "computer"` |
| `humanMark`, `level`, `mode`, `variant` | Unchanged. In network games `humanMark` is chosen once at setup (random draw or explicit), not derived from a seed |

Validation (`parseConfig`): `size ∈ {3,4,5}`; `winLength` integer in `[3, size]` or absent (then the legacy default applies); a Cube config with mode `computer` is invalid; `seed` required when `mode` is `computer` and ignored otherwise.

## Per-variant state (changed shape, same meaning)

| State | Change |
|---|---|
| `ClassicState` | `winLength: number` (001: `3 \| 4`) |
| `UltimateState` | `boards`: N² arrays of N² cells; `claims`: N² entries; `winLine`: K small-board indexes. `forced` is a board index `0..N²−1` or null |
| `CubeState` | `stickers`: 6·N² entries (index `face·N² + row·N + col`); `empty` starts at 6·N²; `lines` recounted over K-windows on each face |

### Cube turn

`CubeRotate = { t: "rotate", axis: "x"|"y"|"z", layer: 0..N−1, dir: 1 | −1 | 2 }`. Legal turns: 9N (N layers × 3 axes × 3 amounts), so 27, 36 and 45. Semantics of `dir` are unchanged (+1 is +90° about the positive axis by the right-hand rule).

### Cube line

`CubeLine = { face, cells: K indexes, owner }`: one entry per window of exactly K consecutive cells (row, column or diagonal) held entirely by one player. A run longer than K yields several lines.

## TurnName (new, display only)

Derived, never stored. `notation.turnName(rotation, size, style)` returns text for the pair `(style, rotation)` where `style` is `words` or `cube`. Examples on 3×3: `R`, `U'`, `F2`, `M`, `E'`; on 4×4: `2R`, `2L'`; on 5×5: `3L2`.

## TurnSelection (new, UI-only, never persisted or transmitted)

| Field | Meaning |
|---|---|
| `status` | `idle`, `previewing`, `animating` |
| `rotation` | The previewed `CubeRotate`, or null |

Transitions: `idle → animating → previewing` on select; `previewing → animating → previewing` on select of another turn; `previewing → animating → idle` on cancel; `previewing → idle` on confirm (commit, then the game applies the move). Reload, undo, a new game or leaving the screen force `idle`. Input is ignored while `animating`.

## MarkPalette (new, display preference)

A built-in constant, not user data. Fixed set of four (see [research.md R11](research.md)):

| Field | Type | Rule |
|---|---|---|
| `id` | `default \| cbsafe \| forest \| sunset` | Unique; `default` is the default |
| `label` | string | Shown in the picker |
| `X`, `O` | `{ light: #rrggbb, dark: #rrggbb }` | Each variant reaches 3:1 on its appearance's `--bg` and `--surface`; X and O differ by at least the Lab distance in the unit test |

The device stores only the palette `id`. Colours shown are looked up for the current appearance, so an appearance switch needs no recomputation. An unknown stored `id` falls back to the default.

## Settings (changed)

| Field | Change |
|---|---|
| `icons` | **Removed.** On load, a stored `icons` field is ignored |
| `markPalette` | **New**, a `MarkPalette` id, default `default` |
| `cubeNotation` | **New**, `words` (default) or `cube` |
| `hints`, `autoReplay`, `replaySpeed`, `theme` | Unchanged |
| `lastSetup` | Gains `winLength`; kept valid against the stored `size` |

## ReplayRecord (changed)

| Field | Change |
|---|---|
| `rules` | **New**: `{ variant, size, winLength }` |
| `seed` | Now optional; present for computer games only |
| `moves`, `players`, `end` | Unchanged |

`configFromRecord` builds a `GameConfig` from `rules`, or, for a 001 link without them, from the seed prefix and the legacy win length.

## Save (changed)

Schema 2, key `ttt.save`: `{ schema: 2, settings, game: { config, moves, startedAt } | null }`, where `config` includes `winLength`. Migration 1 → 2 is described in [contracts/record-format.md](contracts/record-format.md).

## Help content (new, static)

`HelpSection = { id, title, blocks: Array<paragraph | steps | example> }`. Sections: Ultimate, Cube, Setup options. An `example` block is a small board described as data and drawn with the same mark renderer, with a text alternative.
