<!--
Sync Impact Report
Version change: 1.0.0 → 1.1.0 (MINOR: materially expanded guidance)
Modified sections: Technical Constraints (adds the design spec requirement)
Templates updated: .specify/templates/plan-template.md (design line in Constitution Check)
Earlier: (unratified template) → 1.0.0
Modified principles: none renamed (all placeholders filled)
Added principles: I. Test-First (NON-NEGOTIABLE); II. Progressive Web App First;
  III. Offline-Capable by Default; IV. Simplicity; V. Pure, Testable Game Logic
Added sections: Technical Constraints; Development Workflow & Quality Gates
Removed sections: none
Deferred TODOs: none
Assumption: project "ultimattt" is an Ultimate Tic-Tac-Toe game; PROJECT_NAME and
  Principle V derived from the repo name. Amend if wrong.
-->
# ultimattt Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)
Test-Driven Development is mandatory for all production code. The Red-Green-Refactor cycle
MUST be followed: write a failing test, confirm it fails for the expected reason, write the
minimum code to pass, then refactor with tests green. No production code MAY be merged
without a test that failed before the code existed. Bug fixes MUST begin with a failing
regression test. Tasks in `tasks.md` MUST list the test task before its implementation task.

Rationale: tests written after the fact confirm what code does, not what it must do.

### II. Progressive Web App First
The product MUST ship as an installable Progressive Web App: a valid web app manifest
(name, icons, `display`, `start_url`, theme/background colors), a registered service worker,
and HTTPS delivery. It MUST be responsive from phone widths up, usable with touch and
keyboard, and MUST meet a Lighthouse PWA/installability pass and accessibility score of
at least 90 before release. No native-only or store-only dependencies MAY be introduced.

### III. Offline-Capable by Default
After first load, the game MUST be fully playable offline. The service worker MUST precache
all assets required to play, use a versioned cache, and clean up stale caches on activate.
Game state MUST persist locally (e.g. IndexedDB or localStorage) and survive reloads. Any
feature requiring the network MUST degrade gracefully and MUST NOT block core play. Offline
behavior MUST be covered by automated tests.

### IV. Simplicity
Start with the simplest solution that satisfies the spec (YAGNI). New dependencies,
frameworks, or abstractions MUST be justified in the plan's complexity section. Prefer
platform APIs over libraries where reasonable, to keep the bundle small and load fast.

### V. Pure, Testable Game Logic
Game rules (move validation, forced-board routing, win/draw detection) MUST live in pure,
framework-independent modules with no DOM, network, or storage access. UI and persistence
layers MUST be thin adapters over this core. Rule behavior MUST be covered by unit tests
before UI work depends on it.

## Technical Constraints

- Client-side only unless a spec explicitly requires a backend.
- Static hosting over HTTPS MUST suffice for deployment.
- The service worker and manifest MUST be versioned with the app; every release that
  changes cached assets MUST bump the cache version.
- Performance budget: interactive in under 3 seconds on a mid-range mobile device on
  a throttled 4G connection (first load), and near-instant on repeat loads.
- Accessibility: all controls MUST be keyboard operable and have accessible names; state
  MUST NOT be conveyed by color alone.
- UI MUST follow `docs/pwa-design-spec.md`. Departures are recorded in the plan's
  complexity tracking.

## Development Workflow & Quality Gates

- All tests MUST pass before merge; test suite runs MUST be automated.
- Each PR MUST show test-first evidence (tests committed before or with their implementation).
- Unit tests cover game logic; integration/end-to-end tests cover install, offline play,
  and state persistence.
- Releases MUST pass a PWA audit (installability, offline, accessibility) before deploy.
- Plans MUST include a Constitution Check against Principles I–V.

## Governance

This constitution supersedes other practices. Amendments require a documented change to this
file, a Sync Impact Report, and a version bump following semantic versioning: MAJOR for
removed or redefined principles, MINOR for added principles or materially expanded guidance,
PATCH for clarifications. Compliance MUST be verified in every plan and PR review; violations
MUST be justified in the plan's complexity tracking or corrected. Principle I is
non-negotiable and MUST NOT be waived.

**Version**: 1.1.0 | **Ratified**: 2026-10-03 | **Last Amended**: 2026-10-07
