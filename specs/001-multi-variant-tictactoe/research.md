# Research: Multi-Variant Tic Tac Toe

Sources: reference `tictactoe/tictactoe-game` (PWA, seeds, AI, replay, PeerJS) and `tictactoe/1D-Tic-Tac-Toe` (Rubik's-Tac-Toe, Python/tkinter).

## R1. Stack and build

- **Decision**: TypeScript (strict), compiled with `tsc` only to ES modules served as static files. No bundler, no framework. Source in `src/`, output in `site/js` and `site/sw.js`. Relative imports use `.ts` extensions with `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` (TS 5.7+), so the same files run under Node's type stripping in tests and emit valid `.js` imports for the browser. Syntax is limited to what type stripping accepts (`erasableSyntaxOnly`: no enums, namespaces or parameter properties; use `as const` objects and unions). Service worker has its own `tsconfig.sw.json` (`lib: webworker`).
- **Rationale**: User request. Discriminated unions for `Move`/`GameState`/net messages and typed sticker indices make illegal states unrepresentable and check the three variants share one core shape. Keeps Constitution IV: one tool (`tsc`), no runtime cost, tests need no extra loader (Node 22.18+).
- **Alternatives**: Plain JS + JSDoc (weaker checking); Vite/esbuild bundling (extra tool, not needed at ~30 modules); `tsx`/`ts-node` for tests (extra dependency, unneeded with native stripping).
- **Build and offline**: `check-precache` reads the emitted `site/js` file list, so the precache cannot miss a compiled module; `check-version` fails if the list changed without a cache version bump.

## R2. 3D Cube rendering

- **Decision**: CSS 3D transforms (`transform-style: preserve-3d`), one element per sticker, pointer-driven view rotation, plus a flat unfolded-net fallback.
- **Rationale**: 54 stickers is tiny; no library, no WebGL context loss, works with focus/ARIA on real DOM elements, accessible by keyboard. Layer-rotation animation = rotate the 9–21 sticker group then commit state.
- **Alternatives**: Three.js (~600 KB, canvas not accessible, violates simplicity); raw WebGL (same issues, more code).

## R3. Cube rules model

- **Decision**: Model as 54 stickers on a standard cube; faces U, D, F, B, L, R with a fixed (row, col) orientation convention and a precomputed permutation table for each of 3 layers × 3 axes × {+90°, −90°}. Outer layers also rotate their adjacent face 90°. Lines counted per face (3 rows, 3 cols, 2 diagonals = 8 per face, 48 total); a cell can count in several lines.
- **Rationale**: Matches the original (`count_wins` counts all 8 lines per face; layer rotations rotate outer faces via `Board.rotate`). Permutation tables are data, so verify by invariants: each rotation is a 4-cycle ×N, inverse rotation undoes it, four quarter rotations = identity, mark counts conserved.
- **Rotation amounts (clarified)**: quarter rotation either way plus half rotation, matching the original's `times = 1, -1, 2`; a half rotation is one move, not two. Table size 3 axes × 3 layers × 3 amounts = 27. Verify against golden positions derived from the original code (port `rotate_up/rotate_left/make_turn` to fixtures); extra invariant: half = quarter applied twice.
- **Alternatives**: Per-face pointer graph (error-prone for orientation).

## R4. Cube end and tie logic

- **Decision**: Game ends when 54 cells are filled and no rotation pending; most lines wins; equal = tie. After each rotation totals are recounted from the full position (the original does the same), so lines can vanish. A scoring move is detected by a rise in the mover's total *before the rotation*, as in the original `update_cube_state`; a rotation never grants another rotation.
- **Rationale**: Faithful to the original and matches spec edge cases.

## R5. Ultimate rules

- **Decision**: Standard rules: forced board = cell index of last move; closed (won/full) target ⇒ free choice among open boards; board claimed by first line; overall win by line of claimed boards; full unclaimed boards count for no one; draw when no open cells and no line. First move free.
- **Rationale**: Most common published rules; spec assumption.
- **Alternatives**: "Tied board counts for both" and "free choice only when full" variants, left as a future setting.

## R6. Computer opponent

- **Decision**: Negamax + alpha-beta with a position-count budget, five levels (depth and random-move rate as in reference), deterministic PRNG from the seed, run in a Web Worker. Classic reuses reference logic. Ultimate adds a heuristic evaluation (claimed boards, board-line potential, send-opponent-to-closed-board bonus) and a move ordering; levels scale depth and node budget so replies stay < 1 s.
- **Rationale**: Determinism enables replay and seed sharing without a server. Position-count budgets, not clocks, keep results identical across devices.
- **Alternatives**: MCTS (needs randomness/time); server AI (violates offline).
- **Risk**: Ultimate Master strength vs. 1 s limit; tune budgets on a throttled device (see quickstart).

## R7. Seeds, save, replay and share links

- **Decision**: Seed string `<VARIANT>-<8 chars>`, e.g. `3X3-BXK4-M9TR`, `4X4-…`, `5X5-…` for Classic, `ULT-…` for Ultimate, `CUB-…` for Cube (see `contracts/record-format.md`) (28-char alphabet without vowels/0/O/1/I, as in the reference). Replay link encodes variant, seed, per-move characters and result flags in a query string; moves per variant are packed to single characters or short tokens (Cube rotations as tokens). Nothing is stored server-side. Versioned save schema in `localStorage`.
- **Rationale**: Reference format proven; extended for variants. Details in `contracts/record-format.md`.
- **Alternatives**: JSON + base64 (longer links); compression libs (dependency).

## R8. Two-device play

- **Decision**: Reference approach: PeerJS 1.5.4 lazily loaded from a CDN, STUN servers only (explicit `iceServers`, no default TURN), six-character host code, link and QR (QR encoder ported, runs offline). Authoritative host: guest sends intents, host validates with core rules and broadcasts state hash + move; both sides run the same pure core.
- **Rationale**: FR-036 (no own server). Reuse of tested approach. A shared pure core makes desync detectable via state hashes.
- **Known limits**: Fails behind symmetric NAT / client isolation; UI says so and suggests a shared hotspot (reference does the same).
- **Alternatives**: Own signalling server (forbidden); TURN relay (cost, third-party traffic, not requested).

## R9. Undo semantics

- **Decision**: History is the move log; undo pops to the previous human turn (vs computer: user move + reply; Cube: also reverts a pending/performed rotation as one unit with its placement). Network undo is request/accept/decline.
- **Rationale**: FR-005/FR-034; single log keeps replay, save and undo consistent.

## R10. PWA, offline and updates

- **Decision**: Hand-written service worker with a versioned precache list, `skipWaiting` only on user request via an update bar, stale cache cleanup on `activate`; checks as in the reference (`check-sw`, `check-precache`, plus `check-version` requiring a version bump when the asset list changes). Game in progress survives update because it lives in `localStorage` with a schema version and migration hook.
- **Rationale**: Constitution II/III; proven in the reference.
- **Alternatives**: Workbox (dependency).

## R11. Accessibility

- **Decision**: Real `<button>`s for cells, roving tabindex/arrow keys on boards, `aria-live` status line, distinct mark shapes and patterns plus colour, visible focus; Cube gets keyboard controls (arrows rotate view, Enter place, layer-rotation picker as a labelled control group) and a flat view toggle. axe-core in Playwright.
- **Rationale**: FR-013, FR-031, SC-009.

## R12. Hints for variants

- **Decision**: Classic: winning cells (dot) and must-block cells (dashed ring) as reference. Ultimate: same within the playable board(s). Cube: same on the current face candidates for line completion, excluding rotation effects.
- **Rationale**: FR-010; scope bounded to "where meaningful".

## Resolved Unknowns

All items in Technical Context are resolved; no NEEDS CLARIFICATION remain.
