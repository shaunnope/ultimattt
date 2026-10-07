# Contracts: SvelteKit UI Migration

These are the interfaces the migration must hold fixed or define. Anything not listed here follows the existing DOM, class names and copy from spec 006 and `docs/pwa-design-spec.md`.

## C1. Addresses and links (unchanged for players)

| Address or link | Meaning | Rule |
|---|---|---|
| `<base>/` | start screen, or resume | Same as today |
| `<base>/#/help` | help | Opens as a direct load (real route) and in-app (shallow route over the current page) |
| `<base>/#/play`, `<base>/#/replay` | game, replay | Reached by `replace`; a reload restores or returns to `#/` (data-model, Boot decision) |
| `<base>/?join=CODE` | pairing link host shares | Format unchanged; read from `location.search`; opening it joins, then the query is removed with `history.replaceState` |
| `<base>/?watch=...` | replay link | Format unchanged; invalid links show their existing error toast and fall back |
| Seed links from earlier versions | seed in the record | Load and behave unchanged (compat e2e and `record.test.ts`) |

The hash holds the route; the query string is never moved into the hash. `<base>` is the site root or a sub-path chosen at build time.

## C2. Build output contract (asserted by `check-build` and a contract test)

1. `npm run build` writes `build/` (root base) with `index.html`, `service-worker.js`, `_app/immutable/**`, `css/`, `icons/`, `manifest.json`, `404.html`, `screenshots/`.
2. No server code is emitted and none is needed: every file is static.
3. In the root build, no URL in `index.html` begins with a host other than the allowed third parties (Google Fonts). Root-absolute URLs are allowed in the root build only; the sub-path build must have none outside its base.
4. The manifest keeps the 006 contract: relative `id`, `start_url`, `scope`; theme and background colours equal the light page token; icons 192, 512 and maskable 512; narrow and wide screenshots with labels.
5. The shell links the three stylesheets and carries the pre-paint script before any module script (FR-010).
6. Size budget (R12): first-load script plus style at most 70 KB gzipped, all script at most 160 KB gzipped. Counted from the output, not estimated.
7. `index.html` contains no `modulepreload` for a file missing from the output, and no `site/` path.

## C3. Service worker contract (asserted by `check-sw`, `check-build`, installable, offline and subpath e2e)

1. Source: `src/service-worker.ts`; output `build/service-worker.js`; registered by the app (Kit's automatic registration off) with scope at the app root.
2. Precache: every `immutable` and `assets` entry from `$app/manifest` except `screenshots/` and dot files, plus `prerendered` and the base shell. Fetched with `cache: "reload"`.
3. Cache name `ttt-${version}`, `version` from `$app/env`. `activate` deletes every other `ttt-*` cache and calls `clients.claim()`.
4. `skipWaiting()` is called only from the `message` handler, on `{ type: "skip-waiting" }`. Nothing installs or activates a replacement without that message when a worker is already in control.
5. A navigation request is answered from the cache ignoring the query, then the base shell, then the network. Non-GET and cross-origin requests are not handled.
6. Update bar: "A new version is ready." with an Update button in `#update-bar`; nothing happens until pressed; the game was saved on its last move and resumes.
7. Test seam: a window event `ttt:update-ready` with `detail: { postMessage(message) }` makes the bar show for that worker, the same path the registration code uses.

## C4. Shell and landmark contract (so selectors and the audits keep working)

The shell keeps these ids, roles and classes. Components may add wrappers but must not rename or remove them.

| Selector | Role |
|---|---|
| `a.skip-link` (first tab stop, targets `#main`) | skip link |
| `#update-bar.glass` | update bar host, hidden until an update waits |
| `header.topbar.glass`, `.app-brand`, `.app-logo`, `.app-title`, `#header-actions` | top bar |
| `#help-back`, `#help-button`, `#appearance-button`, the Settings icon button (named "Settings") | top-bar buttons with the same accessible names |
| `main#main` (tabindex -1) | the current screen |
| `#help-view` (tabindex -1, `aria-label="Help"`) | the help view, beside `main`, as today |
| `#status` (`role="status"`, `aria-live="polite"`, `.sr-only`) | `announce()` target |
| `#toasts` (`aria-live="polite"`), `.toast[role="status"]` | toast region |
| `dialog.modal`, `.modal-inner`, `.modal-head`, `.dialog-body`, `.btn-row`, `.is-open`, `body.modal-open` | dialogs |
| `#turn-pill`, `[data-mark]`, `.pill-score` | pill |
| `[data-cell]`, `.board`, `.cube-board`, `.sticker`, `[data-face]` | boards |

Copy, icon names (`data-icon`), class names and ARIA attributes are those of the current build. Any difference found by the layout audit or a screenshot comparison is a defect unless recorded in the plan.

## C5. Check scripts (each fails on a deliberate violation; tested first)

| Script | Enforces | Reads |
|---|---|---|
| `check-sw.mjs` | C3.3 and C3.4 | `src/service-worker.ts` |
| `check-build.mjs` | C2, C3.2, C3.3 (version in cache name), size budget | `build/`, `src/service-worker.ts` |
| `check-core-purity.mjs` | no import of `svelte`, `svelte/*`, `@sveltejs/*`, `$app/*`, `$lib/*` or any `.svelte` file from `src/core` and `src/adapters` | those folders |
| `check-no-dom-builders.mjs` | none of: the `h()` helper, `document.createElement`, `Bridge`, an import from a deleted imperative module, in `src/ui`, `src/lib`, `src/routes` (the DOM-free helpers are allowed). Runs only once the final phase flips it on | `src/` |
| `check-theme.mjs` | the pre-paint script and `resolveMode` agree for every stored value | `src/app.html`, `src/ui/theme.ts` |
| `check-theme-tokens.mjs` | no colour literal outside `static/css/theme.css` token declarations, including `<style>` blocks of `.svelte` files | `static/css/*.css`, `src/**/*.svelte` |
| `check-contrast.mjs` | the declared pairs, both modes | `static/css/theme.css`, `scripts/contrast-pairs.json` |
| `check-breakpoints.mjs` | only `max-width: 480px` and `min-width: 640px` | `static/css/*.css`, `src/**/*.svelte` |
| `check-names.mjs` | reference project names absent from visible text | `src/**/*.{ts,svelte}`, `src/app.html`, `static/manifest.json` |

Retired: `gen-precache.mjs`, `gen-preload.mjs`, `check-precache.mjs`, `check-version.mjs`, `precache.lock.json` (replaced by C3 and `check-build`).

## C6. e2e edits allowed (everything else is unchanged; each is listed in the PR with its reason)

| Spec | Edit | Reason |
|---|---|---|
| `a11y`, `components`, `layout-audit` | the update bar is shown by dispatching `ttt:update-ready` instead of importing `./js/ui/update-bar.js` | the built module path no longer exists (C3.7) |
| `theme-dialog` | the 2 s route delay targets the app entry script (`**/_app/immutable/entry/start.*.js`) instead of `**/js/ui/app.js` | the entry module is renamed by the build |
| `offline` | the update test serves `build/` and appends its suffix to `/service-worker.js` instead of `site/` and `/sw.js` | build directory and worker file name |
| `subpath` | serves `build-subpath/` under `/ultimattt/` | base path is a build-time setting (R3) |
| `installable`, `offline`, `network`, `replay`, `help`, `components` | none expected beyond the base URL; they use `serviceWorker.ready` and are layout-independent | confirm in the first full run |
| `components` (icons test), `a11y` (offline banner, skip link), `layout-audit` (start screen offline), `help` (browser back, focus ring), `marks` (palette after reload) | wait for the Start game button (or the help heading) before acting or reading app state (counting icons, going offline, pressing Tab, opening help, reading a colour) | the app now boots after the load event; these steps do not wait on their own. A spec found to race the boot later gets the same wait and a row here |
| `relay.ts` (the two-device test stand-in) | a change of the #/ part of the address is not a reload, so it no longer drops the page's connections | opening help over a game is a same-page address change now, and the 007 specs open help in a two-device game |
| `playwright.config.ts`, `playwright.perf.config.ts` | `webServer` builds and serves `build/`; the expectation timeout goes from 10 s to 15 s | build directory; the app starts from scripts after the page loads, which under a full parallel run on this machine sometimes took longer than 10 s |

A spec edited for any other reason needs an entry here first (SC-001).

## C7. Framework-free session APIs (unit-tested in node)

```text
GameSession(config, { computer, save, now, delay, restored?, net? })   // src/ui/game-session.ts
  .state, .resigned, .startedAt, .over, .computerToMove, .thinking, .canUndo, .change
  .start()                  // saves, and asks the computer if it is to move
  .place(move) -> { ok } | { ok: false, reason, silent? }
  .undo() .resign(mark) .leave() .sync()      // sync: two devices, the shared position changed
  .hints(enabled) .statusText() .pill() .result() .nextConfig() .refusalText(reason)
  .idle()                   // the computer's turn in flight, for tests
  .subscribe(listener) -> unsubscribe
  // writes the save after every change; imports no DOM and no framework; two devices go through `net` (ui/net-types.ts)

CubeSession(driver, onMove)                          // src/ui/cube-session.ts
  .select(rotation) .confirm() .cancel() .reset()
  .preview (shown), .settled (held), .busy, .reversing
  .position(previous, state) -> { justConfirmed }   // a new position arrived
  .subscribe(listener) -> unsubscribe
  // driver: the view's play, retarget, reverse, discard and commit; the flow's rules are core/turn-selection.ts
```

Behaviour is the current behaviour of `game.ts`, `board-cube.ts` and `cube-view.ts`; the first tests are written from the existing e2e assertions and `turn-selection.test.ts` so the extraction cannot change a rule.

## C8. Forbidden couplings

- `src/core` and `src/adapters` import nothing from the framework (C5, `check-core-purity`).
- A `.svelte` file never writes `localStorage` directly; it goes through `src/adapters/store.ts` and `src/ui/theme.ts`.
- No component builds markup with string HTML (`{@html}`) except the logo SVG and icon path data already held as trusted constants.
- No new network origin (R14).
