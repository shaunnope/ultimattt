# Research: Forgiving Seed Entry

Findings from reading `src/core/seed.ts`, `src/core/rules.ts`, `src/core/record.ts`, `src/ui/setup-model.ts`, `src/lib/components/Setup.svelte` and the seed tests. No unknowns remain.

## R1: What fixes a game's randomness today

**Decision**: The canonical seed string is the only input. Nothing else changes.

**Rationale**: `rngFor(seed, moveIndex)` is `randomSource(hashString(seed + "#" + moveIndex))`, and `pickMark(seed)` uses `rngFor(seed, -1)`. The computer's move for a position is drawn from that stream. So the same seed string, the same level and the same moves always give the same replies. Guideline 1 already holds for any one string. The work is making every spelling and every input map to one string.

**Alternatives considered**: hashing a normalised form inside `rngFor` (rejected: it would change the stream for existing seeds and replays).

## R2: Which readers need to stay strict

**Decision**: Keep `parseSeed` as is. Add `resolveSeed` for the start screen only.

**Rationale**: `parseSeed` is called by `record.ts` `unpackLink` (a bad seed in a link gives "The game and the seed in this link do not match" and similar) and by the setup model. Links and records must load exactly as before, and a corrupt link should still be reported, not guessed at. Tests in `tests/unit/seed.test.ts` pin its errors.

**Alternatives considered**: loosening `parseSeed` (rejected: breaks link validation and FR-012); making `parseSeed` call the new function (rejected: a link with a bad seed would start a different game than it was shared from).

## R3: Normalisation

**Decision**: `normaliseSeedText(text)` = Unicode NFKC, uppercase, then remove every character that is whitespace or a dash-like separator (`-`, en dash, em dash, minus sign, `_`, and the Unicode hyphen block). Everything else stays.

**Rationale**: FR-004 asks for dashes, spaces, tabs, other dashes and case to be irrelevant. NFKC folds full-width letters and digits (`ＢＸＫ４`) to ASCII, which is what a phone keyboard or paste from a web page may produce. Removing only separators keeps different texts different: `A.B` and `AB` stay distinct.

**Alternatives considered**: removing all non-alphanumerics (rejected: `hello!` and `hello?` would collide, and emoji-only inputs would all become blank); lower-casing instead of upper (rejected: the standard form is upper case and `parseSeed` upper-cases).

## R4: Classifying normalised text

**Decision**: Four outcomes, tested in this order:

1. Empty after normalising: blank, return `null` (the placeholder is used).
2. **Exact**: three characters of prefix then eight characters, the prefix is a known rules code (`parseSeed` accepts it, legacy prefixes included) and all eight are in the seed alphabet. Return the canonical `PPP-XXXX-XXXX` and the rules.
3. **Body only**: exactly eight characters, all in the alphabet. Return the current rules prefix, then those eight.
   Also: eleven characters whose last eight are in the alphabet but whose first three are not a known rules code. Keep the eight, use the current rules prefix (spec US4 scenario 3).
4. **Derived**: anything else. Eight characters come from the text (R5), the current rules prefix goes in front.

**Rationale**: the order matches the spec's stories. A typo in the last eight (a vowel, `0`, `1`) falls to derived, as the spec requires, with no attempt at repair.

**Alternatives considered**: edit-distance repair to the "nearest" valid seed (rejected: silently starts a different game than the sender's; the spec says no); treating a bad prefix with a good body as derived (rejected: loses a seed the player probably meant, and the spec asks to keep it).

## R5: Deriving the eight characters

**Decision**: `deriveBody(normalised)`: two 32-bit hashes `a = hashString("seed-a#" + text)` and `b = hashString("seed-b#" + text)`. Each feeds `randomSource`; take four values from each, each value modulo the alphabet length (29), index into `SEED_ALPHABET`.

**Rationale**: integer-only, the same in every browser, reuses `hashString` and `randomSource`. 64 bits of state cover the 29^8 (about 2^39) seed space, so 100 distinct texts almost surely give 100 distinct seeds (SC-004; a unit test checks 1,000 texts). Modulo bias across 29 values is irrelevant here (this is not security).

**Alternatives considered**: a single 32-bit hash (rejected: only 2^32 possible seeds, birthday collisions near 65k texts, and half the seed space unreachable); `crypto.subtle.digest` (rejected: async, and the placeholder reads would need to wait); the text taken as-is, padded (rejected: not a mixing function, similar texts give similar seeds).

## R6: The placeholder

**Decision**: A pure helper `placeholderFor(choice, previous)` returns `previous` when its prefix equals `rulesCode(variant, size, winLength)`, otherwise `newSeed(variant, size, winLength)`. `Setup.svelte` holds it in state, refreshes it when the rules change, and starts blank-box games with it.

**Rationale**: matches FR-013: random body, fixed while the rules stay, new when they change or the screen loads again. Level and mark are not read by the helper, so they cannot change it. It is a pure function of its inputs plus `newSeed`'s one crypto read, so it can be tested by checking prefixes and equality.

**Rules prefix carries only variant, size, win length**: `newSeed` calls `rulesCode(variant, size, winLength)` with scoring and lock at their defaults, and `parseSeed` reads a three-character prefix. Twist options never reach a seed, and the seed box is hidden for Twist anyway (`seedControlsVisible`). The spec's Twist wording was corrected during planning.

**Alternatives considered**: computing the placeholder on every render (rejected: it would flicker); storing it in `localStorage` (rejected: needless, the spec says reload may change it).

## R7: Showing the derived seed

**Decision**: When the typed text is not already in canonical form, show a note under the box: `This plays as C33-BXK4-M9TR.` (an exact seed typed in another spelling also gets the note, which shows the standard form). While the box is blank no note is shown, because the placeholder is already the seed. The in-game line `Seed: ...` (`#game-seed` in `Game.svelte`) already shows the played seed.

**Rationale**: FR-010 and FR-005. A live region lets screen readers hear the change. The note uses the existing `hint-text` style so no design departure is needed.

**Alternatives considered**: rewriting the box's value to the canonical form as the player types (rejected: moves the caret and fights the keyboard); showing it only after starting (rejected: the player cannot copy it before the game).

## R8: Tests that assert the old behaviour

`tests/unit/setup.test.ts:160` (`applySeedToSetup(DEFAULT_SETUP, "nope")` is an error), `tests/unit/replay.test.ts:106-110` (four bad inputs are errors) and `tests/e2e/replay.spec.ts:154-155` (`nope` shows "seed looks like") assert the behaviour this feature removes. They are rewritten first, as the failing tests, and listed in contracts C4 with the reason. `tests/unit/seed.test.ts` `parseSeed` cases stay unchanged.
