# UI Contracts: PWA Design Rework

Every component follows `docs/pwa-design-spec.md` sections 1 to 8. This file names which components each screen uses and spells out the domain components. Where a core component is used unchanged, the design spec entry is the contract.

## Core components used

| Component | Where | Notes |
|---|---|---|
| Skip link | Every page | First focusable; jumps to `#main`. |
| Topbar | Every page | Mark (24 to 32 px, unthemed), title in `display` 800, nav, theme icon button. Inside a game, replay or help the first nav item is a `back` icon button. Active nav has `aria-current="page"`. |
| IconButton | Top bar, boards, replay, palette | 42 px, hit area extended to 44, `aria-label`. |
| Button | Setup, results, dialogs | One primary per view. Destructive (resign, forget game) is `error` text with a 14% tint on hover. |
| Segmented toggle | Setup (mode, opponent, who starts), theme modal | `role="radiogroup"`, `aria-checked`, 2 to 4 options. |
| Chip | Setup options with many choices (variant rules), hint toggles | `aria-pressed`. |
| Text field | Join code, names | 16 px, 1 px `edge` border, placeholder `muted-strong`. |
| Banner | Errors, offline multiplayer, waiting, thinking | Status colour on a 14% self tint with an icon. Error is `role="alert"` and says what to do. Busy uses the pulsing `busy` dot. |
| Toast | "Copied", "Link copied" | `role="status"`, pill, short. |
| Modal / sheet | Settings, theme, confirm, pairing, share | Native `<dialog>`; bottom sheet under 640 px, centred above; closes by button, Escape, backdrop; locks body scroll. |
| Theme modal | Opened from the top bar | Light, Dark, System. Pressed state from the **preference**. With System pressed, a note: "Following your device. Currently dark." Never closes on choose. |
| Update bar | Above the top bar | "A new version is ready." plus Update. State saved first; never automatic. |
| Progress pips / pill | Game screen, replay | Pill keeps its two-segment shape and scores in Twist; pips only where a count of steps exists (replay). Always paired with text. |
| Result | End of game | Verdict in `reveal` with a `check` icon in `ok` when won, one line of detail, next action. Plain wording: "X won.", "It was a draw." |
| Share card | End of game | Score in `reveal`, copy button, "Copied" toast. Copied text may use emoji. |

## Domain components

### Boards (Classic, Ultimate, Twist cube)

- Cells are `surface-strong` controls inside a `.glass` board card. No glass on a cell.
- X and O are drawn with `--mark-x` and `--mark-o` exactly, with distinct shapes and no opacity. Every palette reaches 3:1 on the page, a card, a control and every face in both modes (unit-tested), so a mark needs no rim; the shapes that can be white or black (claimed boards, cube faces) carry the 1.5 px `rim`.
- Neighbouring cells, small boards and cube faces are separated by a 2 px `seam` (the `page` colour).
- Playable targets use `brand-fill` plus a visible outline, never colour alone. Last-move uses the inset border from 005.
- Claimed small boards show the owner's shape large and a hatch or outline, plus an `aria-label` ("Won by X").
- Twist faces use `face-0..5` unthemed with a rim. Locked faces carry the `lock` icon and a name in their accessible label.
- Each board has an `aria-label` summarising the position or a text alternative reachable from the status line.

### Setup card

- One `.glass` card per section (mode, opponent, rules), heading style `heading`, `brand-ink`.
- Mode and opponent are segmented toggles. Rule options with more than four choices are chips.
- Exactly one primary button: "Start game" (or "Join" in the pairing flow).

### Multiplayer pairing

- Code shown in `reveal` with `tabular-nums`; QR in `qr-bg`/`qr-fg` on a ring.
- Offline: banner "You are offline. Check your connection to play online." with local play still available.

### Replay controls

- IconButtons for back, play/pause, forward at 44 px hit areas, a position readout in `body-sm` ("Move 7 of 23"), a slider with a 3:1 track and fill.

### Palette picker (Settings)

- List of rows in `surface-strong`; the selected row is `brand-fill` with a `check` icon and the word "Selected". Each row shows live X and O samples in their exact colours.

## Behaviours

- **Open and close**: one class flip; timing in CSS (150 to 220 ms). Reduced motion collapses durations to `0.001ms`, so `transitionend` still fires. Computer think delay and auto-advance are not animation and are unchanged.
- **Mode change by OS**: only the colour transition runs; focus does not move.
- **Focus**: `2px solid var(--brand-ink)`, offset 2 px, on `:focus-visible` for every focusable element.
- **Live regions**: status line `aria-live="polite"`, errors `role="alert"`, toasts `role="status"`, clocks `role="timer"`.
- **Layout**: one 720 px column, one 480 px breakpoint, safe-area padding, no horizontal scroll at 320 px.

## Copy rules for this feature

Sentence case, British spelling and number format, no exclamation marks, no emoji (share text excepted), no em dashes. Errors say what to do next. Locked things say when they open.
