# Data Model: Twist-Tac-Toe Rename and UI Polish

No persisted data changes. Save schema, record/seed format and protocol are untouched; the `Variant` id `"cube"` is unchanged. Everything below is derived display data.

## ModeName

| Field | Type | Notes |
|---|---|---|
| variant | `"classic" \| "ultimate" \| "cube"` | stored id, never renamed |
| full | string | `Classic`, `Ultimate`, `Twist-Tac-Toe` |
| short | string | `Classic`, `Ultimate`, `Twist` |

`variantName(variant, form)` is total over the three ids.

## MoveLabel

Produced by `describeMove(config, move, mover, n, notation)`.

| Field | Type | Rule |
|---|---|---|
| label | string | `n. AcB` (Classic), `n. <board> AcB` (Ultimate), `n. UAcB` (Twist placement), `n. <turn text>` (Twist turn) |
| name | string | words only, includes mover, e.g. "Move 5, X, top face, row 1, column 2" |

Validation: `A` = row 1..size, `B` = column 1..size, from 1; `U` is one of `U D F B L R` (face index 0..5 in that order).

## FaceLetter

`FACE_LETTERS = ["U", "D", "F", "B", "L", "R"]`, index-aligned with `FACE_NAMES` (`top, bottom, front, back, left, right`).

## ViewState (derived, replay only)

| Field | Type | Notes |
|---|---|---|
| rx, ry | degrees | current view angles (existing) |
| flat | boolean | flat view shows every face |
| target face | 0..5 \| none | last move's face when it is a placement |

Rule: `needsTurn = !flat && lastMove.t === "place" && !faceInView(rx, ry, lastMove.face)`.

State transitions for one replay update: `idle → (needsTurn ? turning → settled : settled) → mark shown`. A newer update (jump, step, speed change) increments `generation`; a pending `turning` result is discarded.

## StatusContext

Input to `statusText`: `{ variant, phase, toMove, mode: "one-device" | "computer" | "two-device", humanMark?, myTurn?, result?, resigned?, lockNote? }`. Output: a single sentence string. No state is stored.

## ScoreDisplay (Twist)

| Field | Type |
|---|---|
| label | `"Lines" \| "Faces"` (from `scoreLabel(scoring)`) |
| x, o | non-negative integers |

## HelpSection (extended)

`HelpSection.id` gains `"classic"`. Order: `classic`, `ultimate`, `cube`, `setup`. Blocks use existing kinds; each `example` carries `title`, `alt` and `boards`.
