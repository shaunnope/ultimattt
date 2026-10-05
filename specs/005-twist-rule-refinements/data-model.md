# Data Model: Twist Mode Display Polish and New Logo

No stored data changes: saves, replay records, links, seeds and protocol messages are untouched (FR-017). Everything below is derived at render time.

## PillModel (derived, not stored)

| Field | Type | Rule |
|---|---|---|
| `segments` | `[Segment, Segment]` | Always X first, O second, on every device |
| `Segment.mark` | `"X" \| "O"` | |
| `Segment.active` | boolean | True for the player to move while the game is playing; stays on the same player through a Twist scoring placement and its layer turn |
| `Segment.winner` | boolean | True for the winner when the game is over; false for both on a tie or draw |
| `Segment.score` | `number \| undefined` | Present only for Twist (`state.scores`); absent for Classic and Ultimate |
| `Segment.you` | boolean | Two-device or computer: this device's / the human's mark |
| `spoken` | string | e.g. "O to move, X 2, O 1"; Classic: "X to move"; over: "X wins, X 3, O 1" |

State transitions: place → turn passes (highlight moves); Twist scoring place → same mover, `phase: rotate` → rotate confirmed → turn passes; game over → highlight cleared, winner marked.

## LastPlaced (derived)

| Field | Type | Rule |
|---|---|---|
| index | `number \| null` | Sticker index `face*n² + cell` of the latest placement after every later layer turn is applied via `rotateTable`; `null` if no placement yet |

Recomputed from `state.moves` on every update (play, undo, load, replay step).

## StatusText (changed)

Returns non-empty text only for: result, resignation, two-device waiting, Twist rotate prompt, Ultimate where-to-play, computer thinking. Plain "X to move" / "Your move (X)" return `""`.

## Logo assets

| Asset | Source | Used by |
|---|---|---|
| `site/icons/logo.svg` | hand-written | header and start screen (inline), favicon |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | `make-icons.mjs` | manifest, page head |
| `icon-maskable-512.png` | `make-icons.mjs`, padded 20% | manifest |
