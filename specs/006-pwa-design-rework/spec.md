# Feature Specification: PWA Design Rework

**Feature Branch**: `006-pwa-design-rework` (not created; work stays on `main` unless the user branches)

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Rework the ui according to @docs/pwa-design-spec.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One consistent look in light, dark and system (Priority: P1)

A player opens the app and sees one calm, flat page with frosted cards, one typeface, a single cobalt accent and no gradients or saturated chrome. The look follows their device (light or dark) the moment they arrive, with no white flash on a dark device. They can pin Light or Dark from a theme dialog, or go back to System, and the choice survives reloads and updates. Anyone who already chose a theme before this release keeps that choice.

**Why this priority**: The palette, surfaces, type and theme behaviour are the foundation every other screen is restyled on. Without them nothing else can be judged.

**Independent Test**: Load the app on a dark-preference device and a light-preference device, flip the OS setting live, pin each mode in the theme dialog, reload. Appearance and dialog state match the rules each time. Seed the old stored theme value (`auto`, `light`, `dark`) first and confirm the choice carries over.

**Acceptance Scenarios**:

1. **Given** no saved choice and a dark device, **When** the app first loads, **Then** it paints dark from the first frame and no light flash occurs.
2. **Given** System is chosen, **When** the device switches between light and dark, **Then** the app follows at once without moving focus or reloading.
3. **Given** the theme dialog is open, **When** the player picks Light, Dark or System, **Then** the change applies immediately, the dialog stays open, and the pressed option reflects the choice, not the resolved mode. With System pressed, a note states the current mode.
4. **Given** a player saved a theme under the old storage key and value names, **When** they load the new version, **Then** their choice is kept, migrated to the new key, and the old key is removed.
5. **Given** storage is unavailable (private window), **When** a theme is chosen, **Then** it applies for the visit and nothing breaks.

---

### User Story 2 - Restyled screens: top bar, setup, game, results, help (Priority: P1)

Every existing screen follows the design spec: a glass top bar with the mark, title, nav and theme button (a back button inside a game or help); setup options as segmented toggles and chips; one primary button per view; modals that are bottom sheets on phones and centred on wider screens; banners, toasts, the update bar, progress/turn pill and result and share areas in the specified roles. Game boards keep their meaning but sit in the new surfaces.

**Why this priority**: This is the visible rework. A player sees the same game with the new interface on every screen.

**Independent Test**: Walk Classic, Ultimate and Twist through setup, play, win/draw, replay, help, settings, multiplayer pairing, and the update bar. Each screen uses only the three surface levels, the named components and the type scale, at 320px, 480px, 720px and wider.

**Acceptance Scenarios**:

1. **Given** any screen, **When** viewed, **Then** it has one flat page background, glass cards on it, and controls on those cards, and never glass on glass.
2. **Given** a view with a main action, **When** shown, **Then** exactly one button is primary.
3. **Given** a phone-width screen, **When** a modal opens, **Then** it appears as a bottom sheet that closes by its close button, Escape or a backdrop tap, and body scroll is locked meanwhile.
4. **Given** a screen 320px wide, **When** any view is shown, **Then** there is no horizontal scroll.
5. **Given** a new service worker is waiting, **When** the update bar shows "A new version is ready.", **Then** the player chooses when to update and their game is saved first.
6. **Given** a game ends, **When** the result shows, **Then** it states the outcome in words with an icon, one line of detail and the next action, and the share text copies with a "Copied" toast.

---

### User Story 3 - Marks, boards and content colours drawn exactly (Priority: P2)

X, O, the player palette choices and the six Twist cube faces are content colours: they are drawn with their exact colours, never tinted or dimmed, with a thin outline so they stay visible on any surface. Neighbouring content colours are separated by a seam. Status, ownership and category are always carried by a word, shape or pattern as well as colour (X and O keep their distinct shapes; won boards keep outlines and patterns).

**Why this priority**: The game's meaning lives in these colours; they must survive the restyle intact and remain legible, but the chrome rework can ship first.

**Independent Test**: Inspect board marks, claimed boards and cube faces in both modes with each mark palette. Colours match their defined values, outlines are visible, and each state is identifiable in greyscale.

**Acceptance Scenarios**:

1. **Given** any mark palette in either mode, **When** marks render, **Then** their colour is exactly the palette's value with no opacity or tint applied.
2. **Given** a white-ish or black-ish content colour, **When** shown on a surface it could vanish into, **Then** a visible outline keeps its shape readable.
3. **Given** the board in greyscale, **When** inspected, **Then** X versus O, playable versus claimed, and locked faces are all distinguishable without colour.

---

### User Story 4 - Accessible, touch-friendly, motion-aware (Priority: P2)

Every control has at least a 44 by 44px hit area, inputs use at least 16px text, no text is under 12.5px, focus is a clear 2px ring on every focusable element, and text and edge contrast meet AA in both modes. Anything that opens, closes or switches animates briefly and respects reduced motion, while game timing (computer think delay, auto-advance) is unaffected by it.

**Why this priority**: Required for the release gate but largely a property of the other stories done correctly.

**Independent Test**: Run the accessibility audit and keyboard-only walkthrough; enable reduced motion and confirm animations collapse but computer moves still pause as before.

**Acceptance Scenarios**:

1. **Given** keyboard only, **When** the player tabs through any screen, **Then** the skip link is first, every control is reachable and named, and the focus ring is visible.
2. **Given** reduced motion is on, **When** a modal opens or a mode changes, **Then** no visible animation occurs but the interface still updates correctly.
3. **Given** the OS changes mode while a control has focus, **Then** focus stays where it was.

---

### User Story 5 - Install shell and checks match the spec (Priority: P3)

The installed app, its manifest, icons and screenshots, theme colour, offline behaviour and release checks conform to the PWA shell section of the design spec, with the checks that enforce the design (no stray colour literals, theme parity, contrast) running as part of the normal check and test commands.

**Why this priority**: Much of this already exists; this story closes gaps and adds the contrast check.

**Independent Test**: Run the project's checks, tests, end-to-end suite and audit; all pass. Install the app, go offline and play a full game of each mode.

**Acceptance Scenarios**:

1. **Given** the app has loaded once, **When** the device goes offline, **Then** all three game modes remain fully playable.
2. **Given** a colour literal is added to any stylesheet other than the theme file (outside the allowed fixed-meaning tokens), **When** checks run, **Then** they fail.
3. **Given** any declared text, edge or fill pairing, **When** the contrast check runs, **Then** it fails if the pairing falls below 4.5:1 (text) or 3:1 (edges, focus rings, bar fills, meaningful icons) in either mode.
4. **Given** cached files change, **When** checks run without a cache version bump, **Then** they fail.

---

### Edge Cases

- A stored theme value that is missing, corrupt or unknown: treated as System.
- Both the pre-paint script and the runtime resolver must agree for every stored value, including legacy ones.
- A player in the middle of a game or multiplayer session when the update bar is accepted: state is saved and restored.
- Very long names or counts on narrow screens: rows stack at the single narrow breakpoint, with no clipping.
- Light-on-light or dark-on-dark content colours (a near-white mark in light mode): outline keeps them visible.
- Notched or rounded-corner devices: content respects the safe areas.
- Locked cube faces and disabled controls: marked with a word or icon and not by dimming alone.
- Network features (multiplayer pairing) while offline: show a banner saying what to do and never block local play.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST offer exactly two colour themes, light and dark, with System as the default preference that tracks the device live. No other colour themes or swatches.
- **FR-002**: The player's theme preference (Light, Dark, System) MUST persist locally, survive reloads and updates, and a legacy stored choice MUST be migrated once and its old key removed.
- **FR-003**: The first paint MUST already be in the resolved mode; the early script and the runtime resolver MUST give the same result for every stored value.
- **FR-004**: The page background MUST be one flat colour derived from the accent tint and base; no gradients, orbs or blobs.
- **FR-005**: Surfaces MUST use exactly three levels (page, glass card, control inside a card); glass MUST NOT sit on glass.
- **FR-006**: Every colour used by the interface MUST be defined in the theme file; no colour literal MAY appear in any other stylesheet except the fixed-meaning tokens, which are themselves defined in the theme file.
- **FR-007**: Content colours (X and O palette values, cube face colours, QR code colours) MUST be fixed-meaning tokens, drawn exactly, and never themed, tinted or dimmed. Visible outlines MUST keep them readable on any surface and seams MUST separate neighbouring content colours.
- **FR-008**: The interface MUST use one typeface at weights 400, 600, 700 and 800 only, following the specified type scale, with no text under 12.5px and no input text under 16px. Numeric figures MUST align (tabular).
- **FR-009**: The interface MUST contain no emoji and no em dashes in user-visible text; icons MUST be inline vector icons from one shared set covering the core set plus the game's own concepts (each game mode: classic, ultimate and twist; each hint type: winning cell and block; lock), each recurring concept with its own icon.
- **FR-010**: The top bar, buttons (primary, quiet, destructive, disabled), icon buttons, segmented toggles, chips, text fields, banners, toasts, modals/sheets, theme dialog, update bar, progress and turn indicators, result and share areas MUST follow the component contracts in the design spec.
- **FR-011**: Each view MUST have at most one primary button.
- **FR-012**: Layout MUST use a single centred column up to 720px with one narrow breakpoint at 480px (plus the 640px point where dialogs switch from bottom sheet to centred), respect device safe areas, and show no horizontal scroll at 320px. No other width breakpoints.
- **FR-013**: Every interactive control MUST have a hit area of at least 44 by 44px, a visible 2px focus ring on keyboard focus, and an accessible name. Exempt: individual board cells and cube stickers, which are sized by the board (an Ultimate cell is about 33px on a 360px phone); they keep their visible focus ring and accessible names, and the board as a whole is at least 280px wide.
- **FR-014**: Status, score, owner and category MUST each be shown by a word, shape or pattern in addition to colour.
- **FR-015**: Text and edge colours MUST meet AA contrast (4.5:1 text; 3:1 field edges, focus rings, bar fills and meaningful icons) in both modes, verified by an automated contrast check.
- **FR-016**: Everything that opens, closes or switches MUST animate over 150 to 220ms (bars up to 300ms) and MUST respect reduced motion; computer think delay and auto-advance timing MUST NOT change under reduced motion. Exempt: the Twist cube's layer turns and face-to-face view turns, which are game motion and keep their own longer durations (about 340 to 400ms) under a dedicated token; they still collapse to no animation under reduced motion.
- **FR-017**: A mode change triggered by the device MUST NOT move focus or animate beyond a colour transition.
- **FR-018**: Update availability MUST be shown as a bar offering Update; the app MUST never update automatically, and state MUST be saved before updating.
- **FR-019**: The manifest, icons, favicon, theme and background colours (matching the light page colour) and screenshots MUST conform to the PWA shell section; the cache version MUST be bumped for any cached file change.
- **FR-020**: After one load, all game modes MUST work offline; multiplayer pairing MUST degrade with a banner that says what to do.
- **FR-021**: User-visible copy MUST use sentence case, British spelling and number format, no exclamation marks, and say what to do in errors.
- **FR-022**: Game rules, move behaviour, saved games, replays and multiplayer protocol MUST be unchanged by this rework; existing saved games MUST still load.
- **FR-023**: The mark palette picker MUST remain as a choice of content colours (X and O pairings) and MUST continue to meet the content-colour rules above.

### Key Entities

- **Theme preference**: the player's saved choice of Light, Dark or System; distinct from the resolved mode currently shown.
- **Design tokens**: the named colours, radii, motion timings and shadows that all screens draw from; split into themed tokens and fixed-meaning content tokens.
- **Content colours**: X and O palette values, cube face tints, QR colours; carry game meaning and never change with theme.
- **Component set**: the shared interface parts (top bar, buttons, toggles, chips, fields, banners, toasts, modals, update bar, pills, results, share card) each with a defined look and accessibility behaviour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of screens (setup, each game mode, results, replay, help, settings, theme dialog, multiplayer pairing, update bar) pass a review against the design spec's non-negotiables with zero departures, or each departure is recorded with a reason.
- **SC-002**: Zero colour literals outside the theme file other than the declared fixed-meaning tokens, enforced by an automated check.
- **SC-003**: Every declared text/surface and edge/surface pairing meets its contrast ratio in both light and dark, enforced by an automated check.
- **SC-004**: Accessibility audit score is at least 90, with no serious or critical violations, on setup, game and help screens in both modes.
- **SC-005**: On a dark-preference device, the first paint is already dark: the resolved mode and page colour are set before the first render and before any module script runs.
- **SC-006**: 100% of existing saved theme choices and saved games carry over with unchanged behaviour after the update.
- **SC-007**: The first load is interactive in under 3 seconds on a throttled mobile connection, and a full game of each mode can be played offline after one load.
- **SC-008**: Every control passes a 44 by 44px hit-area check at 320px and at 720px widths.
- **SC-009**: The theme control is reachable in one step (a top-bar button) from every screen, including during a game.

## Assumptions

- The design spec at `docs/pwa-design-spec.md` is the authority; departures are recorded in the plan's complexity tracking.
- The Project Profile slots are filled as: storage prefix `ttt`; content colours are X, O (per chosen palette), the six cube faces and the QR colours; domain components are the three boards, the Twist cube view, the turn pill, replay controls and the multiplayer pairing flow; network feature is multiplayer pairing.
- The existing logo is kept as is and used at 24 to 32px beside the title and as the favicon, and its colours do not theme.
- The mark palette picker is kept as a choice of content colours; the design spec's "no other colour themes" applies to interface chrome, not to which colours X and O are drawn in. Its sample swatches are content, not chrome.
- The app title, game names and rules text stay as they are except where copy rules (sentence case, no em dashes, no exclamation marks) require edits.
- The typeface is loaded from the web without blocking first paint, with a system fallback, so a slow network or first offline use falls back gracefully.
- The Twist cube's turn animations are exempt from the 220ms cap (FR-016); they are game motion, not interface transitions.
- No game logic, scoring, AI, protocol or storage format changes; only the storage key and value names for the theme change, with migration.
- The contrast check listed as "to add" in the design spec is in scope; the other listed checks already exist and are updated where tokens change.
- A constitution amendment referencing the design spec (spec section 14, step 2) is in scope as a documentation change.
