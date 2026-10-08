# Implementation Plan: SvelteKit UI Migration

**Branch**: `007-sveltekit-ui-migration` (not created; work stays on `main` unless the user branches) | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-sveltekit-ui-migration/spec.md`. Authority for look and behaviour: `docs/pwa-design-spec.md` and spec 006.

## Summary

Replace the hand-built DOM layer (`src/ui/*.ts`, about 4,650 lines assembled with the `h()` helper, plus `tsc` emit to `site/js`) with Svelte 5 components inside a SvelteKit app that builds to plain static files. Nothing the player sees or does changes.

Approach, from the research and a throwaway spike (see research.md R1 to R4):

1. **Static single-page app, hash router.** `adapter-static`, no server code, `router.type: "hash"`. This keeps today's addresses (`#/help`, `?join=CODE`, `?watch=...`), needs no host-side fallback rules, and keeps the existing e2e specs that open `./#/help`.
2. **Global stylesheets stay global.** `theme.css`, `style.css` and `cube.css` move unchanged to `static/css/` and stay linked from `src/app.html`, so first paint is styled and dark before any component code runs (FR-010). Components use the existing class names. The design checks keep scanning those files and also scan `.svelte` style blocks.
3. **Framework-free logic stays where it is.** `src/core`, `src/adapters` and the pure UI helpers (theme resolution, status text, help content, icon paths, mark shapes, QR encoder, AI worker, computer client) are untouched or only re-homed. DOM builders become components; logic that lived inside DOM modules is extracted into small framework-free classes first.
4. **Staged and green at every step.** A temporary bridge component mounts each not-yet-ported imperative screen inside the new shell, so the full e2e suite runs against the SvelteKit build from the first scaffold commit and screens are ported one at a time. The bridge and `h()` are deleted at the end and a check keeps them out (SC-009).
5. **Offline by the framework's service worker hook, with our update flow.** `src/service-worker.ts` precaches the build manifest and static files under a cache named from the build version; our own registration and update bar logic stay (the app never updates itself).

## Technical Context

**Language/Version**: TypeScript 6 (required by SvelteKit 3's peer range; the repo is on 5.7 today), Svelte 5.57 (runes), HTML, CSS. Node 22.18+ for tooling and tests.

**Primary Dependencies (new, dev-only)**: `@sveltejs/kit` 3.0.1, `@sveltejs/adapter-static` 4.0.0, `@sveltejs/vite-plugin-svelte` 7.x, `vite` 8.x, `svelte` 5.57, `svelte-check`. All ship as build-time tooling; the shipped runtime is the compiled app plus the Svelte and Kit client runtimes. No runtime dependency is added to `package.json` `dependencies`. PeerJS stays a runtime script from its CDN, as today.

**Storage**: unchanged. `localStorage` keys `ttt.save`, `ttt.mode` and the legacy `ttt.theme` migration, and the save schema, are untouched (`src/adapters`, `src/core`).

**Testing**: `node:test` for unit and contract tests (unchanged for `src/core` and `src/adapters`; new tests for the check scripts, the extracted controllers and the build contract). Playwright e2e is the parity oracle and runs against the production build. `svelte-check` plus `tsc` for tests replace the old `tsc --noEmit` typecheck. Lighthouse and axe audit unchanged.

**Target Platform**: evergreen browsers, installable PWA, static HTTPS hosting from the site root or a sub-path such as `/ultimattt/` (GitHub Pages).

**Project Type**: static web app, single project. Was "tsc emit, no bundler"; becomes "SvelteKit static build".

**Performance Goals**: first load interactive under 3 s on Lighthouse's throttled mobile profile (unchanged). Size budget recorded here: first-load script plus style no more than **70 KB gzipped** (measured baseline today: 29.6 KB script across 19 startup modules plus 10.4 KB style, about 40 KB), and all shipped script no more than **160 KB gzipped** (baseline 99.7 KB). A build check enforces both (research R12).

**Constraints**: offline after one load; no server code; works at `/` and at a sub-path; saves, links, seeds and the multiplayer protocol unchanged; the design rework's rules unchanged; no em dashes, emoji or exclamation marks in copy or docs.

**Scale/Scope**: about 14 DOM modules (about 3,700 lines) become components; about 12 shared components; 4 routes; 6 check scripts re-pointed; 2 scripts and 1 test file removed; about 10 e2e specs edited for hooks and server layout only (listed in contracts/ui-contracts.md C6).

## Constitution Check

| Principle | Status | How the plan satisfies it |
|---|---|---|
| I. Test-First (NON-NEGOTIABLE) | PASS | The e2e suite, unchanged in what it asserts, is the oracle and is run against the new build before any screen is ported. New check scripts (core purity, no DOM builders, bundle budget, build contract, service worker) get failing unit tests first. Extracted controllers get failing unit tests before the component that uses them. `tasks.md` lists each test before its implementation. |
| II. PWA First | PASS | Manifest, icons and screenshots move to `static/` unchanged; a build contract test asserts they ship and that the service worker is registered with scope at the app root. Installability e2e and Lighthouse stay as gates. |
| III. Offline-Capable by Default | PASS | `src/service-worker.ts` precaches every built asset and static file (except screenshots and the font); cache name carries the build version; activate deletes stale caches; existing offline, subpath and update e2e specs run unchanged. |
| IV. Simplicity | PASS with recorded justification | Adds a framework and a bundler where there was none. The user requested SvelteKit; the plan keeps everything else minimal (static adapter, no SSR, no server routes, no stores library, global CSS kept). Recorded in Complexity Tracking. |
| V. Pure, Testable Game Logic | PASS | `src/core` and `src/adapters` are unchanged and a new check fails the build if they import Svelte, Kit or `$app/*` (SC-008). Controllers extracted from DOM modules are plain TypeScript with unit tests. |
| Design spec | PASS | Same CSS, same class names, same tokens; `check-contrast`, `check-theme-tokens`, `check-breakpoints` and `check-theme` keep running and are extended to cover `.svelte` style blocks. No new departures; the departures recorded in 006 carry over. |
| Technical constraints | PASS | Client-side only, static hosting. Cache version is bumped automatically by the build (research R6); the old manual-bump gate is replaced by a structural check. 3 s budget gated by the audit. |

Post-design re-check: unchanged. All PASS, one justified addition under IV.

## Project Structure

### Documentation (this feature)

```text
specs/007-sveltekit-ui-migration/
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
├── core/                       # unchanged: rules, AI, records, protocol, settings (no framework imports, enforced)
├── adapters/                   # unchanged: storage, store, net, restore
├── ui/                         # framework-free UI helpers only, kept in place and still unit-tested:
│   ├── theme.ts                #   resolveMode, normaliseMode, migration, applyMode
│   ├── status-text.ts, messages.ts, replay-text.ts, help-content.ts, cube-labels.ts, hints.ts
│   ├── icons.ts (ICON_PATHS data), mark.ts (markShape), qr.ts, confetti.ts (pure parts)
│   ├── computer.ts, ai-worker.ts   # worker client + worker, started with new Worker(new URL(...))
│   ├── game-session.ts         # NEW: extracted from game.ts: state, undo, resign, hints, autosave, computer turns
│   ├── cube-session.ts         # NEW: extracted from board-cube.ts and cube-view.ts: turn selection and preview model
│   └── (every file that built DOM with h() is deleted when its component lands)
├── lib/
│   ├── components/             # NEW: shared Svelte components
│   │   ├── TopBar.svelte, IconButton.svelte, Icon.svelte, Button.svelte
│   │   ├── Seg.svelte (segmented toggle), Chip.svelte, Banner.svelte, Toasts.svelte
│   │   ├── Dialog.svelte, DialogHost.svelte, UpdateBar.svelte
│   │   ├── Mark.svelte, Pill.svelte, ResultDialog.svelte, ShareCard.svelte
│   │   ├── BoardClassic.svelte, BoardUltimate.svelte, CubeBoard.svelte, CubeView.svelte
│   │   ├── ReplayControls.svelte, PalettePicker.svelte, ThemeDialog.svelte, SettingsDialog.svelte
│   │   └── Setup.svelte, Game.svelte, Replay.svelte, Help.svelte, Host.svelte, Join.svelte
│   ├── state/                  # NEW: rune-based state over the adapters (settings, mode, dialogs, toasts, update)
│   └── legacy/Bridge.svelte    # TEMPORARY: mounts a not-yet-ported imperative screen; deleted in the last phase
├── routes/
│   ├── +layout.svelte          # shell: skip link, update bar, top bar, status and toast regions, dialog host
│   ├── +page.svelte            # "/": decides setup, join link, replay link, or resume saved game
│   ├── play/+page.svelte       # "/play": the game (restored from the save on reload)
│   ├── replay/+page.svelte     # "/replay": a replay opened from a link
│   └── help/+page.svelte       # "/help": direct load; in-app help opens as a shallow route over the current page
├── service-worker.ts           # precache from $app/manifest, cache name from $app/env version, update message
└── app.html                    # pre-paint script, head order, static stylesheet links, font links, shell markup
static/
├── css/theme.css, style.css, cube.css   # moved from site/css, unchanged
├── icons/, screenshots/, manifest.json, 404.html   # moved from site/
vite.config.ts                  # sveltekit({ adapter: adapter-static, router: hash, paths.base from BASE_PATH, version })
scripts/
├── build.mjs                   # NEW: runs vite build (and the sub-path build when asked), sets BASE_PATH in-process
├── check-core-purity.mjs       # NEW: no framework imports in src/core and src/adapters
├── check-no-dom-builders.mjs   # NEW: no h(), createElement or Bridge in src/ui, src/lib, src/routes (final phase gate)
├── check-build.mjs             # NEW: replaces check-precache and check-version: precache covers the build, SW cache name uses the build version, size budget, no root-absolute URLs
├── check-sw.mjs                # re-pointed at src/service-worker.ts
├── check-theme.mjs, check-theme-tokens.mjs, check-contrast.mjs, check-breakpoints.mjs, check-names.mjs   # re-pointed, scan .svelte style blocks too
├── audit.mjs, make-screenshots.mjs, lib/serve.mjs   # serve build/ instead of site/
└── (removed: gen-precache.mjs, gen-preload.mjs, check-precache.mjs, check-version.mjs, precache.lock.json)
tests/
├── unit/                       # unchanged except: gen-precache and gen-preload tests removed; check-scripts, visible-names, logo paths updated; new tests for the new scripts and sessions
├── contract/                   # manifest test re-pointed at static/manifest.json; new build contract test
└── e2e/                        # same specs; edited only where C6 lists (hooks, server layout, build dirs)
```

**Structure Decision**: single project. `site/` (committed files plus gitignored output) is replaced by `static/` (committed) and `build/` plus `build-subpath/` (gitignored output). `src/core` and `src/adapters` keep their paths so their tests do not change. Pure UI helpers keep their paths in `src/ui` for the same reason; components live in `src/lib/components` because that is where SvelteKit looks for `$lib`.

## Complexity Tracking

| Departure | Why needed | Simpler alternative rejected because |
|---|---|---|
| A framework, a bundler and a build step where the app had none (Constitution IV) | The user asked for the UI to move to SvelteKit; components replace about 3,700 lines of imperative DOM code | Keeping hand-built DOM is the status quo the request is about. Plain Svelte with Vite would also work, but the request names SvelteKit and Kit gives the service worker manifest, the build contract and the hash router for free |
| Six new dev dependencies and a TypeScript major upgrade (5.7 to 6) | SvelteKit 3 peers on TypeScript 6, Vite 8 and Svelte 5. All are build-time only | SvelteKit 2.x accepts TypeScript 5, but is the previous major and its service worker API differs; starting a migration on the old major buys a second migration later |
| Hash router (`/#/help`) rather than path routes | Keeps `#/help`, the `?join=` and `?watch=` link formats, and every existing `./#/help` e2e address; needs no 404 fallback rules on a static host; the same build runs from any path in dev. Spike verified | Path routes need a prerender per route, a host fallback and rewritten tests, and they change address shapes players may have bookmarked |
| Shallow routing for help over a game | Opening help must leave a game in progress untouched (an existing e2e). A normal navigation unmounts the game page; shallow routing keeps it mounted. Spike verified (state kept, zero unmounts, Back removes the overlay) | Rebuilding the game on return would restart the computer's turn and, for two-device games, drop and re-make the connection |
| Base path fixed at build time (`BASE_PATH`) and a second build for the sub-path e2e | SvelteKit bakes `paths.base` into the shell. Spike verified that a root build requests root-absolute URLs and fails under a sub-path | Post-processing the built HTML to relative URLs is a patch on generated output that the next Kit release can break |
| Cache version is now the build's version, not a hand-bumped constant, and the lock-file gate is replaced | Every build gets a new cache name, which is what the release gate wanted; a manual constant plus a content-hash lock file is redundant with a build that already knows its version | Keeping `VERSION` and `precache.lock.json` needs a precache hash the new build no longer produces. Replaced by a structural check (cache name uses the build version, activate deletes old caches) |
| Temporary Bridge component and a final cleanup gate | Lets all e2e specs run against the new build from the first commit while screens move one at a time | A single big-bang rewrite of 3,700 lines with no green checkpoint cannot be verified against the parity oracle until the very end |
| Changes found while building (recorded after the fact) | See the items below | Each was the smaller fix |
| Module alias is `#lib/*` (a `package.json` `imports` entry), not `$lib` | SvelteKit 3 removed `$lib` (build error `module_removed_lib`) | Re-adding `$lib` with a config alias is the removed behaviour; `#lib` is the supported spelling and the purity check rejects both |
| Help is mounted from the shell beside `<main>`, so `routes/help/+page.svelte` renders nothing | Contract C4 puts `#help-view` beside `main`, and a shallow route has no page of its own to hold it; one place serves both a direct load and the overlay | A second copy in the route page would mount help twice |
| No ShareCard component | The game never had a share card (its result dialog is a title, one line and three actions, and Share replay is a button) | Inventing one would be a visible change, against SC-002 |
| `decideBoot(search, save, notice)` takes no hash and no clock | The routes decide by address, and the decision never read the time | Unused parameters would mislead |
| The app now boots after the `load` event (SvelteKit starts from an inline script and dynamic imports), so the first paint is the styled page colour only, and a few specs wait for the Start game button before they act (contracts C6 lists each) | The shell is rendered by the client in a static single-page app (no server rendering), which the plan chose for static hosting | Server-rendering the shell would need a prerender per route, which the hash router avoids |
| Dialogs (Settings, Appearance) load when first opened | The measured first load was 71.6 KB gzipped against the 70 KB budget; lazy dialogs brought it to 69.9 KB, asserted by `tests/e2e/budget.spec.ts` | Raising the budget would hide the margin that is gone |
| `check-build` counts the shell's own files and what they import statically; the real first load is the e2e budget spec | Route nodes are fetched at run time and are not named in the shell | Guessing node numbers from minified output would break on the next Kit release |
| `relay.ts` ignores a change of the `#/` part of the address | Opening help over a two-device game changes only the hash; the stand-in treated it as a reload and dropped the connection | A real reload still drops it; only a same-document address change is ignored |
| First-load budget raised from 70 KB to 71 KB gzipped by spec 008 | Forgiving seed entry adds about 0.4 KB gzipped (measured 69.9 KB at 007, 70.3 KB with the seed reader, the placeholder and the note). Trimming the code changed nothing, and lazy-loading the reader would save about 0.2 KB and add an async read at Start | Holding 70 KB would reject a small, wanted feature; the 3 s load target is measured separately by the audit and is not at risk |
| Global CSS kept outside components (no scoped styles for the design tokens) | First paint must be styled and dark before any component code runs, and in a hash-routed client app component CSS is only injected after the scripts load. It also keeps the design checks and every class-based selector valid | Scoped styles would flash unstyled content and rewrite about 1,000 lines of tested CSS for no player-visible gain. The style checks also scan `.svelte` style blocks so a later move to scoped styles is not unguarded |
