# Data Model: SvelteKit UI Migration

No stored data changes. The save, settings, replay record, seed and protocol shapes are the ones in `src/core` and `src/adapters` and are not edited. This file lists the new in-memory state the components share, and the build artefacts the gates read.

## Persisted (unchanged, listed so nothing is touched by accident)

| Item | Where | Notes |
|---|---|---|
| Save blob (`ttt.save`): settings, game, hostCode, joinCode | `src/adapters/store.ts`, `src/core/settings.ts` | `settings.theme` keeps `auto`, `light`, `dark` |
| Mode preference `ttt.mode` | `src/ui/theme.ts` | `system`, `light`, `dark`; legacy `ttt.theme` migrated and removed |
| Replay record and link | `src/core/record.ts` | `?watch=` links unchanged |
| Pairing code and link | `src/core/pairing.ts` | `?join=CODE` links unchanged |

## Route table

| Address | Route | Renders | Entered by | History |
|---|---|---|---|---|
| `#/` | `/` | Setup, or sends the player on (see Boot decision) | load, leaving a game or replay | replace |
| `#/play` | `/play` | Game (local, computer, host or join) | Start, resume, join | replace |
| `#/replay` | `/replay` | Replay of the record in `?watch=` | opening a replay link | replace |
| `#/help` | `/help` | Help | direct load; in-app opens it as a shallow route | push |

**Boot decision** (the same order `app.ts` uses today): a `?join=CODE` in the URL goes to join; else a `?watch=` goes to replay (an invalid one shows its error toast and falls through); else a saved game resumes (a hosted or joined network game is hosted or joined again with its code, unless finished); else Setup. A reload on `#/play` with no saved game goes to `#/`. A reload on `#/replay` without `?watch=` goes to `#/`.

## Shell state (store-compatible plain TypeScript in `src/ui/`, plus `src/lib/state/` where the router or the page is involved)

| State | Fields | Rules |
|---|---|---|
| `mode` | `preference: "system" \| "light" \| "dark"`, `resolved: "light" \| "dark"` | Wraps `src/ui/theme.ts`; the `MODE_EVENT` and the permanent `prefers-color-scheme` listener stay; never moves focus |
| `settings` | the save's `settings` object | Reads through `loadSave()`, writes through `updateSettings()` |
| `toasts` | `{ id, text, ms }[]` | `toast(text, ms)` keeps its signature; each item removes itself after `ms`; the region has `role="status"` |
| `dialogs` | stack of `DialogRequest` | See below; one native `<dialog>` open at a time on top; `body.modal-open` while any is open |
| `update` | `{ waiting: { postMessage } \| null }` | Set by the registration code or by the `ttt:update-ready` event; the bar shows while it is set; pressing Update posts `skip-waiting` and disables the button |
| `help` | `{ open: boolean, fromLink: boolean }` | `open` follows `page.state.help` or the `/help` route; `fromLink` makes Back call `history.back()` as today |

### DialogRequest

`{ title, body, actions: { label, value, primary? }[], icon?, resolve(value \| null) }`. `openDialog(options)` keeps its current signature and returns a promise of the chosen value or `null`. Dismissal by Close, Escape or backdrop resolves `null`. Opening and closing flip the `is-open` class with the existing 400 ms `transitionend` guard. Focus moves into the dialog on open and returns to the opener on close.

## Framework-free sessions (`src/ui/`)

### GameSession (extracted from `game.ts`)

| Field | Meaning |
|---|---|
| `config` | the `GameConfig` the game was started with |
| `state` | `AnyGameState` from `src/core/variants.ts` |
| `resigned` | `Mark \| null` |
| `startedAt` | start time, kept in the save |
| `hint` | current hint selection (winning cell or block), from `hints.ts` |
| `phase` | `playing`, `computer-thinking`, `ended` |

Operations: `place(cell)`, `undo()`, `resign(mark)`, `requestComputerMove()`, `setHint(kind \| null)`, `result()`, and a `subscribe(listener)` the component binds to rune state. It saves after every change through `saveGame`, and it starts the computer through the existing `ComputerPlayer` seam. It imports no DOM and no framework, so it is unit-tested in node.

### CubeSession (extracted from `board-cube.ts` and `cube-view.ts`)

Wraps `src/core/turn-selection.ts`: `select(layer, how)`, `confirm()`, `cancel()`, `reset()`, and the preview model (which stickers are in the layer, the turn angle). Drag, snap and the transition timing stay in `CubeView.svelte`.

## Build artefacts the gates read

| Artefact | Producer | Consumers |
|---|---|---|
| `build/index.html` | `scripts/build.mjs` (root base) | `check-theme`, `check-build`, e2e, audit |
| `build/service-worker.js` | Kit, from `src/service-worker.ts` | e2e, installable test |
| `build/_app/immutable/**` | Kit | precache, `check-build` size budget |
| `build/css`, `build/icons`, `build/manifest.json` | copy of `static/` | manifest contract test, precache |
| `build-subpath/` | `scripts/build.mjs --subpath` (`BASE_PATH=/ultimattt`) | subpath e2e only |
| `.svelte-kit/` | Kit | gitignored; `tsconfig` extends its generated file |

### Precache list (computed inside the worker at install, not a file)

`immutable` plus `assets` plus `prerendered` from `$app/manifest`, minus any path starting `screenshots/` or a dot, plus the base shell `./`. Cache name `ttt-${version}`; stale `ttt-*` caches are deleted on activate.

## State transitions that matter

- **Start**: Setup, `goto("/play", { replaceState: true })`, game mounted from a new `GameSession`.
- **Leave game** (New game button, after the confirm as today): `GameSession` discarded, save cleared as today, `goto("/", { replaceState: true })`.
- **Help during a game**: `pushState("#/help", { help: true })`, game stays mounted and its session keeps running; Back removes the overlay; focus returns as in 006.
- **Update**: waiting worker, bar shown, nothing until pressed, then `skip-waiting`, `controllerchange`, reload; the game was saved on its last move so it resumes.
