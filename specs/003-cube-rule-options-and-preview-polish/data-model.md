# Data Model: Cube Rule Options and Preview Polish

Changes to the 001 and 002 model ([../002-refinements/data-model.md](../002-refinements/data-model.md)). Anything not listed is unchanged. Everything here is pure data.

## GameConfig (changed)

| Field | Type | Rule |
|---|---|---|
| `scoring` | `"lines" \| "faces"` | **New.** Default `lines`. `faces` is valid only for `variant: "cube"` |
| `lockFaces` | boolean | **New.** Default `false`. Valid only for Cube. Recorded in the rules code, replays and links |

`parseConfig`: both fields optional on input; absent means the defaults; present on a non-Cube config is invalid.

## Rules (changed)

`{ variant, size, winLength, scoring, lockFaces }`. Rules code `<V><N><K>` plus optional flags in order: `F` faces scoring, `L` lock: `B33`, `B53F`, `B43L`, `B43FL`. Flags on `C` or `U` are invalid. `legacyWinLength` (001 table) and `defaultWinLength(size)` (3 if 3, else 4) are separate.

## CubeState (changed)

| Field | Change |
|---|---|
| `scores` | **New.** `{X, O}`. Equals `lines` in lines mode; faces with at least one own line in faces mode |
| `lines` | Unchanged: real line count, drives the turn trigger and highlighting |

Derived, not stored: `lockedFaces(state)`, the face indexes holding at least one line of either player; only meaningful when `config.lockFaces`.

Transitions:
- Place on a locked face (lock on): refused, reason `face-locked`.
- Place that raises the mover's `lines`: `phase = "rotate"` (any scoring mode).
- After any move that leaves `phase = "place"`: if `empty = 0`, or lock on and no empty sticker is on an open face, the game ends; winner from `scores` (more wins, equal ties).

## SetupChoice (changed)

Adds `scoring` and `lockFaces`; absent in a stored choice means `lines` / `false`.

## Save file (schema 3)

`schema: 3`. `migrate2to3` adds `scoring: "lines"`, `lockFaces: false` to `game.config` and `settings.lastSetup`. Schema 1 saves migrate through 2.

## TurnSelection (changed)

`previewing` gains a transition on `select` when the new turn has the same axis and layer but a different direction:

`previewing --select(same layer)--> animating(phase: "retarget", rotation: new)` with effect `{kind: "retarget", from, to}`; `done` then returns to `previewing` on the new rotation. `cancel` during a retarget behaves as during `play`. `reset` discards.

## Turn path (new, display only)

`targetAngle(currentDeg, quarters) → deg` and `settleAngle(currentDeg) → deg`; see [research R5](research.md). Angles are cumulative per previewed layer and reset to 0 once the layer is settled.

## Layer name (changed)

For `size` odd, the middle layer is `M`, `E` or `S`; other inner layers are `<depth><face letter>` with depth counted from the nearer face (`2R`, `2L`, `2U`, `2D`, `2F`, `2B`). Even sizes have no middle name.
