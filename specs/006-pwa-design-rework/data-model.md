# Data Model: PWA Design Rework

No game data, save format or protocol changes. The only persisted data touched is the theme preference.

## ModePreference

| Field | Type | Notes |
|---|---|---|
| value | `"light" \| "dark" \| "system"` | Stored under `ttt.mode`. Anything else reads as `system`. |

**Resolution**: `resolveMode(pref, prefersDark) -> "light" | "dark"` (pure). `light` and `dark` return themselves; everything else follows `prefersDark`.

**Mirrors**:
- `save.settings.theme` (`"auto" | "light" | "dark"`): durable copy inside the saved game blob. Mapping: `auto <-> system`.
- `<html data-mode>`: always resolved (`light|dark`). CSS selects on this only.
- `<html data-mode-preference>`: `light|dark|system`. UI state only.
- `<meta name="theme-color">`: resolved mode's `page` colour.

**Transitions**:
1. First load, nothing stored: preference `system`.
2. First load after update, `ttt.theme` present: copy to `ttt.mode` (`auto` becomes `system`), remove `ttt.theme`. The pre-paint script already honoured it.
3. Player picks a mode in the theme modal: write `ttt.mode`, update `save.settings.theme`, set both attributes and the meta colour, keep the modal open.
4. OS scheme changes while preference is `system`: re-resolve, set `data-mode` and meta colour, no focus move.
5. Storage unavailable: choice lives in memory for the visit; no error shown.

## DesignToken

| Field | Notes |
|---|---|
| name | Keeps the design spec role names (`ink`, `surface-strong`, `brand-ink`, `edge`, ...). |
| kind | `themed` (differs by mode), `derived` (same rule both modes), `fixed` (content; never themed). |
| light, dark | Values for themed tokens. |

**Fixed tokens for this project**: `mark-x`, `mark-o` (set from the chosen palette at runtime, with a light and dark variant per palette), `face-0..5`, `qr-bg`, `qr-fg`.

## ContrastPair (declared in `scripts/contrast-pairs.json`)

| Field | Notes |
|---|---|
| fg | Token name. |
| bg | Ordered layer stack of token names, bottom first (for example `page, surface, surface-strong`). |
| min | `4.5` for text, `3` for edges, focus rings, bar fills and meaningful icons. |
| why | Short label for failure output. |

**Rule**: for each pair and each mode, composite the stack, then ratio of fg over the result must be at least `min`.

## ComponentSet

Not stored. Listed in `contracts/ui-contracts.md`.
