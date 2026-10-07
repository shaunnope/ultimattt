---

description: "Task list for SvelteKit UI Migration"
---

# Tasks: SvelteKit UI Migration

**Input**: Design documents from `/specs/007-sveltekit-ui-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md (C1 to C8), quickstart.md, `docs/pwa-design-spec.md`

**Tests**: REQUIRED. Constitution Principle I (Test-First, non-negotiable): each test task precedes its implementation task, and you run it and see it FAIL for the expected reason first. The existing e2e suite is the parity oracle: it must stay green at every checkpoint, and may only be edited as listed in contracts C6. Component markup is covered by that suite and by the parity captures; any rule or state in a component moves to a framework-free `.ts` module with a unit test first (research R8, R11). Every port task follows the port rule below, so each port starts red.

**Organization**: US2 (delivery, P1) goes first because it makes the new build a working PWA with the legacy screens still inside it. US3 (components, P2) then ports screens one at a time, each step green on the oracle. US1 (parity, P1) is verified continuously and closed after the ports. US4 (checks, P2) adds the guard rails. Priorities say what matters most; the order says what can be built on what.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 to US4, from spec.md
- Authored code lives in `src/`, static assets in `static/`, tests in `tests/`. `build/`, `build-subpath/` and `.svelte-kit/` are build output: never edit them
- Unit: `npm run test:unit`; contract: `npm run test:contract`; e2e: `npm run test:e2e`; gates: `npm run check`
- No colour literal outside `static/css/theme.css` token declarations. No em dashes, emoji or exclamation marks in UI copy, comments or docs
- Do not `git add` or commit unless asked. Move files with the filesystem (`mv` or `Move-Item`), not `git mv`
- When a task says "port X", read the whole module first, keep its markup, class names, ids, ARIA attributes, copy and timings exactly (contracts C4), and delete the module in the same task once its component passes the suites, unless the task says a later port still imports it (T072 removes those)
- Port rule (Principle I): a port task starts red. Step 1: make the screen's mount point (route, shell slot or bridge branch) render nothing for that screen, run the specs the task names and confirm they fail because the screen is missing. Step 2: build the component until they pass. Step 3: delete the legacy module unless the task says otherwise. Shared primitives (T042, T048) take their red from the first screen that uses them
- The spike project is in the session scratchpad and is not part of the repo; the working configuration is in quickstart section 5

---

## Phase 1: Setup

**Purpose**: Baselines taken from the current app before anything moves

- [X] T001 Run `npm run build && npm test && npm run check` and record that the 006 baseline is green (467 unit, 89 contract); fix nothing
- [X] T002 [P] Run `npm run test:e2e` once on the current build and record the pass count and any flaky specs in `specs/007-sveltekit-ui-migration/baseline.md`, so later failures can be told apart from pre-existing ones; then run `npm run test:perf` alone and record the computer reply times and the Twist frame-budget numbers, so T062, T067 and T087 compare against measured values
- [X] T003 Write the parity harness before touching the app: `playwright.parity.config.ts` (desktop Chrome only, serves the folder named by env `PARITY_DIR`, default `site`, on port 4175, `snapshotPathTemplate` under `.parity/baseline/{arg}{ext}`) and `tests/parity/screens.spec.ts` that captures with `toHaveScreenshot` (animations disabled, fixed seed, scripted moves, confetti and timestamps masked, requests to `fonts.googleapis.com` and `fonts.gstatic.com` aborted so the fallback face is used in every run, and `maxDiffPixelRatio: 0.002` with `threshold: 0.2` set once in the config) setup, a Classic game mid-play, an Ultimate game mid-play, a Twist game mid-play in 3D and flat, a finished game result dialog, a replay, help, the settings dialog, the theme dialog, the palette picker, the update bar, and the two-device host screen, each at 320, 480 and 720 px wide in light and dark; add `"test:parity": "playwright test -c playwright.parity.config.ts"` to `package.json` and `.parity/` to `.gitignore`
- [X] T004 Run `npm run build && npx playwright test -c playwright.parity.config.ts --update-snapshots` to write the baseline from the CURRENT app into `.parity/baseline/`; run it a second time without `--update-snapshots` and fix any flaky capture until it passes twice in a row; record the capture count in `baseline.md`. Do this before T005
- [X] T005 Install the new dev dependencies and upgrade TypeScript: `npm install -D @sveltejs/kit@3.0.1 @sveltejs/adapter-static@4.0.0 @sveltejs/vite-plugin-svelte@7 vite@8 svelte@5.57 svelte-check typescript@6`; confirm `engines.node` stays `>=22.18`; run `npm run test:unit` to confirm Node's own type stripping is unaffected by the TypeScript upgrade
- [X] T006 [P] Update `.gitignore`: add `build/`, `build-subpath/`, `.svelte-kit/`, `.parity/`; keep `site/js/`, `site/sw.js`, `site/precache.json` until T085 removes the old layout

---

## Phase 2: Foundational (walking skeleton: the legacy UI running inside a SvelteKit shell)

**Purpose**: A SvelteKit static build that serves the unchanged imperative UI, with the checks re-pointed. The app is playable, installable and offline after this phase; screens are ported in later phases.

**CRITICAL**: no story phase starts before this checkpoint.

### Tests first

- [X] T007 [P] Write failing unit tests `tests/unit/check-build.test.ts` for `scripts/check-build.mjs` using small fake `build/` and source fixtures under `tests/fixtures/check/`: passes on a good build; fails when `service-worker.js` or `index.html` is missing; when the worker source does not import `immutable`, `assets`, `prerendered` from `$app/manifest` and `version` from `$app/env`; when the cache name does not use `version`; when the shell links an origin other than Google Fonts; when the sub-path build has a root-absolute URL; when a `modulepreload` points at a missing file; when first-load script plus style exceeds 70 KB gzipped or all script exceeds 160 KB gzipped; when `package.json` lists any runtime `dependencies` (FR-015) (contracts C2, C3; research R12)
- [X] T008 [P] Write failing unit tests `tests/unit/check-core-purity.test.ts` for `scripts/check-core-purity.mjs`: passes on a clean fixture; fails naming file and line on an import of `svelte`, `svelte/store`, `@sveltejs/kit`, `$app/state`, `$lib/x` or a `.svelte` file from a fixture `src/core` or `src/adapters` (contract C5)
- [X] T009 [P] Write failing unit tests `tests/unit/check-no-dom-builders.test.ts` for `scripts/check-no-dom-builders.mjs`: fails on an `h(` call, an `import { h }`, `document.createElement`, an import of `Bridge`, or an import of a deleted imperative module, in fixture `src/ui`, `src/lib` or `src/routes`; passes on a fixture of DOM-free helpers; exits 0 without checking when run without `--final` (contract C5)
- [X] T010 [P] Update `tests/unit/check-scripts.test.ts` (failing first): `check-sw` reads `src/service-worker.ts`; `check-theme` reads the inline script from `src/app.html` and `resolveMode` from `src/ui/theme.ts`; `check-theme-tokens` and `check-breakpoints` scan `static/css/*.css` AND the `<style>` blocks of `src/**/*.svelte` (add fixtures `tests/fixtures/check/svelte-style-bad` with a colour literal and a `min-width: 720px` inside a `.svelte` style block that must fail); `check-contrast` reads `static/css/theme.css`; `check-names` reads `src/**/*.{ts,svelte}`, `src/app.html` and `static/manifest.json`; delete the `check-precache` and `check-version` cases. In the same step re-point the other tests that read moved files (they go red until T012): `tests/unit/contrast.test.ts` and `tests/unit/palette.test.ts` to `static/css/theme.css`, `tests/unit/copy-rules.test.ts` and `tests/unit/visible-names.test.ts` to `src/app.html` and `static/manifest.json`, and every other `site/` path found by `grep -rn "site/" tests`
- [X] T011 [P] Write failing contract tests: re-point `tests/contract/manifest.test.ts` at `static/manifest.json`, and add `tests/contract/build.test.ts` that reads the root `build/` after `node scripts/build.mjs`: `index.html` links the three stylesheets and the pre-paint script appears before any module script, `404.html`, `manifest.json`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `screenshots/` and `service-worker.js` all exist, and no file under `build/` is named `precache.json` (contract C2); also build twice with a static file changed in between and assert `build/_app/version.json` differs, and that the worker source builds its cache name from that version (FR-008, so the cache name tracks content)

### Implementation

- [X] T012 Move the committed static files with the filesystem: `site/css` to `static/css`, `site/icons` to `static/icons`, `site/screenshots` to `static/screenshots`, `site/manifest.json` and `site/404.html` to `static/`. Leave `site/index.html` and the generated `site/js`, `site/sw.js`, `site/precache.json` where they are for now (T085 removes them). CSS content is unchanged
- [X] T013 Replace `tsconfig.json` with one that extends `$app/tsconfig` and sets `include: ["src", "test", "*"]`, `exclude: ["src/service-worker", "src/service-worker.ts"]`; delete `tsconfig.sw.json`; update `tsconfig.tests.json` to extend the generated config and keep its test globs, `noEmit`, and `allowImportingTsExtensions`; run `npx svelte-kit sync`
- [X] T014 Create `vite.config.ts` from the spike configuration in quickstart section 5: `sveltekit({ adapter: adapter({ pages: process.env.BUILD_DIR ?? "build" }), router: { type: "hash" }, serviceWorker: { register: false }, paths: { base: process.env.BASE_PATH ?? "" } })`; no `svelte.config.js` (Kit 3 rejects it)
- [X] T015 Create `src/app.html` from `site/index.html`: same head order (charset, title, viewport, description, theme-color `#f3f2f0`, manifest, icons), the inline pre-paint script copied byte for byte, the three stylesheet links as `%sveltekit.assets%/css/theme.css`, `style.css`, `cube.css`, the non-blocking Nunito links and `<noscript>` link, `%sveltekit.head%`, and a body of `%sveltekit.body%` plus the `<noscript><p class="noscript">` note; drop the modulepreload block. Keep `data-mode="light" data-mode-preference="system"` on `<html>`
- [X] T016 Create `scripts/build.mjs`: runs `npx svelte-kit sync`, then `vite build` with `BUILD_DIR` and `BASE_PATH` set in-process through `child_process` env (never by the shell, research R3); with `--subpath` it builds a second time with `BASE_PATH=/ultimattt` and `BUILD_DIR=build-subpath`; exits non-zero on any failed step
- [X] T017 Move the logo markup out of the old index into `src/lib/components/Logo.svelte` (the `<svg class="app-logo">` between the `logo:start` and `logo:end` markers) and update `scripts/make-icons.mjs`, `scripts/lib/logo.mjs` usage and `tests/unit/make-icons.test.ts` and `tests/unit/logo.test.ts` so the markers, the icon files (`static/icons`) and the logo check point at the new locations; run those unit tests
- [X] T018 Create the shell in `src/routes/+layout.svelte`: skip link `a.skip-link` to `#main`, `#update-bar.glass` (hidden), `header.topbar.glass` with `.app-brand`, `Logo`, `h1.app-title` "Tic Tac Toe" and an empty `#header-actions`, `main#main` (tabindex -1), `section#help-view` (tabindex -1, `aria-label="Help"`, hidden), `#status` live region, `#toasts`; wrap in `.page` exactly as `site/index.html` did (contracts C4). In `onMount` it imports `../ui/app.ts` for its side-effect boot so the legacy UI runs. Add empty `src/routes/+page.svelte`, `src/routes/play/+page.svelte`, `src/routes/replay/+page.svelte`, `src/routes/help/+page.svelte` so every hash route resolves. The legacy `app.ts` hash code must not clobber Kit's router state: change its `history.replaceState(null, ...)` calls to pass `history.state`, and keep `tests/e2e/help.spec.ts` (open help, leave help, Back) green until T055 removes that code
- [X] T019 Point the legacy modules at the new build: in `src/ui/computer.ts` start the worker with `new Worker(new URL("./ai-worker.ts", import.meta.url), { type: "module" })` and keep its main-thread fallback import as `./ai-worker.ts`; in `src/ui/update-bar.ts` register `new URL("service-worker.js", document.baseURI)` with scope `new URL("./", document.baseURI)`. Run `tests/unit/computer.test.ts`
- [X] T020 Create `src/service-worker.ts` (port of `src/sw.ts`): import `immutable`, `assets`, `prerendered` from `$app/manifest` and `version` from `$app/env`; cache name `` `ttt-${version}` ``; install precaches `immutable` plus `assets` (minus paths starting `screenshots/` or a dot) plus `prerendered` plus the base shell, each `new Request(url, { cache: "reload" })`; activate deletes other `ttt-*` caches then `clients.claim()`; fetch handles GET same-origin only, answers navigations from the cache ignoring the query then the base shell then the network; `skipWaiting()` only inside the `message` handler on `{ type: "skip-waiting" }`; keep the file a module that compiles under Kit (no `VERSION` constant). Delete `src/sw.ts`
- [X] T021 Implement `scripts/check-sw.mjs` re-pointed at `src/service-worker.ts` (keeps both rules), so T010's `check-sw` cases pass
- [X] T022 Implement `scripts/check-theme.mjs` re-pointed at `src/app.html` and `src/ui/theme.ts`, so T010's `check-theme` cases pass; keep the stored-value matrix (`system, light, dark, auto, blue, ""`)
- [X] T023 Implement `scripts/check-theme-tokens.mjs`, `scripts/check-breakpoints.mjs` and `scripts/check-contrast.mjs` re-pointed at `static/css`, with the first two also scanning `<style>` blocks of `src/**/*.svelte` (strip comments, same rules as today), so T010's fixture cases pass
- [X] T024 Implement `scripts/check-names.mjs` over `src/**/*.{ts,svelte}`, `src/app.html` and `static/manifest.json`, and extend `tests/unit/visible-names.test.ts` the same way
- [X] T025 Implement `scripts/check-build.mjs` (fake-build fixtures from T007 pass first, then it runs against the real `build/`): the checks in T007, using `node:zlib` gzip sizes, "first load" = the shell's `modulepreload` and entry scripts plus linked stylesheets, "all script" = every `.js` under `build/_app`; and no runtime `dependencies` in `package.json`
- [X] T026 [P] Implement `scripts/check-core-purity.mjs` so T008 passes
- [X] T027 [P] Implement `scripts/check-no-dom-builders.mjs` so T009 passes (`--final` turns the check on)
- [X] T028 Update `package.json` scripts: `build` is `node scripts/build.mjs`; `typecheck` is `svelte-kit sync && svelte-check --fail-on-warnings && tsc -p tsconfig.tests.json`; `check` is `node scripts/check-sw.mjs && node scripts/check-build.mjs && node scripts/check-core-purity.mjs && node scripts/check-theme.mjs && node scripts/check-theme-tokens.mjs && node scripts/check-contrast.mjs && node scripts/check-breakpoints.mjs && node scripts/check-names.mjs`; keep `test`, `test:unit`, `test:contract`, `test:e2e`, `test:perf`, `audit`, `test:parity`. Delete `scripts/gen-precache.mjs`, `scripts/gen-preload.mjs`, `scripts/check-precache.mjs`, `scripts/check-version.mjs`, `scripts/precache.lock.json`, `tests/unit/gen-precache.test.ts`, `tests/unit/gen-preload.test.ts`
- [X] T029 Point the harness at the new output: `playwright.config.ts` and `playwright.perf.config.ts` `webServer.command` becomes `node scripts/build.mjs --subpath && npx http-server build -p 4173 -c-1 --silent`; `scripts/audit.mjs`, `scripts/make-screenshots.mjs` and any `startStaticServer(join(root, "site"))` call serve `build/`; `playwright.parity.config.ts` default `PARITY_DIR` becomes `build`
- [X] T030 Build and run: `npm run build`, `npm run check`, `npm test`, then the full `npm run test:e2e`. Fix skeleton problems until everything is green except the specs listed in contracts C6 that depend on later tasks (`offline` update test, `subpath`, the update-bar seam in `a11y`, `components`, `layout-audit`, and the delayed-script case in `theme-dialog`); record the exact list and the numbers in `baseline.md`

**Checkpoint**: the legacy UI runs inside SvelteKit; unit, contract and check are green; e2e is green apart from the C6 specs.

---

## Phase 3: User Story 2 - Still an installable, offline, fast static app (Priority: P1) MVP

**Goal**: The new build is a proper PWA: update bar flow, offline, sub-path, audit, size budget, all with the legacy screens still in place.

**Independent Test**: quickstart section 4 and `npm run audit`.

### Tests first

- [X] T031 [P] [US2] Write failing unit tests `tests/unit/update-state.test.ts` for a framework-free `src/ui/update-state.ts` (a Svelte-store-compatible object with `subscribe`): `offer(worker)` sets the waiting worker; a window event `ttt:update-ready` with `detail` of `{ postMessage }` offers it; `apply()` posts `{ type: "skip-waiting" }` once and ignores a second call; `controllerchange` triggers a reload only when a worker already controlled the page; registration URL is resolved from the document base; use an injected `EventTarget` and fake `navigator.serviceWorker`
- [X] T032 [P] [US2] Edit the e2e specs for the delivery hooks (contracts C6), run them and see them fail: `tests/e2e/offline.spec.ts` update test serves `build/` and appends its suffix to `/service-worker.js`; `tests/e2e/subpath.spec.ts` serves `build-subpath/` under `/ultimattt/`; `tests/e2e/a11y.spec.ts`, `components.spec.ts` and `layout-audit.spec.ts` show the update bar by dispatching `ttt:update-ready` with `{ postMessage }` instead of importing `./js/ui/update-bar.js`; `tests/e2e/theme-dialog.spec.ts` delays `**/_app/immutable/entry/start.*.js` instead of `**/js/ui/app.js`. Also add `tests/e2e/shell.spec.ts` (FR-010, FR-016; these two cases pass once T015 exists, they guard later steps): with scripts blocked the page shows the page colour and the noscript note, and during a full Classic game plus a settings change the only origins requested are the app's own, `fonts.googleapis.com` and `fonts.gstatic.com`

### Implementation

- [X] T033 [US2] Implement `src/ui/update-state.ts` (and the service worker registration helper in it) so T031 passes; delete `src/ui/update-bar.ts` and its use in `src/ui/app.ts`
- [X] T034 [US2] Create `src/lib/components/UpdateBar.svelte` (id `#update-bar`, class `glass`, `Icon` `info`, `span.update-text` "A new version is ready.", an Update button that disables itself when pressed, hidden when nothing waits) and mount it in the shell in place of the plain div; register the worker from the shell's `onMount` through `update-state.ts`
- [X] T035 [US2] Make T032 pass: run `tests/e2e/offline.spec.ts`, `subpath.spec.ts`, `a11y.spec.ts`, `components.spec.ts`, `layout-audit.spec.ts`, `theme-dialog.spec.ts`, `installable.spec.ts`; fix the service worker, base-path handling or shell until they pass without any other edit to those specs
- [X] T036 [US2] Run `npm run audit` against `build/`; record accessibility score, axe count and first-load interactive time. The gate is accessibility at least 90, axe serious 0, interactive under 3000 ms
- [X] T037 [US2] Run `node scripts/check-build.mjs` and record first-load and total gzipped sizes in `baseline.md` (with the legacy UI included). If either is over budget, lazy-load the Cube and replay code behind `import()` in the legacy `app.ts` boot, re-measure, and only then, with a recorded reason in plan.md Complexity Tracking, change a budget
- [X] T038 [US2] Play a full game of each mode against the computer with the network off, from the root build and from `build-subpath/` (cover by adding one offline-vs-computer case to `tests/e2e/offline.spec.ts` if absent), confirming the worker chunk is precached (research R9 risk)

**Checkpoint**: US2 complete. The migrated build is installable, offline, updates only on request, works under a sub-path, and passes the audit. This is a shippable first increment (legacy UI inside SvelteKit).

---

## Phase 4: User Story 3 - The interface is built from reusable components (Priority: P2)

**Goal**: Every screen and shared part is a Svelte component; the imperative DOM layer is deleted. Each step ends with the full e2e suite and the parity spec green for the screens ported so far.

**Independent Test**: no screen is assembled with `h()` (`check-no-dom-builders --final`), `src/core` and `src/adapters` import no framework, and `npm run test:e2e` plus `npm run test:parity` pass.

### 4a. Shell state and primitives

- [X] T039 [P] [US3] Write failing unit tests `tests/unit/toast-state.test.ts` for `src/ui/toast-state.ts` (store-compatible): `add(text, ms)` appends an item with an id; the item removes itself after `ms` (fake timers); items keep their order; default 3500 ms
- [X] T040 [P] [US3] Write failing unit tests `tests/unit/dialog-state.test.ts` for `src/ui/dialog-state.ts`: `open(options)` returns a promise; `close(id, value)` resolves it with the value; dismissal resolves `null`; a stack keeps the previous dialog under the top one; `body.modal-open` state is true while any dialog is open
- [X] T041 [US3] Implement `toast-state.ts` and `dialog-state.ts`; keep `toast()` and `openDialog()` in `src/ui/ui.ts` with their current signatures delegating to the new stores, so legacy screens and new components share one toast region and one dialog host (research R10)
- [X] T042 [US3] Create `Icon.svelte` (from `ICON_PATHS`, 24 grid, same stroke attributes, `data-icon` attribute), `IconButton.svelte` (`icon-btn`, optional `small`, `aria-label` and `title`), `Button.svelte` (`btn`, `btn-primary`, `btn-destructive`), `Banner.svelte` (tone variants, `role="alert"` for error, busy dot, icon rules from `setBanner`) and `Mark.svelte` (from `markShape`; `mark-x` and `mark-o` classes, `mark-new` draw-in rules, `data-mark`; `help.ts` and `palette-picker.ts` import it, so it comes first) in `src/lib/components/`; keep `src/ui/icons.ts` as the data source and `tests/unit/icons.test.ts` unchanged
- [X] T043 [US3] (port rule) Create `Toasts.svelte` (region `#toasts`, `.toast[role="status"]`), `Dialog.svelte` and `DialogHost.svelte` (native `<dialog class="modal">`, `.modal-inner`, `.modal-head` with `h2#dialog-title` and the Close icon button, `.dialog-body`, `.btn-row`; open and close flip `is-open` with the 400 ms `transitionend` guard; Escape, Close and backdrop click resolve `null`; `body.modal-open`; focus into the primary button on open and back to the opener on close); mount both in the shell and delete the toast and dialog code from `ui.ts`
- [X] T044 [US3] (port rule) Create `TopBar.svelte` in the shell: `#help-back` (hidden unless help is open), `#help-button`, `#appearance-button` (icon follows `currentPreference()`, repaints on `MODE_EVENT`), the Settings button, with the same labels, titles and `aria-current="page"` rule on Help; remove `addHeaderButtons` from `src/ui/app.ts`
- [X] T045 [US3] (port rule) Create `ThemeDialog.svelte` from `theme-modal.ts` (Light, Dark, System radiogroup with `aria-checked` from the preference, the System note "Following your device. Currently dark.", applies at once through `applyMode` and `updateSettings`, never closes on choose); delete `src/ui/theme-modal.ts`; run `tests/e2e/theme-dialog.spec.ts` and `tests/unit/theme.test.ts`
- [X] T046 [US3] Checkpoint 4a: `npm run build && npm run check && npm test && npm run test:e2e && npm run test:parity`; fix every difference before continuing

### 4b. Setup and settings

- [X] T047 [P] [US3] Read `src/ui/setup.ts` and `tests/unit/setup.test.ts`; move any pure option model (choice lists, defaults, validation, config building, join-code handling) into `src/ui/setup-model.ts` and re-point `setup.test.ts` imports only, keeping every assertion; run it
- [X] T048 [US3] Create `Seg.svelte` (native radios styled as the segmented toggle and cards, group `role="radiogroup"`, same label markup `label > strong` the e2e `choose()` helper matches) and `Chip.svelte` (`aria-pressed`)
- [X] T049 [US3] Port `src/ui/setup.ts` to `Setup.svelte`: mode, opponent, size, win length, level `select#level`, mark, seed field, offline banner "You are offline. Check your connection to play on two devices.", error banners, one primary Start button, join-by-code; it calls the boot code to start a game; delete `src/ui/setup.ts` when `tests/e2e/classic.spec.ts`, `ultimate.spec.ts`, `cube.spec.ts`, `network.spec.ts` (setup parts) and `layout-audit.spec.ts` pass
- [X] T050 [US3] Port `src/ui/settings.ts` to `SettingsDialog.svelte` and `src/ui/palette-picker.ts` to `PalettePicker.svelte` (hints, replay speed, notation, palette rows with the "Selected" check and live X and O samples); `applySettings` and `SETTINGS_EVENT` become a `settings` store in `src/lib/state/settings.ts` over `loadSave`, `updateSettings`; delete both modules; run `tests/e2e/settings.spec.ts`, `marks.spec.ts`, `content-colours.spec.ts`
- [X] T051 [US3] Checkpoint 4b: build, check, test, e2e, parity

### 4c. Help

- [X] T052 [US3] Port `src/ui/help.ts` to `Help.svelte` (keep `src/ui/help-content.ts` as data, with `tests/unit/help-content.test.ts` unchanged); render it from `src/routes/help/+page.svelte` for direct loads and from the shell as an overlay when `page.state.help` is set; open it with `pushState("#/help", { help: true })` from `$app/navigation`; Back calls `history.back()` when help was opened by following a link, otherwise `history.replaceState` and closes, exactly as `app.ts` did; focus moves to `#help-view` on open and back to `#main` on close; delete `src/ui/help.ts`; run `tests/e2e/help.spec.ts` (including "help opened in the middle of a game leaves the game untouched") and `a11y.spec.ts`

### 4d. Boot and routes

- [X] T053 [P] [US3] Write failing unit tests `tests/unit/boot.test.ts` for a pure `src/ui/boot.ts` `decideBoot(search, hash, save, now)` returning `{ screen: "join" | "watch" | "host" | "rejoin" | "game" | "setup", ... }` in the order of data-model "Boot decision": `?join=CODE` first; a valid `?watch=`; an invalid `?watch=` falls through with its error; a saved network game being hosted or joined resumes with its code unless finished (and is cleared if finished); a saved local game resumes; otherwise setup
- [X] T054 [P] [US3] Write failing e2e `tests/e2e/routes.spec.ts` (contracts C1): a reload on `#/play` with a saved game restores it and with none shows setup at `#/`; a reload on `#/replay` without `?watch=` shows setup; `?join=CODE` joins then removes the query; an invalid `?watch=` shows its toast and setup; Start, resume and opening a replay add no history entry (history length unchanged) while opening help adds one and Back returns to the same game position with the computer's pending reply not restarted; an old `#/help` bookmark opens help
- [X] T055 [US3] Implement `src/ui/boot.ts` so T053 passes and write `src/routes/+page.svelte` (runs `decideBoot`, then `goto("/play" | "/replay", { replaceState: true })` or renders `Setup`), `src/routes/play/+page.svelte` and `src/routes/replay/+page.svelte` (guards from data-model); keep the legacy game inside `Bridge.svelte` for now: create `src/lib/legacy/Bridge.svelte` that mounts `gameScreen.mount` / `hostGame` / `joinGame` / `mountReplay` into a container on mount and cleans up on destroy; remove the routing, `hashchange` and `boot()` code from `src/ui/app.ts`; make T054 pass
- [X] T056 [US3] Checkpoint 4d: build, check, test, e2e, parity

### 4e. Game: Classic, Ultimate, computer, results

- [X] T057 [P] [US3] Read `src/ui/game.ts` in full, then write failing unit tests `tests/unit/game-session.test.ts` for `src/ui/game-session.ts` (contracts C7) from its behaviour and the assertions in `classic.spec.ts`, `ultimate.spec.ts`, `cube-rules.spec.ts` and `computer.test.ts`: place a mark and switch turn; refuse an illegal cell; undo as `game.ts` does today against a friend and against the computer (encode what the module does, not an assumption); resign; hint selection and its win or block kinds; the computer is asked after the player's move and its reply is applied; autosave after every change through an injected `saveGame`; result for win, draw and resign; restored games continue from `state`, `resigned` and `startedAt`
- [X] T058 [US3] Implement `src/ui/game-session.ts` (no DOM, no framework, Svelte-store-compatible `subscribe`) so T057 passes
- [X] T059 [P] [US3] Create `BoardClassic.svelte` and `BoardUltimate.svelte` (from `board-classic.ts`, `board-ultimate.ts`, `boards.ts`; `[data-cell]` buttons with `aria-label`, seams, rims, claimed boards with the 30% marks and the owner outline, last-move and win highlights, playable targets, win line); keep `src/ui/mark.ts` as data; move the DOM-free helpers `whereToPlay` and `boardName` out of `board-ultimate.ts` into `src/ui/board-text.ts` (re-point `game.ts`, `replay-text.ts` and their unit tests first)
- [X] T060 [P] [US3] (port rule) Create `Pill.svelte` (from `pill.ts` and the existing pure `pill-model.ts` logic; `#turn-pill`, `[data-mark]`, `.pill-score`, `aria-current`), `ResultDialog.svelte` and `ShareCard.svelte` (check icon, "X wins", one detail line, next action, copy with the "Copied" toast, native share when available, replay link), and a `confetti` Svelte action over `src/ui/confetti.ts` pure parts
- [X] T061 [US3] Port `src/ui/game.ts` to `Game.svelte` over `GameSession` for local, computer and restored games (status banners, hints row, Undo, Resign confirm as a destructive dialog, New game, banners, announcements through the `#status` region; the post-game replay uses the legacy `mountReplay` into a container until T068); mount it from `/play` instead of the bridge for non-network, non-Twist games; network games, Twist games and the replay still go through the bridge, so `game.ts`, `boards.ts`, `pill.ts`, `board-classic.ts`, `board-ultimate.ts` and `replay.ts` stay until T072; run `classic.spec.ts`, `ultimate.spec.ts`, `pill.spec.ts`, `input.spec.ts`, `marks.spec.ts`, `compat.spec.ts`
- [X] T062 [US3] Checkpoint 4e: build, check, test, e2e, parity, and `npm run test:perf` (computer reply times must stay within the numbers recorded in `baseline.md` by T002; no new failures)

### 4f. The Cube

- [X] T063 [P] [US3] Read `src/ui/board-cube.ts` and `src/ui/cube-view.ts`, then write failing unit tests `tests/unit/cube-session.test.ts` for `src/ui/cube-session.ts` (contracts C7) on top of `src/core/turn-selection.ts`: select a layer and a direction previews it; selecting another layer reverses then previews the new one; confirm commits the turn; cancel and reset discard it; the preview model reports the layer's stickers and angle; derive cases from `turn-selection.test.ts`, `cube-rotations.test.ts` and `cube.spec.ts`
- [X] T064 [US3] Implement `src/ui/cube-session.ts` so T063 passes
- [X] T065 [US3] (port rule) Port the 3D scene, flat net, drag-to-turn and snap from `src/ui/cube-view.ts` to `CubeView.svelte` (stickers with `data-face`, `data-cell`, `data-mark`, `data-line`, `data-last`, `data-locked`, `data-preview`; `--E`, `--n`, `--rx`, `--ry`, `--turn` custom properties; `.cube-scene.snap`, `.no-anim`, `--duration-turn`; locked-face badge with the padlock icon and the "locked" accessible name; view switcher; reduced motion unchanged); keep `src/ui/cube-labels.ts` as data
- [X] T066 [US3] Port `src/ui/board-cube.ts` to `CubeBoard.svelte` (layer picker `role="group"` named "Turn a layer", turn buttons with icons or notation, Confirm turn and Cancel, caption, phases place and rotate, scoring pill, hints) over `CubeSession` and `GameSession`; mount it from `/play` for Twist games; keep the legacy `board-cube.ts` and `cube-view.ts` until T072 (the legacy replay and network game still import them); run `cube.spec.ts`, `cube-rules.spec.ts`, `motion.spec.ts` (cube cases) and `layout-audit.spec.ts`
- [X] T067 [US3] Checkpoint 4f: build, check, test, e2e, parity, perf. The Twist 5x5 frame-budget failure is known and pre-existing (66.7 ms against 50 on the 005 baseline); anything else failing is a regression

### 4g. Replay

- [X] T068 [US3] Port `src/ui/replay.ts` to `Replay.svelte` and `ReplayControls.svelte` (after the Cube: it renders the board of every variant with `BoardClassic`, `BoardUltimate`, `CubeView` and `Pill`) (icon buttons named as now, `#replay-readout` "Move N of M", speed control, autoplay, progress, "Play this seed" action, `role="group"` named "Replay controls", Close replay); `src/ui/replay-text.ts` stays; the `/replay` route reads `location.search` through `src/core/record.ts` `unpackLink`; swap the legacy `mountReplay` use in `Game.svelte` and `Bridge.svelte` for `Replay.svelte`; delete `src/ui/replay.ts`; run `tests/e2e/replay.spec.ts` and `tests/unit/replay.test.ts`

- [X] T069 [US3] Checkpoint 4g: build, check, test, e2e, parity, perf

### 4h. Two-device play and removing the bridge

- [X] T070 [P] [US3] Add failing e2e cases to `tests/e2e/network.spec.ts`: help opened in the middle of a two-device game leaves the connection and play intact; leaving a hosted or joined game (New game, or navigating to setup) closes its connection so a later game gets no stale messages; both written to fail only if the migrated component misbehaves (they pass on the legacy code); also add failing cases to `tests/unit/game-session.test.ts` for the network hooks `mountNetGame` has today (a remote move is applied, a local move is sent, a disconnect is reported as `game.ts` does it)
- [X] T071 [US3] Port `src/ui/multiplayer.ts` to `Host.svelte` and `Join.svelte` (pairing code in `reveal` with tabular figures, `.join-link`, QR from `src/ui/qr.ts` rendered with `{@html}` of its trusted SVG string, waiting and offline banners, resume under the same code, guest rejoin); the connection lives in a store created on mount and closed in `onDestroy`; extend `GameSession` and `Game.svelte` with the network hooks so two-device games play in the component; `/play` mounts these for network games; run `network.spec.ts` and `tests/unit/net-codes.test.ts`
- [X] T072 [US3] Delete the bridge and the imperative layer: remove `src/lib/legacy/Bridge.svelte`, `src/ui/app.ts`, `src/ui/multiplayer.ts`, and whichever of `game.ts`, `boards.ts`, `pill.ts`, `board-classic.ts`, `board-ultimate.ts`, `board-cube.ts`, `cube-view.ts` still exist, and `h`, `clear`, `setBanner` and the dialog and toast shims from `src/ui/ui.ts` (keep `announce` as a store-backed helper and the storage re-exports if still used); add `node scripts/check-no-dom-builders.mjs --final` to the `check` script in `package.json`; fix every import until `npm run check` and `npm test` pass
- [X] T073 [US3] Checkpoint 4h: `npm run build && npm run check && npm test && npm run test:e2e && npm run test:parity && npm run test:perf`

**Checkpoint**: US3 complete. Every screen is a component, `h()` and the bridge are gone, and the guard is on.

---

## Phase 5: User Story 1 - The app looks and plays exactly as before (Priority: P1)

**Goal**: Close the parity claim with evidence across every screen, save and link.

**Independent Test**: `npm run test:parity` against the baseline, the full e2e suite, and the fixtures.

- [X] T074 [US1] Run `npm run test:parity` on the final build; review every difference image; for each, fix the component or record a deliberate difference in `plan.md` Complexity Tracking with a reason. Target: zero unexplained differences at 320, 480 and 720 px in both modes (SC-002)
- [X] T075 [P] [US1] Run `tests/e2e/compat.spec.ts` against fixtures `tests/fixtures/001` to `003`, a seed link from an earlier version, and a legacy `ttt.theme` value; confirm all load and play unchanged (SC-003). Add any missing fixture case to `compat.spec.ts` first, see it pass on the legacy baseline commit if needed
- [X] T076 [P] [US1] Two-device parity: with two browser contexts, play a hosted game to a result, once with both on the migrated build; run `network.spec.ts` in both desktop and mobile projects (spec acceptance 1.3). Cross-version pairing (old app with new) is checked by hand in T090
- [X] T077 [US1] Re-run the design checks that guard 006's rules against the final source: `npm run check`, `tests/e2e/layout-audit.spec.ts`, `content-colours.spec.ts`, `motion.spec.ts`, `a11y.spec.ts`; none may be edited beyond contracts C6 (SC-001): run `git diff <commit where this work started> -- tests/e2e`, check every hunk against contracts C6, and list any hunk not covered there in `baseline.md` with its reason

**Checkpoint**: US1 complete.

---

## Phase 6: User Story 4 - Checks and tests still guard the design (Priority: P2)

**Goal**: Every release gate catches a deliberate violation in the migrated source.

**Independent Test**: for each check, add the violation from its fixture to the real source temporarily and see `npm run check` or `npm test` fail (SC-010).

- [X] T078 [P] [US4] Extend `tests/unit/copy-rules.test.ts` first (failing): scan the text nodes, `aria-label`, `title`, `placeholder` and `alt` attributes of `src/lib/**/*.svelte`, `src/routes/**/*.svelte` and `src/app.html` for em dashes, exclamation marks and emoji, plus string literals in the remaining `src/ui/*.ts`; add a fixture `.svelte` with a violation of each kind that must be reported
- [X] T079 [US4] Implement the `.svelte` text scanner in `tests/unit/copy-rules.test.ts` support code (a small tag-stripping reader, no new dependency) so T078 passes on the real source and fails on the fixtures
- [X] T080 [P] [US4] Add a deliberate-violation fixture and failing-first case per check in `tests/unit/check-scripts.test.ts` and the new check tests, one each for the cases T007 to T010 did not cover (the `.svelte` colour literal and the third breakpoint are in T010): a stored-value mismatch in the pre-paint script, a worker cache name without the build version, `skipWaiting` outside the message handler, a framework import in `src/core`, an `h()` call in `src/lib`, an oversize bundle; confirm each case names the file and rule
- [X] T081 [US4] Make T080 pass; then run the manual mutation check once: add a colour literal to a component style, a `@media (min-width: 720px)`, and an `import "svelte"` in `src/core/rules.ts` in turn, confirm `npm run check` fails each time with a useful message, and revert each
- [X] T082 [US4] Make Svelte compiler warnings fail the build: confirm `svelte-check --fail-on-warnings` is in `typecheck`, and fix any accessibility or unused-CSS warning in the components without suppressing it (a suppression needs a comment with the reason)
- [X] T083 [US4] Update `docs/pwa-design-spec.md` and `README.md` where they name `site/`, `site/css/theme.css`, `tsc`, `precache.json` or `VERSION`: replace with `static/css/theme.css`, `npm run build` and the new service worker rule; keep no em dashes; add a note that departures from 007 are in `specs/007-sveltekit-ui-migration/plan.md`

**Checkpoint**: US4 complete.

---

## Phase 7: Polish and Cross-Cutting

- [X] T084 Regenerate the install screenshots with `node scripts/make-screenshots.mjs` served from `build/` into `static/screenshots/`; compare with the old ones; keep the manifest `label` text accurate
- [X] T085 Remove the old layout: delete `site/index.html`, `site/js`, `site/sw.js`, `site/precache.json` and the empty `site/` folder; remove the `site/` lines from `.gitignore`; confirm `grep -rn "site/" src scripts tests package.json playwright*.ts` finds nothing stale
- [X] T086 [P] Run `grep -rn "—" src static scripts docs specs/007-sveltekit-ui-migration` and confirm no em dashes in UI copy, comments or docs (task lines in this file that quote the grep command are the only allowed hits)
- [X] T087 Run the whole gate set: `npm run build && npm run check && npm test && npm run test:e2e && npm run test:parity && npm run test:perf && npm run audit`; record every result and the gzipped sizes in `quickstart.md` under a "Results" heading, with the 006 numbers beside them (467 unit, 89 contract, 564 e2e, accessibility 100, 2588 ms interactive, 29.6 KB plus 10.4 KB first load)
- [X] T088 Update `plan.md` Complexity Tracking for anything that changed during implementation (the budget, a recorded visual difference, the worker chunk handling, the `ttt:update-ready` seam), and check `contracts/ui-contracts.md` still matches the code
- [X] T089 Confirm nothing is staged or committed by this work (`git status --short`), and that the scratch spike is not in the repo
- [ ] T090 Manual walkthrough by a person of quickstart sections 2 to 4, including pairing the pre-migration app (a 006 build) with the migrated app for a two-device game, and note any deviation in `quickstart.md` Results. If no person has done it, record that plainly instead of ticking it

---

## Dependencies and Execution Order

- Phase 1: T003 and T004 must finish before T005 (the baseline needs the old toolchain). T001, T002 and T006 can run alongside them.
- Phase 2 blocks everything. Within it: T007 to T011 (tests) before T012 to T029; T012 (moving static files) before T017, T023, T029; T013 and T014 before T016; T015 and T018 before T030; T030 last.
- US2 (Phase 3) needs Phase 2. T031 and T032 before T033 to T035. T036 to T038 after T035.
- US3 (Phase 4) needs US2 (the update bar and service worker exist). Sub-phases run in order 4a to 4h. Inside a sub-phase, `[P]` tasks (test writing, independent components) can run together.
  - 4a: `Mark.svelte` is built here because Help (4c) and the palette picker (4b) import it.
  - 4d (boot and routes) needs 4b and 4c. 4e (game) needs 4d. 4f (Cube) needs 4e, because it shares `GameSession` and `Game.svelte`.
  - 4g (replay) needs 4e and 4f: it renders the board of every variant with `BoardClassic`, `BoardUltimate`, `CubeView` and `Pill`.
  - 4h (two-device) needs 4g. T072 (bridge and legacy removal) needs every port done.
  - Shared legacy modules (`game.ts`, `boards.ts`, `pill.ts`, `board-*.ts`, `cube-view.ts`, `multiplayer.ts`) stay until T072, because the legacy network game and the bridge still import them.
- US1 (Phase 5) needs T072. Its parity captures also ran at each checkpoint during Phase 4.
- US4 (Phase 6): T078 and T080 can be written any time after Phase 2 and are most useful before T072; T079, T081 and T082 need Phase 4. T083 needs T072.
- Polish (Phase 7) needs everything.

## Parallel Opportunities

- Phase 2 tests: T007, T008, T009, T010, T011 together. Scripts T026 and T027 together after their tests.
- US2 tests: T031 and T032 together.
- 4a tests: T039 and T040 together. 4e: T057 with the component tasks T059 and T060 once their data inputs are read (T061 waits for all three).
- 4f: T063 can be written while 4e is being finished.
- US4: T078 and T080 together; US1: T075 and T076 together.

## Implementation Strategy

1. **MVP**: Phases 1 to 3. The unchanged UI runs inside a SvelteKit static build that is installable, offline, sub-path safe, audited and size-checked, with every guard re-pointed. Ship-ready checkpoint and the point where the riskiest unknowns (build, base path, worker, update flow) are proven.
2. **Increment 2**: Phase 4a to 4d (shell, setup, settings, help, boot and routes). Low-risk screens first.
3. **Increment 3**: 4e to 4g (the game, the Cube and the replay). The riskiest logic is extracted into tested sessions before its components are written.
4. **Increment 4**: 4h, then Phases 5 to 7: two-device play, bridge removal, parity close-out, guard rails, docs and clean-up.
5. After each checkpoint task: `npm run build && npm run check && npm test`, then the e2e and parity subsets named. Do not start the next sub-phase on a red checkpoint.
