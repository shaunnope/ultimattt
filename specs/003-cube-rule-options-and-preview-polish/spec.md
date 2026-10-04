# Feature Specification: Cube Rule Options and Preview Polish

**Feature Branch**: `003-cube-rule-options-and-preview-polish`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "More refinements" (renamed from `003-more-refinements`), expanded from six notes: cube preview continuity, layer highlight on hover, win-length default on board-size change, a review of cube notation for 4×4 and 5×5, an optional rule that locks faces that already hold a winning line, and an optional face-count scoring mode.

## Clarifications

### Session 2026-10-04

- Q: Which of the two new Cube rules are saved in replays and share links? → A: Both. The scoring mode changes the score a replay must show, and the face-lock rule changes which moves are allowed and when a game ends, so both are recorded with the rules and a replay reproduces the game exactly as it was played. A game in progress also keeps both in its own save and in the two-device handshake.
- Q: How does the layer highlight work on devices without hover? → A: Hovering (or focusing) a turn button or the layer's row highlights that layer without previewing anything, as in 001. On touch, tapping the layer's name highlights it; the highlight stays until another layer name is tapped or the turn is cancelled or confirmed. Tapping a turn button still previews that turn and highlights its layer.
- Q: Does the win-length reset on board-size change apply to every variant? → A: Yes. Choosing a board size always sets win length to 3 for 3×3 and 4 for 4×4 and 5×5, whatever the variant, as 001 did for Classic. Older saved games keep the rules they were started under.
- Q: In face-count scoring, does a second line on an already-scored face still make the scorer turn a layer? → A: Yes. What triggers the layer turn is unchanged (completing any new line); only the tally and the winner change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cube Rule Options: Face Lock and Face-Count Scoring (Priority: P1)

A player setting up a Cube game can switch on two optional rules, both off by default. **Lock scored faces**: once a face holds at least one winning line, no more marks can be placed on that face (layer turns can still carry its marks away, which can unlock it). **Count faces, not lines**: the score is the number of faces on which a player has at least one winning line, instead of the total number of lines. The score shown during play, the final result and any replay all follow the chosen options.

**Why this priority**: These change the rules and the result of Cube games, so everything else (help text, replays, share links, two-device play) must agree with them.

**Independent Test**: Start a Cube game with lock scored faces on; make a line on one face and confirm the face refuses further marks; turn a layer that breaks the line and confirm the face accepts marks again. Start a second game with face-count scoring; make two lines on one face and confirm the score is 1; replay the finished game from its link and confirm the same score and winner.

**Acceptance Scenarios**:

1. **Given** the Cube setup screen, **When** it is shown, **Then** it offers "Lock scored faces" and "Count faces, not lines", each off by default, remembered with the other setup choices, and not shown for Classic or Ultimate.
2. **Given** a Cube game with lock scored faces on and a face that holds a winning line (of either player), **When** a player tries to place a mark on an empty cell of that face, **Then** the move is refused with a reason that names the lock, and the face is visibly marked as locked by more than colour alone.
3. **Given** a locked face, **When** a layer turn removes every winning line from that face, **Then** the face becomes open again and accepts marks; **When** a layer turn brings a winning line onto a face, **Then** that face becomes locked.
4. **Given** lock scored faces on, **When** a mark completes the first line on a face, **Then** the move is allowed (the face was open) and the scorer must then turn a layer as usual.
5. **Given** lock scored faces on and every empty cell is on a locked face when marks are due, **When** play would otherwise stall, **Then** the game ends at once with the result from the current score, and the end is explained to the player.
6. **Given** lock scored faces on, **When** hints are on, **Then** no hint is shown on a locked face.
7. **Given** face-count scoring, **When** a player has three lines on one face and one line on another, **Then** their score is 2; **When** both players hold a line on the same face, **Then** that face counts once for each.
8. **Given** face-count scoring, **When** a player completes a second line on a face they already count, **Then** the score does not change, the player still turns a layer, and the new line is still highlighted.
9. **Given** face-count scoring, **When** the board fills (or the game ends by the lock rule), **Then** the winner is the player with more scoring faces, equal scores tie, and the live score, result screen, move list and replay all show faces rather than lines.
10. **Given** a finished game played with face-count scoring and/or the face lock, **When** its replay link is opened, **Then** the replay uses the same scoring and lock, shows the same scores and winner, and ends where the live game ended (including an end caused by the lock); **Given** a link or save from before this release, **When** it is opened, **Then** it uses line counting and no lock as it always did.
11. **Given** a two-device Cube game, **When** the host chose either option, **Then** the other device plays with the same rules, and a device that cannot honour them says so instead of starting a mismatched game.
12. **Given** a game in progress with the lock on, **When** the app is reloaded, **Then** the lock is still enforced.
13. **Given** a replay link of a game played with the lock on, **When** it is opened, **Then** the replay enforces the lock, and a link without the lock flag plays with no lock.

---

### User Story 2 - Smoother Cube Turn Preview and Layer Highlight (Priority: P2)

Two polish fixes to the layer-turn flow. First, when a player previews a turn and then picks a different turn on the same layer, the layer turns directly from the first preview to the second instead of swinging back to its original position first. Second, the layer under the pointer keeps its highlight for as long as the pointer stays on that layer's controls, including while its preview animates and is held, so the player always sees which layer they are acting on.

**Why this priority**: These are small but constant annoyances in the one hard interaction of Cube; they build on the 002 preview flow and are independent of the rule options.

**Independent Test**: In a Cube game with a turn pending, preview "turn the top layer to the right", then pick "turn the top layer to the left" and watch the layer go straight through to the new position; hover a layer's name and watch it highlight with no preview, then select, preview and hold and watch the highlight stay.

**Acceptance Scenarios**:

1. **Given** a turn is previewed, **When** the player selects another turn on the same layer, **Then** the layer animates directly from its current previewed position to the new previewed position, by the shortest route, without first returning to the original orientation.
2. **Given** a turn is previewed, **When** the player selects a turn on a different layer, **Then** the first layer returns to its original position and the new layer turns, as in 002 (they cannot share a path).
3. **Given** a layer previewed at a quarter turn, **When** the player selects the half turn or the opposite quarter turn on that layer, **Then** the animation ends on exactly the position that final turn produces, and confirming applies exactly that turn.
4. **Given** a preview is showing on a layer, **When** the player cancels, **Then** the layer returns to its original position from wherever it is, as in 002.
5. **Given** the pointer is on a layer's name, row or turn buttons, **When** the pointer rests there (with nothing selected), **Then** that layer is highlighted and no preview is shown, as in 001; **When** the player then selects, previews or holds a turn there, **Then** the layer stays highlighted for as long as the pointer stays on it, and the highlight clears when the pointer leaves, with no flicker when a preview starts or ends.
6. **Given** keyboard focus is on a layer's name, row or turn buttons, **When** focus stays there, **Then** the same highlight shows (a pointer is not required), and the highlight is never the only sign of which turn is selected.
6a. **Given** a touch device, **When** the player taps a layer's name, **Then** that layer is highlighted with no preview, and stays highlighted until another layer's name is tapped or the turn is cancelled or confirmed.
7. **Given** the flat view, **When** the player hovers or focuses a layer, **Then** that layer's stickers are highlighted there too.
8. **Given** reduced-motion is on, **When** the player changes the preview within a layer, **Then** the new position appears at once and the highlight behaves the same.

---

### User Story 3 - Sensible Win-Length Default on Every Size Change (Priority: P3)

Choosing a board size on the new-game screen always puts win length back to its default: 3 for 3×3 and 4 for 4×4 and 5×5, in every variant. The player can then change it. This is what 001 did for Classic, and it replaces the 002 rule that kept the previous win length when it still fitted.

**Why this priority**: A small, low-risk setup fix that makes the defaults predictable; it touches nothing else.

**Independent Test**: On the setup screen pick 5×5, set win length 5, pick 4×4 (win length shows 4), pick 3×3 (fixed at 3), pick 5×5 (win length shows 4).

**Acceptance Scenarios**:

1. **Given** any variant on 3×3, **When** the player picks 4×4 or 5×5, **Then** win length shows 4.
2. **Given** 5×5 with win length 5, **When** the player picks 4×4, **Then** win length shows 4 (not 5, not the old value).
3. **Given** 4×4 with win length 3, **When** the player picks 5×5, **Then** win length shows 4: a deliberate win length is not carried across a size change.
4. **Given** 4×4 or 5×5, **When** the player picks 3×3, **Then** win length is 3 and fixed.
5. **Given** the player re-picks the size that is already selected, **When** the choice is made again, **Then** nothing changes (no reset of an edited win length).
6. **Given** a seed typed or pasted on the setup screen, **When** it sets size and win length, **Then** the seed's values win, and the default rule applies only to later size choices.
7. **Given** the app last remembered a setup with a particular size and win length, **When** the screen opens, **Then** the remembered values show unchanged (the default applies only when the player picks a size).
8. **Given** games, seeds and links from before this release, **When** they are opened, **Then** their rules are unchanged.

---

### User Story 4 - Review and Correct Cube Notation on 4×4 and 5×5 (Priority: P4)

A player who reads cube-solving notation finds the names for inner layers on 4×4 and 5×5 (such as "2U" or "3D") odd or wrong. The notation is reviewed against published speedcubing conventions, corrected where it departs from them, and the result is explained in the help screen. The 3×3 names, which are standard, do not change.

**Why this priority**: The notation is a display preference and no game depends on it, so it is the least urgent; it still matters because wrong notation misleads the people who chose it.

**Independent Test**: Switch to cube notation, open a 4×4 and a 5×5 Cube with a turn pending, and read each layer name against the published convention listed in the help screen.

**Acceptance Scenarios**:

1. **Given** the notation setting is cube notation on a 4×4 or 5×5, **When** every layer and turn is listed, **Then** each name follows one documented published convention, and every layer has exactly one name that identifies that single layer (never ambiguous with a wide turn of several layers).
2. **Given** the 3×3 Cube, **When** names are listed, **Then** they are exactly as before: R, L, U, D, F, B and the middle slices M, E, S, with prime and 2.
3. **Given** the layer names on 4×4 and 5×5, **When** the player reads them, **Then** the same side is not used for one layer and the other side for its neighbour without a stated reason, and the middle layer of an odd cube has a recognised name.
4. **Given** the chosen convention, **When** a name is typed back or shown anywhere (controls, move list, captions, replay), **Then** it round-trips to the same turn and is identical in every place.
5. **Given** the help screen, **When** the player reads the Cube notation part, **Then** it shows how inner layers are named on 4×4 and 5×5, with a small example, and says which convention it follows.
6. **Given** saved games, links and seeds, **When** the notation changes, **Then** they are unaffected (notation is display only).

---

### Edge Cases

- Lock scored faces: a placement completes a line and the same move is the last empty cell on an open face — the scorer still turns a layer, then play continues on the remaining open faces.
- Lock scored faces: after a layer turn, every remaining empty cell sits on locked faces — the game ends immediately by the rule in scenario 1.5; if the turn instead opens a face, play continues.
- Lock scored faces: a layer turn lands a line of one player on a face where the other player has marks — the face locks for both players.
- Lock scored faces: a layer turn that is pending after a score is always allowed, even if it will lock more faces.
- Lock scored faces: an inner-layer turn (4×4, 5×5) moves marks between faces without touching the end faces; locks are re-evaluated from the resulting position, not from history.
- Lock scored faces: undo — undo restores the position and recomputes locks from it.
- Face-count scoring on 3×3 with win length 3 and on 5×5 with win length 3 — the same rule applies; the maximum score is 6.
- Face-count scoring: a layer turn breaks a face's last line — that face stops counting for its owner; scores can fall as well as rise.
- Both options on together — the lock stops a face gaining lines by placement, so extra lines on one face come only from layer turns; scoring counts faces, so those still add nothing; the result is still determined correctly.
- A replay of a lock game: the replay carries the lock, so it enforces the same refusals and ends where the live game ended, including an end caused by the lock.
- A 001 or 002 save or link has neither option — it opens with line counting and no lock.
- Two-device play with a device that predates this release — the handshake refuses a game that uses either option and names the reason.
- Preview within a layer: the player selects the same turn already showing — nothing moves.
- Preview within a layer: fast repeated selection while an animation runs — input is held until the animation ends, as in 002 (FR-021 of 002).
- Preview within a layer from a half turn to a quarter turn the same way — the layer turns the short way (a quarter back), not through a full revolution.
- Hover highlight when the layer being previewed is hidden behind the cube in 3D — the highlight is still visible on the controls and on whichever of its stickers face the viewer.
- Touch devices have no hover — tapping a layer's name highlights that layer with no preview; tapping a turn button previews that turn and highlights its layer; the highlight stays until another layer name is tapped or the turn is cancelled or confirmed.
- Win-length reset when the seed field already holds a seed — a size choice clears the seed as it does today and the default applies.
- Notation: even-sized cubes have no single middle layer, so they have no middle-slice name.

## Requirements *(mandatory)*

### Functional Requirements

**Cube rule options**

- **FR-001**: The Cube setup screen MUST offer two independent options, "Lock scored faces" and "Count faces, not lines", each off by default; they MUST NOT appear for Classic or Ultimate, and the last choice MUST be remembered with the other setup choices.
- **FR-002**: With "Lock scored faces" on, placing a mark on an empty cell of a face that currently holds at least one winning line (of either player) MUST be refused with a stated reason, and the refusal MUST apply to both players, to hints, to the keyboard and to the two-device guest alike.
- **FR-003**: A face's locked state MUST be derived from the current position only (it locks when a winning line is on it and opens when none is), so layer turns, undo, replays and reloads need no extra history.
- **FR-004**: Layer turns MUST remain allowed on locked faces and MUST be unaffected by the lock; a placement that completes the first line on an open face MUST be allowed and MUST still require the scorer's layer turn.
- **FR-005**: If marks are due and no empty cell lies on an open face, the game MUST end at once with the result from the current score; the player MUST be told why it ended.
- **FR-006**: Locked faces MUST be marked in the 3D view, the flat view and for assistive technology, using more than colour, and hints MUST NOT point to cells on locked faces.
- **FR-007**: The lock rule MUST be enforced in game logic, recorded with the game's rules in replay records and share links, kept in the saved game, and sent in the two-device handshake so replays, saved games and two-device games are all held to it until they end. Links and saves without it MUST open with no lock, exactly as before.
- **FR-008**: With "Count faces, not lines" on, a player's score MUST be the number of faces on which that player currently holds at least one winning line; a face can count for both players; the score MUST be recounted from the position after every move and layer turn.
- **FR-009**: Under face-count scoring the layer turn that follows a scoring placement MUST be triggered exactly as under line counting (completing any new winning line, including a further line on a face already counted).
- **FR-010**: The winner when the game ends MUST be decided by the chosen scoring: more scoring faces wins, equal scores tie. The live score, result text, move list and replay MUST all state faces rather than lines when this mode is on.
- **FR-011**: The scoring mode MUST be stored with the game's rules and encoded in replay records and share links so a replay shows the same scores and winner. Links and saves without it MUST open with line counting, exactly as before.
- **FR-012**: In a two-device game the host's choices of both options MUST reach the guest before play begins; a device that cannot honour a choice MUST refuse the game and say which part it cannot honour.
- **FR-013**: The Cube help text MUST explain both options and how each changes the score or the allowed moves.

**Preview and highlight**

- **FR-014**: While a turn is previewed, selecting a different turn on the same layer MUST animate the layer from its current previewed position straight to the new previewed position, by the shortest rotation, without passing through the original position; selecting a turn on another layer MUST return the first layer and then turn the second.
- **FR-015**: Whatever route the preview takes, the layer MUST end exactly at the position the final selected turn produces, and confirming MUST apply exactly that turn; cancelling MUST return the layer to its original position from wherever it is.
- **FR-016**: The animation duration for a within-layer change MUST be no longer than a normal preview turn; reduced-motion MUST show the new position at once.
- **FR-017**: A layer MUST be highlighted, with no preview, while the pointer is over its name, row or turn buttons, or keyboard focus is on them; it MUST stay highlighted through selection, preview animation and the held preview, clearing when the pointer or focus leaves that layer's controls and no preview of that layer is pointer-held; the highlight MUST NOT flicker when a preview starts, changes or ends.
- **FR-018**: The highlight MUST work in the 3D view and the flat view, and on touch: tapping a layer's name highlights that layer with no preview, and the highlight stays until another layer's name is tapped or the turn is cancelled or confirmed. The highlight MUST NOT be the only indicator of the selected turn.

**Setup defaults**

- **FR-019**: Choosing a board size on the new-game screen MUST set the win length to 3 for 3×3 and 4 for 4×4 and 5×5, in every variant, replacing any previously chosen value; choosing the already-selected size MUST change nothing.
- **FR-020**: The remembered setup, an applied seed, and saved games, links and seeds MUST keep their own board size and win length; the default MUST be applied only when a player picks a board size on the setup screen.
- **FR-021**: Win length on 3×3 MUST stay fixed at 3 and 4×4 and 5×5 MUST still offer every valid value from 3 to the size.

**Cube notation**

- **FR-022**: The names for inner layers on 4×4 and 5×5 MUST be reviewed against published speedcubing notation, and MUST be changed to follow one documented convention that gives each single layer exactly one unambiguous name; the choice and its sources are recorded in the planning research.
- **FR-023**: 3×3 names (R, L, U, D, F, B, M, E, S, prime, 2) MUST NOT change; a name MUST parse back to the turn it names on every size; the same name MUST be used everywhere a turn is shown.
- **FR-024**: Notation MUST stay a display preference: no effect on game state, saves, seeds, links or the other device.
- **FR-025**: The help screen MUST describe how inner layers are named on 4×4 and 5×5 and name the convention followed.

### Key Entities

- **Game Rules (Cube)**: Variant, board size N, win length K, plus a scoring mode (lines or faces) and the face-lock flag. Both are part of the rules recorded in replays, links and saves. Lines mode and no lock are the defaults and mean a record without the field.
- **Cube Game Options**: The scoring mode and the face-lock flag, chosen on the setup screen and sent to the other device in a two-device game.
- **Locked Face**: A face that currently holds at least one winning line while the lock rule is on; derived from the position, never stored.
- **Layer Highlight**: A local, temporary emphasis of one layer under the pointer, focus or last tap on its name; never part of game state and never a preview.
- **Turn Preview Path**: The animation route from the layer's current previewed position to its next one; display only.
- **Layer Name**: The notation text for one single layer on a given cube size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every Cube size and win length, 100% of rule-test scenarios for the lock (placement refusals, turns that lock and unlock, end-by-lock) and for face-count scoring (single face, shared face, extra line on a counted face, lines broken by a turn) match the definitions with 0 known discrepancies.
- **SC-002**: 100% of replays of games played with face-count scoring show the same final scores and winner as the live game; 100% of 001 and 002 links and saves still open with line counting and the same result.
- **SC-003**: In a within-layer preview change, the layer never passes through its original orientation (checked frame by frame in a test), for every ordered pair of turns on a layer on every cube size.
- **SC-004**: During within-layer preview changes at least 95% of frames complete within 20 ms and none take over 50 ms on a mid-range phone, as for other previews.
- **SC-005**: A layer's highlight is present on every frame between pointer entry and exit on its controls, including the frames where a preview starts and ends, in both views, with 0 flicker frames in tests.
- **SC-006**: After any sequence of board-size choices, the win length equals the default for the chosen size in 100% of cases in all variants.
- **SC-007**: Every inner-layer name on 4×4 and 5×5 is covered by a table test that checks the name against the documented convention and its round trip, with 0 mismatches.
- **SC-008**: In a usability check of 10 players who know cube notation, at least 9 read all 4×4 and 5×5 layer names correctly without help.
- **SC-009**: Accessibility score of at least 90 and the offline, install and keyboard-only checks from 001 and 002 still pass; locked faces and the highlight are perceivable without colour.

## Assumptions

- This feature builds on 001 and 002: every rule and requirement not mentioned here stays as specified there.
- The face-lock rule is recorded with the rules in replays and links, so a replay reproduces the game exactly, including an early end caused by the lock. Links and saves without the lock flag open with no lock.
- Face-count scoring changes only the tally and the winner. The count of lines is still computed, because the layer-turn trigger and line highlighting use it.
- "Winning line" on a face means a line of exactly the chosen win length of one player's marks, as already defined for Cube scoring in 002.
- The face-lock flag and the scoring mode are kept in the in-progress save (save schema bump with a migration that treats older saves as "off") and sent with the two-device configuration; the protocol version is bumped, and older devices are refused cleanly for games that use either option.
- Win-length defaults apply to all variants; 002's FR-002 default of 3 for Ultimate and Cube on 4×4 and 5×5 is replaced by 4 for new size choices. Existing saved setups, seeds and games are untouched.
- "Hovered layer" means the layer whose name, row or turn buttons are under the pointer or focus in the turn picker; the highlight is not tied to which part of the cube the pointer is over. Hover never previews.
- The notation review follows published speedcubing conventions (single-layer slice names, with numbered inner layers and middle slices on odd cubes); the exact convention and any change from today's names are decided in planning research. Wide turns of several layers are out of scope because a Cube turn moves a single layer.
- Out of scope: new variants, a computer opponent for Cube, free-form rule editors, per-player scoring modes and any change to Classic or Ultimate rules.
- The constitution applies: PWA, offline-first, simple dependencies, pure testable rules (the lock, scoring and notation live in the core modules), test-first.
