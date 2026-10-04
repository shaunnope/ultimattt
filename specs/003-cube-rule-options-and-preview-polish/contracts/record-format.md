# Contract: Record, link and save formats

## Rules code

`<V><N><K>[F][L]` — `V` in `C U B`, `N` and `K` digits 3 to 5, optional `F` (face-count scoring) then optional `L` (lock scored faces), Cube only. Examples: `B33` (lines, no lock), `B43F`, `B43L`, `B43FL`. A code without a flag, and every 001 or 002 code, means lines and no lock.

## Replay link

`?watch=…&rules=B43F&game=l&moves=…[&end=…]`. `rules` carries the scoring and the lock. A link without `F` opens with line counting and without `L` with no lock. A seed is never present for Cube.

Opening a link replays the moves under the rules code, lock included; the result is recomputed, so a game that ended early because of the lock ends at the same move in the replay.

## Save file

`schema: 3`. Game config adds `scoring` and `lockFaces`. `lastSetup` adds both. Reading rules:

- Schema 2 → migrated (`scoring: "lines"`, `lockFaces: false`).
- Schema 1 → migrated through 2.
- Unknown schema or corrupt → copied aside, never overwritten (unchanged).
- A game config with `scoring` or `lockFaces` on a non-Cube variant is invalid.
