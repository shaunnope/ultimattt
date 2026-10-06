# Implementation Plan: PWA Design Rework

**Branch**: `006-pwa-design-rework` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-pwa-design-rework/spec.md`. Authority: `docs/pwa-design-spec.md` (the "design spec").

## Summary

Restyle the whole interface to the design spec with no rule, record, save, link or protocol change. The work is mostly CSS and DOM structure, plus four logic-bearing pieces: (1) a theme store with a `system | light | dark` preference under a new `ttt.mode` key, a migration from `ttt.theme`, and `data-mode-preference`; (2) a token layer in `site/css/theme.css` rebuilt from design spec Appendix A, with the old tokens renamed per the migration table; (3) a pure contrast-matrix check (`scripts/check-contrast.mjs`) that resolves tokens per mode and asserts the declared pairs; (4) design-spec versions of the shared components (top bar, buttons, segmented toggle, chip, field, banner, toast, sheet, theme modal, update bar, pill, result, share card).

Approach: no new runtime dependencies. Tokens first (theme.css + checks), then the shell (head, top bar, theme runtime and modal), then component CSS screen by screen, then boards and content colours, then the PWA shell gates (manifest colours, screenshots, `VERSION` bump). Existing native `<dialog>` is kept and styled as the sheet. Existing mark-palette machinery is kept and treated as content colours. Game logic in `src/core` is not touched except `src/core/settings.ts`, which keeps its `auto` value for save compatibility and maps to `system` at the UI boundary.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict, ES2022, `erasableSyntaxOnly`), HTML, CSS. Node 22.18+ for tests and tooling only.

**Primary Dependencies**: None added. Nunito loads from Google Fonts via a non-blocking `<link>` (`media="print"` swapped to `all` on load, with a `<noscript>` fallback) and `display=swap` and a `"Segoe UI", system-ui, sans-serif` fallback (design spec section 3). It is third party, so the service worker never caches it; offline first use shows the fallback face.

**Storage**: `localStorage`. New key `ttt.mode` (`light|dark|system`). Legacy `ttt.theme` (`auto|light|dark`) is migrated once and removed. `save.settings.theme` in the saved game blob keeps its schema (`auto|light|dark`) so 001 to 005 saves load unchanged; it is the durable copy, `ttt.mode` is the pre-paint mirror (as `ttt.theme` is today).

**Testing**: `node:test` for pure code (`resolveMode`, migration, contrast resolver, token and pair checks, manifest colour derivation); Playwright for UI (theme dialog, system follow, sheet vs centred modal, 320 px no-scroll, 44 px hit areas, one primary per view, offline, a11y, subpath); the existing check scripts updated and `check-contrast` added to `npm run check`. Existing e2e tests that use `#theme-select`, `data-theme-pref` or old class names are rewritten against the new structure.

**Target Platform**: Evergreen browsers, installable PWA on static HTTPS under a subpath. Unchanged.

**Project Type**: Static web app (`tsc` emit to `site/js`, hand-written CSS, no bundler).

**Performance Goals**: Interactive under 3 s on throttled mobile (unchanged budget). `backdrop-filter` is limited to the three glass roles (top bar, cards, modal) and never nested, to keep paint cost down on low-end phones. One font request, `display=swap`.

**Constraints**: Offline after first load; saves, links, seeds and the multiplayer protocol unchanged; no colour-only state; reduced motion respected while game timing is not; forced-colours safe (existing block kept); Lighthouse accessibility at least 90; no em dashes or emoji in UI copy; reference project names absent from visible text.

**Scale/Scope**: 3 CSS files rewritten (`theme.css`, `style.css`, `cube.css`), about 15 UI modules touched for markup and class changes (`app`, `setup`, `game`, `settings`, `theme`, `ui`, `pill`, `update-bar`, `help`, `replay`, `multiplayer`, `palette-picker`, `icons`, board files for seams and rims), 1 new script (`check-contrast.mjs`) with a pairs file, `index.html`, `manifest.json`, screenshots, constitution amendment.

## Constitution Check

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | Failing unit tests first for the theme store (resolve, migrate, validate), the contrast resolver and pair list, the manifest colour derivation and the new token checks; failing Playwright specs first for the theme dialog, sheet behaviour and hit-area and no-scroll audits. `tasks.md` lists each test before its implementation. Pure CSS restyling is covered by those audits plus the token and contrast checks rather than per-rule tests. |
| II. PWA First | PASS | Manifest `theme_color` and `background_color` re-derived from the light `page` token and asserted by test; icons, favicon, screenshots regenerated; touch and keyboard preserved; 44 px hit areas and the 320 px layout audited. |
| III. Offline-Capable by Default | PASS | `VERSION` bump; changed files in precache (enforced); all game modes still work offline (existing e2e). The web font is the one non-cached asset and falls back gracefully (recorded below). |
| IV. Simplicity | PASS | No dependencies; the contrast checker is a small script; components are CSS classes over the existing `h()` helper, not a framework. |
| V. Pure, Testable Game Logic | PASS | `src/core` rules untouched. `resolveMode` and the migration stay pure and DOM-free; DOM code only applies them. |
| Design spec (to be added to Technical Constraints) | PASS with recorded departures | See Complexity Tracking. |

Post-design re-check: unchanged. All PASS.

Test-first coverage (Principle I): the layout audit, a components spec for replay, pairing, update bar, result and palette picker, the motion audit and the breakpoint check each fail before the CSS they cover is written.

## Project Structure

### Documentation (this feature)

```text
specs/006-pwa-design-rework/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contracts.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks, not created here
```

### Source Code (repository root)

```text
src/
├── core/settings.ts        # unchanged shape; Theme stays "auto"|"light"|"dark" (save compat)
├── adapters/storage.ts     # + storageRemove if missing (for legacy key removal)
├── ui/
│   ├── theme.ts            # ModePref = "system"|"light"|"dark"; resolveMode; loadModePref (migrate ttt.theme);
│   │                       #   applyMode (writes data-mode + data-mode-preference + theme-color); mark palette kept
│   ├── theme-modal.ts      # NEW: Light/Dark/System radiogroup, "Following your device. Currently dark." note
│   ├── settings.ts         # appearance select removed; hints, replay, palette, notation stay
│   ├── icons.ts            # + sun moon system search info palette check cross timer heart; core set complete
│   ├── ui.ts, app.ts       # top bar (mark, title, nav, theme button; back button inside tasks), skip link, toasts
│   ├── setup.ts            # segmented toggles, chips, one primary
│   ├── game.ts, pill.ts    # pill and result per design spec; banners
│   ├── update-bar.ts       # copy and button per design spec
│   ├── board-*.ts, cube-view.ts  # seams (2px page colour) and rims (1.5px edge) on content shapes
│   └── help.ts, replay.ts, multiplayer.ts, palette-picker.ts  # class and structure changes only
└── sw.ts                   # VERSION bump
site/
├── index.html              # head order per design spec; pre-paint script (new key, legacy fallback)
├── manifest.json           # theme/background colours from page token
├── css/theme.css           # rebuilt from design spec Appendix A + fixed-meaning tokens
├── css/style.css, cube.css # component and board styling on tokens only
└── screenshots/            # regenerated
scripts/
├── check-contrast.mjs      # NEW (+ scripts/lib/colour.mjs: parse, mix, composite, ratio)
├── contrast-pairs.json     # NEW: declared text/surface, edge/surface and fill pairs
├── check-theme.mjs         # new key, new attribute, legacy values
├── check-theme-tokens.mjs  # now also scans theme.css: literals allowed only in `--token:` declarations
├── check-breakpoints.mjs   # NEW: fails on any width @media other than 480 (max) and 640 (min)
└── make-screenshots.mjs    # regenerated against the new look
tests/
├── unit/                   # theme-store, contrast, colour-lib, manifest-colours, check-scripts updates
├── contract/manifest.test.ts  # colours equal derived page token
└── e2e/                    # theme-dialog.spec, layout-audit.spec (hit areas, 320 px, one primary), updates to a11y/settings/offline/subpath
docs/pwa-design-spec.md     # section 0 Profile filled in
.specify/memory/constitution.md  # amendment: UI MUST follow the design spec (1.1.0)
```

**Structure Decision**: single project, extending the 005 layout. CSS stays in three files; theme.css is the only file with colour literals.

## Complexity Tracking

Departures from the design spec, each recorded here as it asks.

| Departure | Why needed | Simpler alternative rejected because |
|---|---|---|
| Pre-paint script also reads legacy `ttt.theme` (`auto` maps to `system`) | A returning dark-mode user would otherwise see one white flash on the first load after the update, before JS migrates the key | Migrating only in JS (design spec section 9) breaks FR-003 and SC-005 on that one load. The fallback is two lines and is covered by `check-theme` |
| Mark colours keep a light and a dark value per palette; Twist face tints are one fixed set checked against both | Marks must reach 3:1 against face tints in both modes; one X colour cannot do that on both `#f6f4ee` and `#121419` pages for every palette | A single value per palette fails contrast for at least one mode. They remain fixed-meaning tokens set by the palette, never tinted or dimmed |
| Palette picker retained | It is an accessibility feature (colour-vision-friendly X and O pairs), not a colour theme of the chrome | Removing it drops a shipped feature and is outside "rework the UI" |
| Cube turn animations (about 340 to 400ms) exceed the 220ms cap | They are game motion that must be long enough to follow a layer turning; spec FR-016 exempts them under a dedicated `--duration-turn` token | Capping at 220ms makes layer turns read as a jump. Reduced motion still removes them |
| Font stylesheet loaded non-blocking (design spec section 10 puts the stylesheet in head order) | A render-blocking third-party stylesheet can delay first paint on a slow network and risk the 3s budget | A blocking link is simpler but leaves SC-007 at the mercy of a third party |
| Board cells and cube stickers are exempt from the 44px hit area (spec FR-013) | An Ultimate board packs 81 cells into about 340px, so a cell is about 33px; enlarging cells would shrink or scroll the board | Padding cells to 44px makes the Ultimate board wider than a phone. Cells keep a visible focus ring and names, and the one-tap controls around the board all meet 44px |
| Twist face colours keep a light and a dark set (`--face-0..5` in each mode block of `theme.css`), not one fixed set | The X and O colours differ by mode and must reach 3:1 on every face (tested in `palette.test.ts`); one pastel set fails that in dark mode | A single set is simpler but cannot satisfy both modes. Each face is still drawn in exactly its own token, never tinted or dimmed |
| The marks inside a claimed Ultimate board are drawn at 30% opacity | The owner is shown at full strength by the large mark and the 4px ring; dimming the small marks keeps the board readable | Undimmed marks under a large overlay mark are unreadable. The live, unclaimed marks are tested for exact colour and no opacity |
| Top-bar title is 18/24 at weight 800, not the 32/36 `display` style | `display` does not fit beside three icon buttons at 320px | Hiding the title on phones loses the name; this keeps it and the type scale's weights |
| The top bar has a Back button only on the help page, not in a game or a replay | Leaving a game erases it (the New game button does that on purpose), and the replay has its own Close button | A Back in the game bar would make an accidental tap discard a game |
| The current-player pill's mover segment is a lifted fill with a 2px ring, not `brand-fill` | The pill holds X and O marks in their exact colours, and light marks on a pale `brand-fill` fall under 3:1 in dark mode | Using `brand-fill` fails the mark contrast. The segmented toggles and primary buttons do use `brand-fill` with `on-brand` |
| Setup choice groups are native radio inputs styled as segmented toggles, not `role="radio"` buttons | The browser supplies grouping, arrow keys and form semantics; the existing tests drive the labels | Rebuilding them as buttons adds code for no user gain |
| `.glass` has no `backdrop-filter` blur (design spec section 5 specifies one) | The page is one flat colour, so the blur is visually a no-op, and with it the 4x-throttled perf tests regressed (8 to 10 of 48 failing against 1 before, from blurred cards under the moving cube) | Keeping the blur costs frames on a slow phone for no visible change. If the page ever gets texture or a sticky bar scrolls over content, restore it |
| Web font not cached by the service worker | Design spec says third-party traffic is never cached | Self-hosting Nunito would cache it but departs from "loaded from Google Fonts" and adds roughly 100 KB to precache; revisit if offline first-run look matters |
