# Contract: UI behaviour

Observable behaviour, testable in Playwright unless marked unit.

## Setup screen

- Choosing a size sets win length to 3 (3×3) or 4 (4×4, 5×5) in every variant. Choosing the already-selected size changes nothing. A pasted seed or remembered setup keeps its own values (FR-019 to FR-021).
- With Cube selected, two checkboxes appear: "Lock scored faces" and "Count faces, not lines", both unchecked by default and remembered. They are hidden for Classic and Ultimate.

## Cube game screen

- The score label reads "Lines" or "Faces" per the scoring mode; the result text, move list and replay match.
- With the lock on, a locked face shows a pattern and a "Locked" label on the face (3D, flat view) and each of its empty stickers is `aria-disabled` with "locked face" in its name. Pressing one shows the refusal message instead of placing.
- Hints skip locked faces.
- When the lock ends the game, the status line says why ("No open face left to play on").

## Turn picker

- Selecting another direction on the previewed layer turns the layer straight to the new position (no pass through the original). Selecting another layer reverses the first, then turns the second. Cancel returns the layer to the original by the shortest way.
- Hovering or focusing a layer's name, row or turn buttons highlights that layer in 3D and flat views, with no preview. On touch, tapping the layer name highlights it (no preview) until another name is tapped or the turn is cancelled or confirmed; tapping a turn button previews it. The highlight is continuous through select, preview, change and hold; it clears when the pointer or focus leaves and nothing is held.
- Layer names follow [core-api.md](core-api.md) (notation) in controls, captions, move list and replay.

## Help

- Help text describes both options and inner-layer naming on 4×4 and 5×5, naming the convention (single layer, depth from the nearer face, M/E/S for the middle of odd cubes, no wide turns).
