# Research: Twist-Tac-Toe Rename and UI Polish

No `NEEDS CLARIFICATION` remained after the spec. The items below record the design choices the code review turned up.

## R1. Rename mechanism

- **Decision**: Keep the stored id `"cube"` (seeds, records, saves, protocol, `config.variant`). Add `variantName(variant, form)` in `src/core/variants.ts` returning `Classic`, `Ultimate`, `Twist-Tac-Toe` (full) or `Twist` (short). Replace the literals in `game.ts` (`VARIANT_TITLE`), `replay.ts` (title), `setup.ts` and reword the remaining strings by hand.
- **Rationale**: Display-only change satisfies FR-002 with no migration. One helper stops the name drifting between screens.
- **Alternatives**: Rename the id and migrate (rejected: breaks old links and needs a schema bump for no user gain). A full i18n table (rejected: YAGNI).

## R2. What counts as "Cube" left in visible text

- **Decision**: Reword mode references ("The Cube has no computer opponent", "Cube is for two players", "Turn a layer of the cube", help copy, aria-labels "Cube, 3D view", manifest and page `<title>`/description). Keep lower-case "the cube" for the 3D shape (spec clarification). Keep the settings option "Cube notation (R, U', F2, 2L)" because it names the standard cubing notation, not the mode; relabel its field "Twist turn names".
- **Rationale**: SC-001 is about the mode name. Renaming a notation standard would confuse players who know it.
- **Alternatives**: "Twist notation" (rejected: it is not our own notation; and the option value `"cube"` stays in settings storage).
- **Guard**: a unit test scans string literals in `src/ui` and `src/core` (comments stripped, same approach as `scripts/check-names.mjs`) for `\bCube\b` with an explicit allow-list for the notation option; plus an e2e text sweep of each screen.

## R3. Replay label format

- **Decision**: `describeMove(config, move, mover, n, notation)` returns `{ label, name }`.
  - Classic: label `n. AcB`, e.g. `3. 2c3`.
  - Ultimate: label `n. <board name> AcB` (board name as today from `boardName`, then the cell as `AcB`).
  - Twist placement: `n. UAcB` with `U D F B L R` from a new `FACE_LETTERS` next to `FACE_NAMES`.
  - Twist turn: unchanged text after the number, in the chosen notation style.
  - `name`: words-only, includes the mover for assistive tech, e.g. "Move 5, X, top face, row 1, column 2".
- **Rationale**: Move number already implies the mover in alternating play (spec). The accessible name keeps the mover because the visible mark is dropped and screen-reader users lose nothing by hearing it.
- **Open assumption carried from spec**: in Twist, a scoring placement and the following turn are two list entries by the same player; the move number still maps to the mover through `frames[i + 1].mover`, which the replay already computes. If review shows the pair is confusing, the turn entry may show a "↻" prefix; not in scope now.
- **Alternatives**: Keep X/O in the accessible label only (adopted). Show the mark as an icon in the list (rejected: the spec removes it).

## R4. Is a face "in view"?

- **Decision**: Pure `faceInView(rx, ry, face)` in `cube-labels.ts`, using the same normals and rotation maths as `frontFace`. A face is in view when its outward normal has a depth component of at least `cos 66° ≈ 0.4` towards the viewer. In flat view every face is in view.
- **Rationale**: In the default 3D angle the front face and slivers of two others are visible; at the opening angle the top and right faces lean towards the viewer at about 0.42 and 0.45 and are readable, so 0.4 keeps them (and the front) and turns for the other three; a face below 0.4 is a sliver.
- **Alternatives**: `face === frontFace` only (rejected: turns the cube on nearly every move, which is disorienting). Any positive depth (rejected: sliver faces count as visible).

## R5. Awaitable view turn and replay timing

- **Decision**: Add `turnToFace(face, ms)` to `cube-view.ts`; it sets the target view via the existing `applyView(true)` path, resolves on `transitionend` (with a timeout fallback of `ms + 50`), and resolves at once under reduced motion after applying the final angles (FR-007: face visible before the mark). The read-only cube board's `update()` does, for a placement that is in the state's last move and whose face is hidden: `await view.turnToFace(face, ms)`, then `if (mine === generation) show(state, fresh)`. The `generation` counter already cancels stale updates on jumps (FR-006).
- **Duration**: `ms = min(350, 0.6 × step)` where step is the replay's `STEP_MS / speed` (clamped by `MIN_STEP_MS`); the replay passes it through `createBoard` options (`stepMs`). At fastest speed the turn is short but the mark still appears after it.
- **Rationale**: Reuses the existing view animation, cancellation and reduced-motion handling instead of a second timer system.
- **Alternatives**: Turn and show the mark at the same time (rejected: spec says turn first). A CSS-only animation chain (rejected: no cancellation on jumps).
- **Backward steps and jumps**: `update(state)` is given a position, not a direction, so "last move is a placement on a hidden face" is the only trigger. Stepping back to a state whose last move is a placement turns to that face as well; a state whose last move is a turn or the empty board leaves the view alone.

## R6. Status and score wording

- **Decision**: New pure `statusText(ctx)` in `src/ui/status-text.ts`, called by `game.ts` and `cubeStatus`. Phrases:
  - vs computer, human to move: `Your move (X).`
  - one device: `X to move.`
  - two devices: `Your move (X).` / `Waiting for your friend (O).`
  - Twist after a score: `X scored! Turn a layer.`
  - results as today (winner, draw, tie, resignation, lock end).
  Ultimate keeps the "where to play" suffix.
- **Score row** (Twist only): `Lines · X: 2 · O: 1` / `Faces · X: 2 · O: 1`, with each player preceded by their mark drawn by the shared mark renderer so the player is identified by shape as well as letter, in one `aria-live` row below the status line.
- **Rationale**: The status line already reads close to the target; the work is consistency (one source), a score row that cannot be misread, and testability.
- **Alternatives**: Put score inside the status line (rejected: long on 320 px, and the status line is also used as the live announcement).

## R7. Help: Classic section and layout

- **Decision**: Add `{ id: "classic", title: "Classic rules", ... }` first in `HELP_SECTIONS` using the existing block kinds (`paragraph`, `steps`, `example`). Content: goal, alternating turns, draw on full board, lines in rows, columns and both diagonals, default win length per size (3 for 3×3, 4 for 4×4 and 5×5), win length adjustable where setup allows. Two examples with text alternatives: a 3×3 winning diagonal and a 4×4 row of four with a three-in-a-row that does not win. The `HelpSection["id"]` union gains `"classic"`. Existing `cube` id stays (display title becomes "Twist-Tac-Toe") so anchors and e2e hooks keep working.
- **Layout**: CSS only: `.help` max-width about 42rem (reading width), consistent inline padding using the existing spacing tokens with `max(1rem, env(safe-area-inset-*))` gutters, `.help-section` vertical rhythm and a top rule between sections, headings with clear size steps, examples wrapped so they never overflow at 320 px. Dark-mode checked through existing theme tokens (`scripts/check-theme-tokens.mjs` still passes).
- **Alternatives**: Table of contents with anchors (rejected for now: five short sections; revisit if help grows).

## R8. Cache, manifest and release hygiene

- **Decision**: Bump `VERSION` in `src/sw.ts` to `"4"`; update `site/index.html` `<title>` and description and `site/manifest.json` `name`, `description` and the screenshot label to say "Twist". `scripts/check-version.mjs` verifies the bump; `npm run check` and the precache generators run in `build`.
- **Rationale**: Constitution Technical Constraints require a cache bump whenever cached assets change.
