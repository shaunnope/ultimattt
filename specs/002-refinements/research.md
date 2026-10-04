# Research: Game Refinements and Tweaks

No `NEEDS CLARIFICATION` items remained after the spec. The decisions below resolve the design questions the spec left to planning. Each cites the code it was drawn from.

## R1. Carrying board size and win length

- **Decision**: `GameConfig` gains `winLength` (3 to `size`). `size` stays `3 | 4 | 5` for every variant. Every rules module reads both from the config. A new pure `rules.ts` owns win-length options, defaults, and the legacy default used when a 001 config has none (Classic: 3 on 3×3, else 4; Ultimate and Cube: 3).
- **Rationale**: `classic.winLengthFor(size)` is hard-coded today, and `lines(size)` caches by size alone. Putting K in the config is the only way for saves, replays, seeds and the network to reproduce the right rules (FR-009).
- **Alternatives**: Deriving K from size (rejected: that is exactly what the spec removes). Storing K in the seed (rejected: games without a computer have no seed, see R5).

## R2. Win detection with a win length below the board size

- **Decision**: Keep the 001 approach: precompute every window of exactly K cells in rows, columns and both diagonals, cached by `(size, K)`. A run longer than K contains a window, so it wins automatically in Classic and Ultimate. In Cube the same windows are the scoring unit, so a run of length L scores `L − K + 1` points (FR-005).
- **Rationale**: One line table serves Classic, the small and large level of Ultimate, Cube faces, hints, and the AI. `classic.lines` already builds exactly these windows.
- **Alternatives**: Scoring a maximal run once in Cube (rejected: a spec assumption; windows are also what the existing recount does per face line, so totals generalise without a new counting rule).

## R3. Ultimate on N×N

- **Decision**: N small boards of N×N cells on an N×N grid; one K for both levels. `SMALL_LINES` and the meta lines become `lines(N, K)`. A small board full without a K-line is still claim 3 (nobody's). Forced-board routing stays "cell index = board index", which holds on any N.
- **Rationale**: The routing rule needs the small board and the grid to be the same size, which the spec's single N already guarantees. Memory and apply cost stay small (at most 625 cells).
- **Alternatives**: Independent small and large sizes or Ks (rejected: out of scope, breaks cell-to-board routing).

## R4. Cube geometry for N layers

- **Decision**: Keep the true 3D rotation approach, but use doubled integer coordinates. A sticker at row r, column c on a face sits at `2c − (N−1)` along a face axis and `±(N−1)` along the face normal. Layer l (0 to N−1) is the plane at `2l − (N−1)`. Sticker index is `face·N² + row·N + col`. Quarter-turn vectors are unchanged. For N=3 this is the 001 geometry scaled by two, so every table equals the 001 table.
- **Rationale**: The 001 rule "an outer layer carries its whole face" falls out naturally because face stickers lie on the outer layer plane. Orientation can never go wrong because turns are real rotations.
- **How correctness is proven** (Constitution I): (a) `cube-golden.json` still passes unchanged for N=3; (b) property tests for N=3,4,5: four quarters is identity, a quarter then its reverse is identity, a half equals two quarters, every turn is a permutation, turning all N layers of an axis equals turning the whole cube; (c) the order of the outer-turn sequence R U R' U' is 6 on every N; (d) inner-layer turns on N=4,5 are cross-checked against a small independent facelet simulator written in the test file, not derived from the geometry.
- **Alternatives**: Per-N hand-written permutation tables (rejected: 150 stickers, error-prone). Half-integer coordinates (rejected: floating point where integers are enough).

## R5. Seeds only for computer games

- **Why seeds exist** (answers the user's question 3): in 001 a seed decides which mark a "let the game decide" player gets and every random choice the computer makes (`pickMark`, `rngFor` in `seed.ts`, used by `ai-worker.ts`). Replays and share links reproduce games from the move list, not the seed. With no computer, only the mark pick used it, and for two-device play the host's choice is already sent in the config. So the seed is needed only when a computer plays.
- **Decision**: `GameConfig.seed` becomes optional and is present exactly when `mode === "computer"`. Two-device games with "let the game decide" take their mark from a one-off random draw at setup, stored as `humanMark`. The seed text keeps its `PREFIX-XXXX-XXXX` form with a new prefix scheme: a rules code of letter plus size plus win length (`C53` Classic 5×5 K=3, `U43` Ultimate 4×4 K=3). 001 prefixes (`3X3`, `4X4`, `5X5`, `ULT`, `CUB`) still parse, with legacy win lengths.
- **Replay links** carry the rules as a `rules=` parameter always, and `seed=` only for computer games. A 001 link (no `rules`, a seed) is read through the seed prefix. See [contracts/record-format.md](contracts/record-format.md).
- **UI**: no explanatory text anywhere (clarification of 2026-10-04); seed field, display and copy action appear only for computer games.
- **Alternatives**: Keeping a hidden seed for every game (rejected: the spec removes the concept for human games). Dropping seeds entirely (rejected: computer games need repeatable choices, and SC-003 from 001).

## R6. Move tokens on larger boards

- **Decision**: Reuse the Classic alphabet `0-9a-o` (25 symbols) for every index that can reach 24: Classic cell, Ultimate board and cell, Cube cell. Cube face stays one digit 0 to 5; layer stays one digit 0 to 4. Rotation tokens remain `.` + axis + layer + way.
- **Rationale**: Tokens remain self-delimiting and 001 tokens decode identically (digits mean the same). No separators or version flag needed.
- **Alternatives**: Variable-width numbers with separators (rejected: longer links, new parser).

## R7. Computer strength and time on large boards

- **Decision**: Keep the deterministic, node-budgeted negamax. Parameterise by `(size, K)`; the evaluation already works from a line list. Scale per-size budgets and depth so a reply stays under 1 s; budgets are counted in positions, never milliseconds. Master "never loses" remains guaranteed only for 3×3 with K=3 (FR-008). A performance probe runs the slowest case (Ultimate 5×5, all levels) under a 4× CPU slowdown and fails the gate above the limit.
- **Rationale**: Node-count budgets keep seeds reproducible across devices (001 constraint). Larger boards give a weaker top level, which the spec explicitly allows.
- **Alternatives**: Time-boxed search (rejected: not reproducible). Precomputed tables (rejected: size and K combinations are many, and complexity is not justified).

## R8. Two-device compatibility

- **Decision**: Bump the wire protocol to version 2. A version 1 peer is refused with the existing `reject: version` path and a plain message, since it would misread `winLength` and sizes. Both devices must run the same release for network play. Messages gain `winLength` inside `config` (see [contracts/net-protocol.md](contracts/net-protocol.md)).
- **Rationale**: Silent rule mismatch is the one outcome worse than refusing. The service worker already updates both devices on next load.
- **Alternatives**: Staying on v1 and defaulting K by size (rejected: wrong rules for any new setting).

## R9. Save migration

- **Decision**: Schema 1 to 2: drop `settings.icons`; add `markPalette` (`"default"`), `cubeNotation: "words"`; add `winLength` to a saved game's config using the legacy default; add `winLength` to `lastSetup`. Unknown schemas behave as in 001 (file kept, fresh start, notice).
- **Rationale**: FR-030 and SC-010 require 001 saves to keep loading and old custom icons to be ignored without error.

## R10. Marks: SVG from tictactoe-game

- **Decision**: Draw X as two `path` strokes and O as a `circle`, in a 100×100 viewBox, with `pathLength="1"` so one dash animation works for any size (the reference's `board.js` and `style.css`: `draw 0.22s`, second stroke delayed 0.1 s). Colour comes from CSS custom properties `--mark-x` and `--mark-o`, set at runtime from the chosen palette for the current appearance (R11). Only newly placed marks animate; reduced motion removes the animation. Text uses plain letters "X" and "O" where a name is needed (status lines, aria-labels).
- **Rationale**: Shape differs between players, so colour is never the only signal (Constitution, Technical Constraints). SVG scales across Classic, Ultimate small cells and cube stickers with no font dependence.
- **Alternatives**: Keep text glyphs with a colour (rejected: spec requires the reference icon set and animation). Emoji (the reference explicitly avoids them).

## R11. Mark colours

- **Decision** (clarification of 2026-10-04: fixed palettes, no custom colour, one X/O pair per choice): A pure `palette.ts` holds a constant table `PALETTES` of four ready-made pairs, each with a light and a dark variant of both colours, picked by identifier. The palette is applied by setting `--mark-x` and `--mark-o` from the table for the current appearance. No colour parsing, adjustment or user-entered colour exists at runtime.

  | id | Label | X light / dark | O light / dark |
  |---|---|---|---|
  | `default` | Default | `#3b5bdb` / `#6a8cff` | `#c2410c` / `#fb923c` |
  | `cbsafe` | Colour-blind safe | `#0072b2` / `#56b4e9` | `#b84a00` / `#e69f00` |
  | `forest` | Forest and berry | `#0f766e` / `#2dd4bf` | `#be185d` / `#f472b6` |
  | `sunset` | Violet and amber | `#6d28d9` / `#a78bfa` | `#a16207` / `#facc15` |

  The default X is flagrant's `--accent`, so first use matches the flagrant scheme. The `cbsafe` pair follows the Okabe-Ito blue and orange family. Contrast against the flagrant surfaces was computed during planning: every variant is at least 4.2:1 on both `--bg` and `--surface` in its appearance, above the 3:1 non-text minimum.
- **Rationale**: Readability and distinctness are properties of a fixed table, so they are proven once by a unit test over the table instead of checked per user choice (FR-028). This removes the same-hue adjustment, the suggestion UI and the "too similar" rejection path.
- **Test gate** (Constitution I): `palette.test.ts` asserts for every palette and appearance (a) 3:1 contrast of X and O on `--bg` and `--surface` from `theme.css`, (b) CIE Lab distance between X and O at or above a threshold fixed in the test, and (c) that the table contains `cbsafe` and a default. If a pair fails (b), its values are changed in the table, not the test.
- **Alternatives**: Custom colour with per-theme adjustment (rejected by the user's clarification). Independent X and O choice (rejected: allows clashing choices; fixed pairs cannot clash). A colour library (rejected: Constitution IV).

## R12. Flagrant look and feel

- **Extracted from** `flagrant/game/src/app.css`: tokens `--bg`, `--fg`, `--surface`, `--border`, `--accent`, `--accent-muted`, `--accent-contrast`, `--success`, a system-ui font stack, light values (`#faf8f3`, `#1a1a1a`, `#f1efe8`, `#dcdce2`, `#3b5bdb`, `#e4e9fb`, `#ffffff`, `#2ecc71`) and dark values (`#14161c`, `#f0f0f2`, `#1d2028`, `#2e323d`, `#6a8cff`, `#262c42`, `#0c0e13`). The `HelpPage.svelte` structure (centred column of at most 34 rem, `h2` headings, ordered list of steps) is the model for our help page.
- **Decision**: Map our tokens onto flagrant's: `--bg`, `--surface`, `--line` becomes `--border`, `--brand` and `--brand-ink` come from `--accent` and `--accent-muted`, `--ink` becomes `--fg`. Keep our theme mechanism (`data-mode`, the `ttt.theme` key and the pre-paint script) so `check-theme` and the "auto" option keep working. Elements flagrant has no equivalent for (boards, cube, replay controls, dialogs, toasts, update bar, QR panel) take the tictactoe-game styling, rewritten against flagrant tokens. A new check (`check-theme-tokens`) fails if the CSS introduces a colour literal outside `theme.css`.
- **Rationale**: One token layer makes consistency checkable (SC-008) and keeps the pre-paint script untouched.
- **Alternatives**: Copying flagrant's CSS wholesale (rejected: it is scoped to a Svelte app with chart-specific variables). Renaming our attribute to `data-theme` (rejected: churn in the pre-paint script and its check for no user value).

## R13. Cube turn flow

- **Decision**: A small state machine in the cube board: `idle`, `previewing(rotation)`, `animating`. Selecting a turn while `idle` plays the animated preview and enables Confirm. Selecting another while `previewing` reverses, then plays the new one. Cancel (outside pointer-down, Escape) reverses to `idle` with the turn still pending. Confirm hands the previewed rotation to `onMove` and the view commits without replaying the animation. An outside click is "outside" only if it is not on the cube stage, the picker or any interactive element, and a view drag never cancels. In the flat view the preview is the post-turn marks drawn in a dashed "preview" style (computed with `rotateStickers`), since there is no 3D motion to show. Preview state is local: it is not saved, not sent to the other device, and is discarded on reload or undo.
- **Rationale**: The existing `playRotation` already animates a layer with CSS transforms and resets without transition; the new API splits "turn and hold" from "commit". Input is held while `animating` (FR-021).
- **Alternatives**: A separate Cancel button (kept out: Escape, outside click and choosing again cover pointer, touch and keyboard; fewer controls on a narrow screen).

## R14. Turn buttons and labels

- **Decision**: With wording mode, each button is an icon only, with an accessible name and a tooltip taken from the wording label: up and down arrows (x axis), left and right arrows (y axis), curved clockwise and anticlockwise arrows (z axis), and a half-turn icon. With notation mode, buttons show the notation text instead (never more than four characters), so the single glyph set stays unambiguous and nothing overflows. Rows are labelled by layer name or by notation letter.
- **Rationale**: Fixes the overflow in the issue (words in narrow buttons) and gives notation users the labels they expect.

## R15. Cube-solving notation

- **Decision**: A pure `notation.ts`. Faces: x axis layer N−1 is R, layer 0 is L; y axis N−1 is U, 0 is D; z axis N−1 is F, 0 is B. A face letter turns clockwise as seen looking at that face. With the 001 convention (`dir +1` is +90° about the positive axis by the right-hand rule), this gives: R, U and F are `dir −1`; L, D and B are `dir +1`. Suffix `'` for the opposite way and `2` for a half turn. Middle slices on N=3 use M (follows L), E (follows D) and S (follows F). On N≥4 an inner layer is numbered from the nearer side: `2R`, `2L`, `3U` and so on, taking the high side (R, U, F) when numbering from it gives no more than N/2 and the low side otherwise; on N=5 the middle layer is `3L`, `3D`, `3B`. The mapping is relative to the cube's fixed orientation and does not depend on the current view.
- **Rationale**: Numbered layers as used for big cubes in speedcubing; matches the spec's `2R` example (FR-017) and its middle-slice edge case.
- **Verification**: A table test lists every turn for N=3,4,5 and checks a round trip name → turn → name, and that notation mirrors wording labels one-to-one.

## R16. Help screen

- **Decision**: A hash-routed page (`#/help`), as in flagrant, loaded lazily and added to the precache list. Content is static data in `help-content.ts` rendered by `help.ts`: Ultimate section, Cube section, and a short "setup options" section (board size, win length, notation). Small diagrams reuse the SVG mark renderer so examples follow light and dark and carry shape as well as colour. A "Back" control returns to where the player came from; opening help mid-game does not touch the game (FR-025) because the game screen stays mounted in memory or is restored from the save.
- **Rationale**: A hash route needs no server rewrite on static hosting and works under the subpath. Matches flagrant's own `#/help`.
- **Alternatives**: A modal dialog (rejected: long content, poor on phones, and spec says "screen"). A separate HTML file (rejected: duplicates theme and shell code).

## R17. Performance of larger cubes in the browser

- **Decision**: Sticker size and offsets are driven by a `--n` custom property (sticker is 1/N of a face), so one stylesheet serves all sizes. 150 stickers remain individual buttons (needed for accessible names and keyboard). Previews animate only the stickers of the chosen layer. A Playwright timing probe under 4× CPU throttle checks SC-005 on N=5.
- **Rationale**: The 001 view already handles 54 buttons within budget; the cost is linear.
