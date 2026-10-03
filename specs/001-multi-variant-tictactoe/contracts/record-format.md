# Contract: Seed, Save and Replay-Link Formats

## Seed

`<PREFIX>-<4>-<4>` using alphabet `BCDFGHJKLMNPQRSTVWXYZ23456789`.

| Variant | Prefix |
|---|---|
| Classic 3×3 / 4×4 / 5×5 | `3X3`, `4X4`, `5X5` (as in the reference game) |
| Ultimate | `ULT` |
| Cube | `CUB` |

Pasting a seed selects the variant and size.

## Move tokens (one string per move, concatenated in links)

| Move | Token |
|---|---|
| Classic place | one char: `0-9a-o` = cell index (reading rows top-left) |
| Ultimate place | two chars: board `0-8`, cell `0-8` |
| Cube place | two chars: face `0-5`, cell `0-8` |
| Cube rotate | `.` + axis `x|y|z` + layer `0-2` + dir `+` quarter, `-` quarter back, `2` half (e.g. `.x1+`, `.z02`) |

Tokens are self-delimiting per variant, so decoding needs no separators.

## Replay link

`/?watch=<n>&seed=<SEED>&game=<players>&moves=<tokens>&end=<flag>`

- `game`: `c<level><mark>` computer, `l` local, `n` network.
- `end`: optional `rx` / `ro` (X / O resigned).
- Opening a link does not touch the viewer's save. Invalid, truncated or illegal sequences show a friendly error and start nothing.
- Results are always recomputed by folding moves through core; the link never carries a result to trust.

## Save (`localStorage`, key `ttt.save`)

```json
{ "schema": 1, "settings": {}, "game": { "config": {}, "moves": "<tokens>", "startedAt": 0 } }
```

Unknown `schema` → keep the file, start fresh, show a notice. Migration functions keyed by schema number.
