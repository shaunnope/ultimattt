# Feature Specification: Forgiving Seed Entry

**Feature Branch**: `008-seed-refinement` (not created; work stays on `main` unless the user branches)

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Refine parsing of user-entered seed based on @specs/008-seed-refinement/todo.md"

## Clarifications

### Session 2026-10-08

- Q: Make the seed box placeholder follow the chosen variant, board size and win length; when the box is blank, should the game play the shown placeholder? → A: Yes. The placeholder is a real seed with the current rules prefix and a random body, and a blank box plays exactly that seed. The body changes only when the rules change or the screen reloads.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Any text in the seed box starts a game (Priority: P1)

A player types or pastes something into the seed box on the start screen, in a game against the computer. It may be a real seed copied from a friend, a seed with the dashes or capitals missing, a seed with a typo, or an ordinary word such as "banana". The player never sees a rejection. A well-formed seed is used as is. Anything else is turned into a valid seed, using what the player typed as the starting point, and the player is shown the seed that will be played.

**Why this priority**: Today a seed that is slightly off is refused with an error and the player must work out what is wrong. The request is that seed entry never fails, so every other story depends on this one.

**Independent Test**: Enter each of: a valid seed, a valid seed in lower case without dashes, a seed with a banned character, a seed that is too short, a seed that is too long, a random word, only spaces, and emoji. Start a game each time. No error is shown and a game starts with a valid seed.

**Acceptance Scenarios**:

1. **Given** the seed box holds text that is not a valid seed, **When** the player starts the game, **Then** no error appears and the game starts with a valid seed derived from that text.
2. **Given** the player entered the same non-conforming text twice with the same rules chosen, **When** each game starts, **Then** both games get the same seed.
3. **Given** two different non-conforming texts, **When** each game starts, **Then** they get different seeds (barring chance collisions among the seed space).
4. **Given** the seed box is empty or only spaces, **When** the player starts the game, **Then** the game plays the seed shown as the box's placeholder.
5. **Given** the seed box is blank, **When** the player changes the variant, board size or win length, **Then** the placeholder changes to a seed whose rules part matches the new choices, and it is the seed played if the player starts.
6. **Given** the seed box is blank, **When** the player changes only the opponent level, their mark or the typed text, **Then** the placeholder stays the same.
7. **Given** a seed was derived from the player's text, **When** the game starts, **Then** the seed in use is visible to the player in the standard seed form, so they can copy it and share it.

---

### User Story 2 - Seed formatting is optional (Priority: P1)

A player can enter a seed with or without dashes, in upper or lower case, with stray spaces, and it means the same seed. `c53-bxk4-m9tr`, `C53BXK4M9TR`, ` C53 BXK4 M9TR ` and `C53-BXK4-M9TR` all start the identical game.

**Why this priority**: People read seeds aloud or retype them from a screenshot, and punctuation and case are the likeliest things to go wrong. It is a P1 because the identical-game guarantee in story 3 depends on all spellings meaning one seed.

**Independent Test**: Start a game from each spelling of one seed with the same moves played. The computer's moves, and the mark chosen by "let the game decide", are identical in every game, and the seed shown is the same in every game.

**Acceptance Scenarios**:

1. **Given** a valid seed written without dashes, **When** the game starts, **Then** it is treated as that seed.
2. **Given** a valid seed in lower or mixed case, **When** the game starts, **Then** it is treated as that seed.
3. **Given** a valid seed with spaces, tabs or other dashes (hyphen, en dash, underscore) between or around its groups, **When** the game starts, **Then** it is treated as that seed.
4. **Given** any spelling of a valid seed, **When** the game starts, **Then** the seed shown is in the standard form with capitals and dashes.
5. **Given** an older seed form that still reads today (the five legacy prefixes), **When** it is entered in any spelling, **Then** it still starts the same game as before this change.

---

### User Story 3 - A seed from a past game replays the computer's moves (Priority: P1)

A player takes the seed of an earlier game, shown in its results or in a shared link, and starts a new game from it. If they make the same moves, the computer replies with the same moves every time, and "let the game decide" gives the same mark.

**Why this priority**: Sharing and replaying a seed is the reason seeds exist. Making entry forgiving must not weaken this.

**Independent Test**: Play a game to the end, copy its seed, start a new game from that seed, repeat the same moves, and compare every computer reply. Do the same with the seed spelled in different ways, and with a seed that was derived from a non-conforming text (copy the shown seed, not the original text).

**Acceptance Scenarios**:

1. **Given** the seed of a finished game, **When** a new game is started from it and the player makes identical moves, **Then** the computer's moves are identical to the first game's.
2. **Given** a seed that was derived from non-conforming text, **When** its shown form is entered in a later game, **Then** that game matches the game that showed it.
3. **Given** a seed entered in a different spelling from the one shown, **When** a game starts, **Then** it still matches.
4. **Given** the same seed and different rules (variant, board size or win length), **When** games start, **Then** the rules entered with the seed decide the board, as today.

---

### User Story 4 - Rules in the seed still set up the board (Priority: P2)

A valid seed carries its rules (variant, board size, win length), and entering one sets those choices on the start screen, as today. If the entered text does not carry a recognisable rules part, the player's current choices are kept and the new seed is made for them.

**Why this priority**: Pasting a friend's seed and getting their board is a feature players use today and must keep working; but it is a refinement of story 1 and 2, not new capability.

**Independent Test**: Enter a seed whose rules differ from the current choices and confirm the start screen changes to match. Enter text with no rules part and confirm the choices are unchanged and the derived seed carries the current rules.

**Acceptance Scenarios**:

1. **Given** a valid seed with a rules part, **When** it is entered, **Then** variant, board size and win length change to match, and a mode that does not fit the variant changes to one that does, as today.
2. **Given** text with no recognisable rules part, **When** a game starts, **Then** the current variant, board size and win length are used and appear in the derived seed's rules part.
3. **Given** text whose seed part is valid but whose rules part is unknown, **When** a game starts, **Then** the seed part is kept, the current rules are used, and no error appears.

---

### Edge Cases

- Very long text (thousands of characters): it is accepted and produces a valid seed without delay or truncation errors.
- Text with characters outside the seed alphabet, such as vowels, 0, 1, I, O, accents, emoji or non-Latin scripts: it is accepted; characters may be replaced or dropped in deriving the seed, but the result for the same text is always the same.
- Text that looks like a seed with one or two characters changed (a typo): treated like any other non-conforming text. It is not guessed back into the intended seed.
- Seed of the right length that contains a banned character such as `O` or `0`: not rejected; it is treated as non-conforming text, not as an error.
- Two texts that differ only in dashes, spaces or case: they give the same seed.
- A seed entered while the mode is not "computer": the seed box is not shown, so nothing is read, as today.
- A seed in a shared link or in a stored saved game: these are always already valid, and load exactly as before.
- The player types text, then deletes it all: the placeholder is shown again, unchanged, and is what a start plays.
- The player changes the variant, board size or win length after typing text: the typed text is discarded and the placeholder returns, as the box behaves today, so a seed never disagrees with the visible choices.
- The player returns to the start screen after a game: the screen is made anew, so its placeholder is a new seed.
- Text made only of separators (dashes, spaces) counts as blank.
- Text of exactly the eight seed characters, with no rules part: those characters are kept as the seed's own part and the current rules are put in front.
- Pasting a seed twice in a row, or editing the box after a derived seed was shown: the shown seed always matches the box's current content once the player starts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Reading text from the seed box MUST never fail. For any input, including empty, whitespace-only, very long and non-text characters, the result MUST be a usable valid seed (for empty input, the placeholder seed).
- **FR-002**: When the entered text, after the formatting rules below, is a valid seed, it MUST be used unchanged, including its rules part.
- **FR-003**: When the entered text is not a valid seed, the system MUST make a valid seed from it, using the text as the starting value so that the same text with the same rules always gives the same seed and different texts give different seeds.
- **FR-004**: Dashes, spaces, tabs, other dash-like separators and letter case MUST NOT affect which seed is meant. All spellings of one seed MUST give identical games and the identical shown seed.
- **FR-005**: The shown seed MUST always be in the standard form (`C53-BXK4-M9TR`: capitals, two dashes, rules part first).
- **FR-006**: A game started from a given seed MUST produce the same computer replies and the same "let the game decide" mark whenever the player's moves are the same, regardless of how the seed was spelled when entered.
- **FR-007**: Seeds in the five legacy forms (`3X3`, `4X4`, `5X5`, `ULT`, `CUB` prefixes) MUST keep starting the same games as before this change.
- **FR-008**: A valid rules part MUST set the variant, board size and win length on the start screen, as today. If the text has no recognisable rules part, the current choices MUST be kept and used in the new seed.
- **FR-009**: No error message about the seed format MUST be shown for any entered text. The format hint that tells the player what a seed looks like MAY remain as guidance.
- **FR-010**: When a seed has been made from text that was not a valid seed, the player MUST be able to see which seed will be played before or as the game starts, and copy it.
- **FR-011**: Empty or whitespace-only text MUST behave as no seed entered: the game plays the placeholder seed (FR-013).
- **FR-013**: The seed box MUST show a placeholder that is a valid seed whose rules part matches the current variant, board size and win length. Its eight own characters MUST be random, fixed while the rules stay the same, and made anew when any of those choices changes or the screen is loaded again. Changing only the opponent level, the player's mark or the typed text MUST NOT change it.
- **FR-012**: Saved games, replays and shared links that hold seeds MUST load and behave exactly as before. A seed that was valid before this change MUST give the same game after it.

### Key Entities

- **Seed**: the code that fixes a computer-opponent game's chance (the computer's choices and the "let the game decide" mark). It has a rules part (variant, board size, win length) and eight characters of its own.
- **Entered text**: anything the player puts in the seed box. It may be a seed, a near seed or any other text.
- **Placeholder seed**: the valid seed shown faintly in an empty seed box. It follows the current rules and is the seed played when the box stays blank.
- **Derived seed**: a valid seed made from entered text that was not itself valid, fixed by that text and the rules in force.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a test set covering valid, malformed, empty, very long, non-Latin and emoji inputs, 100% start a game with no seed format error shown.
- **SC-002**: For 100% of tested spellings of a valid seed (dashes dropped, lower case, extra spaces, other dash characters), the games match: same shown seed, same computer replies and same chosen mark over a scripted set of moves.
- **SC-003**: Replaying 100% of a set of recorded games from their shown seed with the same moves reproduces every computer reply.
- **SC-004**: Entering the same non-conforming text 100 times with the same rules gives one seed every time, and 100 different texts give 100 different seeds.
- **SC-005**: 100% of seeds, saved games and links valid before this change give the same game after it (checked against the stored fixtures from earlier versions).
- **SC-006**: Starting a game from the seed box takes no more steps than it does today for a valid seed.
- **SC-007**: For every combination of variant, board size and win length the seed box can show, the placeholder carries the matching rules part, and in 100% of blank-box starts the game's seed equals the placeholder shown at the moment of starting.

## Assumptions

- The seed box exists only in a game against the computer, as today; this feature changes how its text is read, not where it appears.
- "Use the entered value as an IV" means the entered text is the starting value from which the seed's characters are worked out; the same text and rules always give the same result. How the characters are worked out is a planning decision.
- A seed that was derived from text is reproduced by its shown standard form, not by the original text. The original text is also reproducible, because it derives the same seed, but sharing the shown form is the supported way.
- Text that looks like a seed with a typo is not corrected towards the likeliest intended seed; guessing could start a different game from the one the player meant, silently.
- The placeholder's random characters need not be stable across reloads; only across edits to level, mark and typed text.
- The seed box appears only against the computer in Classic or Ultimate (Twist has no computer opponent), and a seed's rules part carries only variant, board size and win length, so Twist scoring and lock options are not part of any seed.
- "The same moves give the same computer replies" holds for the same computer level and the same chosen mark; the seed fixes the computer's chance, not those choices.
- The standard seed form, the seed alphabet and the five legacy prefixes do not change.
- No change to game rules, the computer opponent, saved-game format or the multiplayer protocol is part of this feature.
- Copy follows the project's rules (no em dashes, emoji or exclamation marks).
