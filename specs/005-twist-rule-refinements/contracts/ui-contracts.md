# UI Contracts: Twist Mode Display Polish and New Logo

Observable hooks that tests and users rely on. Stored identifiers (the `"cube"` variant id, link and save formats) are unchanged.

## Current-player pill (all modes)

- Element `#turn-pill`, `role="group"`, `aria-label="Current player"`, placed between the game head and the board.
- Two children `[data-mark="X"]` and `[data-mark="O"]`, in that order on every device. Each holds the mark SVG and, in Twist only, a `.pill-score` number.
- The mover's segment has `aria-current="true"` and `data-active`. When the game is over neither has it; the winner has `data-winner` and a visible "Winner" text cue (not colour alone).
- A `.pill-thumb` highlight slides under the active segment (`transform`), with no transition under `prefers-reduced-motion`.
- Not focusable, not clickable.
- Never contains the words "Lines" or "Faces".
- Spoken text goes through the existing `announce()` live region: "O to move, X 2, O 1" (Twist) or "O to move" (other modes).
- Two-device and computer games mark the local segment with a visible "You" caption; segment order is unchanged.
- Replay: the `#turn-pill` in the replay view follows the shown position.

## Status line

- `#game-status` stays (live region). Empty and hidden for a plain turn.
- The same rule applies to the replay view's status line.
- Shown for: results ("X wins!", "It's a draw.", "It's a tie." plus lock note), "Y resigned. Z wins.", "Waiting for your friend (O).", "X scored! Turn a layer of the cube.", Ultimate where-to-play, "Computer is thinking…", and errors.
- `#cube-score` is removed.

## Twist locked face

- `.face-locked-label` contains an SVG `.lock-icon` (padlock, round caps) only, `aria-hidden="true"`, with no text at all. The locked state is announced via the stickers' accessible names.
- Hidden when the face is not locked. Stickers keep `data-locked="true"` and their "locked face" aria-labels.
- Visible in 3D (turns with the face, `backface-visibility: hidden`) and in flat view.

## Twist last-move indicator

- Zero or one sticker has `data-last`: none before the first placement.
- Style: full inset ring, distinct from the `data-locked` hatch, `data-line` and hint styles; outline fallback in forced-colours.
- Follows the mark through layer turns; undo and replay stepping recompute it.

## Logo and icons

- Header: inline SVG `.app-logo` (`aria-hidden`, beside the `h1` text) using `currentColor` plus accent tokens; passes `check-theme-tokens`.
- `site/icons/logo.svg` and the four PNGs exist, are in `precache.json`, and are referenced by `manifest.json` and `index.html`.
- All strokes: `stroke-linecap="round" stroke-linejoin="round"`.
