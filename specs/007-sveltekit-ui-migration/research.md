# Research: SvelteKit UI Migration

Decisions that shape the plan. R1 to R4 were checked with a throwaway SvelteKit project outside the repo (build, hash router, base path, shallow routing, in Chromium through Playwright). Anything not spiked is marked as a risk with the test that will catch it.

## R1. Which SvelteKit, and what it forces

**Decision**: SvelteKit 3.0.1 with `@sveltejs/adapter-static` 4.0.0, `@sveltejs/vite-plugin-svelte` 7.x, Vite 8.3, Svelte 5.57 (runes), TypeScript 6, and `svelte-check` for `.svelte` type checks.

**Findings from the spike** (these are the 3.x behaviours the plan is built around):

- Configuration goes in the Vite plugin call, `sveltekit({ ... })`. A `svelte.config.js` is rejected with `config_file_unsupported`.
- Peer range is `typescript ^6.0.0`, so the repo's TypeScript moves from 5.7 to 6. Engines: Node 22.17 or newer (the repo asks for 22.18).
- `tsconfig.json` must extend `$app/tsconfig` and exclude `src/service-worker`, or `svelte-kit sync` and the build fail with `tsconfig_invalid`.
- `$service-worker` is gone. A worker imports `immutable`, `assets` and `prerendered` from `$app/manifest`, and `version` from `$app/env`.
- With `router.type: "hash"`, the page options `ssr` and `prerender` are rejected (`router_hash_page_options`); the app is a client-rendered shell by construction.

**Rationale**: the user asked for SvelteKit; the current major is 3. Starting on 2.x would mean a second migration later.

**Alternatives considered**: SvelteKit 2.70 (works with TypeScript 5 but is the previous major, with a different service-worker API); plain Svelte with Vite (lighter, but the request names SvelteKit and Kit supplies the build manifest and router); Astro or another meta-framework (not requested).

**Risk**: a new major with less field time. Mitigation: the parity e2e suite is the gate, and the spike's findings are encoded as build contract checks (contracts C2).

## R2. Routing: hash router, static output

**Decision**: `router: { type: "hash" }` with `adapter-static` and no fallback page. The build is one `index.html` plus assets. Routes: `/` (`#/`), `/play`, `/replay`, `/help`. Share and join links keep their shape, `https://host/base/?watch=...` and `?join=CODE`, because query strings live on the document URL, not in the hash. Code reads `location.search` directly (as `app.ts` does now), not `page.url`.

**Rationale**: it keeps the existing `#/help` address, which `help.spec`, `a11y.spec` and `layout-audit.spec` open with `page.goto("./#/help")`. It needs no host rewrite or 404 fallback, so GitHub Pages and any static host behave the same, and a hard reload on any route works.

**Alternatives considered**: path routes with prerendering. That needs a prerendered file per route, a host fallback for unknown paths, and changes every address and test; and it forces `/help` where `#/help` is bookmarked today.

## R3. Base path and the sub-path build

**Decision**: `paths.base` comes from the `BASE_PATH` environment variable, empty by default. `scripts/build.mjs` sets it in-process (not through the shell) and runs `vite build`. The e2e config builds twice: root output to `build/`, and `BASE_PATH=/ultimattt` output to `build-subpath/` for the sub-path specs.

**Spike result**: a build with an empty base wrote `href="/favicon.svg"` and `import("/_app/...")` in the shell, which would 404 under `/ultimattt/`. Setting `paths.base` to `/ultimattt` wrote `/ultimattt/...` everywhere, and a Chromium run against a server that serves only under that prefix made zero requests outside it. `paths.relative: true` did not make the shell relative for a client-rendered hash app, so it is not used.

**Windows note** (a trap hit during the spike): Git Bash rewrites `BASE_PATH=/ultimattt` into a Windows path before Node sees it, which Kit rejects as `config_paths_base_invalid`. Setting it inside a Node script avoids that on every shell.

**Alternatives considered**: patching the generated HTML to relative URLs after the build. Rejected: it edits generated output that the next Kit release can change.

## R4. Keeping a game alive under help (shallow routing)

**Decision**: help opens with `pushState("#/help", { help: true })` from `$app/navigation`, rendered by the root layout as an overlay view while the current page stays mounted. Loading `#/help` directly (reload, bookmark, test) hits the real `/help` route, which renders the same `Help` component. Starting a game, resuming one and opening a replay use `goto(..., { replaceState: true })`, so they add no history entries and the browser's Back behaves as it does today.

**Spike result** (hash mode, under a base path): after `pushState` the URL became `#/help`, `page.route.id` stayed `/play`, the counter component kept its state and the unmount counter stayed 0; Back removed the overlay and restored `#/play`. A normal link to `#/help` unmounted the page (unmount count 1), which is why shallow routing is needed for in-game help.

**Rationale**: the existing test "help opened in the middle of a game leaves the game untouched" and the 006 contract require this. For two-device games a remount would also drop the connection.

**Alternatives considered**: a session object that outlives the page (more state to keep in step; unmount during help would still stop timers); keeping help as a normal route and re-opening the game on return (restarts the computer's turn, re-hosts the game).

## R5. Styles stay global

**Decision**: `theme.css`, `style.css` and `cube.css` move to `static/css/` unchanged and are linked from `src/app.html` as they are today. Components use the same class names. Scoped `<style>` blocks are allowed for small, layout-only rules and are scanned by the colour-literal and breakpoint checks.

**Rationale**: in a client-rendered hash app, CSS imported by a component is injected after the scripts run, so the first frame is unstyled and a dark device would flash light. A static `<link>` in the shell keeps FR-010 and SC-007. It also keeps every class-based selector in about 60 e2e tests valid and the 006 design checks scanning the same files.

**Risk**: static files are not content-hashed, so a stale cached stylesheet is possible without the service worker's cache version. The service worker precaches them under the build version, and the browser's HTTP cache is bypassed for them with `cache: "reload"` at install, as the current worker does.

## R6. Service worker and the update flow

**Decision**: `src/service-worker.ts` (Kit's service worker entry) with Kit's automatic registration turned off (`serviceWorker: { register: false }`). The app registers it itself from the update-bar state module, which keeps today's behaviour: register, watch for a waiting worker, offer "A new version is ready.", send `skip-waiting` only on the player's click, reload on `controllerchange` when a worker was already in control.

- Precache list: `immutable` plus `assets` from `$app/manifest`, minus `screenshots/`, minus dot files, plus `prerendered` paths and the base shell (`./`). The font and PeerJS are cross-origin and never cached (the worker ignores other origins, as now).
- Cache name: `ttt-${version}` with `version` from `$app/env`. Kit's default version is a build timestamp, so every build has a new cache name; the manual `VERSION` constant and `precache.lock.json` are no longer needed.
- Navigation fallback: a navigation request is answered from the cache ignoring the query string (so `?watch=` and `?join=` open the cached shell), then the base shell, then the network.
- `check-sw` keeps its rules (`skipWaiting` only in the `message` handler; `activate` calls `caches.delete`) and reads `src/service-worker.ts`. `check-build` adds: the cache name uses the build version, every file in the build manifest is in the precache list, and no shell URL is root-absolute in the root build.

**Test seam for the update bar**: three e2e specs import `./js/ui/update-bar.js` and call `offerUpdate`. That module path will not exist. The update state module listens for a window event, `ttt:update-ready` (detail: a `{ postMessage }` worker stand-in), which the real registration code also uses internally. The specs dispatch that event. Recorded as test edits in C6.

**Risk**: Kit's `immutable` list might omit Worker chunks. Mitigation: `check-build` compares the manifest to the files on disk in `build/_app`, and the offline e2e plays against the computer with the network off.

## R7. First paint, head order and the font

**Decision**: `src/app.html` holds what `site/index.html` holds today: charset, title, viewport, description, theme-color, manifest, icons, the inline pre-paint script (same code, same `ttt.mode` then legacy `ttt.theme` read), stylesheet links, and the non-blocking Nunito links. The `<!-- modulepreload -->` block and `gen-preload.mjs` are dropped; Kit writes its own `modulepreload` links. `check-theme` reads the script from `src/app.html`.

The shell content (skip link, update-bar host, top bar, `#main`, status and toast regions) moves into `+layout.svelte`. Because it is rendered by the client, the first paint shows the page colour and an empty frame, as it does now (`<main>` is empty until the module runs). The noscript note stays in `app.html`.

## R8. Source layout and what is extracted

**Decision**: `src/core` and `src/adapters` keep their paths and are not edited, so their tests do not change. Pure UI helpers keep their paths in `src/ui`. Components go in `src/lib/components`. State that was module-level variables in DOM files becomes rune state in `src/lib/state/*.svelte.ts` over the same adapters.

Logic that is mixed into DOM modules is extracted first, as plain TypeScript with unit tests, so the component only renders and forwards events:

- `game-session.ts` from `game.ts` (494 lines): current state, move, undo, resign, hint selection, autosave, computer turns, result.
- `cube-session.ts` from `board-cube.ts` and `cube-view.ts` (889 lines): layer selection and preview model on top of `src/core/turn-selection.ts`; drag and snap stay in the component.
- `src/ui/pill.ts` already has a pure model (`pill-model.test.ts`); the component uses it.

**Rationale**: Constitution V (thin UI over testable logic) and Principle I (a failing unit test for each extracted rule).

## R9. The computer worker

**Decision**: keep `src/ui/computer.ts` and its `WorkerLike` seam; start the worker with `new Worker(new URL("./ai-worker.ts", import.meta.url), { type: "module" })`, which Vite bundles as its own chunk. The existing fallback that imports the solver on the main thread stays for environments without module workers.

**Risk (not spiked)**: worker chunk URL under a base path and in the precache. Caught by: the subpath e2e playing against the computer, the offline e2e, and `check-build` listing worker chunks.

## R10. Migration order and the bridge

**Decision**: scaffold first, then port in this order, each step green on the full e2e suite: (1) shell, theme state, toasts, dialogs and update bar; (2) setup and settings; (3) help; (4) replay; (5) Classic and Ultimate boards and `Game`; (6) the Cube; (7) two-device host and join; (8) delete the bridge, `h()` and every imperative module, turn on `check-no-dom-builders`.

A temporary `Bridge.svelte` calls an unported module's `mount(container, ...)` or `render*(container, ...)` from `onMount` and cleans up on destroy, so a screen that is still imperative runs inside the new shell. Imperative code keeps calling `toast()` and `openDialog()`; those functions become thin writers into the new state so both worlds share one dialog host and one toast region.

**Alternatives considered**: big-bang rewrite (no green checkpoint, parity unverifiable until the end); incremental screens without a bridge (the shell must exist first and old screens need somewhere to render).

## R11. Tests: what stays, what changes

- Unit and contract tests of `src/core` and `src/adapters`: untouched.
- Unit tests that exercise pure UI helpers (`theme`, `status-text`, `help-content`, `icons`, `mark`, `pill-model`, `qr`, `computer`, `confetti`): untouched, unless a helper is re-homed (import paths only).
- Removed with their scripts: `gen-precache.test.ts`, `gen-preload.test.ts`, the `check-precache` and `check-version` cases in `check-scripts.test.ts`.
- New unit tests, written first: `check-core-purity`, `check-no-dom-builders`, `check-build` (precache coverage, version name, size budget, absolute URLs), updated `check-sw`, `check-names` and `check-theme*` readers, `game-session`, `cube-session`, and the update-state event seam.
- Node's test runner cannot import `.svelte`, so component behaviour is covered by the e2e suite; anything with rules goes in a `.ts` module first.
- e2e: same assertions. Edits are limited to the hooks and layout facts listed in contracts C6.

## R12. Size budget

Measured on the current build: 19 startup modules, 79.3 KB raw and 29.6 KB gzipped; three stylesheets, 37.2 KB raw and 10.4 KB gzipped; all script 303.8 KB raw and 99.7 KB gzipped.

**Budget**: first-load script plus style at most 70 KB gzipped (about 40 KB today plus about 30 KB for the Svelte and Kit runtimes); all shipped script at most 160 KB gzipped. `check-build` computes both from `build/` (first load = the files the shell preloads plus the entry, plus the linked stylesheets) and fails above budget. The Lighthouse gate (interactive under 3 s) stays as the real measure; the byte budget catches regressions earlier. If the first measurement lands above budget, the plan's response is to lazy-load the Cube and replay routes, not to raise the number without a recorded reason.

## R13. Tooling changes

- `package.json`: `build` runs `node scripts/build.mjs`; `typecheck` runs `svelte-check` and `tsc -p tsconfig.tests.json`; `check` swaps `check-precache` and `check-version` for `check-build`, and adds `check-core-purity` and `check-no-dom-builders`; the new devDependencies from R1.
- `tsconfig.json` extends `$app/tsconfig` (generated by `svelte-kit sync`, which `build.mjs` runs); `tsconfig.tests.json` extends it and keeps `allowImportingTsExtensions` and the test globs.
- `.gitignore`: `build/`, `build-subpath/`, `.svelte-kit/` replace `site/js/`, `site/sw.js`, `site/precache.json`.
- `playwright.config.ts` and `playwright.perf.config.ts`: `webServer.command` becomes `node scripts/build.mjs --subpath && npx http-server build -p 4173 -c-1 --silent`; the sub-path spec serves `build-subpath/` under `/ultimattt/`.
- `scripts/audit.mjs`, `make-screenshots.mjs`, `lib/serve.mjs` callers: serve `build/`.

## R14. Network surface (FR-016)

Unchanged: the Nunito stylesheet and font files (not cached), the PeerJS script from its CDN and the PeerJS signalling service. SvelteKit adds no request to any other origin; `check-build` fails if the shell references one.

## R15. What was not decided here

Per-component details (markup, class names, props) are in tasks and the code; they follow the existing DOM structure so the CSS and e2e selectors stay valid. The exact Vite plugin option shapes are set while scaffolding, against the spike's working configuration (`vite.config.ts` in the scratch directory, recorded in quickstart).
