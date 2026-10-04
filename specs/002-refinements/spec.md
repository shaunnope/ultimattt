# Feature Specification: Game Refinements and Tweaks

**Feature Branch**: `002-refinements`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Expand 002 into a full spec" — seven refinements to the multi-variant tic-tac-toe app delivered in 001: default animated icon set with colour choice, shared look and feel with the flagrant project, seed rationale, win length decoupled from board size, 4×4 and 5×5 boards for Ultimate and Cube, a refined Cube rotation UI, and a help screen.

## Clarifications

### Session 2026-10-04

- Q: Should the UI explain in-game why a seed appears? → A: No; seeds are shown only for games with a computer player, with no in-game explanation.
- Q: Can players pick any custom mark colour? → A: No; mark colours come from a fixed set of palettes, each defined for both light and dark appearance, with no free colour entry.
- Q: Do players pick X and O colours separately or as one ready-made pair? → A: One named X/O pair (palette); no per-player choice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose Win Length and Larger Boards (Priority: P1)

A player starting a game picks the board size (N×N) and, separately, how many marks in a row are needed to win, anywhere from 3 up to N. Classic keeps its 3×3, 4×4 and 5×5 boards. Ultimate and Cube gain 4×4 and 5×5 boards alongside 3×3. For example, a player can run Classic on 5×5 needing only three in a row, or Ultimate on 4×4 needing four.

**Why this priority**: It changes the rules of every variant and everything else (help text, notation, computer strength) builds on it. It is also the most visible gameplay gain.

**Independent Test**: Start a Classic 5×5 game with win length 3 and confirm three in a row wins; start Ultimate 4×4 and Cube 5×5 and play each to a result.

**Acceptance Scenarios**:

1. **Given** the new-game screen, **When** the player changes board size, **Then** the win-length choice offers exactly the values 3 through N and the previous win length is kept if still valid, otherwise set to the default.
2. **Given** a Classic 5×5 game with win length 3, **When** a player gets three in a row, **Then** the win is declared and the winning line is highlighted.
3. **Given** a Classic 4×4 game with win length 4, **When** a player has three in a row, **Then** no win is declared.
4. **Given** an Ultimate game on 4×4 with win length 3, **When** a player claims three small boards in a row on the 4×4 grid, **Then** the game ends with that player as winner.
5. **Given** an Ultimate game on 5×5, **When** the player sends the opponent to the small board matching the cell just played, **Then** the forced-board rule works exactly as on 3×3.
6. **Given** a Cube game on 4×4 faces, **When** a move completes a line of the chosen win length on any face, **Then** it scores one point and the player must then turn one layer, any of the four layers on any axis.
7. **Given** Ultimate or Cube on 3×3, **When** the player views win length, **Then** it is fixed at 3.
8. **Given** a game started before this release, **When** the app loads, **Then** the game resumes with the rules it was started under.

---

### User Story 2 - Refined Cube Rotation Controls (Priority: P2)

When a player must turn a layer in Cube, picking a layer and direction first shows a live preview of that turn on the cube. The player then confirms to commit it or cancels by clicking outside the cube. Direction buttons show icons instead of the words "clockwise" and "anticlockwise", which overflowed their buttons. A new setting lets players who know cube-solving notation (U, D, L, R, F, B with prime and double markers) use it instead of clockwise/anticlockwise wording.

**Why this priority**: Rotation is the hardest part of Cube to understand and today's controls commit immediately with no way to take back a mistap. Fixing it improves the most error-prone interaction.

**Independent Test**: Score a line in a Cube game; select a layer and direction, watch the preview, cancel by clicking outside, select again and confirm; verify the final position matches the preview.

**Acceptance Scenarios**:

1. **Given** a turn is pending, **When** the player selects a layer and direction, **Then** the cube animates that turn as a preview and a confirm button becomes available; the turn is not yet applied to the game.
2. **Given** a preview is showing, **When** the player selects a different layer or direction, **Then** the first preview reverses and the new preview plays.
3. **Given** a preview is showing, **When** the player clicks or taps outside the cube (or presses Escape), **Then** the preview reverses, the cube returns to its pre-turn position and the turn is still pending.
4. **Given** a preview is showing, **When** the player presses the confirm button, **Then** the turn is applied, scores update and play passes to the opponent; the final position equals the previewed one.
5. **Given** a turn is pending and nothing is previewed, **When** the player views the controls, **Then** confirm is unavailable.
6. **Given** the direction buttons, **When** displayed on a narrow phone screen, **Then** each shows an icon (clockwise arrow, anticlockwise arrow, half turn) with no clipped or overflowing text, and each has an accessible name and a tooltip.
7. **Given** the notation setting is set to cube notation, **When** a turn is offered, previewed or listed (controls, move list, replay), **Then** turns are named in cube notation, such as "R", "U'" and "F2", instead of clockwise/anticlockwise wording.
8. **Given** a 4×4 or 5×5 Cube with cube notation on, **When** an inner layer is selected, **Then** it is named with the numbered-layer convention, such as "2R" for the second layer from the right face.
9. **Given** the flat (non-3D) fallback view, **When** a turn is pending, **Then** the same select, preview, confirm and cancel flow works there.
10. **Given** keyboard-only use, **When** a turn is pending, **Then** the player can select, confirm and cancel without a pointer.

---

### User Story 3 - Learn the Game from a Help Screen (Priority: P3)

A new player opens a help screen from the main menu to read how Ultimate and Cube are played: the goal, the turn sequence, forced boards, claiming small boards, scoring lines, layer turns and how the game ends. The help also explains the setup options added in this release (board size, win length, notation).

**Why this priority**: Ultimate and Cube are unfamiliar to many players; today the rules are only learned by trial and error. Documentation is independent of the other refinements, but it should describe the final rules, so it follows them.

**Independent Test**: From the main menu open Help, read each section for Ultimate and Cube, and follow the written instructions to play a first move in each variant.

**Acceptance Scenarios**:

1. **Given** the main menu, **When** the player looks for help, **Then** a clearly labelled link opens the help screen in one interaction.
2. **Given** the help screen, **When** it opens, **Then** it has a section each for Ultimate and Cube, each covering goal, how a turn works, special rules, how the game ends, and the effect of board size and win length.
3. **Given** the help screen, **When** the player reads the Cube section, **Then** it explains layer turns, previewing and confirming, and both naming styles for turns.
4. **Given** the help screen, **When** the player is done, **Then** a single control returns to where they came from.
5. **Given** the device is offline after first load, **When** the player opens help, **Then** it displays completely.
6. **Given** a keyboard or screen-reader user, **When** they use the help screen, **Then** all sections are reachable and headings are announced in order.
7. **Given** a help section illustrates an example, **When** it is shown, **Then** the example is understandable without colour alone and follows the current light or dark appearance.

---

### User Story 4 - Default Animated Marks, Fixed Mark Palettes, and Shared Look (Priority: P4)

Marks always use the app's default icon set, drawn with the same animations as the tictactoe-game reference project. Typing a custom icon character is removed. Instead, the player can pick one palette from a fixed set, each palette being a ready-made X/O colour pair with matching light and dark variants (no free colour entry, no per-player choice). The whole app adopts the colour scheme and UI design of the flagrant project (borrowing from tictactoe-game for elements flagrant lacks), so the projects feel like one family.

**Why this priority**: Visual consistency and polish; the game plays the same without it.

**Independent Test**: Open settings, confirm no custom-icon field exists, pick a palette from the fixed set, play a game and see animated marks in that palette's colours in light and dark appearance; compare app screens against flagrant for matching palette, typography and component styling.

**Acceptance Scenarios**:

1. **Given** the settings screen, **When** it opens, **Then** there is no field for typing a custom icon; there is a single palette choice covering both players' marks.
2. **Given** a mark is placed, **When** it appears, **Then** it is drawn with the reference project's mark animation; with reduced-motion preference on, it appears without animation.
3. **Given** the colour choice, **When** the player opens it, **Then** it offers only the fixed X/O palettes (no custom colour option) and shows a live sample of both marks.
4. **Given** the palette list, **When** it is displayed, **Then** it includes at least one colour-blind-safe palette, and every palette shows X and O in clearly different colours.
5. **Given** a chosen palette, **When** appearance switches between light and dark, **Then** the marks switch to that palette's variant for the new appearance and remain legible.
6. **Given** a player upgrades from 001 having saved custom icon characters, **When** the app loads, **Then** the default icons are used, no error is shown, and saved games, seeds and share links still open.
7. **Given** the app's screens (menu, setup, game, replay, settings, help), **When** compared with flagrant, **Then** colours, type scale, spacing, buttons, panels and dialogs use flagrant's design; any element flagrant has no equivalent for uses the tictactoe-game design, restyled to the flagrant colour scheme.
8. **Given** two-device play, **When** each player picks a mark colour, **Then** colours are a local display preference: they do not change what the other device shows and are not stored in game records or share links.

---

### User Story 5 - Seeds Only Where They Matter (Priority: P5)

A seed exists so that a game with a computer opponent can be replayed with the computer making identical choices. In a game with no computer player (two people on one device, two devices, and Cube, which has no computer opponent), nothing is random, so a seed has no purpose. Seeds are therefore shown only for games that include a computer player, with no in-game explanation of why; games without a computer player show no seed.

**Why this priority**: Removes confusing UI and a field that does nothing; small and safe.

**Independent Test**: Start a two-player Classic game and confirm no seed appears anywhere, then start a game against the computer and confirm the seed appears.

**Acceptance Scenarios**:

1. **Given** a new game screen with no computer player (two people, two devices, or Cube), **When** it is displayed, **Then** no seed field or seed control is shown.
2. **Given** a game in progress without a computer player, **When** the player looks at game info, **Then** there is no copy-seed action.
3. **Given** a game against the computer, **When** it is displayed, **Then** the seed can be copied and a pasted seed can be started, with no accompanying explanation text.
4. **Given** a finished game without a computer player, **When** it is replayed or shared, **Then** the replay and share link reproduce it from the move record alone.
5. **Given** a seed from 001 or a share link that carries a seed for a game without a computer player, **When** it is opened, **Then** it still loads and plays back correctly.
6. **Given** a player switches the setup between computer and human opponent, **When** the opponent changes, **Then** seed controls appear or disappear accordingly without losing other settings.

---

### Edge Cases

- Win length is larger than the new board size after the board size is reduced — the win length snaps to the largest valid value.
- A longer run than the win length (for example four in a row with win length 3) — counts as a win in Classic and Ultimate; in Cube it scores per rule in FR-005.
- Ultimate on 5×5 against the computer — replies stay within the response-time target (SC-004), at the cost of search depth if needed.
- Cube: a preview is showing and the view is dragged to rotate it — the view moves, the preview stays, and the turn is not cancelled.
- Cube: a click outside the cube lands on a button or control — it triggers that control, not a cancel.
- Cube: preview animation is in progress when the player confirms or cancels — input is held until the animation ends, then applied.
- Cube: reload while a preview is showing — the game resumes with the turn pending and no preview applied.
- Cube: two-device play — the other device sees only the committed turn, never the preview.
- Cube: undo while a preview is showing — the preview is cancelled and the undo applies as defined in 001.
- Cube notation on 3×3 — inner layers are the middle slices, named with the standard middle-slice letters.
- Colour choice: a saved palette identifier no longer exists in the fixed set — the default palette is used without error.
- Help screen opened mid-game — the game is not lost or advanced; closing help returns to it.
- Seed field has text typed in, then the opponent is switched to a human — the seed is discarded.
- Reduced-motion preference — previews and mark animations still convey the result, with instant or shortened transitions.

## Requirements *(mandatory)*

### Functional Requirements

**Rules and board sizes**

- **FR-001**: The new-game screen MUST let users choose win length separately from board size, for any N×N board, from 3 through N inclusive.
- **FR-002**: Defaults MUST be 3 for 3×3 boards in all variants, and for Classic 4×4 and 5×5 MUST stay at the 001 defaults (4 in a row); for Ultimate and Cube on 4×4 and 5×5 the default MUST be 3.
- **FR-003**: Classic MUST support 3×3, 4×4 and 5×5 with any valid win length; the line that wins is any run of at least the win length of one player's marks in a row, column or diagonal.
- **FR-004**: Ultimate MUST support 3×3, 4×4 and 5×5 sizes where the size sets both the grid of small boards and the cells in each small board. The chosen win length MUST apply to both levels: making that many in a row inside a small board claims it, and claiming that many small boards in a row on the grid wins the game.
- **FR-005**: Cube MUST support 3×3, 4×4 and 5×5 faces. A line scores one point for each distinct run of exactly win-length consecutive cells (in a row, column or diagonal of a face) all belonging to one player; a longer run therefore scores once per window it contains.
- **FR-006**: In Cube, a layer turn MUST be able to turn any one of the N layers on any of the three axes by a quarter turn either way or a half turn, carrying marks across faces with correct orientation, and MUST recount points from the resulting position.
- **FR-007**: The forced-board rule, free-choice rule for closed boards, draw detection, computer legality and every other rule from 001 MUST work unchanged on the larger Ultimate and Cube sizes.
- **FR-008**: Computer opponents MUST remain available for Classic and Ultimate on every supported size and win length, MUST only play legal moves, and MUST meet the response-time limit in SC-004; Master on 3×3 with win length 3 MUST still never lose.
- **FR-009**: Board size and win length MUST be recorded in the game so that saved games, replays, seeds and share links reproduce the correct rules; games and links created under 001 MUST continue to load with their original rules.
- **FR-010**: For 3×3 Ultimate and Cube, win length MUST be shown as fixed at 3 rather than as a choice.

**Cube rotation UI**

- **FR-011**: When a turn is pending, selecting a layer and direction MUST play an animated preview of that turn on the cube without applying it to the game state.
- **FR-012**: A confirm control MUST be unavailable until a turn is previewed; activating it MUST apply exactly the previewed turn.
- **FR-013**: Users MUST be able to cancel a preview by clicking or tapping outside the cube or pressing Escape; cancelling MUST reverse the preview and leave the turn pending; a click on another control MUST act on that control instead.
- **FR-014**: Selecting a different layer or direction during a preview MUST replace the preview with the new one.
- **FR-015**: Direction controls MUST show icons (clockwise, anticlockwise, half turn) rather than text, MUST NOT clip or overflow on supported screen widths down to a small phone, and MUST each carry an accessible name and a tooltip.
- **FR-016**: A setting MUST let users choose between clockwise/anticlockwise wording and cube-solving notation for naming turns; the default MUST be clockwise/anticlockwise, and the choice MUST be remembered on this device.
- **FR-017**: Cube-solving notation MUST use the standard face letters and markers (prime for the opposite direction, 2 for a half turn) and a numbered-layer convention for inner layers on 4×4 and 5×5; the same name MUST be used everywhere a turn is shown (controls, previews, move list, replay).
- **FR-018**: Notation is a display preference of this device: it MUST NOT change game state, seeds, saved records, share links or what the other device shows.
- **FR-019**: The preview, confirm and cancel flow MUST work identically in the flat fallback view, with touch, and with keyboard alone.
- **FR-020**: Previews MUST be local: in two-device play the other player MUST see only the confirmed turn, and a reload with a preview showing MUST restore the pending turn with no preview.
- **FR-021**: Input during a preview or cancel animation MUST be held until it ends.

**Help screen**

- **FR-022**: The main menu MUST contain a labelled link to a help screen.
- **FR-023**: The help screen MUST explain Ultimate and Cube: goal, turn flow, special rules (forced boards, claims; scoring lines, layer turns, preview and confirm), how the game ends, and the effects of board size, win length and notation.
- **FR-024**: The help screen MUST be fully readable offline after first load, reachable and operable by keyboard and screen reader, and follow the current appearance.
- **FR-025**: Opening or closing help MUST NOT alter a game in progress.

**Icons, colours and look**

- **FR-026**: The custom-icon setting MUST be removed; marks MUST always use the default icon set taken from the tictactoe-game reference project, including its mark-drawing animations, which MUST be suppressed when the reduced-motion preference is on.
- **FR-027**: Users MUST be able to choose one palette, a fixed X/O colour pair, from a fixed set, with a live sample; custom, free-form or per-player colours MUST NOT be offered. Every palette MUST define a light-appearance and a dark-appearance variant of both colours, applied automatically with the current appearance; the choice (by palette identifier) MUST be remembered on this device.
- **FR-028**: Every palette variant MUST meet the readable-contrast minimum against its appearance's background, and X and O colours within a palette MUST be distinguishable from each other in both appearances; the set MUST include at least one colour-blind-safe palette. Marks MUST also remain distinguishable by shape, never by colour alone.
- **FR-029**: Mark colours MUST be a display preference of this device: no effect on game state, seeds, share links, saved game records or two-device display.
- **FR-030**: Saved custom icon characters from 001 MUST be ignored without error, and saved games, seeds and share links MUST still open.
- **FR-031**: The app MUST adopt the colour scheme, typography, spacing and component styling of the flagrant project in light and dark appearance; elements with no flagrant equivalent MUST use the tictactoe-game design restyled to flagrant's scheme.
- **FR-032**: Accessibility and installability requirements from 001 (keyboard operation, accessible names, no state by colour alone, installable, offline) MUST still be met after the restyle.

**Seeds**

- **FR-033**: A seed MUST exist and be shown only for games that include a computer player; games without one (two people on one device, two devices, Cube) MUST show no seed field, seed display or copy-seed action, and MUST NOT require one to replay or share.
- **FR-034**: The UI MUST NOT include in-game explanatory text about why a seed appears; the rationale for seeds is documented in this spec only.
- **FR-035**: Seeds and share links from 001 MUST continue to open, including those carrying a seed for a game without a computer player.
- **FR-036**: Changing the opponent type in setup MUST show or hide seed controls immediately and MUST discard a typed seed when no computer is selected.

### Key Entities

- **Game Rules**: Board size N, win length K (3 to N), variant; now stored with the game so rules can be reproduced exactly.
- **Layer Turn**: In Cube, a layer (axis plus index from 0 to N−1) and amount (quarter either way, or half); has a display name in either style.
- **Pending Turn Preview**: Local, temporary choice of layer turn shown on the cube; discarded on cancel, reload or undo; never part of game state.
- **Mark Palette**: One entry of a fixed, built-in set: an identifier plus an X/O colour pair, each in a light and a dark variant; a device stores one palette identifier.
- **Display Preferences**: Mark colours, turn notation, appearance; all local to the device.
- **Help Content**: Rules guidance for Ultimate and Cube.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every supported combination of variant, board size and win length, 100% of rule-test scenarios (win detection, claims, forced-board routing, Cube scoring and layer-turn mapping) match the rule definitions with 0 known discrepancies.
- **SC-002**: A player can set board size and win length and start a game within 4 interactions of opening the new-game screen.
- **SC-003**: At least 90% of first-time Cube players complete a layer turn through the preview and confirm flow without help, and none report accidentally committing a wrong turn in testing.
- **SC-004**: Computer replies take under 1 second on a mid-range phone for all levels on every supported Classic and Ultimate size, including Ultimate 5×5.
- **SC-005**: During cube turn previews and confirmations, at least 95% of frames complete within 20 ms and none take over 50 ms on a mid-range phone, on every cube size.
- **SC-006**: In a usability check of 10 new players, at least 9 find the help screen from the main menu in one try and answer correctly when asked what happens after a move in Ultimate and after a scoring move in Cube.
- **SC-007**: Every direction control shows without clipped or overflowing content at viewport widths from 320 px upward, in both languages of notation.
- **SC-008**: Every screen passes visual comparison against flagrant's palette and component styling with 0 unmatched colours or fonts, and every text/control pair meets the accessibility contrast minimum in light and dark.
- **SC-009**: 100% of games without a computer player show no seed anywhere in the UI, and 100% of games with one show a seed, with no explanatory text.
- **SC-010**: 100% of games, seeds and share links saved under 001 still open and play back identically after upgrade.
- **SC-011**: The accessibility score of at least 90 and the offline, install and keyboard-only completion checks from 001 still pass after the restyle.

## Assumptions

- This feature builds on 001; every 001 rule and requirement not mentioned here stays as specified there, including Cube being two-player only and the half turn.
- "Reference project" for the icon set and animations means tictactoe-game (in `C:\Users\yapzh\CodeProjects\tictactoe`); the look and feel reference is flagrant (in `C:\Users\yapzh\CodeProjects\flagrant`).
- Win length is one value shared by both levels in Ultimate, to keep setup simple; separate values per level are out of scope.
- In Classic and Ultimate a win is any run of at least the win length; Cube counts each exact-length window (FR-005) because points accumulate there, so Cube totals may differ from a "maximal run" reading.
- Ultimate on 5×5 means 25 small boards of 25 cells, so computer search depth is allowed to shrink at higher sizes to meet SC-004.
- Cube-solving notation uses face letters U, D, L, R, F, B relative to a fixed cube orientation, independent of how the view is rotated; clockwise is as viewed looking at that face.
- Mark colours are one palette (X/O pair) per device, not per game; the fixed set includes at least one colour-blind-safe palette. The exact palette count and values are decided in planning.
- The first-use experience is unchanged: the default notation is clockwise/anticlockwise wording and the default colours match the flagrant scheme.
- The help screen is static content stored with the app, covers Ultimate and Cube only (Classic rules need no explanation), and is in English only.
- Out of scope: new variants, a computer opponent for Cube, tutorials with interactive boards, and win lengths above N.
- The constitution applies: PWA, offline-first, simple dependencies, pure testable rules, test-first.
