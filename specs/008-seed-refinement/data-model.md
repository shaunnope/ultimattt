# Data Model: Forgiving Seed Entry

No stored data changes. Saves, records and links hold the same seed strings as before.

## Seed (string, unchanged)

`PPP-XXXX-XXXX`: `PPP` is the rules code (`C`, `U`, `B` then size then win length, for example `C53`) or one of the five legacy prefixes (`3X3`, `4X4`, `5X5`, `ULT`, `CUB`); `XXXX-XXXX` are eight characters from `BCDFGHJKLMNPQRSTVWXYZ23456789`. Upper case, two dashes. This string is the whole input to the game's randomness.

## SeedReading (new, in memory only)

What `resolveSeed(text, fallback)` returns.

| Field | Meaning |
|---|---|
| `seed` | the canonical seed string to play |
| `kind` | `exact` (valid as typed, ignoring spelling), `body` (eight good characters, current rules put in front), `derived` (made from the text) |
| `rules` | present only for `exact`: variant, size and win length from the prefix, applied to the start screen |

`resolveSeed` returns `null` for blank text (nothing left after removing separators). `fallback` is `{ variant, size, winLength }`, the current choices, used for the prefix of `body` and `derived`.

Rules:
- `kind: "exact"` keeps the prefix as its own spelling: a legacy prefix stays legacy.
- `kind: "body"` and `"derived"` use `rulesCode(fallback.variant, fallback.size, fallback.winLength)` as the prefix.
- The same normalised text and the same `fallback` always give the same `seed`.

## SetupForm additions (start screen state)

| Field | Meaning |
|---|---|
| `seedText` | the raw text in the box (as today) |
| `reading` | `SeedReading` of `seedText`, or `null` when blank (replaces the old `seed` and `seedError` pair) |
| `placeholder` | the seed shown in the empty box; the seed played when `reading` is `null` |

Transitions:
- Text typed: `reading` is recomputed. If `kind` is `exact`, `rules` set variant, size and win length (and a mode that does not fit the variant moves to one that does, as today).
- Variant, size or win length changed by the player: `seedText` and `reading` are cleared (as today); `placeholder` is kept if its prefix still equals the new rules code, otherwise made anew.
- Level, mark or computer/friend mode switch: `placeholder` unchanged. Leaving the computer clears `seedText`, as today.
- Screen mounted: `placeholder` made once.
- Start: the played seed is `reading.seed` when text is present, else `placeholder`.

## Validation rules (from the spec)

- Reading never throws and never returns an error (FR-001, FR-009).
- Every spelling of one valid seed gives the same `seed` (FR-004).
- Derived seeds are reproducible from the same text (FR-003) and distinct for distinct texts (SC-004).
- Seeds in links and saves are read by `parseSeed`, unchanged (FR-012).
