# PWA Design Spec

A portable design and shell spec for small, installable, offline-first web apps (games and tools). Copy this file into a project, fill in the Project Profile, and point the constitution and every `plan.md` at it.


Keywords: **MUST** is enforced by a check or a release gate. **SHOULD** is the default, and you need a reason to depart from it. **MAY** is optional.

---

## 0. Project Profile (fill in per project)

| Slot | What to decide |
| --- | --- |
| `APP_KEY` | Storage prefix for every key |
| Content colours | The colours that *are* the content, drawn exactly and never themed |
| Domain components | Components only this app has |
| Network features | Anything that needs the network, so it can degrade |

**Constant across projects (not Profile slots):** `brand-ink` (cobalt `#3149c4` light, `#b3c3ff` dark), the typeface (Nunito, 400/600/700/800) and the copy locale (British spelling and number format).

---

## 1. Non-negotiables

1. **Content colours are drawn exactly.** Data that is colour (flags, player marks, categories) uses its own hex. Never a token, tint or opacity. These colours are the only literal colours allowed outside the theme file, and each one is listed as a fixed-meaning token.
2. **The interface recedes.** Chrome uses pale fills, paper, ink and one accent foreground. No saturated UI fill sits next to content colours. Status colours stay away from the content area.
3. **Flat page.** The background is one flat colour: `page = color-mix(in srgb, var(--brand) 10%, var(--bg))`. No gradients, orbs or blobs.
4. **Three surface levels.** `page`, then `.glass` cards (`surface`), then controls inside a card (`surface-strong`). Never put glass on glass.
5. **No colour literal outside the theme file** (MUST, `check-theme-tokens`). The only exceptions are the fixed-meaning tokens, which are still defined in the theme file.
6. **One typeface (Nunito), set once on `*`.** No `font-family` on components. Weights 400, 600, 700 and 800 only.
7. **No emoji in the interface.** Icons are inline SVG. Text copied out to other apps (share text) MAY use emoji.
8. **No em dashes** in UI copy, comments or docs.
9. **System is the default mode.** A first visit follows `prefers-color-scheme`, live. Choosing Light or Dark pins it until the person chooses System again.
10. **Everything that opens, closes or switches animates** over 150 to 220ms and respects `prefers-reduced-motion`.
11. **State is never colour alone.** Every status, score, owner or category also carries a word, a shape or a pattern.
12. **AA in every combination** (MUST): 4.5:1 for text, 3:1 for field edges, focus rings, bar fills and meaningful icons, checked in both modes.

---

## 2. Colour

### 2.1 Two themes

There is one light theme and one dark theme. No other colour themes or swatches.

| Attribute on `<html>` | Values | What it moves |
| --- | --- | --- |
| `data-mode` | `light` or `dark` (always resolved) | Every surface, text and status token |
| `data-mode-preference` | `light`, `dark` or `system` | Nothing in CSS. Records the choice for UI state |

CSS selects on `data-mode` only. Something in JS, never CSS, resolves `system`. Both modes are measured.

### 2.2 Token roles

Keep these names so the components, checks and migration maps carry across projects.

| Token | Role | Baseline light | Baseline dark |
| --- | --- | --- | --- |
| `bg` | Page base before tint. Never painted on its own | `#f6f4ee` | `#121419` |
| `page` | Body background (derived) | `mix(brand 10%, bg)` | same rule |
| `surface` | `.glass` fill: cards, topbar, panels | `rgba(255,255,255,.58)` | `rgba(255,255,255,.06)` |
| `surface-strong` | Controls in a card: buttons, chips, inputs, rows, modals | `rgba(255,255,255,.82)` | `rgba(255,255,255,.11)` |
| `surface-border` | Decorative hairline. Never the only edge of a control | `rgba(255,255,255,.65)` | `rgba(255,255,255,.14)` |
| `ink` | Primary text | `#1a1a1a` | `#f0f0f2` |
| `muted` | Secondary text on `page` and `surface` | `#5c5a54` | `#a3a7b2` |
| `muted-strong` | Secondary text on `surface-strong` (derived) | `mix(ink 70%, transparent)` | same rule |
| `brand` | Pale accent tint. Only used as an ingredient | `#d4ddff` | `#d4ddff` |
| `brand-ink` | Links, nav, card headings, focus ring | `#3149c4` | `#b3c3ff` |
| `on-brand` | Text on brand fills, in both modes | `#1a1a1a` | `#1a1a1a` |
| `brand-fill` | Primary button, active segment, highlighted row (derived) | `mix(brand 55%, surface-strong)` | same rule |
| `brand-fill-strong` | Hover above `brand-fill`, the success row, the active tile (derived) | `mix(brand 75%, surface-strong)` | same rule |
| `edge` | Any boundary that must be seen, at 3:1 or more (derived) | `mix(ink 50%, transparent)` | same rule |
| `backdrop` | Modal scrim | `rgba(14,16,22,.35)` | `rgba(0,0,0,.5)` |
| `ok` | Success | `#17733a` | `#4ade80` |
| `warn` | Warning | `#9c4a06` | `#fbbf24` |
| `error` | Error | `#b8232b` | `#ffa4a4` |
| `busy` | In-progress dots. 3:1, never body text | `#5f6b7d` | `#94a3b8` |
| `track` | Empty part of any bar or progress (derived) | `mix(ink 12%, transparent)` | same rule |

**Fixed-meaning tokens** (per project, never themed): content colours, category dots, `heart`, `qr-bg`/`qr-fg`. Prefix them by family (`hue-*`, `mark-*`, `face-*`). When a fixed colour can vanish on a surface (white on light glass, black on dark), give it a 1px ring of `mix(ink 30%, transparent)`.

### 2.3 Pairing rules

- Body text: `ink` on `page`, `surface` or `surface-strong`.
- Secondary text: `muted` on `page` and `surface`, and `muted-strong` on `surface-strong`. In the baseline, `muted` drops to about 3.6:1 on a strong surface in dark mode.
- Text on any brand fill is `on-brand`, never `brand-ink`.
- `brand-ink` is a separate, deeper colour than `brand`, because a pastel foreground cannot reach 4.5:1 on a pale ground.
- Status as text goes on a surface, or on a 14% tint of itself: `color-mix(in srgb, var(--error) 14%, transparent)`. A solid status fill takes `bg`-coloured text.
- Replace opacity-dimmed text (`opacity: .7`) with `muted` or `muted-strong`. Disabled controls are the one exception, at 60% opacity.

### 2.4 Score and band pattern (any graded result)

Show a grade three ways at once: the number, a bar and a word.

| Band | Bar fill | Word colour |
| --- | --- | --- |
| Exact | row on `brand-fill-strong` | `on-brand` |
| High | `ok` | `ok` |
| Middle | `warn` | `warn` |
| Low | a neutral slate, 3:1 on `track` | `muted-strong` |

### 2.5 Drawing content colours

- Separate neighbouring content colours with a 2px **seam** in `page`, so two similar neighbours still read as two.
- Outline every content shape with a 1.5px **rim** in `edge`, so a white shape on light glass or a black shape on dark keeps its outline.
- Pin any chart library's surface and text variables to `page` and `ink`, so it follows `data-mode` rather than the OS.

---

## 3. Typography

One family, Nunito, loaded from Google Fonts at 400/600/700/800 with `display=swap` and a `"Segoe UI", system-ui, sans-serif` fallback. Hierarchy comes from weight as much as size.

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| `display` | 32/36 | 800 | App title, once per screen |
| `reveal` | 24/30 | 700 | The outcome line, session score. `brand-ink` |
| `heading` | 18/24 | 700 | Card, modal and panel titles. `brand-ink` |
| `body-lg` | 16/22 | 400 | Text inputs and their dropdowns. **Never under 16px on an input** (iOS zoom) |
| `body` | 15/21 | 400 | Status, hints, help. Button labels at 600 |
| `body-sm` | 14/20 | 400 | Dense rows and lists |
| `label` | 13.5/18 | 600 | Nav, chips, segments, section labels |
| `caption` | 12.5/16 | 600 | Tags, percentages, footer. **Nothing smaller** |

- Figures that line up (scores, clocks, counts) use `font-variant-numeric: tabular-nums`, right-aligned (a `.num` utility).
- Use no weight under 400. Light weights fall apart on glass.

---

## 4. Space, shape, layout

**Spacing** (px): 4 (toggle inset, chip gap), 6 (gap between chips, segments and rows), 8 (icon to label, row padding), 10 (page padding under the breakpoint), 12 (gap between page sections), 14 (page padding), 18 (card and modal padding), 24 (gap between major blocks in a card).

**Radii ladder:** `radius-content` 4 (images of content), `radius-seg` 10, `radius-btn` 12 (buttons, fields), `radius-control` 14 (icon buttons, toggle tracks, rows, dropdown), `radius-card` 16, `radius-glass` 20 (glass, modals), `radius-pill` 999.

**Layout:**
- One page column, `max-width: 720px`, centred, flex column with 12px gaps.
- **One** breakpoint, `max-width: 480px`, where padding drops to 10px and dense rows stack.
- Modals are bottom sheets on phones and centred from 640px.
- Pad with `env(safe-area-inset-*)` and set `viewport-fit=cover`.
- No horizontal scroll at 320px wide.
- **Touch targets: at least 44 × 44px hit area** (MUST). The visual may be smaller (a 42px icon button, a 30px chip) only if padding or a pseudo-element brings the hit area up to 44px.

---

## 5. Elevation

```css
.glass {
  background: var(--surface);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-glass);
  box-shadow: var(--shadow-glass);
}
```

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `shadow-glass` | `0 10px 30px rgba(22,26,40,.10)` | `0 10px 34px rgba(0,0,0,.5)` | Glass, dropdowns |
| `shadow-lift` | `0 4px 16px rgba(22,26,40,.18)` | `0 4px 16px rgba(0,0,0,.45)` | A revealed content image lifted off a card |

Tint shadows towards the product's ink, never towards a hue.

---

## 6. Motion

| Token | Value | Use |
| --- | --- | --- |
| `duration-quick` | 150ms | Hover, press, colour changes |
| `duration-open` | 220ms, `ease-out` | Modal, dropdown, panel and reveal entrances |
| `duration-close` | 180ms | Exits run a little faster than entrances |
| `duration-bar` | 300ms | A bar growing to its value. The only motion over 220ms |
| `ease-out` | `cubic-bezier(.2,.8,.2,1)` | Entrances |

- Show and hide are one class flip in JS. Timing lives in CSS.
- The global reduced-motion rule sets animation and transition durations to `0.001ms`, so `transitionend` and `animationend` still fire.
- Game timing (auto-advance, AI think delay) is not animation and stays under reduced motion.
- A mode change triggered by the OS never moves focus or animates beyond the colour transition.

---

## 7. Iconography

- Inline SVG on a 24px grid with a 2px stroke, round caps and joins, `currentColor`, `fill="none"` and `aria-hidden="true"`.
- One module exports `icon(name): string`, so it works in any framework.
- The container sets the size: 20px in icon buttons, 16px in buttons, chips and segments, 18px in list rows.
- The button or row carries the accessible name, never the icon.
- **Core set** that every app ships: `sun moon system close back search help info palette share copy check cross timer lock flag heart`. Add domain icons in the same style. Give each recurring concept (each hint type, each mode) its own icon.
- **Mark or logo:** used as is at 24 to 32px beside the title and as the favicon. Its colours belong to the mark and do not theme. There is no separate wordmark: set the name in the family at 800.

---

## 8. Core components

These are the shared library. Each entry gives the anatomy, the tokens and the accessibility contract. Domain components (charts, boards, guess lists) are written per project, but they MUST follow sections 1 to 7.

| Component | Contract |
| --- | --- |
| **Topbar** | `.glass` bar with mark, title, nav and theme button. Nav links are `brand-ink` at `label` size with a pill hover in `surface-strong`. The active link has `aria-current="page"` and is styled `brand-fill` / `on-brand`. Inside a task, the first nav item becomes a `back` icon button. |
| **IconButton** | 42px square (34px `.small`), `surface-strong` with a hairline and a 1px lift on hover. It needs an `aria-label`. |
| **Button** | `radius-btn`, `body` 600, optional 16px leading icon. *Primary* is `brand-fill`/`on-brand`, and there is **one per view**. *Quiet* is `surface-strong`/`ink`. *Destructive* is `error` text with no fill and a 14% tint on hover. *Disabled* is 60% opacity with a `not-allowed` cursor. |
| **Segmented toggle** | `surface` track with a 4px inset. The chosen segment is `brand-fill`/`on-brand`. Uses `role="radiogroup"` and `aria-checked`. 2 to 4 options. |
| **Chip** | Pill in `surface-strong`. Pressed is `brand-fill` with `aria-pressed`. A count inside is `muted-strong`. |
| **Text field and dropdown** | `surface-strong` with a 1px `edge` border and 16px text. The placeholder is `muted-strong` at `opacity: 1`. The dropdown is `surface-strong` with `shadow-glass`. The keyboard-highlighted row is `brand-fill`. Unavailable rows get a word ("Guessed") plus `aria-disabled`, not opacity alone. |
| **Banner / status line** | Its status colour on a 14% tint of itself, with an icon, at `radius-control`. Error has `role="alert"` and says what to do next. Busy is `surface` with a pulsing `busy` dot. |
| **Toast** | Pill, status colour on its tint, `role="status"`, short ("Copied"). |
| **Modal / sheet** | `.modal-backdrop` over `backdrop` holds a `.modal` in `surface-strong`, 18px padding, max 420px wide and 85vh tall. Bottom sheet under 640px. Closes with the close button, Escape or a backdrop click. Locks body scroll. Prefer the native `<dialog>` where it fits. |
| **Theme modal** | Mode row (Light, Dark, System). The pressed state comes from the **preference**, not the resolved mode. With System pressed, a note says the current mode ("Following your device. Currently dark."). Choosing applies at once and never closes the modal. |
| **Update bar** | Shown when a new service worker is waiting: "A new version is ready." plus an Update button. The person chooses when to update, and state is saved first. |
| **Progress pips** | One pip per step: `ok` done, `edge` missed, `brand-ink` current, `track` to come. Always paired with text ("Round 4 of 10"). A clock chip turns `error` on its tint near zero and gets `role="timer"`. |
| **Result** | Content image (lifted, rimmed, entering over `duration-open`), a verdict in `reveal` with a `check` icon in `ok` when won, one line of detail, then the next action. |
| **Share card** | Score in `reveal`, a grid of squares in `ok`/`error`, and a copy button. The copied text may use emoji. Confirms with a toast. |
| **Skip link** | The first focusable element, visible on focus, jumping to `main`. |

---

## 9. Theme runtime (framework-agnostic contract)

**Storage:** `${APP_KEY}.mode` holds the *preference* (`light|dark|system`), never the resolved mode. Wrap every storage access in try/catch: in private mode the choice lasts for the visit.

**Pure resolver** (unit-tested):
```ts
export function resolveMode(pref: string | null, prefersDark: boolean): "light" | "dark" {
  return pref === "light" || pref === "dark" ? pref : prefersDark ? "dark" : "light";
}
```

**Pre-paint script**, inline in `<head>` before any stylesheet or module, so a dark device never flashes white. It MUST agree with `resolveMode` for every stored value (`check-theme`).
```html
<script>
  (function () {
    var k = "APP_KEY", m = null;
    try { m = localStorage.getItem(k + ".mode"); } catch (e) {}
    if (m !== "light" && m !== "dark") m = "system";
    var r = document.documentElement;
    r.setAttribute("data-mode-preference", m);
    if (m === "system") m = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    r.setAttribute("data-mode", m);
  })();
</script>
```

**Store behaviour:**
- Subscribe to the `prefers-color-scheme` change event all the time, so choosing System takes effect immediately.
- Write both attributes on every change.
- Update `<meta name="theme-color">` to the resolved mode's `page` colour.
- Validate the stored value and fall back to `system`.
- **Migrating an old key:** on first load, copy the legacy value to the new key and remove the old one, so nobody loses their choice.

---

## 10. PWA shell

**Manifest** (MUST, contract test):
- `id`, `start_url` and `scope` are **relative** (`./`), so the site works under a project subpath such as GitHub Pages.
- `name`, `short_name`, `description`, `display: standalone`, `lang`, `categories`.
- `theme_color` and `background_color` are 6-digit hex values matching the light `page` token. A test checks this against the theme file.
- Icons: 192 and 512 `any`, and a 512 `maskable`. All paths relative, all files present and non-empty. Also an `apple-touch-icon` and an SVG favicon.
- Screenshots: one `narrow` and one `wide`, each with a `label` (enables the richer install UI). SHOULD be generated by script.

**`index.html` head order:** charset, title, viewport (`viewport-fit=cover`), description, `theme-color`, manifest, icons, **pre-paint theme script**, `modulepreload` list (generated), stylesheets (theme file first).

**Service worker** (MUST, `check-sw`):
- Versioned cache `${APP_KEY}-${VERSION}`. **Bump `VERSION` whenever a cached file changes** (`check-version` compares an asset hash with a committed lock file).
- `install` precaches the list in a generated `precache.json` (`check-precache`: every emitted file is listed). Fetch with `cache: "reload"`.
- `activate` deletes every older `${APP_KEY}-*` cache, then calls `clients.claim()`.
- `skipWaiting()` **only** from the `message` handler, after the person presses Update. Never automatically.
- `fetch`: GET and same-origin only, cache first. Navigations ignore the query string and fall back to the cached shell. Third-party traffic (brokers, analytics) is never cached.
- Register with a URL relative to the module. Check for updates hourly and on `visibilitychange`. Reload once on `controllerchange`, but not on the first install.
- Registration failure (private window, http) is swallowed. The app still runs online.

**Offline and state:**
- After one load, every core feature works offline (e2e test).
- State persists locally after every meaningful action and survives reload and update.
- A network feature degrades with a banner that says what to do. It never blocks core use.

**Budget:** interactive in under 3s on throttled mobile (slow 4G, 4x CPU), first load. Repeat loads are near-instant. No bundler needed: `tsc` emits ES modules, plus generated preload and precache lists.

---

## 11. Writing

- Sentence case, short declaratives, British spelling.
- No exclamation marks, no emoji, no em dashes.
- Results say what happened plainly: "It was Mauritius." or "The answer was Lithuania."
- Errors say what to do: "Could not load the list. Check your connection and reload."
- Locked or future things say when they open: "Unlocks after the next guess."
- Product names from reference projects never appear in user-visible text (`check-names`). They may appear in comments that cite sources.

---

## 12. Accessibility checklist

- [ ] AA text contrast in both modes. 3:1 for edges, focus, bars and meaningful icons.
- [ ] Focus is `2px solid var(--brand-ink)` with a 2px offset on every focusable element, via `:focus-visible`.
- [ ] Every control is keyboard operable and has an accessible name. Icon-only buttons have `aria-label`.
- [ ] State always has a word, shape or pattern as well as colour.
- [ ] Content visuals (charts, boards) have an `aria-label` or text alternative listing what they show.
- [ ] Live regions: status lines `aria-live="polite"`, errors `role="alert"`, toasts `role="status"`, clocks `role="timer"`.
- [ ] 44px hit areas, 16px inputs, no text under 12.5px.
- [ ] Reduced motion honoured. OS-driven mode changes never move focus.
- [ ] Lighthouse accessibility ≥ 90 and no serious or critical axe violations (release gate).

---

## 13. Enforcement

| Check | Fails when | Reference implementation (ultimattt) |
| --- | --- | --- |
| Theme tokens | A colour literal appears in any stylesheet other than the theme file | `scripts/check-theme-tokens.mjs` |
| Pre-paint parity | The inline script and `resolveMode` disagree for any stored value | `scripts/check-theme.mjs` |
| Service worker rules | `skipWaiting` outside `message`, or no cache cleanup on `activate` | `scripts/check-sw.mjs` |
| Precache coverage | An emitted file is missing from `precache.json` | `scripts/check-precache.mjs` |
| Version bump | Cached assets changed but `VERSION` did not | `scripts/check-version.mjs` + `precache.lock.json` |
| Preload list | The `modulepreload` block is stale | `scripts/gen-preload.mjs --check` |
| Names | A reference project's name is visible to users | `scripts/check-names.mjs` |
| Manifest | Missing fields, absolute URLs, missing icons | `tests/contract/manifest.test.ts` |
| Install, offline, subpath | Not installable, broken offline, broken under `/repo/` | `tests/e2e/installable`, `offline`, `subpath` specs |
| Release gate | Accessibility < 90, axe serious violations, first load ≥ 3s | `scripts/audit.mjs` (CI blocks deploy) |
| **Contrast matrix** (to add) | Any declared pair falls below its ratio in either mode | Not yet implemented. Resolve tokens per mode and assert ratios |

Wire them as `npm run check`, `npm test`, `npm run test:e2e` and `npm run audit`. CI runs all four before publishing.

---

## 14. Adopting this spec

1. Copy this file to `docs/pwa-design-spec.md` and fill in section 0.
2. Add to the constitution under Technical Constraints: *"UI MUST follow `docs/pwa-design-spec.md`. Departures are recorded in the plan's complexity tracking."* Add a design row to each plan's Constitution Check.
3. Start the theme file from Appendix A, setting the fixed-meaning tokens.
4. Copy the icon module, the theme store and the pre-paint script, then replace `APP_KEY`.
5. Copy the check scripts, the manifest contract test and the audit, and add them to CI.
6. In each feature's `contracts/ui-contracts.md`, name the core components used and spell out domain components against sections 1 to 8.

### Migrating from the pre-refinement palette (ultimattt today)

ultimattt's `site/css/theme.css` still uses Flagrant's original tokens. Rename as follows:

| Old | New |
| --- | --- |
| `--fg` | `--ink` |
| `--accent` (as text, links, focus) | `--brand-ink` |
| `--accent` (as a fill) / `--accent-muted` | `--brand-fill` with `--on-brand` text |
| `--accent-contrast` | `--on-brand` |
| `--border` on inputs | `--edge` |
| `--border` elsewhere | `--surface-border` |
| `--surface` (flat card) | `.glass` (`--surface`) / `--surface-strong` |
| `--success #2ecc71` (2:1 on paper) | `--ok` |
| `--scrim` | `--backdrop` |
| `--radius` / `--radius-small` | the radii ladder |
| storage `ttt.theme` = `auto` | `ttt.mode` = `system` (migrate the value) |
| `data-theme-pref` | `data-mode-preference` |

### Flagrant's domain names versus the generic names

This spec generalises a few of Flagrant's flag-specific token names. Flagrant MAY keep its own names as aliases (`--chart-rim: var(--rim)`):

| Flagrant | Generic |
| --- | --- |
| `score-track` | `track` |
| `chart-seam` | `seam` |
| `chart-rim` | `rim` |
| `score-close` / `score-warm` / `score-cold` | band fills in section 2.4 |
| `radius-flag` | `radius-content` |
| `shadow-flag` | `shadow-lift` |

---

## Appendix A: theme file skeleton

```css
@import url("https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap");

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; font-family: "Nunito", "Segoe UI", system-ui, sans-serif; }
html, body { min-height: 100%; }
button { cursor: pointer; border: none; background: none; color: inherit; font: inherit; font-weight: 600; }
button:disabled { cursor: not-allowed; opacity: .6; }
:link, :visited { color: var(--brand-ink); }
.num { font-variant-numeric: tabular-nums; }
:focus-visible { outline: 2px solid var(--brand-ink); outline-offset: 2px; }
[hidden] { display: none !important; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
}

/* mode: surfaces, text, status */
:root, :root[data-mode="light"] {
  color-scheme: light;
  --bg: #f6f4ee; --surface: rgba(255,255,255,.58); --surface-strong: rgba(255,255,255,.82); --surface-border: rgba(255,255,255,.65);
  --brand: #d4ddff;
  --ink: #1a1a1a; --muted: #5c5a54; --brand-ink: #3149c4;
  --ok: #17733a; --warn: #9c4a06; --error: #b8232b; --busy: #5f6b7d;
  --backdrop: rgba(14,16,22,.35); --shadow-glass: 0 10px 30px rgba(22,26,40,.1); --shadow-lift: 0 4px 16px rgba(22,26,40,.18);
}
:root[data-mode="dark"] {
  color-scheme: dark;
  --bg: #121419; --surface: rgba(255,255,255,.06); --surface-strong: rgba(255,255,255,.11); --surface-border: rgba(255,255,255,.14);
  --brand: #d4ddff;
  --ink: #f0f0f2; --muted: #a3a7b2; --brand-ink: #b3c3ff;
  --ok: #4ade80; --warn: #fbbf24; --error: #ffa4a4; --busy: #94a3b8;
  --backdrop: rgba(0,0,0,.5); --shadow-glass: 0 10px 34px rgba(0,0,0,.5); --shadow-lift: 0 4px 16px rgba(0,0,0,.45);
}

/* derived: same rule in both modes */
:root {
  --on-brand: #1a1a1a;
  --page: color-mix(in srgb, var(--brand) 10%, var(--bg));
  --brand-fill: color-mix(in srgb, var(--brand) 55%, var(--surface-strong));
  --brand-fill-strong: color-mix(in srgb, var(--brand) 75%, var(--surface-strong));
  --muted-strong: color-mix(in srgb, var(--ink) 70%, transparent);
  --edge: color-mix(in srgb, var(--ink) 50%, transparent);
  --track: color-mix(in srgb, var(--ink) 12%, transparent);
  --seam: var(--page); --rim: var(--edge);

  --radius-content: 4px; --radius-seg: 10px; --radius-btn: 12px; --radius-control: 14px; --radius-card: 16px; --radius-glass: 20px; --radius-pill: 999px;
  --duration-quick: 150ms; --duration-open: 220ms; --duration-close: 180ms; --duration-bar: 300ms; --ease-out: cubic-bezier(.2,.8,.2,1);

  /* fixed-meaning tokens for this project: content colours, category dots, heart, qr */
}

body { background-color: var(--page); color: var(--ink); transition: background-color .25s ease, color .25s ease; overflow-x: hidden; }

.glass { background: var(--surface); backdrop-filter: blur(18px) saturate(150%); -webkit-backdrop-filter: blur(18px) saturate(150%); border: 1px solid var(--surface-border); border-radius: var(--radius-glass); box-shadow: var(--shadow-glass); }

.page { width: 100%; max-width: 720px; margin: 0 auto; padding: 14px; padding-top: max(14px, env(safe-area-inset-top)); padding-bottom: max(14px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 12px; }
@media (max-width: 480px) { .page { padding: 10px; } }

.modal-backdrop { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; padding: 12px; background: var(--backdrop); transition: opacity var(--duration-open) ease, visibility 0s; }
.modal-backdrop.hidden { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity var(--duration-close) ease, visibility 0s linear var(--duration-close); }
@media (min-width: 640px) { .modal-backdrop { align-items: center; } }
.modal { width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto; padding: 18px; background: var(--surface-strong); transition: transform var(--duration-open) var(--ease-out), opacity var(--duration-close) ease; }
.modal-backdrop.hidden .modal { opacity: 0; transform: translateY(14px) scale(.97); }
body.modal-open { overflow: hidden; }
```
