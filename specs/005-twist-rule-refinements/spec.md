# Feature Specification: Twist Mode Display Polish and New Logo

**Feature Branch**: `005-twist-rule-refinements`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Expand @specs/005-twist-rule-refinements\" (from four notes under "Additional Polish"): show locked faces with a lock icon instead of the word "Locked", add a last-move indicator to Twist, replace the current-player display in all modes with the two-segment pill used in the reference project (showing scores inside it in Twist), and redraw the logo as a 2×2×2 cube of X's and O's with rounded line ends.

## Clarifications

### Session 2026-10-06

- Q: The original notes mention a 2×2 Twist board and a 2-in-a-row win condition. In scope? → A: No. That note was commented out ("skip for now") and stays out of scope. No new board size or win length is added.
- Q: Does the lock icon replace only the visible word, or also what assistive technology hears? → A: The visible word "Locked" is replaced by a padlock icon. The padlock itself is decorative and hidden from screen readers; the locked state stays available to them through the accessible names of the face's stickers ("… empty, locked face"), so nothing is lost for non-visual users.
- Q: What does "last move" mean in Twist, where a turn can be a placement or a layer turn? → A: The cell of the most recent placement. A layer turn does not set or move the indicator; it stays on the last placed mark, following the mark as the layer carries it, and is cleared only by a new placement, undo past it, or a new game.
- Q: What does the "slider-like" current-player display look like? → A: A two-segment control showing X and O side by side with a highlight on the segment of the player to move; the highlight slides to the other segment when the turn passes. It is a display, not a control: it cannot be tapped to change the turn.
- Q: Where do Twist scores go? → A: Inside each player's segment, next to their mark, as a number. The separate "Lines · X: n · O: n" / "Faces · …" line is removed from the board area. The scoring kind is stated in the game info area at the top of every Twist game, which now always names it ("lines scoring" or "faces scoring"; today only Faces is named), so it is not repeated in the pill.
- Q: Does the pill replace the text turn prompts? → A: The pill shows whose move it is. The status line stays for messages the pill cannot carry (game result, resignation, "Waiting for your friend", Ultimate's where-to-play note, errors, computer "thinking") and no longer shows a plain "X to move" / "Your move (X)" prompt.
- Q: Is the two-segment pill Twist-only? → A: No. It is used in all game modes (Classic, Ultimate, Twist). Only Twist shows scores in the segments; Classic and Ultimate show the pill with the mark and highlight only.
- Q: What does the logo change cover? → A: The in-app logo (header and start screen), the favicon, the install icons (192, 512, maskable, Apple touch) and the web app manifest icons. Not the app name or colours.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lock Icon on Locked Faces (Priority: P1)

In a Twist game with the lock rule on, a face that holds a scored line shows a padlock symbol instead of the word "Locked".

**Why this priority**: The word is wide, clips on small boards and small screens, and obscures stickers. An icon is smaller and language-free.

**Independent Test**: Start a Twist game with lock on, score a line, and look at the locked face on 3×3, 4×4 and 5×5 boards, in cube view and flat view, in both themes.

**Acceptance Scenarios**:

1. **Given** a face that has become locked, **When** it is shown, **Then** a padlock icon appears on it and the word "Locked" does not appear visibly anywhere on the face.
2. **Given** a locked face, **When** a screen reader reads the board, **Then** the face is still announced as locked (through its stickers' accessible names; the padlock icon is decorative).
3. **Given** a face that is not locked, **When** it is shown, **Then** no padlock appears.
4. **Given** the cube is turned, **When** the locked face moves or is seen from an angle, **Then** the padlock stays on its face and turns with it.
5. **Given** a 5×5 board on a phone, **When** a face is locked, **Then** the icon is visible, does not hide more than a small part of the face, and does not block taps on unlocked faces.
6. **Given** a replay passes the move that locks a face, **When** it is shown, **Then** the padlock appears with the lock and disappears again when stepping back before it.

---

### User Story 2 - Last Move Indicator in Twist (Priority: P1)

The cell where the most recent mark was placed is outlined with an inset border, as other modes already do, so players can see what just happened.

**Why this priority**: Classic and Ultimate show it; its absence in Twist makes it hard to follow the opponent's move across six faces.

**Independent Test**: Play several Twist moves with placements on different faces and layer turns between them; after each, confirm exactly one cell carries the indicator and it is the latest placement.

**Acceptance Scenarios**:

1. **Given** a placement is made, **When** it is shown, **Then** that cell has an inset border and no other cell does.
2. **Given** a layer turn follows, **When** the layer moves the marked cell, **Then** the indicator moves with that mark.
3. **Given** undo is used, **When** the last placement is undone, **Then** the indicator moves to the previous placement, or is gone if none exists.
4. **Given** a game is loaded from a save or a replay link, **When** it is shown, **Then** the indicator is shown for the last placement in its history.
5. **Given** a replay is stepped to any move, **When** shown, **Then** the indicator matches the last placement at that point.
6. **Given** a locked face, a scored cell or a hint highlight on the same cell, **When** shown, **Then** the inset border remains visible and distinguishable, and does not rely on colour alone.
7. **Given** the new game starts, **When** no placement has been made, **Then** no cell shows the indicator.

---

### User Story 3 - Current Player Pill in All Modes, Scores in Twist (Priority: P2)

Every game mode shows the current player in the two-segment pill from the reference project. In Twist each player's score also appears inside their own segment, and the old "Faces/Lines" score text is removed.

**Why this priority**: It makes whose turn it is obvious at a glance, puts the score next to the player it belongs to, and removes a duplicated label.

**Independent Test**: Play a Classic, an Ultimate and a Twist game (Twist with lines scoring and with faces scoring); confirm the highlight tracks the mover, scores update in the segments, and no separate score line remains.

**Acceptance Scenarios**:

1. **Given** a game of any mode starts, **When** the board is shown, **Then** a two-segment pill shows X and O with X highlighted; in Twist each segment also shows a score of 0, and in Classic and Ultimate no score is shown.
2. **Given** the turn passes, **When** it is shown, **Then** the highlight slides to the other segment.
3. **Given** a Twist move scores, **When** it is shown, **Then** the scorer's number increases in their segment.
4. **Given** a scoring placement lets the same player turn a layer, **When** it is shown, **Then** the highlight stays on that player until the turn ends.
5. **Given** a Twist game of either scoring kind, **When** the board is shown, **Then** no "Lines" or "Faces" text appears in the display; the scoring kind is read from the game info area only.
6. **Given** the game ends, **When** it is shown, **Then** the pill marks the winner's segment (or neither on a tie or draw) and in Twist shows the final scores, in a way that does not rely on colour alone.
7. **Given** a replay, **When** it is stepped, **Then** the highlight and scores match the position at that move.
8. **Given** a screen reader, **When** the turn or a score changes, **Then** the change is announced in words (for example "O to move, X 2, O 1").
9. **Given** reduced motion is on, **When** the turn passes, **Then** the highlight changes without a slide animation.
10. **Given** a 320-pixel-wide screen in either theme, **When** shown, **Then** both segments and scores are fully visible without overlap or clipping.

---

### User Story 4 - New Logo: 2×2×2 Cube of X's and O's (Priority: P2)

The game's logo is redrawn as a small 2×2×2 cube whose visible faces carry X and O marks, all strokes with rounded ends and joins.

**Why this priority**: The current logo is a flat grid; the new one reflects the cube mode and matches the rounded look of the rest of the interface.

**Independent Test**: View the logo at header size, favicon size and install size, in light and dark themes, and as a maskable icon on a platform that crops it.

**Acceptance Scenarios**:

1. **Given** the logo, **When** it is shown, **Then** it reads as a cube split into 2×2×2 cells, with X's and O's on the visible faces.
2. **Given** any stroke in the logo, **When** inspected, **Then** its ends and corners are rounded.
3. **Given** the logo at 16 px, **When** viewed as a favicon, **Then** the cube outline and the distinction between X and O are still recognisable.
4. **Given** light and dark themes, **When** the header logo shows, **Then** it uses the theme's colours and has enough contrast against the background.
5. **Given** the install icons (192, 512, Apple touch), **When** generated, **Then** they use the same drawing; the maskable icon keeps the cube inside the safe zone.
6. **Given** the manifest and page head, **When** they refer to icons, **Then** every referenced icon exists, is precached and works offline.
7. **Given** a user who installed the app earlier, **When** the app updates, **Then** the new icon is picked up via the normal update path with no other change in behaviour.

---

### Edge Cases

- A placement on a face that gets locked in the same move: it shows both the last-move border and the lock icon without one hiding the other.
- Flat view and cube view both show the padlock and the last-move border.
- A layer turn that moves the last-placed mark across a face edge: the indicator follows the mark to its new cell.
- The pill shows an unlimited score (for example two digits): the number still fits its segment.
- A two-device game in any mode: the pill shows the local player's mark clearly (for example "You") without changing the segment order, so both devices show X on the same side.
- A computer opponent's turn: the highlight sits on the computer's mark while it thinks, and the existing "thinking" status is not lost.
- Games loaded from saves or links made before this feature: they show the new lock icon, last-move border and pill, with no change to stored data.
- Logo drawn in a monochrome context (for example a notification or tinted OS icon): still readable as a cube.
- High-contrast or forced-colours mode: padlock, last-move border and pill highlight remain visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A locked Twist face MUST show a padlock icon and MUST NOT show the visible word "Locked".
- **FR-002**: A locked face MUST still be announced as locked to assistive technology through its stickers' accessible names; the padlock icon is decorative (`aria-hidden`).
- **FR-003**: The padlock MUST turn with its face in cube view, appear in flat view, and be usable at 3×3, 4×4 and 5×5 sizes without blocking input on other faces.
- **FR-004**: Twist MUST mark the cell of the most recent placement with an inset border, and only that cell.
- **FR-005**: A layer turn MUST NOT clear the indicator; it MUST follow its mark. Undo, replay stepping and loading from a save or link MUST show the indicator for the last placement at that point.
- **FR-006**: The last-move border MUST remain visible on locked or scored faces and MUST NOT rely on colour alone.
- **FR-007**: Every game mode (Classic, Ultimate, Twist) MUST show a two-segment current-player pill with X and O and a highlight on the player to move. Twist MUST also show each player's score in their own segment; Classic and Ultimate MUST NOT show scores in it.
- **FR-008**: The highlight MUST stay with a player through a scoring placement and the layer turn that follows, and move only when the turn passes.
- **FR-009**: The separate Twist score line ("Lines" / "Faces" plus both counts) MUST be removed, and the words "Lines" and "Faces" MUST NOT appear in the new display.
- **FR-010**: At game end the display MUST show final scores and indicate the winner without relying on colour alone.
- **FR-011**: The pill MUST update correctly in every mode in play, undo, replay stepping, saved-game loading and two-device play.
- **FR-012**: Turn and score changes MUST be announced in words to assistive technology, and the slide MUST be skipped when reduced motion is on.
- **FR-013**: The display MUST fit at 320 px wide in both themes with no clipping or overlap and MUST NOT be interactive.
- **FR-014**: The logo MUST be a 2×2×2 cube with X's and O's on its visible faces, drawn with rounded stroke ends and joins.
- **FR-015**: The new logo MUST replace the old one in the header, start screen, favicon, install icons and manifest, with matching assets for light and dark, maskable and Apple touch uses.
- **FR-016**: Every icon the page or manifest refers to MUST exist, be listed for offline use, and pass the existing precache and version checks.
- **FR-017**: No change to game rules, scoring, win conditions, saved-game format, link format or seeds.
- **FR-018**: The status line MUST stop showing plain turn prompts ("X to move", "Your move (X)") in every mode, because the pill shows the mover. It MUST keep showing results, resignation, two-device waiting messages, Ultimate's where-to-play note, computer "thinking" and error messages. The same rule applies to the status line in a replay view.
- **FR-019**: The game info text of every Twist game (live and replay) MUST state the scoring kind as "lines scoring" or "faces scoring"; Classic and Ultimate game info is unchanged.

### Key Entities *(include if feature involves data)*

- **Lock icon**: a decorative padlock symbol shown on a locked face; the locked state is announced through the stickers' accessible names.
- **Last-move indicator**: an inset border on the cell of the latest placement; derived from move history, never stored.
- **Current-player pill**: the two-segment display showing the mover in every mode, and both scores in Twist.
- **Logo**: the 2×2×2 cube mark with X's and O's, in vector form for the page and as generated images for install.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of visible text on every Twist screen and state finds no on-board "Locked" word and no "Lines" or "Faces" in the player display.
- **SC-002**: In a Twist game of 20 or more moves, exactly one cell carries the last-move indicator after every move, and it is always the latest placement.
- **SC-003**: At every move of a game of any mode and its replay, the highlighted segment matches the player to move and, in Twist, the displayed scores match the rules' score, 100% of the time.
- **SC-004**: Status, scores and padlock are fully visible without overlap or clipping at 320 px wide in both themes.
- **SC-005**: The logo's X and O are distinguishable at 16 px and the cube outline is recognisable at 16 px.
- **SC-006**: All stroke ends and corners in the logo source are rounded; none are butt or miter.
- **SC-007**: Every icon referenced by the page and manifest loads offline, and the existing build checks (names, precache, theme tokens, version) and the accessibility score of at least 90 still pass.
- **SC-008**: Saves, links and seeds made before this change open and play identically.

## Assumptions

- "Reference project" is the project this app's Classic game follows. Its current-player display is taken to be a two-segment pill with a sliding highlight on the active player; exact sizes, colours and timing follow this app's existing theme tokens rather than copying the reference, and the reference's name does not appear in any visible text, stylesheet or page.
- The 2×2 board and 2-in-a-row win condition are deferred, as the original note says.
- The last-move indicator reuses the style (inset border) already used by Classic and Ultimate, adjusted for stickers on cube faces.
- The padlock is a simple outlined symbol with rounded stroke ends, in line with the app's other icons.
- The logo keeps the app's existing accent and ink colours; only the shape changes. Source art is vector, and the PNG icons are regenerated from the same drawing by the existing icon script.
- This feature changes display only (Twist polish, plus the current-player pill in all modes). Game rules, stored data, link formats and seeds are untouched.
