# Contract: UI Behaviour

Observable behaviour the UI must keep. Each item is testable in Playwright unless marked unit.

## Setup screen

- Size choice (3×3, 4×4, 5×5) is offered for every variant.
- Win length is a separate choice listing exactly `3 … size`. For size 3 it is shown fixed at 3 and is not editable. Changing size keeps the win length if still valid, otherwise sets the default for that variant and size (FR-001, FR-002, FR-010).
- Seed field and seed paste appear only when the opponent is the computer. Switching the opponent away from the computer hides them at once and clears typed text. Switching back shows an empty field (FR-033, FR-036).
- Nothing on the setup screen explains why a seed exists.

## Game and replay screens

- Seed text and a copy-seed action appear only in games that have a seed, with no explanatory text (FR-034).
- A replay link offers "Play this seed" only when the game has a seed.
- Marks are SVG drawn in the player's colour. A newly placed mark draws in; with reduced motion it appears at once. Marks differ by shape.

## Cube turn flow (FR-011 to FR-021)

States: see TurnSelection in [data-model.md](../data-model.md).

| Event | Result |
|---|---|
| Turn becomes pending | Picker shown, Confirm disabled, no preview |
| Press a turn button | Layer animates to the previewed position and stays; that button is marked pressed; Confirm enabled |
| Press a different turn button | Previous preview reverses, then the new one plays |
| Pointer-down outside the cube, picker and any interactive element; or Escape | Preview reverses; turn remains pending; Confirm disabled |
| Pointer-down on a button or other control | That control acts; no cancel |
| Drag on the cube to rotate the view | View moves; preview stays |
| Press Confirm | `onMove` receives exactly the previewed rotation; view settles to the committed marks without replaying; scores update; turn passes |
| Input during `animating` | Held until the animation ends |
| Undo, reload, new game, leave screen | Preview discarded, pending turn kept (undo as defined in 001) |
| Flat view | Preview shows the post-turn marks in a dashed style; same events apply |
| Two-device | Only the confirmed move is sent |

Buttons:

- Words mode: icon only, accessible name and tooltip from the wording label, no visible text. Icons by axis: up/down, left/right, clockwise/anticlockwise, plus half turn. At 320 px width nothing clips or scrolls horizontally.
- Notation mode: visible notation text of at most four characters; the accessible name still spells the turn in words.
- A layer row is labelled by layer name (words) or face letter (notation).
- All controls are reachable and operable by keyboard; Escape cancels.

## Notation (unit)

- `turnName` and `parseTurnName` round trip for every turn on N = 3, 4, 5.
- The same text appears in the picker, the preview caption, the move list and the replay.
- The setting only changes display; saved moves, links and seeds are identical in either mode.

## Mark palettes (unit and e2e)

- Settings has no icon field and no colour input. It offers a list of the four fixed palettes, each shown with a live X and O sample; exactly one is selected (FR-026, FR-027).
- Choosing a palette updates marks on screen at once. Switching light or dark appearance swaps to that palette's variant for the new appearance with no other action.
- `palette.test.ts` proves every palette and appearance meets the contrast and distinctness rules, and that a colour-blind-safe palette exists (FR-028).
- An unknown saved palette id shows the default without an error.
- The palette id never appears in saves of games, links, seeds or network messages.

## Help (FR-022 to FR-025)

- The main menu has a link labelled "Help" that navigates to `#/help` in one interaction.
- The page has headings for Ultimate, Cube and Setup options, in that order, as real heading elements. Content covers goal, turn flow, special rules, end of game, and the effect of size, win length and notation.
- A Back control returns to the previous screen. Opening or leaving help never changes a game in progress.
- Works offline after first load; included in the precache list.

## Look and feel

- All colours come from tokens in `theme.css`; a script check fails on colour literals elsewhere.
- No user-visible text (labels, help, tooltips, aria-labels, page title, manifest), palette id, CSS class, custom property or source identifier names the flagrant or tictactoe-game projects. The reference projects appear only in spec documents and in code comments that cite the source of a value. A script check greps `src/` and `site/` and fails on either name outside comments.
- Light and dark values equal flagrant's (see [research.md R12](../research.md)); the contrast of every text and background pair meets the accessibility minimum.
