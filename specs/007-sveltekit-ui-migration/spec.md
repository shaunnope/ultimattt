# Feature Specification: SvelteKit UI Migration

**Feature Branch**: `007-sveltekit-ui-migration` (not created; work stays on `main` unless the user branches)

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Migrate UI to use sveltekit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app looks and plays exactly as before (Priority: P1)

A player opens the app and finds every screen, control, board, animation, share text, setting and help page behaving as it did before the migration. Classic, Ultimate and Twist all play to a win and a draw, with the computer opponent, on two devices, with hints, undo, replay and sharing. Saved games, replays, shared links and stored settings from earlier versions load unchanged. Nothing about the migration is visible to the player.

**Why this priority**: The migration earns nothing if it changes the product. Behaviour parity is the release gate; every other story is about how the app is built, delivered and maintained.

**Independent Test**: Run the existing end-to-end suites, unchanged in what they assert, against the migrated app, then open the old save and link fixtures. Everything passes with no test expectation relaxed.

**Acceptance Scenarios**:

1. **Given** the migrated app, **When** each game mode is played through setup, a win, a draw, replay and share, **Then** every screen, copy string, icon, colour and motion matches the pre-migration app under the same viewport and theme.
2. **Given** a saved game, a replay, a seed link and a stored theme or palette choice made by an earlier version, **When** the migrated app loads, **Then** each loads and behaves unchanged.
3. **Given** two devices pairing for a multiplayer game, **When** one is the old app and one is the migrated app (or both are migrated), **Then** pairing, moves and results work as before.
4. **Given** the design rework's checks (layout audit, contrast, theme parity, copy rules, accessibility), **When** they run against the migrated app, **Then** all pass with the same thresholds.

---

### User Story 2 - Still an installable, offline, fast static app (Priority: P1)

The app stays a Progressive Web App delivered as plain static files. After one load, it works with no network, installs to a device, offers an Update bar when a new version waits, and never updates by itself. It opens fast on a throttled phone connection, and works when served from the site root or from a sub-path.

**Why this priority**: Installability, offline play and the 3-second first load are constitutional requirements, and a framework migration is the likeliest thing to break them.

**Independent Test**: Build the app, serve the output as static files from `/` and from `/ultimattt/`, run the install, offline, update, sub-path and audit checks, and play a full game of each mode with the network off.

**Acceptance Scenarios**:

1. **Given** the app has loaded once, **When** the device goes offline and the page is reloaded, **Then** all three game modes are fully playable and multiplayer pairing shows its offline banner.
2. **Given** a new build is available, **When** the player has the app open, **Then** the Update bar appears, nothing changes until they choose Update, and their game in progress survives.
3. **Given** the production output, **When** it is served from a static file server with no server-side code, **Then** every route and deep link works, including after a hard reload and when served under a sub-path.
4. **Given** a throttled mobile connection, **When** the app loads for the first time, **Then** it is interactive in under 3 seconds and the Lighthouse accessibility score stays at or above 90 with no serious axe violations.
5. **Given** cached files change, **When** release checks run without a cache version bump, **Then** they fail.

---

### User Story 3 - The interface is built from reusable components (Priority: P2)

A developer working on the interface finds each screen and each shared part (top bar, buttons, segmented toggles, banners, dialogs, update bar, boards, cube view, pill, replay controls, palette picker, theme dialog) as a self-contained component with its own markup, styles and behaviour, replacing the hand-built element code. Screens are reached by routes. Game rules, the computer opponent, saving and the multiplayer protocol stay in their existing framework-independent modules, which the components only call.

**Why this priority**: This is the point of the migration for the team, but it is judged by whether the player-facing stories still hold.

**Independent Test**: Confirm no screen is assembled with the old element-building helpers, every shared part has one component used everywhere, and the game rules module has no dependency on the interface framework and passes its unit tests untouched.

**Acceptance Scenarios**:

1. **Given** the migrated source, **When** the game rules, saved-game format, replay and protocol modules are inspected, **Then** they contain no interface framework code and their unit tests pass without edits to their expectations.
2. **Given** any screen or shared part, **When** its source is found, **Then** it is a single component, and no screen is built by imperative element-creation helpers.
3. **Given** the main screens (setup, game, replay, help), **When** the address bar is inspected, **Then** each has its own address, and back and forward move between them without losing a game in progress.

---

### User Story 4 - Checks and tests still guard the design (Priority: P2)

The project's release gates keep running against the migrated app: no colour literals outside the theme file, theme parity between the early script and the runtime resolver, contrast pairs in both modes, width breakpoints, cache version and precache coverage, copy rules, and the full unit, contract, end-to-end and audit suites. Where a check scanned the old file layout, it is updated to scan the new one without loosening what it enforces.

**Why this priority**: The design rework's guarantees are only as good as the checks that hold them; they must not lapse silently during the move.

**Independent Test**: Run the check, test, end-to-end and audit commands. All pass, and deliberately adding a stray colour literal or an unlisted breakpoint to a component's styles makes the matching check fail.

**Acceptance Scenarios**:

1. **Given** a colour literal added to a component's styles outside the theme file, **When** checks run, **Then** they fail.
2. **Given** a width media query other than the two allowed, **When** checks run, **Then** they fail.
3. **Given** the early theme script and the runtime resolver disagree for any stored value, **When** checks run, **Then** they fail.
4. **Given** the migration is complete, **When** the old hand-built UI code and its now-dead helpers are searched for, **Then** none remain.

---

### Edge Cases

- A player with the old version installed and a saved game in progress updates to the migrated build: the Update bar offers it, the game is saved first and restored, and old caches are removed.
- A first load on a dark device: the page is dark from the first frame, with no light flash, before any component code runs.
- A reload or direct link on any address while offline or on a static host: the app shell loads and the right screen shows, with no server fallback required beyond the host's own not-found page.
- Served under a sub-path: addresses, assets, manifest, icons and the worker all resolve under that path.
- A browser with scripts blocked or slow to load: the page shows its colours and a short message rather than a blank screen.
- The game in progress when the player navigates with browser back or forward: the game is kept, and leaving a game by an explicit button still discards it as before.
- Reduced motion and the cube's longer turn animation: both behave as under the design rework.
- Multiplayer pairing code and QR flows after a route change: the connection is closed cleanly and no stale connection leaks into the next screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every screen, dialog, banner, toast and shared control MUST be built as a component of the new interface framework, with the old hand-built element code removed once replaced.
- **FR-002**: The migrated app MUST be visually and behaviourally identical to the pre-migration app at 320, 480 and 720px and wider, in light and dark, including copy, icons, colours, spacing and motion. Any deliberate difference MUST be recorded in the plan with a reason.
- **FR-003**: Game rules, move behaviour, the computer opponent, scoring, saved games, replays, share links and the multiplayer protocol MUST be unchanged, and the modules holding them MUST stay free of interface framework code and keep their unit tests as they are.
- **FR-004**: Existing saved games, replays, seed links and stored settings (including the theme and palette preferences and their legacy values) MUST load and behave unchanged.
- **FR-005**: The app MUST be produced as static files that need no server-side code to run, and MUST work when served from the site root and from a sub-path.
- **FR-006**: The main screens (setup, game, replay, help) MUST each have their own address, MUST work on a hard reload and as a direct link on a static host, and browser back and forward MUST move between them without discarding a game in progress.
- **FR-007**: The app MUST remain installable, with the manifest, icons, favicon, theme and background colours and screenshots conforming to the existing install-shell rules.
- **FR-008**: After one load, all game modes MUST work offline, and every file needed to play MUST be in the offline cache. The cache version MUST be bumped for any cached-file change, and stale caches MUST be removed when a new version activates.
- **FR-009**: The app MUST never update itself. A waiting new version MUST be offered through the Update bar, with state saved first.
- **FR-010**: The first paint MUST already be in the resolved light or dark mode, set before any component code runs, and the early script and runtime resolver MUST agree for every stored value.
- **FR-011**: The first load MUST be interactive in under 3 seconds on a throttled mobile connection, and repeat loads MUST be near-instant. The shipped script and style size for the first load MUST NOT grow beyond a budget recorded in the plan.
- **FR-012**: The design rework's rules MUST continue to hold and stay enforced by checks: no colour literal outside the theme file, three surface levels, the type scale, 44px hit areas with the recorded exemptions, AA contrast in both modes, the two width breakpoints, reduced motion, and the copy rules (no em dashes, emoji or exclamation marks).
- **FR-013**: Accessibility MUST NOT regress: every control keyboard operable with a visible focus ring and an accessible name, focus kept stable on a device mode change, focus moved into a dialog on open and returned on close, and a Lighthouse accessibility score of at least 90 with no serious axe violations.
- **FR-014**: The project's existing check, unit, contract, end-to-end and audit commands MUST keep working and keep their meaning. Checks that scanned the old source layout MUST be updated to the new layout without lowering what they enforce, and each such change MUST be covered by a test that fails on a violation.
- **FR-015**: The migration MUST add no runtime dependency beyond what the new interface framework itself requires, and the plan MUST justify the framework and its build tooling against the constitution's simplicity principle.
- **FR-016**: Third-party network traffic MUST stay limited to what exists today (the web font and multiplayer signalling), and the migration MUST NOT add any other.

### Key Entities

- **Screen**: a routed view (setup, game, replay, help) with its own address and its own set of components.
- **Shared component**: a reusable interface part with one definition used everywhere: top bar, buttons, segmented toggle, chip, banner, toast, dialog or sheet, update bar, pill, icon, board, cube view, replay controls, palette picker, theme dialog.
- **Framework-independent core**: the rules, computer opponent, saved-game format, replay and protocol modules. Treated as a fixed contract the components call.
- **Release gates**: the automated checks, tests and audits that must pass before a build ships.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing end-to-end specs pass against the migrated app with no assertion weakened, and any spec edited for a new address or structure is listed with a reason.
- **SC-002**: A side-by-side capture of setup, each game mode in play, results, replay, help, settings and the theme dialog, at 320, 480 and 720px in both modes, shows no unexplained visual difference from the pre-migration app.
- **SC-003**: 100% of saved-game, replay and link fixtures from earlier versions load and play unchanged.
- **SC-004**: All three game modes can be played to completion offline after one load, from the site root and from a sub-path.
- **SC-005**: The first load is interactive in under 3 seconds on a throttled mobile connection, and the first-load script and style size is no more than the budget set in the plan.
- **SC-006**: The accessibility audit scores at least 90 with zero serious or critical violations on setup, game and help in both modes.
- **SC-007**: On a dark-preference device, the first paint is already dark, before any component code runs.
- **SC-008**: The core rules, saved-game and protocol modules contain zero imports of the interface framework, verified by an automated check.
- **SC-009**: Zero screens remain assembled with the old element-building helpers, verified by an automated check.
- **SC-010**: Each of the existing design checks (colour literals, contrast, breakpoints, theme parity, copy rules, cache version) fails when given a deliberate violation in the migrated source.

## Assumptions

- "Sveltekit" in the request means the SvelteKit framework, used to produce a fully static site (prerendered, no server). The choice is the user's; the plan justifies it against the constitution's simplicity principle and records the added build dependencies.
- The migration covers the interface layer only. The rules, computer opponent, saved-game format, replay and protocol code stay as they are, and keep working from a worker where they do now.
- The look, copy and behaviour are the design rework's (spec 006) and are not redesigned here; `docs/pwa-design-spec.md` remains the authority and the theme file stays the single home of colours.
- The existing end-to-end, unit and contract tests are the parity oracle. Selectors may change only where a class name or address must, and each such change is justified.
- Routing is a convenience of the framework, not a feature request: addresses for the main screens are added because the framework provides them, with back and forward preserving a game in progress.
- The app is hosted as static files, possibly under a sub-path (as the existing sub-path test does), so the migrated output must not assume the site root.
- The service worker, manifest and version-bump rules from the install-shell section stay in force; how the worker's file list is produced may change with the build.
- The web font stays non-blocking and uncached, as recorded in spec 006.
- No game feature, rule, copy or storage-format change is part of this migration.
