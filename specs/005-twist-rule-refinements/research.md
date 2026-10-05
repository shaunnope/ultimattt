# Research: Twist Mode Display Polish and New Logo

No NEEDS CLARIFICATION remained after `/speckit-clarify`. Decisions below.

## 1. Pill placement and ownership
- **Decision**: One `createPill()` component mounted by `game.ts` above the board and by `replay.ts` for replays; boards stay unaware of it.
- **Rationale**: Turn and score are game-level, not board-level, and apply to all three modes. Removes `#cube-score` from `board-cube.ts`.
- **Alternatives**: a pill per board (triplicated code); keep the Twist score in the board and add a pill beside it (violates "scores inside the pill").

## 2. Pill content and wording
- **Decision**: `pillModel({ mover, scores?, phase, over, winner, myMark? })` returns segments `{mark, active, score?, label}` and a spoken string ("O to move, X 2, O 1"). The active segment gets a filled background, a bold outline and `aria-current="true"`; the winner gets a text cue. Never colour alone.
- **Rationale**: Pure and unit-testable; the spoken text is built once and sent to the existing live region.
- **Alternatives**: building text in the DOM layer (untestable).

## 3. Slide animation
- **Decision**: One absolutely positioned highlight element moved with `transform: translateX`; `prefers-reduced-motion` removes the transition.
- **Rationale**: Compositor-only, no layout, simple CSS.
- **Alternatives**: toggling classes on two segments (no slide).

## 4. Status line after the pill
- **Decision**: `statusText` returns `""` for plain turns; the status element stays in the DOM as a live region and is hidden when empty. It keeps results, resignation, "Waiting for your friend", the rotate prompt, where-to-play, thinking and errors.
- **Rationale**: Clarified answer B. Keeping the element avoids breaking the live region and the error channel.
- **Alternatives**: remove the element (loses result and error channel).

## 5. Last-move indicator in Twist
- **Decision**: `lastPlacedSticker(state)` in `core/cube.ts`: walk `state.moves`; on a place set `idx = face*n² + cell`; on a rotate, find `dst` with `table[dst] === idx` for `rotateTable(size, axis, layer, dir)` (`table[dst] = src`) and set `idx = dst`; unmoved stickers map to themselves. Return `null` with no placement. Derived on every render; the view toggles `data-last` on the old and new sticker only.
- **Rationale**: Works for undo, saves, links and replay with no stored data; reuses the existing permutation.
- **Alternatives**: store the index in state (changes save/record shape, forbidden by FR-017).

## 6. Last-move style
- **Decision**: `.sticker[data-last]` uses a full inset ring (`box-shadow: inset 0 0 0 3px var(--fg)`) kept distinct from the `data-locked` hatch, `data-line` and hint styles; forced-colours gets an `outline` fallback.
- **Rationale**: The spec asks for an inset border. Classic's `inset 0 -5px 0` bar is too weak on small 5×5 stickers.
- **Alternatives**: copy Classic's bottom bar exactly (low visibility).

## 7. Padlock
- **Decision**: Inline SVG `lock` icon (body plus shackle, round caps) inside the existing `.face-locked-label`, which stays `aria-hidden="true"`. No screen-reader text is added: the stickers already announce "locked face" in their accessible names, and an extra hidden span inside an `aria-hidden` element would never be read.
- **Rationale**: Minimal change to the existing badge; works in 3D and flat view.
- **Alternatives**: CSS-drawn lock (more CSS, worse in forced colours).

## 8. Logo
- **Decision**: One SVG, viewBox 64×64: an isometric cube outline (three visible faces), each split 2×2, with X's and O's, all `stroke-linecap` and `stroke-linejoin` round. Colours: ink outline, accent X, default O colour. The same coordinates are ported to `make-icons.mjs`, which keeps its dependency-free PNG writer and rasterises by distance to rounded segments, at 192, 512, 180 and a padded maskable size. The header inlines the SVG using `currentColor` so both themes work.
- **Rationale**: No image toolchain; rounded caps come free from distance-to-segment rasterisation.
- **Alternatives**: add `sharp` or a canvas dependency (violates Simplicity); SVG-only icons (weaker install support on iOS).

## 9. Cache and release
- **Decision**: Bump `VERSION` 4 → 5, add `logo.svg` to precache, keep `precache.lock.json` in step via the existing scripts.
- **Rationale**: Cached CSS, JS, icons and manifest change.

## 10. Tests that change
- **Decision**: Update turn-text asserts on `#game-status` in the classic, ultimate, cube, network, input, replay and compat specs, and `#cube-score` asserts in the cube, cube-rules and compat specs, to read the pill. Fixtures are untouched.
- **Rationale**: Behaviour intentionally changes (FR-009, FR-018); old assertions would fail.
