# Research: Cube Rule Options and Preview Polish

## R1. Face lock as a derived property

- **Decision**: `lockedFaces(stickers, size, winLength)` returns the faces that currently hold at least one winning line (either player), computed from the position with `cubeLines`. Placement on a locked face is refused with reason `face-locked`; rotations are never refused. `legalMoves` and `hints` skip locked faces. Nothing is stored, so rotations, undo (which replays moves), reloads and replays need no history.
- **End by lock**: `settle` ends the game when phase is `place`, `empty > 0` and no empty sticker lies on an open face; the winner comes from the tally (R2). Checked after every placement that does not score and after every rotation.
- **Rationale**: Position-derived state cannot drift from the board.
- **Alternatives**: Storing locked flags per face (rejected: breaks on rotations and undo). A pass move (rejected: new move type and encoding).

## R2. Face-count scoring

- **Decision**: `CubeState` gains `scores: {X, O}`. In `lines` mode it equals `lines`; in `faces` mode it is the number of faces on which each player owns at least one line. The rotation trigger still uses `lines` (a placement that raises the mover's line count requires a turn), per the clarification. `settle` and the winner use `scores`.
- **Rationale**: One extra field; `lines` keeps its meaning for the trigger and highlighting.
- **Alternatives**: Replacing `lines` (rejected: trigger and highlight need real line counts).

## R3. What is recorded

- **Decision**: `scoring` and `lockFaces` join `Rules`; the rules code gets optional trailing flags in a fixed order: `F` (faces scoring) then `L` (lock): `B33`, `B33F`, `B33L`, `B33FL`. No flag means lines and no lock. Only Cube may carry flags. The save and the welcome message carry the full `GameConfig`. 001 and 002 codes parse as before.
- **Replay of a lock game**: `configFromRecord` sets `lockFaces` from the rules, so `fromMoves` enforces the lock and the replay ends where the live game did, including an end caused by the lock. No special last-frame handling is needed.
- **Alternatives**: Leaving the lock out of the code (rejected by the clarification: a replay must reproduce the game mode exactly).

## R4. Save and protocol versions

- **Decision**: Save schema 3: `migrate2to3` adds `scoring: "lines"` and `lockFaces: false` to a saved game config and to `lastSetup`. An older build sees schema 3 as unknown and copies it aside rather than playing it wrongly. Protocol 3: a version-2 `hello` is answered with the existing `reject: version`; the message tells the player the other device needs the latest version (this satisfies FR-012: a peer that cannot honour the options is refused with a stated reason).

## R5. Same-layer preview path

- **Decision**: The view tracks a cumulative angle in degrees for the previewed layer. `turn-path.ts` exports `targetAngle(current, quarters)`: the equivalent (mod 360) of the target nearest to `current`; when two are 180° away (a quarter turn to the opposite quarter turn) pick the one that continues in the sign of `current`, so the path goes through the half-turn position and never through the original. CSS transitions the layer from the old angle to the new one. Cancel and commit use `settleAngle(current)`, the nearest multiple of 360 (270° becomes 360°), so the layer reaches the original orientation by the shortest way, then the angle resets with no animation.
- **State machine**: `previewing --select (same axis and layer, different dir)--> animating(retarget)` with effect `{kind: "retarget", from, to}`. A different layer keeps the 002 behaviour (reverse, then play). The same turn is a no-op.
- **Flat view**: no motion; the ghost marks switch. **Reduced motion**: set the final angle with transitions off.
- **Alternatives**: Always reverse first (the 002 behaviour, rejected by the request). Re-parenting stickers into a rotating group (rejected: larger change than a CSS variable).

## R6. Layer highlight

- **Decision**: `board-cube.ts` listens for `pointerenter/leave` and `focusin/out` on each row, its name and its turn buttons. Hover and focus highlight the layer with no preview (as in 001). Touch: a tap on the layer name (`.rotate-name`) sets the highlighted layer, which stays until another name is tapped or the turn is cancelled or confirmed. Highlighted layer = hovered or focused layer, else the tapped layer, else the previewed layer while held. It calls `view.outline(axis, layer)`; `outline` already exists in `cube-view.ts` and `cube.css` styles `[data-preview]`, but nothing calls it (002 dropped the 001 hover highlight). The outline sits on stickers that travel with the layer. It is recomputed, not cleared and reapplied, when a preview starts, changes or ends, which avoids flicker. It clears when the picker hides. The selected turn is also shown by `aria-pressed` and the caption, so the highlight is never the only cue.
- **Rationale**: No new module: three handlers and one function; e2e checks cover frames.

## R7. Win-length defaults

- **Decision**: `defaultWinLength(size)`: 3 for size 3, 4 otherwise. `legacyWinLength(variant, size)` keeps the 001 table (Classic 4×4 and 5×5 → 4, everything else 3) as its own function, used only for configs, saves and seeds with no win length. `chooseSize` returns the state unchanged when the size is unchanged, otherwise sets the default. `clampWinLength` keeps valid values and falls back to `defaultWinLength` (remembered setup, variant change). A seed's values win.
- **Rationale**: Splits two meanings that were one function; old data stays pinned to the old table.
- **Risk**: Ultimate and Cube on 4×4 and 5×5 now default to 4; re-run the perf probe with K=4.

## R8. Cube notation review

- **Sources**: Speedsolving big-cube notation and SiGN (`2R` is the second layer from the right alone; `Rw` and `3Rw` are wide turns of several layers; on a 3×3 the slices M, E, S correspond to SiGN `2L`, `2D`, `2F`), as summarised by [cubelelo](https://www.cubelelo.com/blogs/cubing/understanding-advanced-cube-notation-a-comprehensive-guide), [mzrg.com SiGN](https://mzrg.com/rubik/nota.shtml) and [Randelshofer's 4×4 notation notes](https://www.randelshofer.ch/rubik/revenge/doc/supersetENG_4x4.html).
- **Finding**: Today's 4×4 names (`2D 2U 2L 2R 2F 2B`: depth counted from the nearer face, turning like that face) are valid single-layer names. The odd one is the 5×5 middle layer, written `3L`, `3D`, `3B`; the standard name is the slice letter (M, E, S) already used on a 3×3. `2U` beside `3D` looked inconsistent because only the middle layer counted from the low side.
- **Decision**: Keep depth-from-nearer-face for non-middle inner layers (4×4 and 5×5: 2L 2R 2D 2U 2B 2F). The middle layer of any odd cube is M, E or S (M follows L, E follows D, S follows F; unchanged on 3×3). Even cubes have no middle name. A name means one layer; the help screen says wide turns (`Rw`) are not used. `parseTurnName` accepts exactly these names, so the `3`-prefixed names disappear.
- **Verification**: Table test for every turn on N=3,4,5: name, round trip, one name per layer.
- **Alternatives**: Numbering every layer from one face (`2U 3U 4U`): rejected, forces counting across the cube. Wide-turn names: out of scope.
