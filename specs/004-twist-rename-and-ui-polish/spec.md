# Feature Specification: Twist-Tac-Toe Rename and UI Polish

**Feature Branch**: `004-twist-rename-and-ui-polish`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Expand @specs/004-polish/spec.md with more descriptive name" (renamed from `004-polish`), expanded from six notes: rename the Cube mode to Twist-Tac-Toe ("Twist"), turn the cube to the played face during replay, simpler replay move notation, clearer move and score display, a help section on classic rules and win conditions for 3×3 to 5×5 boards, and a tidier help page layout.

## Clarifications

### Session 2026-10-04

- Q: Where does the rename show? → A: Everywhere a player reads it: variant picker, setup screen (including the "Cube rules" group), game screen, result text, replay page, help page, share and invite text, page titles and install metadata if they mention it. "Twist-Tac-Toe" is the full name; "Twist" is the short name used where space is tight (picker button, status line, move list heading). The 3D object is still called "the cube" in descriptions of what the board looks like.
- Q: Do old saved games, share links and seeds still work after the rename? → A: Yes. The rename changes display text only. Saved games, replay links, seeds and two-device handshakes made before the rename load and play exactly as before.
- Q: What does replay notation look like? → A: Placements read `AcB`: row number A, column number B, both counted from 1 (for example `2c3` is row 2, column 3). On Twist boards a placement is prefixed with the face letter and reads `UAcB`, where the letter names the face: U top, D bottom, F front, B back, L left, R right. The X/O mark is dropped from the label because the move number already tells who moved. Layer-turn moves keep their current notation.
- Q: Does the notation setting (words or cube-style) still matter? → A: It still decides how layer turns are named. It does not change placement labels, which always use `AcB` / `UAcB`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Twist-Tac-Toe Naming (Priority: P1)

A player who opens the app sees the third mode called Twist-Tac-Toe (short name "Twist") instead of "Cube". The new name appears in the variant picker, setup, in-game status, results, replays, help and any text the app generates for sharing.

**Why this priority**: The name is the most visible change and every other story's wording (help text, status, notation) depends on it being settled.

**Independent Test**: Walk through start screen, setup, a game, the result, a shared replay link and the help page; search all visible text for "Cube" as a mode name and find none. Open a game, replay link and seed created before the change and confirm they still load.

**Acceptance Scenarios**:

1. **Given** the start screen, **When** it is shown, **Then** the third mode is labelled "Twist" (full name "Twist-Tac-Toe" wherever there is room) with its blurb unchanged in meaning.
2. **Given** the Twist setup screen, **When** it is shown, **Then** the rule options group reads "Twist rules" and the two-player note names Twist, not Cube.
3. **Given** a Twist game in progress or finished, **When** status, result, end-of-game and refusal messages show, **Then** none of them use "Cube" as the mode name.
4. **Given** a share link, invite text or replay page, **When** it names the mode, **Then** it says Twist-Tac-Toe or Twist.
5. **Given** a game, replay link, seed or two-device invite made before this change, **When** it is opened, **Then** it loads and plays as before, and shows the new name.
6. **Given** the help page, **When** it describes the mode, **Then** it uses the new name throughout and still refers to "the cube" only for the 3D shape.

---

### User Story 2 - Replay Turns the Cube to the Played Face (Priority: P1)

When a Twist replay plays a placement on a face that is not currently facing the viewer, the cube first turns to bring that face into view, then the mark appears.

**Why this priority**: Without it, a replay of a Twist game shows marks appearing on faces the viewer cannot see, which makes replays hard to follow.

**Independent Test**: Replay a Twist game that has placements on all six faces; at every placement confirm the played face is visible and the mark appears only after the cube has settled on it.

**Acceptance Scenarios**:

1. **Given** a replay at a placement whose face is hidden from the current view, **When** the replay reaches that move, **Then** the cube turns to show that face, and the mark appears once the turn has finished.
2. **Given** a replay at a placement whose face is already visible, **When** the replay reaches that move, **Then** the cube does not move.
3. **Given** a replay step caused by a layer turn, **When** it plays, **Then** the layer animation runs as it does now and the view is not changed by this feature.
4. **Given** the viewer steps backwards or jumps to a move, **When** the position is shown, **Then** the played face is brought into view the same way, without leaving the board in a half-turned state.
5. **Given** flat view is on, **When** a placement is replayed, **Then** the view does not turn (all faces are already visible) and the new mark is highlighted.
6. **Given** replay speed is changed, **When** a hidden-face placement plays, **Then** the view turn fits within the step so playback does not stall or overlap the next step.

---

### User Story 3 - Cleaner Replay Notation (Priority: P2)

The replay move list labels each placement as `AcB` (row A, column B), and on Twist boards as `UAcB` with a face letter in front. The X and O marks are no longer printed in the list, since the move number shows who moved.

**Why this priority**: It shortens and tidies a list players read often, but replays already work without it.

**Independent Test**: Replay one game of each variant and check every list entry against the format; confirm no X/O appears in labels and that the move number still maps to the right player.

**Acceptance Scenarios**:

1. **Given** a Classic replay, **When** the move list shows, **Then** a mark in row 2, column 3 reads `2c3`.
2. **Given** an Ultimate replay, **When** the move list shows, **Then** each placement identifies the small board and the cell in a compact form that follows the same `AcB` pattern for the cell (the small board is named as it is today).
3. **Given** a Twist replay, **When** the move list shows, **Then** a mark on the top face in row 1, column 2 reads `U1c2`; the other faces use D, F, B and L, R.
4. **Given** a Twist layer turn, **When** the move list shows, **Then** it reads as it does now, in the chosen notation style.
5. **Given** any replay entry, **When** read by assistive technology, **Then** it has an accessible name that spells the move out in words (for example "move 5, top face, row 1, column 2") so the shorthand is not the only description.
6. **Given** boards of size 4×4 and 5×5, **When** the list shows, **Then** row and column numbers up to 5 use the same format.

---

### User Story 4 - Clearer Move and Score Display (Priority: P2)

The status line and score display read at a glance: whose move it is, in a consistent phrase, and the current score labelled by what it counts (for example "Your move (X)" and "Lines · X: 0 · O: 0").

**Why this priority**: Players look at this constantly, so small wording and layout gains add up, but nothing is broken today.

**Independent Test**: Start each variant and each opponent type; at every turn check the status and score text follows one consistent pattern and updates after each move.

**Acceptance Scenarios**:

1. **Given** any game against the computer, **When** it is the player's turn, **Then** the status reads "Your move (X)" or "Your move (O)" with the player's own mark.
2. **Given** a one-device two-player game, **When** the turn changes, **Then** the status names the mover and mark in one consistent phrase.
3. **Given** a two-device game, **When** it is the other player's turn, **Then** the status says so and shows their mark.
4. **Given** a Twist game, **When** the score shows, **Then** it is labelled by what is counted ("Lines" or "Faces") followed by both players' counts, and updates after every scoring move.
5. **Given** a game that has ended, **When** the status shows, **Then** it states the result (winner, draw or resignation) in the same place and style as the move prompts.
6. **Given** a narrow phone screen, **When** status and score show, **Then** nothing is cut off or overlaps the board, and the mark in each is not conveyed by colour alone.

---

### User Story 5 - Classic Rules and Win Conditions in Help (Priority: P2)

The help page gains a section explaining the classic game on regular boards: how turns work, and how to win on 3×3, 4×4 and 5×5 boards, including the win length used on each.

**Why this priority**: New players of the variants often need the base rules first. The section is independent of other changes.

**Independent Test**: Open help and read the new section with no other knowledge of the game; confirm it explains the goal, turn order, winning line length per board size and how a draw happens.

**Acceptance Scenarios**:

1. **Given** the help page, **When** it opens, **Then** a "Classic rules" section covers the goal, alternating turns, and a draw on a full board with no line.
2. **Given** that section, **When** it describes win conditions, **Then** it states that 3×3 needs 3 in a row and 4×4 and 5×5 need 4 in a row by default, and that rows, columns and both diagonals count.
3. **Given** that section, **When** it mentions setup, **Then** it notes that win length can be changed where setup allows it, matching what the setup screen offers.
4. **Given** the help page, **When** the sections are listed, **Then** Classic rules comes before Ultimate and Twist so players meet the base game first.
5. **Given** the section, **When** it explains a win, **Then** it includes a small visual or worked example that does not rely on colour alone.

---

### User Story 6 - Help Page Layout and Padding (Priority: P3)

The help page reads more comfortably: consistent spacing between and inside sections, content that does not touch screen edges, and a clear heading structure.

**Why this priority**: Pure presentation. Valuable, but the content works without it.

**Independent Test**: Open help at phone width and at desktop width; confirm content has comfortable margins, sections are visibly separated, and nothing scrolls sideways.

**Acceptance Scenarios**:

1. **Given** help at phone width, **When** it opens, **Then** content has a consistent side margin and no horizontal scrolling.
2. **Given** help at desktop width, **When** it opens, **Then** the text column is a comfortable reading width and sections have even vertical spacing.
3. **Given** the help page in light and dark themes, **When** viewed, **Then** spacing and contrast are correct in both.
4. **Given** keyboard-only use, **When** moving through help, **Then** every control is reachable, has a visible focus state and an accessible name.
5. **Given** the help page is opened offline, **When** it loads, **Then** it looks and works the same.

---

### Edge Cases

- A replay link made by an older version, with the old mode id, still opens and shows the new name.
- Replay jumps to a move on a hidden face, then immediately to another hidden face: the view ends on the second face with no stuck mid-turn state.
- A replay of a game on a different board size (3×3, 4×4, 5×5) uses the same face letters and `AcB` pattern.
- A placement in Twist that happens right after a layer turn (face contents have moved): the label still names the face where the mark was placed at that time.
- The viewer rotates the cube by hand during a replay; the next hidden-face placement still brings its face into view.
- Reduced-motion preference is on: the view change to the played face happens without a long animation but the face is still shown before the mark appears.
- A very long status message (resignation, lock-end explanation) still fits on a narrow screen.
- Text that mentions "Cube" in user-visible saved data (for example a stored title or note) is displayed with the new name, without altering the stored record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST show the third mode as "Twist-Tac-Toe" (short "Twist") in every place a player reads the mode name, and MUST NOT show "Cube" as a mode name anywhere in visible text.
- **FR-002**: Saved games, replay links, seeds and two-device handshakes created before this change MUST keep working with identical behaviour.
- **FR-003**: Help text MUST use the new name and keep "the cube" only for the 3D shape.
- **FR-004**: When a Twist replay reaches a placement on a face that is not in view, the replay MUST turn the view to that face before showing the mark.
- **FR-005**: When the face is already in view, or flat view is on, the replay MUST NOT turn the view.
- **FR-006**: Stepping, jumping and speed changes in a replay MUST leave the view on the played face with no half-finished turns.
- **FR-007**: With reduced motion on, the view change MUST be short or instant but still complete before the mark appears.
- **FR-008**: Replay move list entries for placements MUST read `AcB` (row A, column B, from 1) and, on Twist boards, `UAcB` with face letters U, D, F, B, L, R.
- **FR-009**: Replay move list entries MUST NOT include the X/O mark; the move number MUST remain visible and tell the viewer who moved.
- **FR-010**: Each move list entry MUST also carry a full-words accessible name.
- **FR-011**: Layer-turn entries MUST keep their current naming and still respond to the notation style setting.
- **FR-012**: The status line MUST use one consistent phrasing per situation: "Your move (X)", the mover and mark for one-device play, and the waiting message with mark for two-device play.
- **FR-013**: The Twist score MUST be labelled by what it counts (Lines or Faces) and show both players' counts, updating after every scoring move.
- **FR-014**: The end-of-game status MUST state the result in the same place and style as move prompts.
- **FR-015**: Status and score MUST fit without clipping or overlap at phone width and MUST NOT rely on colour alone.
- **FR-016**: The help page MUST include a Classic rules section covering the goal, turns, draws, line directions, and default win length per board size (3 for 3×3; 4 for 4×4 and 5×5).
- **FR-017**: The Classic rules section MUST appear before the Ultimate and Twist sections and MUST include a worked example that does not rely on colour alone.
- **FR-018**: The help page MUST have consistent padding and section spacing, a comfortable reading width on large screens, and no horizontal scroll at phone width, in both themes.
- **FR-019**: All help controls MUST stay keyboard operable with visible focus and accessible names, and the page MUST work offline.

### Key Entities *(include if feature involves data)*

- **Mode name**: the display name for the third variant (full "Twist-Tac-Toe", short "Twist"); separate from the stored identifier, which does not change.
- **Move label**: the short text for one placement in a replay list (`AcB` or `UAcB`), paired with a full-words description.
- **Face letter**: U, D, F, B, L or R, naming a face of the cube in labels.
- **Status line**: the one-line statement of whose move it is or how the game ended.
- **Score display**: the labelled counts for both players in a Twist game (Lines or Faces).
- **Help section**: a titled block of the help page; this feature adds Classic rules and reflows the existing sections.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of all visible text, across every screen and state, finds zero uses of "Cube" as a mode name.
- **SC-002**: 100% of games, replay links, seeds and invites made before the change open and play identically after it.
- **SC-003**: In a replay of a Twist game with placements on all six faces, 100% of placements are shown on a face that is visible when the mark appears.
- **SC-004**: Replay move labels are on average at least 30% shorter than before, and every label matches the `AcB` / `UAcB` format.
- **SC-005**: A first-time player can find the winning-line length for a 4×4 board in the help page in under 30 seconds.
- **SC-006**: Status and score text is fully visible, without overlap or clipping, at a 320-pixel-wide screen in both themes.
- **SC-007**: The help page has no horizontal scrolling at 320 pixels wide and passes the project's accessibility score of at least 90.

## Assumptions

- The rename is a display-only change; internal identifiers, stored data formats and link formats stay as they are.
- The move number identifies the mover in every variant (alternating turns). In Twist, where a layer turn follows a scoring placement by the same player, the list's existing numbering already makes the mover clear; if it does not, the entry keeps whatever marker is needed to show the mover.
- Face letters follow the standard cube convention (U up/top, D down/bottom, F front, B back, L left, R right) and match the face names used elsewhere in the app.
- Ultimate replay labels keep their current small-board naming; only the cell part adopts `AcB`.
- Computer-opponent and two-device status messages exist today for Classic and Ultimate and are only reworded, not changed in behaviour.
- The help page's existing content is correct; only the Classic rules section is new, and the rest is reflowed, not rewritten.
- No change to game rules, scoring rules or win conditions: this feature changes names, labels, view behaviour in replays, and help content only.
