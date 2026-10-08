# Contracts: Forgiving Seed Entry

## C1: `resolveSeed` (src/core/seed.ts)

```ts
type Fallback = { variant: Variant; size: 3 | 4 | 5; winLength: number };
type SeedReading =
  | { kind: "exact"; seed: string; variant: Variant; size: 3 | 4 | 5; winLength: number }
  | { kind: "body" | "derived"; seed: string };
function resolveSeed(text: string, fallback: Fallback): SeedReading | null;
function normaliseSeedText(text: string): string;
```

- Total: never throws, for any string (also `undefined`/`null` coerced to empty).
- `null` iff `normaliseSeedText(text) === ""`.
- `exact` iff the normalised text is a known rules prefix (current or legacy) plus eight characters from `SEED_ALPHABET`. `seed` is `PPP-XXXX-XXXX`.
- `body` iff the normalised text is exactly eight alphabet characters, or eleven characters whose last eight are alphabet characters and whose first three are not a known prefix.
- `derived` otherwise.
- Output `seed` always matches `^[0-9A-Z]{3}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}-[BCDFGHJKLMNPQRSTVWXYZ2-9]{4}$` and `parseSeed(seed)` accepts it (round trip).
- Pure and deterministic: no clock, no `Math.random`, no storage. Integer arithmetic only.
- Time linear in input length.

Normalisation: NFKC, `toUpperCase()`, remove whitespace and the separators `- _` and the Unicode dash and hyphen characters (U+2010 to U+2015, U+2212).

## C2: `parseSeed` (unchanged)

Same signature, same errors, same results as before. `tests/unit/seed.test.ts` cases for it are not edited.

## C3: setup model (src/ui/setup-model.ts)

```ts
function placeholderFor(choice: SetupState, previous: string | null): string;
function applySeedText(state: SetupState, text: string): { state: SetupState; reading: SeedReading | null };
function configFromSetup(state: SetupState, seed?: string): GameConfig; // unchanged
```

- `placeholderFor` returns `previous` iff it is a valid seed whose prefix equals `rulesCode(variant, size, winLength)`; otherwise a new seed (`newSeed`). Reads neither level, mark nor mode.
- `applySeedText` calls `resolveSeed(text, choice)`. For `exact`, the returned state has the seed's variant, size and win length and a mode the variant allows (the old `applySeedToSetup` mode rule). For `body`, `derived` and `null`, the state is returned as given. Never returns an error.
- `applySeedToSetup` is removed; nothing else imports it (checked by `check-core-purity`'s sibling grep in tasks).

## C4: Start screen (Setup.svelte) and tests

Element contract, additions and removals only (everything else as 007 C4):

| Element | Change |
|---|---|
| `#seed-input` | `placeholder` is the current placeholder seed. `aria-invalid` is always `false`. `aria-describedby` points to `seed-note`. Typing and pasting use the same reading. |
| `#seed-error` | removed (the banner and its `role="alert"`) |
| `#seed-note` | new `p.hint-text`, `aria-live="polite"`, hidden while the box is blank or its text equals the seed it plays. Text: `This plays as <seed>.` |
| Start button | blank box: plays the placeholder. Text: plays `reading.seed`. Never blocked, never refocuses the box. |

Tests rewritten because they assert the removed behaviour (all listed with the reason, no assertion weakened beyond it):

| File | Case | Change |
|---|---|---|
| `tests/unit/setup.test.ts` | line 160, `applySeedToSetup(..., "nope")` is an error | becomes `applySeedText` returns a `derived` reading and leaves the state unchanged |
| `tests/unit/replay.test.ts` | line 106-110, four bad inputs are errors | becomes each is read as `derived` or `null` (the empty string); `parseSeed` still errors on them |
| `tests/e2e/replay.spec.ts` | line 154-155, `nope` shows "seed looks like" | becomes `nope` shows the note, no error, and Start begins a game whose `#game-seed` equals the note's seed |
| `tests/unit/setup.test.ts` | lines 112, 115, 151-157 (valid seeds set rules) | unchanged in what they assert; re-pointed from `applySeedToSetup` to `applySeedText` |

## C5: Replay links and saved games

Unchanged. A link with a bad seed still reports its error through `unpackLink`; a saved game with a seed loads as before. `tests/e2e/compat.spec.ts` and `tests/contract/record.test.ts` are not edited.
