# Contract: Rules Code, Seed, Move Tokens, Link and Save (delta to 001)

Baseline: [001 record-format](../../001-multi-variant-tictactoe/contracts/record-format.md). Only differences are listed.

## Rules code

Three characters `<V><N><K>`: `V` = `C` Classic, `U` Ultimate, `B` Cube; `N` = `3`, `4` or `5`; `K` = win length, `3 ≤ K ≤ N`.
Examples: `C33`, `C54` (Classic 5×5, four in a row), `U43`, `B53`.
Invalid when K > N, N outside 3 to 5, or V unknown. Reading never throws: bad codes give `{ error }`.

## Seed

Form unchanged: `<PREFIX>-<4>-<4>`, same alphabet. A seed exists only for computer games (Classic or Ultimate).

| Prefix | Meaning |
|---|---|
| Rules code, e.g. `C53`, `U44` | New in 002: names the full rules |
| `3X3`, `4X4`, `5X5` | 001 Classic; win length is the legacy default (3, 4, 4) |
| `ULT` | 001 Ultimate 3×3, K=3 |
| `CUB` | 001 Cube 3×3, K=3. Still parses; not generated, since Cube has no computer opponent |

Pasting a seed sets variant, size and win length.

## Move tokens

001 tokens decode identically. The index alphabet widens from 9 to 25 symbols so every index on a 5×5 fits one character.

| Move | Token |
|---|---|
| Classic place | one char of `0-9a-o`: cell index |
| Ultimate place | two chars of `0-9a-o`: board index then cell index |
| Cube place | face digit `0-5` then one char of `0-9a-o`: cell index |
| Cube rotate | `.` + axis `x`, `y` or `z` + layer digit `0-4` + way `+`, `-` or `2` |

Range is checked against the game's size by the rules module when moves are played, not by the token reader.

## Replay link

`/?watch=<n>&rules=<code>&seed=<SEED>&game=<players>&moves=<tokens>&end=<flag>`

- `rules`: **new**, present on every new link.
- `seed`: present only when `game` starts with `c` (computer).
- Reading precedence: if `rules` is present, it decides variant, size and win length. If absent (a 001 link), they come from the seed prefix and the legacy win length. A link with neither, or whose `rules` disagrees with the seed prefix, gives a friendly error.
- A 001 link, or one carrying a seed for a game without a computer, still opens and plays back.
- Results are still recomputed by playing the moves; a link never carries a result.

## Save (`ttt.save`), schema 2

```json
{ "schema": 2,
  "settings": { "hints": false, "autoReplay": true, "replaySpeed": 1, "theme": "auto",
                "markPalette": "default", "cubeNotation": "words",
                "lastSetup": { "variant": "classic", "size": 3, "winLength": 3, "mode": "local", "level": 3, "markChoice": "random" } },
  "game": { "config": { "variant": "…", "size": 3, "winLength": 3, "mode": "…", "seed": "…?" }, "moves": "<tokens>", "startedAt": 0 } }
```

Migration 1 → 2 (pure function, tested with 001 fixtures):

1. Drop `settings.icons`.
2. Add `markPalette: "default"` and `cubeNotation: "words"`.
3. Add `winLength` to `lastSetup` and to a saved `game.config`, using the legacy default for its variant and size.
4. Remove `seed` from a saved game config whose mode is not `computer`.
5. Set `schema: 2`.

A schema newer than 2 behaves as in 001: keep the file untouched, start fresh, show the notice. A failed migration does the same.
