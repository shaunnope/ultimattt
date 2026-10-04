# UI Contracts: Twist-Tac-Toe Rename and UI Polish

The app exposes no network API. These are the contracts between the pure helpers and the screens, and what a player or test may rely on.

## 1. Names

- `variantName("cube", "full")` → `Twist-Tac-Toe`; `variantName("cube", "short")` → `Twist`.
- Short form: picker button, status where space is tight, game title, move list heading. Full form: help title, page title, manifest, share text.
- No visible text, including `aria-label`, may use "Cube" as the mode name. Allowed: "the cube" for the shape and the settings option text "Cube notation (R, U', F2, 2L)".
- Unchanged and relied on by old links: `config.variant === "cube"`, seed letter, record variant id, protocol fields, saved `cubeNotation` setting value `"cube"`.

## 2. Replay move list

Each `<li><button class="move-item">` shows `label` and has `aria-label = name`.

| Situation | Visible label | aria-label |
|---|---|---|
| Classic, move 3, row 2 col 3 | `3. 2c3` | `Move 3, X, row 2, column 3` |
| Ultimate, move 4 | `4. <board name> 1c2` | `Move 4, O, <board name>, row 1, column 2` |
| Twist, move 5, top face, row 1 col 2 | `5. U1c2` | `Move 5, X, top face, row 1, column 2` |
| Twist turn | `6. <turn text in chosen style>` | `Move 6, X, <turn in words>` |

Never in a label: the mover mark. `aria-current="step"` behaviour is unchanged.

## 3. Replay view turn (Twist, 3D)

On `board.update(state)` in a read-only Twist board:

1. If the last move is not a placement, or flat view is on, or the face is in view (`faceInView`): show the state immediately (turns animate as today).
2. Otherwise: turn the view to the face (`turnToFace`), then show the state with the new mark highlighted.
3. A newer `update` before the turn settles cancels step 2's final show; the newest state wins and its own rules (1 or 2) apply.
4. Reduced motion: the view is set to the face without animation, then the state is shown.
5. Duration `min(350 ms, 0.6 × replay step)`; replay at every speed remains at least one frame per step.

`faceInView(rx, ry, face)` → boolean, pure; true when the face normal's depth component is ≥ 0.4.

## 4. Status and score

Status line (`#game-status`, live region as today): sentences per the table in research R6, one source of truth in `statusText`. Result sentences keep today's text.

Twist score row (`#cube-score`, `aria-live="polite"`): visible `Lines · X: 0 · O: 0`, each player preceded by their mark drawn by the shared mark renderer (decorative, hidden from assistive technology), so the text reads as written. Label follows the scoring mode (`Lines` or `Faces`). Not colour-only: the player is identified by mark shape and letter.

## 5. Help page

- Section order: Classic rules, Ultimate, Twist-Tac-Toe, Setup (`#help-classic`, `#help-ultimate`, `#help-cube`, `#help-setup`).
- Classic rules states: goal; alternating turns, X first; draw on a full board with no line; lines are rows, columns and both diagonals; default win length 3 on 3×3 and 4 on 4×4 and 5×5; win length is adjustable in setup where offered.
- At least one example per block of kind `example` with a non-empty `alt`.
- Layout: reading column no wider than about 42 rem, side gutter at least 1 rem (plus safe-area insets), even vertical spacing between sections, no horizontal scroll at 320 px, correct in light and dark, all controls keyboard reachable with visible focus.
