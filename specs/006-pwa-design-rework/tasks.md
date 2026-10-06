---

description: "Task list for PWA Design Rework"
---

# Tasks: PWA Design Rework

**Input**: Design documents from `/specs/006-pwa-design-rework/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md, `docs/pwa-design-spec.md` (the "design spec")

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): each test task precedes its implementation task; run it and see it FAIL for the expected reason first. Pure CSS restyling is covered by the layout audit, `check-theme-tokens` and `check-contrast` written in the Foundational and US4 phases rather than per-rule tests.

**Organization**: Grouped by user story (spec.md priorities): US1 theme system (P1), US2 restyled screens (P1), US3 content colours (P2), US4 accessibility and motion (P2), US5 install shell and checks (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 to US5, from spec.md
- Authored TypeScript lives in `src/`, static assets and CSS in `site/`, tests in `tests/`. `site/js/` and `site/sw.js` are build output: never edit them
- Unit: `npm run test:unit`; contract: `npm run test:contract`; e2e: `npm run test:e2e`; gates: `npm run check`
- No colour literal outside `site/css/theme.css`. No em dashes, emoji or exclamation marks in UI copy, comments or docs
- Do not `git add` or commit unless asked

---

## Phase 1: Setup

**Purpose**: Baseline before any change

- [X] T001 Run `npm run build && npm test && npm run check` and record that the 005 baseline is green; fix nothing
- [X] T002 [P] Run `npm run test:e2e` once and record which specs pass, so later failures can be told apart from pre-existing ones
- [X] T003 [P] Fill design spec section 0 (Project Profile) in `docs/pwa-design-spec.md`: `APP_KEY` = `ttt`; content colours = X and O per chosen palette, `face-0..5`, `qr-bg`/`qr-fg`; domain components = the three boards, Twist cube view, turn pill, replay controls, multiplayer pairing; network feature = multiplayer pairing. Remove the "Migrating ... (ultimattt today)" section's present-tense framing once US1 and US2 land (do that in T067)
- [X] T004 [P] Amend `.specify/memory/constitution.md` Technical Constraints with: "UI MUST follow `docs/pwa-design-spec.md`. Departures are recorded in the plan's complexity tracking." Bump to 1.1.0 and update the Sync Impact Report. Add a design row to `.specify/templates/plan-template.md` Constitution Check

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The token layer, the colour maths and the checks every story relies on. The old token names stay alive as aliases until Phase 8 so the app never breaks between tasks.

**⚠️ CRITICAL**: No story starts before this phase is complete.

### Tests first

- [X] T005 [P] Write failing tests for the colour library in `tests/unit/colour.test.ts`: parse `#rrggbb`, `rgba()`, `color-mix(in srgb, A p%, B)` (including `transparent` as B), composite a translucent colour over a backdrop, and WCAG ratio (known pairs: black on white 21, `#767676` on white about 4.54)
- [X] T006 [P] Write failing tests for the contrast checker in `tests/unit/contrast.test.ts`: a synthetic theme and pairs file where one pair is below 4.5 fails and names token, mode and ratio; a passing set returns no problems; a pair whose token is missing fails with a clear message
- [X] T007 [P] Extend `tests/unit/check-scripts.test.ts` (failing first): `check-theme-tokens` now also scans `theme.css`, accepting colour literals only on custom-property declarations (`--name: #...;`) and rejecting one in a rule (`.x { color: #fff }`); still rejects a literal in `style.css` or `cube.css`; passes on the project's own files once T074 and T012 are done

### Implementation

- [X] T074 Update `scripts/check-theme-tokens.mjs` so `site/css/theme.css` is scanned too, with colour literals allowed only on `--name:` declarations, so T007 passes
- [X] T008 Create `scripts/lib/colour.mjs` exporting `parseColour`, `mix`, `composite`, `luminance`, `ratio` so T005 passes
- [X] T009 Create `scripts/check-contrast.mjs` (`checkContrast(themeCss, pairs)` plus a CLI) that reads `site/css/theme.css`, resolves tokens per mode (`:root`, `:root[data-mode="light"]`, `:root[data-mode="dark"]`, derived block), and asserts every pair in `scripts/contrast-pairs.json` so T006 passes
- [X] T010 Create `scripts/contrast-pairs.json` with the pairs from design spec 2.3: `ink` on `page`, `surface`, `surface-strong`; `muted` on `page`, `surface`; `muted-strong` on `surface-strong`; `on-brand` on `brand-fill`, `brand-fill-strong`; `brand-ink` on `page`, `surface`, `surface-strong`; `ok`, `warn`, `error` on `page` and `surface`; `edge` on `surface-strong` and `page` (min 3); `brand-ink` focus ring on `page` (min 3); `busy` on `surface` (min 3); `muted-strong` on `track` (min 3 for the Low band bar). Each has a `why`
- [X] T011 Add `node scripts/check-contrast.mjs` to the `check` script in `package.json`
- [X] T012 Rebuild `site/css/theme.css` from design spec Appendix A: reset, Nunito font stack on `*`, light and dark mode blocks, derived block (`page`, `brand-fill`, `brand-fill-strong`, `muted-strong`, `edge`, `track`, `seam`, `rim`), radii ladder, durations (including `--duration-turn: 400ms`, the exempt Twist turn duration from spec FR-016), `.glass`, `.page`, native `dialog` and `dialog::backdrop` sheet rules (bottom sheet under 640 px, centred above; see research R6, not the div-based `.modal` of design spec Appendix A), `.num`, reduced-motion rule. Keep fixed-meaning tokens `--mark-x`, `--mark-o`, `--claim-x`, `--claim-o`, `--face-0..5`, `--qr-bg`, `--qr-fg`, `--hatch`, `--playable` (single values, derived where possible). Add a temporary "legacy aliases" block mapping `--fg`, `--accent`, `--accent-muted`, `--accent-contrast`, `--border`, `--success`, `--scrim`, `--radius`, `--radius-small`, `--focus` to the new tokens, marked `/* remove in T066 */`
- [X] T013 Run `npm run check` and `npm run build && npm run test:unit`; fix any contrast pair that fails by adjusting token values in `site/css/theme.css` only, never by weakening `contrast-pairs.json`

**Checkpoint**: tokens, colour maths and contrast check are in place; the app still renders through aliases.

---

## Phase 3: User Story 1 - One consistent look in light, dark and system (Priority: P1) MVP

**Goal**: Two themes, System default, live follow, no flash, legacy choice migrated, theme modal.

**Independent Test**: quickstart section 2.

### Tests first

- [X] T014 [P] [US1] Write failing tests in `tests/unit/theme.test.ts`: `resolveMode("system"|"light"|"dark"|null|"blue", prefersDark)`; `loadModePref` returns stored `ttt.mode`; migrates `ttt.theme` (`auto` to `system`, `light`, `dark`) to `ttt.mode` and removes the legacy key; ignores corrupt values (falls back to `system`); survives a throwing storage
- [X] T015 [P] [US1] Update `tests/unit/check-theme.test.ts` and write the failing expectations for `scripts/check-theme.mjs`: the sandbox serves `ttt.mode`, with legacy `ttt.theme` as fallback; stored values `system`, `light`, `dark`, `auto` (legacy), `blue`, empty; asserts `data-mode` and `data-mode-preference`
- [X] T016 [P] [US1] Write failing e2e `tests/e2e/theme-dialog.spec.ts`: dark-preference context is dark before any module script runs (route-delay `js/ui/app.js` by 2 s, then at `domcontentloaded` assert `data-mode="dark"` and the computed body background equals the dark `page` token); theme button opens a dialog with a Light/Dark/System `radiogroup`; pressed state follows the preference; with System the note reads "Following your device. Currently dark."; choosing keeps the dialog open; `emulateMedia({ colorScheme })` change updates `data-mode` without moving focus; seeded legacy `ttt.theme=dark` yields dark first paint and ends with `ttt.mode=dark`, no `ttt.theme`
- [X] T017 [P] [US1] Update `tests/e2e/settings.spec.ts`: remove the appearance select assertions (`#theme-select`), keep hints, replay, palette, notation; keep the check-theme test

### Implementation

- [X] T072 [P] [US1] Write failing e2e `tests/e2e/font-load.spec.ts` (before T021): with requests to `fonts.googleapis.com` and `fonts.gstatic.com` delayed by 5 s, `domcontentloaded` and the start screen's first render occur in under 1 s and the body font stack ends in the fallback; with those requests aborted the app renders and plays a move
- T018 removed: `storageRemove` already exists in `src/adapters/storage.ts`; ID kept so later references stay stable
- [X] T019 [US1] Rewrite `src/ui/theme.ts`: `ModePref = "system"|"light"|"dark"`, pure `resolveMode(pref: string | null, prefersDark)`, `MODE_KEY = "ttt.mode"`, `loadModePref()` with the migration from `ttt.theme`, `applyMode(pref)` that writes `ttt.mode`, sets `data-mode`, `data-mode-preference`, the `theme-color` meta to the resolved page colour (read from computed `--page`, not hard-coded), repaints marks, and keeps a permanent `prefers-color-scheme` listener that re-resolves only while pref is `system`. Map `Theme` (`auto`) to `ModePref` at the boundary. Make T014 pass
- [X] T020 [US1] Update `src/core/settings.ts` only if needed to keep `Theme = "auto"|"light"|"dark"` valid for old saves (no schema change); add a comment on the `auto` to `system` mapping
- [X] T021 [US1] Replace the inline script in `site/index.html` with the design spec section 9 script reading `ttt.mode` then legacy `ttt.theme`, setting `data-mode-preference` and `data-mode`; reorder the head per design spec section 10 (charset, title, viewport, description, theme-color, manifest, icons, pre-paint script, modulepreload block, stylesheets with theme first); add the Nunito stylesheet non-blocking (`<link rel="stylesheet" media="print" onload="this.media='all'">` plus a `<noscript>` plain link, `preconnect`, `display=swap`) so T072 passes
- [X] T022 [US1] Update `scripts/check-theme.mjs` to the new key, attribute, PREFS list (`system, light, dark, auto, blue, ""`) and `resolveMode` signature so T015 passes; `npm run check` green
- [X] T023 [US1] Add icons `sun`, `moon`, `system`, `palette` to `src/ui/icons.ts` (24 grid, 2px stroke, round caps) and extend `tests/unit/icons.test.ts` first (failing) to cover them
- [X] T024 [US1] Create `src/ui/theme-modal.ts`: native dialog via `openDialog` with a Light/Dark/System segmented `radiogroup` (`aria-checked`, from the preference), the System note, applies on click via `applyMode` and `updateSettings`, never closes on choose
- [X] T025 [US1] Remove the appearance `<select>` from `src/ui/settings.ts`; add a theme icon button (icon follows the preference: `sun`, `moon`, `system`) to the header actions in `src/ui/app.ts` that opens the theme modal; update `applySettings` to call `applyMode`
- [X] T026 [US1] Make T016 and T017 pass; fix any old selector references (`data-theme-pref`, `ttt.theme`) across `src/` and `tests/` found with a grep

**Checkpoint**: US1 complete. App follows the device, pins modes, migrates legacy choices.

---

## Phase 4: User Story 2 - Restyled screens (Priority: P1)

**Goal**: Every screen uses the three surfaces, the type scale, the core components and the layout rules.

**Independent Test**: quickstart section 3.

### Tests first

- [X] T027 [P] [US2] Write failing e2e `tests/e2e/layout-audit.spec.ts` that, for setup, a Classic game, an Ultimate game, a Twist game, a finished game with its result and share card, replay, the multiplayer pairing screens (host and join, online and offline), the update bar, help, and each open dialog (settings, theme, confirm, palette picker), at widths 320, 480, 720 and in both modes: asserts no horizontal scroll; counts `.btn-primary` visible per view and expects at most 1; asserts no `.glass` element has a `.glass` ancestor; asserts no computed `font-family` other than Nunito stack and no font weight outside 400/600/700/800; asserts no computed `font-size` under 12.5px (inputs at least 16px); asserts every visible focusable element has a hit area of at least 44 by 44, measured with `document.elementFromPoint` at the four points 22 px from the element's centre (each must resolve to the element or a descendant), since pseudo-element extents are not in `getBoundingClientRect`
- [X] T028 [P] [US2] Write failing e2e in `tests/e2e/layout-audit.spec.ts` for dialogs: at 390 px a dialog is anchored to the bottom (sheet), at 800 px centred; closes by close button, Escape, backdrop click; `body.modal-open` locks scroll
- [X] T029 [P] [US2] Update `tests/e2e/pill.spec.ts`, `classic.spec.ts`, `ultimate.spec.ts`, `cube.spec.ts`, `replay.spec.ts`, `help.spec.ts`, `network.spec.ts` selectors that change with new class names; write the changes first so they fail against current markup, then use them as the acceptance for the restyle
- [X] T030 [P] [US2] Write failing unit tests `tests/unit/messages.test.ts` and `tests/unit/status-text.test.ts` additions for copy rules: no em dash, no exclamation mark, no emoji in any user-visible string exported from `src/ui/messages.ts`, `status-text.ts`, `help-content.ts`, `replay-text.ts`, `setup.ts` labels. Add `tests/unit/copy-rules.test.ts` that scans those modules' string literals

- [X] T071 [P] [US2] Write failing e2e `tests/e2e/components.spec.ts` for the views T027 only samples, one case each, before T039 to T042: update bar (text "A new version is ready.", an Update button, nothing reloads until it is pressed, the game in progress survives); replay (IconButtons named and at 44 px, readout matches "Move N of M", progress pips or slider paired with text); result and share card (outcome in words, `check` icon with `ok` colour on a win, one detail line, next action, "Copied" toast with `role="status"`); multiplayer pairing (code uses tabular figures, offline banner says what to do and local play still starts); palette picker (selected row shows `check` and the word "Selected", samples have a rim)

### Implementation: icons and primitives

- [X] T031 [P] [US2] Add the remaining core icons to `src/ui/icons.ts` (`search`, `info`, `check`, `cross`, `timer`, `heart`, plus any missing from `sun moon system close back search help info palette share copy check cross timer lock flag heart`) and the domain icons `mode-classic`, `mode-ultimate`, `mode-twist`, `hint-win`, `hint-block` (used on the setup mode toggle, the settings hints row and help); each concept has its own icon; extend `tests/unit/icons.test.ts` first; icon container sizes set in CSS (20 in icon buttons, 16 in buttons/chips/segments, 18 in rows)
- [X] T032 [US2] Update `src/ui/ui.ts` helpers (`h`, `openDialog`, toast): dialog gets `.modal` classes, header with title (`heading`) and close icon button, sheet open and close by a class flip with `transitionend`, `body.modal-open`, backdrop click and Escape; toast uses role `status` and the pill style; keep the public signatures so callers keep working

### Implementation: CSS by component (`site/css/style.css`)

- [X] T033 [US2] Rewrite `style.css` base and layout sections: remove `body` background and font (now in theme.css), `.page` column with 720 px max and 480 px breakpoint, `.skip-link`, `.sr-only`, `main` and `#help-view` padding, safe areas
- [X] T034 [US2] Rewrite top bar styles and markup: `.app-header` becomes `.topbar.glass` with mark (24 to 32 px), title (`display`, 800), nav and theme button; first nav item becomes a `back` icon button inside a game, replay or help; `aria-current="page"` on the active link. Markup in `site/index.html` and `src/ui/app.ts`
- [X] T035 [US2] Rewrite button styles: `.btn` (quiet), `.btn-primary` (`brand-fill`/`on-brand`), `.btn-destructive`, disabled at 60%, `.icon-btn` 42 px with 44 px hit area `::after`, 1px lift on hover. Audit each view in `src/ui/setup.ts`, `game.ts`, `replay.ts`, `multiplayer.ts`, `help.ts` for exactly one primary
- [X] T036 [US2] Rewrite form control styles: `.seg` segmented toggle (radiogroup), `.chip` with `aria-pressed`, `.field` text and select (16 px, 1 px `edge`, placeholder `muted-strong`), checkbox rows; convert `.choice-grid` in `src/ui/setup.ts` to `.seg` for 2 to 4 options and `.chip` for more
- [X] T037 [US2] Rewrite banner, status line, busy dot and toast styles; map `statusText` tones to banner variants (`error` has `role="alert"`); update `src/ui/game.ts` and `src/ui/multiplayer.ts` accordingly; offline multiplayer shows the banner copy from the contract
- [X] T038 [US2] Restyle cards: `.card` becomes `.glass`; headings use `heading` and `brand-ink`; controls inside cards use `surface-strong`. Fix any glass-on-glass found by T027
- [X] T039 [US2] Restyle `src/ui/update-bar.ts` and its CSS: "A new version is ready." plus Update button, shown above the top bar, state saved before reload (keep existing behaviour; verify with the existing e2e)
- [X] T040 [US2] Restyle the pill and result in `src/ui/pill.ts` and `game.ts`: pill on `surface-strong` with `brand-fill` active segment; result with `check` icon in `ok` for wins, verdict in `reveal`, one line of detail, next action; share card with score in `reveal`, copy button, "Copied" toast
- [X] T041 [US2] Restyle replay controls in `src/ui/replay.ts` (IconButtons at 44 px hit areas, readout "Move 7 of 23" in `body-sm` with `.num`, slider track `track` and fill `brand-fill`) and help in `src/ui/help.ts` and `help-content.ts` (headings, lists, links in `brand-ink`)
- [X] T042 [US2] Restyle multiplayer pairing in `src/ui/multiplayer.ts` and `qr.ts` surroundings: code in `reveal` with `.num`, QR in `--qr-bg`/`--qr-fg` with a ring, banners for waiting and offline
- [X] T043 [US2] Fix copy across `src/ui/*.ts` found by T030 (sentence case, British spelling, errors say what to do, locked things say when they open); no em dashes or exclamation marks
- [X] T044 [US2] Make T027 to T029 and T071 pass; iterate on CSS until the audit is green at 320, 480, 720 in both modes

**Checkpoint**: US2 complete. Every screen is restyled and audited.

---

## Phase 5: User Story 3 - Marks, boards and content colours (Priority: P2)

**Goal**: Content colours drawn exactly, rimmed, seamed, never colour alone.

**Independent Test**: quickstart section 3 (greyscale and palette steps).

### Tests first

- [X] T045 [P] [US3] Write failing e2e `tests/e2e/marks.spec.ts` additions: for each palette in both modes, the computed `fill`/`stroke` of an X and an O equals `markColors(palette, mode)` exactly (no `opacity` below 1 on the mark or its ancestors); each mark has a rim (stroke or outline from `--rim`); two adjacent cells have a 2 px gap whose background is `--seam`
- [X] T046 [P] [US3] Write failing unit test `tests/unit/contrast.test.ts` additions: for each palette and mode, `mark-x` and `mark-o` against `face-0..5` composited and against `page`, `surface-strong` reach 3:1 (the check from Complexity Tracking); failing names the palette
- [X] T047 [P] [US3] Write failing e2e `tests/e2e/cube.spec.ts` additions: locked faces show the lock icon and their accessible name includes "locked"; claimed small boards in Ultimate carry an `aria-label` with the owner and a non-colour cue (outline or hatch)

### Implementation

- [X] T048 [US3] Define `--seam`, `--rim`, `--face-0..5` (one fixed set), `--claim-x`, `--claim-o`, `--hatch`, `--playable` in `site/css/theme.css` as fixed-meaning tokens, derived from mark tokens where possible; extend `contrast-pairs.json` with the mark-on-face pairs and run T046 to red then green by tuning `src/core/palette.ts` values only where a pair fails (palette values are content, record any change in `research.md` R8)
- [X] T049 [US3] Style `src/ui/board-classic.ts`, `board-ultimate.ts` and `site/css/style.css` board rules: cells on `surface-strong` inside a `.glass` board, 2 px `seam` gaps, 1.5 px `--rim` on marks and claimed boards, playable targets `brand-fill` plus outline, no opacity on marks; keep hatch and shapes for claimed state
- [X] T050 [US3] Style `src/ui/board-cube.ts`, `cube-view.ts` and `site/css/cube.css`: faces use `--face-*` unthemed with a rim, seams between faces, lock icon plus accessible name on locked faces, last-move inset border retained; remove any per-mode face overrides; layer-turn and face-turn transitions (`.cube-scene.snap`, `.sticker`, and the `turnToFace` duration in `cube-view.ts`) use `var(--duration-turn)` and are the only interface motion over 220 ms apart from bars (FR-016 exemption)
- [X] T051 [US3] Restyle `src/ui/palette-picker.ts` rows: `surface-strong` rows, selected row `brand-fill` with `check` icon and the word "Selected", live X and O samples with rims; keep behaviour
- [X] T052 [US3] Make T045 to T047 pass

**Checkpoint**: US3 complete.

---

## Phase 6: User Story 4 - Accessible, touch-friendly, motion-aware (Priority: P2)

**Goal**: AA in every combination, focus, motion rules.

**Independent Test**: quickstart section 3 (keyboard and reduced motion), `npm run audit`.

### Tests first

- [X] T053 [P] [US4] Write failing e2e in `tests/e2e/a11y.spec.ts`: axe run on setup, game, help and each dialog in light and dark has no serious or critical violations; skip link is the first Tab stop; every `:focus-visible` element shows a 2px `--brand-ink` outline with 2px offset; every button and link has an accessible name
- [X] T054 [P] [US4] Write failing e2e `tests/e2e/motion.spec.ts`: with `reducedMotion: "reduce"`, opening a dialog completes (`transitionend` fires) with no perceptible duration (under 5 ms computed), and the computer still waits its think delay before moving (same delay as without reduced motion); an OS colour-scheme change leaves `document.activeElement` unchanged; a CSS audit over all stylesheets (computed from `document.styleSheets`) finds no `transition-duration` or `animation-duration` over 220 ms except `--duration-bar` (300 ms) and rules on `.cube-scene` and `.sticker` that use `--duration-turn`; with reduced motion the cube turn still completes (end state reached) with no perceptible duration
- [X] T055 [P] [US4] Write failing unit test in `tests/unit/check-scripts.test.ts` for a new `scripts/check-breakpoints.mjs`: `@media (max-width: 480px)` and `(min-width: 640px)` pass; `(min-width: 720px)`, `(max-width: 600px)` and any other width query fail with file and line; `prefers-reduced-motion`, `forced-colors` and `prefers-color-scheme` queries are ignored; the checker currently fails on the project's own `site/css/cube.css` (`min-width: 720px`)

### Implementation

- [X] T056 [US4] Apply the focus rule once in `site/css/theme.css` (`:focus-visible { outline: 2px solid var(--brand-ink); outline-offset: 2px; }`) and delete per-component focus overrides in `style.css` and `cube.css`; ensure board cells and cube controls inherit it
- [X] T057 [US4] Replace opacity-dimmed text with `muted` or `muted-strong` across `style.css` and `cube.css`; disabled controls at 60% only; locked and unavailable rows get a word or icon plus `aria-disabled`
- [X] T058 [US4] Ensure all open, close and switch transitions use `--duration-quick`, `--duration-open`, `--duration-close`, `--duration-bar` and `--ease-out` only; verify the reduced-motion block; confirm `src/ui/computer.ts` timers do not read the media query; the only exceptions are the cube turn durations on `--duration-turn` (spec FR-016). Make T053 and T054 pass
- [X] T073 [US4] Create `scripts/check-breakpoints.mjs` (strip comments, find width `@media` queries, allow only `max-width: 480px` and `min-width: 640px`), add it to the `check` script in `package.json`, and replace the `min-width: 720px` rule in `site/css/cube.css` with layout that does not need it (container-relative sizing or the 480 px query), so T055 passes and `npm run check` is green
- [X] T059 [US4] Run `npm run audit` and fix anything that drops accessibility under 90 on setup, game or help in either mode

**Checkpoint**: US4 complete.

---

## Phase 7: User Story 5 - Install shell and checks (Priority: P3)

**Goal**: Manifest, icons, screenshots, versioning, offline and subpath match the design spec.

**Independent Test**: quickstart section 4.

### Tests first

- [X] T060 [P] [US5] Write failing contract test in `tests/contract/manifest.test.ts`: `theme_color` and `background_color` equal the light `page` token computed from `theme.css` (`mix(brand 10%, bg)`), are 6-digit hex, `id`/`start_url`/`scope` are relative, icons 192, 512 any and 512 maskable exist and are non-empty, screenshots have narrow and wide with labels; add a unit test that the runtime `theme-color` meta for dark equals the dark `page` token
- [X] T061 [P] [US5] Update `tests/e2e/installable.spec.ts`, `offline.spec.ts`, `subpath.spec.ts` for new markup; add to offline: with the web font blocked, the app still renders with the fallback face and all three modes play (the delayed-font timing case is T072)

### Implementation

- [X] T062 [US5] Update `site/manifest.json` colours to the derived light `page` hex; regenerate `site/icons/*` only if the logo needs a `maskable` background change (keep the logo as is); update `<meta name="theme-color">` default in `site/index.html` to the same value
- [X] T063 [US5] Update `scripts/make-screenshots.mjs` and regenerate `site/screenshots/screen-narrow.png` and `screen-wide.png` against the new look, keeping `label` text in the manifest accurate (British spelling, no em dashes)
- [X] T064 [US5] Bump `VERSION` in `src/sw.ts`; run `npm run build` to regenerate `site/precache.json` and the preload block; run `node scripts/check-version.mjs` and update `scripts/precache.lock.json` as that script directs
- [X] T065 [US5] Make T060 and T061 pass; run `npm run test:e2e` fully

**Checkpoint**: US5 complete.

---

## Phase 8: Polish and Cross-Cutting

- [X] T066 Remove the legacy aliases block from `site/css/theme.css` (marked `remove in T066` in T012) after a grep shows no remaining use of `--fg`, `--accent`, `--accent-muted`, `--accent-contrast`, `--border`, `--success`, `--scrim`, `--radius`, `--radius-small`, `--focus` in `site/css/*.css` or `src/**/*.ts`; `npm run check` green
- [X] T067 [P] Update `docs/pwa-design-spec.md` section 14 "Migrating from the pre-refinement palette" to past tense ("done in 006") and mark the contrast matrix row in section 13 as implemented with `scripts/check-contrast.mjs`
- [X] T068 [P] Update comments in `src/ui/theme.ts`, `scripts/check-theme.mjs`, `scripts/check-theme-tokens.mjs` and the `theme.css` header to the new vocabulary; confirm no em dashes with `grep -rn "—" src site scripts docs specs/006-pwa-design-rework`
- [X] T069 [P] Run `npm run check && npm test && npm run test:e2e && npm run audit` and record results; walk quickstart sections 2 to 5 manually and note any deviation in `specs/006-pwa-design-rework/quickstart.md` under a "Results" heading
- [X] T070 Update the Complexity Tracking table in `specs/006-pwa-design-rework/plan.md` if any departure changed during implementation (for example a palette value adjusted in T048)

---

## Dependencies and Execution Order

- Phase 1 has no dependencies. T003 and T004 are documentation and can run alongside T001.
- Phase 2 blocks everything. Within it: T005 to T007 (tests) before T008 to T012; T013 last.
- US1 (Phase 3) depends on Phase 2 only. It is the MVP.
- US2 (Phase 4) depends on Phase 2; it also uses the theme button from US1 (T025) for the top bar, so start US2 after T025.
- US3 (Phase 5) depends on US2's board and card CSS (T033, T038) because it refines them.
- US4 (Phase 6) depends on US2 and US3 (it audits their output) but its tests T053 to T055 can be written earlier.
- Added tasks keep their IDs out of numeric order: T074 sits in Phase 2 (before T008), T072 in Phase 3, T071 in Phase 4, T073 in Phase 6. Each follows its own phase's tests-first rule.
- US5 (Phase 7) depends on US1 (colours) and can run in parallel with US3 and US4 except T064, which runs last because it needs the final cached file set.
- Phase 8 depends on all stories; T066 is the last CSS change.

## Parallel Opportunities

- Phase 2 tests: T005, T006, T007 together.
- US1 tests: T014, T015, T016, T017 together.
- US2 tests: T027 to T030 together; after T032, CSS tasks in different sections of `style.css` serialise, but T041 (replay and help) and T042 (multiplayer) touch different modules and can proceed in parallel with T037 to T040.
- US3 tests T045 to T047 together; T049 (classic and ultimate boards) and T050 (cube) are parallel after T048.
- US4 tests T053 to T055 together.
- US5 tests T060 and T061 together; T062 and T063 together.

## Implementation Strategy

1. **MVP**: Phases 1, 2 and 3 (US1). The app has the new token layer and a working Light, Dark and System theme with migration, still through legacy aliases for the rest of the chrome. Ship-ready as a checkpoint.
2. **Increment 2**: US2. Visible rework of every screen. Release candidate.
3. **Increment 3**: US3, then US4. Content colours exact, audits green.
4. **Increment 4**: US5 and Polish. Manifest, screenshots, version bump, alias removal, docs.
5. After each phase: `npm run build && npm run check && npm test`, then the relevant e2e subset. Bump `VERSION` once, in T064, unless a release is cut earlier (then bump then).
