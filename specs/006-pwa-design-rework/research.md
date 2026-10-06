# Research: PWA Design Rework

No NEEDS CLARIFICATION remained in the spec. The items below are the design choices the plan depends on.

## R1. Theme preference storage and migration

- **Decision**: New key `ttt.mode` holds `light|dark|system`. `save.settings.theme` keeps `auto|light|dark` (no save schema change) and maps `auto` to `system` at the UI boundary. On load, if `ttt.mode` is absent and `ttt.theme` is present, copy (`auto` to `system`), then remove `ttt.theme`. The pre-paint script reads `ttt.mode`, falling back to `ttt.theme`, so the first post-update paint is already correct.
- **Rationale**: Keeps FR-022 (saves unchanged) and FR-003 (no flash). The mirror-key pattern already exists (`applyTheme` writes `ttt.theme`).
- **Alternatives**: Bumping the save schema to rename `auto` (rejected: touches saves, links and compat tests for no user benefit). JS-only migration (rejected: one flash).

## R2. Resolving mode in CSS

- **Decision**: CSS selects on `data-mode` only; JS resolves `system` and subscribes to `prefers-color-scheme` permanently. `data-mode-preference` is state for the UI only.
- **Rationale**: Design spec section 2.1. Current code already resolves in JS; only attribute and value names change.
- **Alternatives**: `@media (prefers-color-scheme)` rules (rejected: duplicates the dark block and can disagree with a pinned choice).

## R3. Token layer and migration

- **Decision**: Rebuild `theme.css` from design spec Appendix A. Apply the migration table: `--fg` to `--ink`, `--accent` as text to `--brand-ink`, `--accent` as fill to `--brand-fill` with `--on-brand`, `--border` on inputs to `--edge`, other borders to `--surface-border`, `--success` to `--ok`, `--scrim` to `--backdrop`, radii to the ladder. Keep game tokens as fixed-meaning: `--mark-x`, `--mark-o` (palette-driven), `--face-0..5`, `--qr-bg`, `--qr-fg`, plus `--claim-x/o` derived from marks.
- **Rationale**: One theme file, enforced by `check-theme-tokens`. Derived claims stay derived.
- **Alternatives**: Keeping old token names as aliases (rejected: leaves two vocabularies; the check script would not catch drift).

## R4. Contrast matrix

- **Decision**: `scripts/lib/colour.mjs` parses hex, `rgba()` and `color-mix(in srgb, A p%, B)`, composites alpha over a given backdrop, and returns WCAG ratios. `scripts/contrast-pairs.json` declares pairs as `{ fg, bg, min, why }` with backgrounds being the layer stack (for example `ink` on `surface-strong` over `surface` over `page`). The script reads `theme.css`, evaluates each pair in light and dark, fails below 4.5 (text) or 3 (edge, focus, bar, icon).
- **Rationale**: The design spec lists this as "to add"; tokens contain translucent surfaces, so naive hex comparison is wrong and compositing is required. A small resolver keeps it dependency-free (Simplicity).
- **Alternatives**: Relying on Lighthouse and axe only (rejected: they sample rendered pages, not every declared pair, and miss states not on screen). A library such as `colorjs.io` (rejected: dependency for about 80 lines).
- **Known risk**: design spec notes `muted` is about 3.6:1 on `surface-strong` in dark; the pair list therefore uses `muted-strong` there and the check proves it.

## R5. Manifest colours

- **Decision**: `theme_color` and `background_color` equal the light `page` token, computed as `mix(brand 10%, bg)` in sRGB (about `#f3f2f0`). A contract test derives it from `theme.css` and compares. The runtime `<meta name="theme-color">` is set from the resolved mode's page colour (dark about `#252830`).
- **Rationale**: Design spec section 10. Today the manifest uses the old `bg` (`#faf8f3`).
- **Alternatives**: Hard-coding in two places with no test (rejected: drifts).

## R6. Modal as sheet

- **Decision**: Keep native `<dialog>`. Under 640 px it anchors to the bottom with a slide-up over `duration-open`; from 640 px it is centred. Closing animates over `duration-close` by a class flip, then `close()` on `transitionend` (which still fires under the reduced-motion `0.001ms` rule).
- **Rationale**: Design spec prefers native dialog; focus trapping, Escape and top layer come free. Body scroll lock via `body.modal-open`.
- **Alternatives**: Custom div modal (rejected: re-implements focus handling).

## R7. Hit areas

- **Decision**: Visual sizes follow the spec (42 px icon button, 30 px chip); a `::after` inset extends the hit area to 44 px where the visual is smaller. A Playwright audit measures every interactive element's bounding box plus pseudo-element extent at 320 and 720 px.
- **Rationale**: MUST in design spec section 4; automated so it does not regress.
- **Alternatives**: Making everything 44 px visually (rejected: chips at 44 px crowd the setup card on 320 px).

## R8. Content colour rendering

- **Decision**: Marks, claimed-board fills and cube faces use their tokens with no opacity. A 1.5 px rim in `edge` outlines each content shape; neighbouring cells and faces are separated by a 2 px `seam` (the `page` colour). Won and claimed boards retain their existing shape or pattern cues.
- **Rationale**: Design spec 2.5; satisfies the "state not colour alone" rule already met by distinct X and O shapes.
- **Alternatives**: Themed face tints per mode (rejected: spec says fixed-meaning tokens are never themed; see Complexity Tracking for the mark exception).

## R9. Web font

- **Decision**: Google Fonts stylesheet loaded non-blocking: `<link rel="stylesheet" media="print" onload="this.media='all'">` plus a `<noscript>` plain link, `display=swap`, with `preconnect`. A blocking link would let a slow third party delay first paint (SC-007). Fallback `"Segoe UI", system-ui, sans-serif`.
- **Rationale**: Matches the design spec exactly; no precache impact.
- **Alternatives**: Self-hosting (see Complexity Tracking).
