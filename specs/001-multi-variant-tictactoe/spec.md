# Feature Specification: Multi-Variant Tic Tac Toe

**Feature Branch**: `001-multi-variant-tictactoe`

**Created**: 2026-10-03

**Status**: Draft

## Clarifications

### Session 2026-10-03

- Q: May a layer turn be a half turn as well as a quarter turn either way? → A: Yes; quarter turns in both directions plus half turns (27 turn moves), as in the original game.

**Input**: User description: "See the two projects in C:\Users\yapzh\CodeProjects\tictactoe . Emulate tictactoe-game with the additional game variants: ultimate tic tac toe, and game defined in 1D-Tic-Tac-Toe (with interactable 3D ui)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play Classic Tic Tac Toe vs Computer or Friend (Priority: P1)

A player opens the app, picks the Classic variant (3×3 three-in-a-row, 4×4 and 5×5 four-in-a-row), chooses to play against the computer (five levels, Beginner to Master) or against another person on the same device, and plays a full game to a win, loss or draw. X always moves first; the player may choose a mark or let the game decide.

**Why this priority**: This is the baseline experience of the reference game. Every other variant reuses its game flow (setup, play, result, replay), so it is the smallest viable product.

**Independent Test**: Start a 3×3 game against Master; confirm it can never be beaten. Start a two-player game on one device; confirm alternating turns, win detection and draw detection on all three board sizes.

**Acceptance Scenarios**:

1. **Given** the new-game screen, **When** the player picks Classic 3×3, level 3, and starts, **Then** an empty board shows and X moves first.
2. **Given** a 4×4 game, **When** a player has three in a row, **Then** no win is declared; at four in a row the win is declared and the winning line is highlighted.
3. **Given** a full board with no winning line, **When** the last move is made, **Then** the game ends as a draw.
4. **Given** a game against the computer, **When** the player undoes, **Then** their last move and the computer's reply are both taken back.
5. **Given** the same seed and same moves, **When** a game is replayed, **Then** the computer makes identical choices every time.

---

### User Story 2 - Play Ultimate Tic Tac Toe (Priority: P2)

A player chooses the Ultimate variant: a 3×3 grid of small 3×3 boards. The cell a player picks inside a small board decides which small board the opponent must play next. Winning a small board claims it for that player; claiming three small boards in a line wins the game. If a player is sent to a board that is already won or full, they may play in any open board. The player can face the computer or a friend on the same device.

**Why this priority**: First requested new variant, and the more widely known one; it needs only 2D display, so it ships before the 3D variant.

**Independent Test**: Play a game in two-player mode; verify forced-board routing, free choice when sent to a closed board, small-board claims, overall win and overall draw.

**Acceptance Scenarios**:

1. **Given** a new Ultimate game, **When** X plays the top-right cell of any small board, **Then** O must play in the top-right small board, which is visibly marked as the only playable one.
2. **Given** O is sent to a small board that is already won or full, **When** O's turn starts, **Then** every open cell in every unclaimed, non-full board is playable.
3. **Given** a player completes a line in a small board, **When** the move is placed, **Then** that small board shows as claimed by that player and accepts no more moves.
4. **Given** a player claims three small boards in a line, **When** the claim happens, **Then** the game ends with that player as winner.
5. **Given** all small boards are claimed or full with no overall line, **When** the last move is made, **Then** the game ends as a draw.
6. **Given** play against the computer, **When** it is the computer's turn, **Then** it only chooses legal moves under the forced-board rule.

---

### User Story 3 - Play 3D Cube Tic Tac Toe (Priority: P3)

A player chooses the Cube variant, based on the 1D Tic Tac Toe game ("Rubik's-Tac-Toe"): six 3×3 boards, one per face of a cube, shown as an interactive 3D cube the player can drag or tap to rotate and inspect. Two players alternate placing marks on the face in front of them. Every completed three-in-a-row on any face scores one point for that player. When a move scores, that player must then turn one row or column layer of the cube (any of three layers; a quarter turn either way or a half turn), which carries marks between faces and can create or destroy lines. The game ends when every cell on every face is filled; the player with more total lines wins, equal totals are a tie.

**Why this priority**: The most novel and the most work (3D interaction, layer-turn rules). Valuable on its own, but not required for the other variants.

**Independent Test**: Play a two-player game; verify marks appear on the correct faces from every viewing angle, a scoring move forces a layer turn before the next mark, turns correctly relocate marks and re-count lines, and the final tally decides the result.

**Acceptance Scenarios**:

1. **Given** a new Cube game, **When** the player drags the cube, **Then** it rotates smoothly in 3D and any face can be brought to the front for play.
2. **Given** a player places a mark that completes a line, **When** the move is placed, **Then** board play is paused and the player is prompted to choose a layer and a turn (quarter either way, or half).
3. **Given** the player picks a layer and a turn amount (quarter either way, or half), **When** the turn is applied, **Then** the cube animates the turn, marks move to their new faces and cells with correct orientation, and the scores update to the current line totals on all faces.
4. **Given** a layer turn breaks a previously scored line, **When** totals are recalculated, **Then** the scoreboard reflects the lower total.
5. **Given** every cell on every face is filled, **When** the last move (and any required turn) completes, **Then** the game ends and announces the winner by line count or a tie.
6. **Given** a touch device or keyboard-only user, **When** they play, **Then** every action (rotate view, place mark, choose layer turn) is possible without a mouse.

---

### User Story 4 - Save, Resume and Play Offline (Priority: P4)

A player installs the app, closes it mid-game, and later reopens it — online or offline — to find the game exactly where it was left, in any variant.

**Why this priority**: Required by the project constitution (installable, offline-capable, persistent state) but layered on top of working games.

**Independent Test**: Load the app once, go offline, start and play each variant; reload and verify the game resumes.

**Acceptance Scenarios**:

1. **Given** the app has been opened once online, **When** the device goes offline and the app is launched, **Then** all three variants are fully playable.
2. **Given** a game in progress, **When** the page is reloaded, **Then** the same position, turn and settings are restored.
3. **Given** a new release is available, **When** the player returns online, **Then** they are told an update is ready and can apply it without losing a game in progress.

---

### User Story 5 - Replays, Seeds and Sharing (Priority: P5)

When a game ends, it plays back automatically as an instant replay with play, pause, step and speed controls. Each game has a copyable seed that restarts the same game setup, and a share link reproduces the entire game for anyone, offline once the app is loaded.

**Why this priority**: Polish features from the reference game; none block play.

**Independent Test**: Finish a game, copy its seed and share link, open the link in a fresh browser profile, and confirm the same game replays move for move.

**Acceptance Scenarios**:

1. **Given** a finished game in any variant, **When** the result shows, **Then** a replay plays through every move including (for Cube) every layer turn, with controls at 0.5×, 1×, 2× and 4×.
2. **Given** a seed pasted into the new-game screen, **When** the game starts, **Then** the variant and board match and the computer plays the same way for the same moves.
3. **Given** a share link, **When** it is opened, **Then** the replay plays without altering the viewer's own saved game.

---

### User Story 6 - Hints, Settings and Theme (Priority: P6)

Players can turn on hints (marking winning cells and cells that must be blocked, where meaningful for the variant), toggle auto-replay, choose icons (all variants, this device only), and switch between light and dark appearance.

**Why this priority**: Comfort features; the games work without them.

**Independent Test**: Enable hints in Classic; confirm winning cells and must-block cells are marked on the player's turn, and disabled by default.

**Acceptance Scenarios**:

1. **Given** hints are off (default), **When** it is the player's turn, **Then** no cells are marked.
2. **Given** hints are on in a Classic game, **When** a winning or must-block cell exists, **Then** it is marked with a shape that is distinguishable without colour.

---

### User Story 7 - Play a Friend on Another Device (Priority: P7)

One player hosts a game in any variant and shares a six-character code, link or QR code. A friend on another device opens it and joins. Both play the same game in real time.

**Why this priority**: Reference-game feature that adds social play; every variant works without it.

**Independent Test**: Host on one device, join on another with the code; play to a result in each variant and confirm both screens agree at every move.

**Acceptance Scenarios**:

1. **Given** a host has created a game, **When** the friend enters the code, opens the link or scans the QR, **Then** both devices show the same new game.
2. **Given** it is the host's turn, **When** the friend tries to move, **Then** the move is refused.
3. **Given** a player requests undo, **When** the other accepts, **Then** both devices step back; if declined, nothing changes.
4. **Given** the connection drops mid-game, **When** it is restored through a rejoin, **Then** the game resumes at the same position.

---

### Edge Cases

- Two-device: wrong or expired code — friendly error, no game starts.
- Two-device: a third person tries to join a full game — refused.
- Two-device: a player closes the app mid-game — the other is told and can wait for a rejoin.
- Two-device: device offline — option is shown unavailable while all other modes work.

- Ultimate: the forced board is full or already claimed — free choice among all open boards (covered above). A small board that is full but unwon counts as neither player's for the overall line.
- Ultimate: a single move both wins a small board and sends the opponent to a closed board.
- Cube: a single move completes more than one line — one point per line, still one layer turn only.
- Cube: a layer turn creates a line for the opponent, or completes lines for both players — each line counts for its owner; no extra turn is granted by a turn-created line.
- Cube: the last empty cell is filled by a scoring move — the final layer turn is still required before the result.
- Cube: a player tries to place a mark while a layer turn is pending — placement is refused with a clear message.
- Cube: a layer turn is chosen while an animation plays — input is held until the animation ends.
- Computer move is in progress and the player taps — input is ignored, not queued.
- Reload mid-computer-turn or mid-animation — the game resumes at a consistent state and the computer moves again.
- Invalid or tampered seed or share link — the app shows a friendly error and starts nothing.
- User chooses identical icons for both players or an empty / multi-character icon — rejected with an explanation.
- 3D rendering is unavailable on the device — a flat fallback view lets the Cube variant stay playable.

## Requirements *(mandatory)*

### Functional Requirements

**Common**

- **FR-001**: Users MUST be able to choose between three variants — Classic, Ultimate and Cube — from a single start screen.
- **FR-002**: Users MUST be able to play each variant against another person on the same device.
- **FR-003**: System MUST detect and announce wins, draws and (Cube) final tallies correctly, and show the result clearly.
- **FR-004**: System MUST prevent illegal moves and explain why a move was refused.
- **FR-005**: Users MUST be able to undo moves in every mode; against the computer an undo reverts the user's move and the computer's reply. In Cube, undoing while a layer rotation is pending takes back the placement that triggered it; undoing after a rotation takes back the rotation and its placement together.
- **FR-006**: System MUST persist the game in progress and settings locally and restore them after reload or restart.
- **FR-007**: Every game MUST have a seed that, with the same moves, reproduces the same game including every computer choice; users MUST be able to copy a seed and start a game from a pasted seed.
- **FR-008**: System MUST replay every finished game with play, pause, step back/forward, scrubbing, a move list, and 0.5×/1×/2×/4× speed (remembered).
- **FR-009**: Users MUST be able to share a game as a link that reproduces the whole game, works offline after the app is loaded, and does not modify the viewer's own saved game.
- **FR-010**: Hints MUST be an off-by-default setting.
- **FR-011**: Users MUST be able to choose light or dark appearance.
- **FR-012**: The app MUST be installable and fully playable offline after first load, with an in-app notice when an update is ready.
- **FR-013**: All controls MUST be keyboard and touch operable with accessible names, and state (turn, claimed board, scoring line) MUST NOT be conveyed by colour alone.

**Classic**

- **FR-014**: Classic MUST offer 3×3 (three in a row wins), 4×4 and 5×5 (four in a row wins), X moving first.
- **FR-015**: Against the computer, users MUST be able to select one of five levels (Beginner, Casual, Steady, Sharp, Master) of increasing strength; Master on 3×3 MUST never lose.
- **FR-016**: The computer MUST meet the reply-time limit in SC-004 and MUST NOT freeze the interface while thinking.

**Ultimate**

- **FR-017**: Ultimate MUST consist of nine 3×3 boards in a 3×3 grid, X moving first, with the first move free.
- **FR-018**: After each move, the opponent MUST be required to play in the small board matching the cell just played; if that board is claimed or full, the opponent MAY play in any open board.
- **FR-019**: A small board MUST be claimed by the first player to make three in a row in it; claimed boards accept no further moves; a full unwon board belongs to nobody.
- **FR-020**: The game MUST be won by three claimed small boards in a row and drawn when no open cells remain without such a line.
- **FR-021**: The playable board(s) MUST be visibly indicated to the player at all times.
- **FR-022**: Computer opponent MUST be available in Ultimate with selectable levels and only ever make legal moves.

**Cube**

- **FR-023**: Cube MUST present six 3×3 boards, one per cube face, as an interactive 3D cube; users MUST be able to rotate the view freely by drag, touch, or keyboard and see all faces.
- **FR-024**: Marks placed on a face MUST appear in the matching cell and orientation on the 3D cube.
- **FR-025**: Each completed three-in-a-row on any face MUST award one point to its owner; the scoreboard MUST always show current totals.
- **FR-026**: When a move completes at least one line, the player MUST turn exactly one layer (any of three rows or three columns on any axis) by a quarter turn in either direction or a half turn before the opponent moves; placement MUST be blocked until the turn is made.
- **FR-027**: Layer turns MUST carry marks across faces with correct orientation and MUST recount totals from the resulting position (lines can be created or broken).
- **FR-028**: Layer turns MUST be animated; inputs during animation MUST be held until completion.
- **FR-029**: The game MUST end when all 54 cells are filled and no turn is pending; most lines wins, equal is a tie.
- **FR-030**: In any variant, players MUST be able to choose a single-character icon for each mark (X and O), subject to validation. Icons are a display preference of the device: they MUST NOT change game state, seeds, share links, saved game records or what the other device shows in two-device play.
- **FR-031**: A flat (non-3D) view MUST be available as a fallback and as an accessibility alternative, supporting all the same actions.
- **FR-032**: Cube MUST be two-player only (two people on one device, or two devices per FR-033); no computer opponent is offered for Cube.

**Two-device play**

- **FR-033**: Users MUST be able to play any variant against another person on a different device: one device hosts and shares a six-character code, a link or a QR code; the other joins with it. Each device sees the same game state, and a player can only move on their own turn.
- **FR-034**: In two-device games, undo MUST require the other player's acceptance; the other player MAY decline.
- **FR-035**: If the connection drops, both players MUST be told, and the host MUST be able to offer a rejoin that resumes the same game from its saved position.
- **FR-036**: Two-device play MUST need no account and no game server of our own; only the initial introduction of the two devices MAY use a third-party service, and the app MUST work fully offline for every other mode when it is unreachable.
- **FR-037**: Scored games, point totals and a global leaderboard are out of scope.

### Key Entities

- **Game**: One play session — variant, board size/mode, players (human/computer with level), seed, move history, result, status.
- **Variant**: Classic, Ultimate or Cube; defines board shape, legal moves, scoring and end condition.
- **Board / Cell / Mark**: Position state; Classic has one board, Ultimate nine small boards plus an overall claim state, Cube six faces.
- **Move**: A mark placement; in Cube, also a layer turn (layer, direction).
- **Player**: X/O (or custom icon), human or computer with a level.
- **Seed**: Compact code identifying variant, setup and random choices.
- **Replay / Share Link**: Ordered move record that reproduces a finished game.
- **Settings**: Hints, auto-replay, replay speed, icons (display only, this device), appearance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can start a game in any variant within 3 interactions of opening the app.
- **SC-002**: Master on 3×3 draws or wins in 100% of games against a full set of test opponents (never loses).
- **SC-003**: In 100% of games from a seed with identical moves, the computer's choices are identical.
- **SC-004**: Computer replies in under 1 second on a mid-range phone for all levels on 3×3 and Ultimate.
- **SC-005**: All three variants, including saved-game resume, work with the device offline after one prior load.
- **SC-006**: Rule behaviour (routing, claims, layer-turn mapping, line counts) matches the rule definitions for every scenario in the acceptance tests with 0 known discrepancies.
- **SC-007**: In usability testing, at least 90% of new players complete a Cube game, including at least one layer turn, without help.
- **SC-008**: During cube rotation and layer-turn animation, at least 95% of frames complete within 20 ms and none takes longer than 50 ms, on a mid-range phone.
- **SC-009**: Users can finish any game start-to-end using touch only, and using keyboard only.
- **SC-010**: A shared replay link reproduces the identical game for 100% of tested links.

## Assumptions

- Target is a modern phone, tablet or desktop browser; no store listing or native build.
- No accounts; everything runs on the device, except that two-device play needs both devices online and a third-party introduction service.
- Classic behaves like the reference tictactoe-game (levels, seeds, undo, hints, replay, share links, light/dark theme), minus its scoring and leaderboard.
- Ultimate uses standard rules; "sent to a closed board" gives free choice of any open board (the most common house rule).
- Cube follows the 1D Tic-Tac-Toe rules: six faces, lines scored per line (a move may score several), one layer turn after a scoring move, win by total line count when full. The player may place on any face brought to the front (no forced routing).
- Computer opponents in Classic and Ultimate share the five-level model of the reference game; Ultimate levels are tuned to meet the response-time target.
- Visual look follows the reference game's theme.
- SC-007 is a manual usability check run before release; it is not automated.
- A mid-range phone means a typical Android phone from the last four years. Automated checks stand in for it with a 4× CPU slowdown of a desktop browser; real-device spot checks happen before release.
- Constitution applies: PWA, offline-first, simple dependencies, pure testable rules, test-first.
