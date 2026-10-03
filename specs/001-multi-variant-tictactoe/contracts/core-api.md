# Contract: Core API (pure modules)

Written in TypeScript (`src/core/*.ts`); the signatures below are the exported types. `Move`, `GameState` and `Config` are discriminated unions on `variant` / `t`, so `apply` narrows by variant at compile time.

No DOM, storage, network, clock, or `Math.random` in `src/core`. All functions deterministic.

## Shared shape (each variant module exports the same functions)

```text
newGame(config)               → state
legalMoves(state)             → Move[]
isLegal(state, move)          → { ok: true } | { ok: false, reason: string }
apply(state, move)            → state               // throws if illegal
status(state)                 → { status, winner, winLine? }
undo(state)                   → state               // pops one unit (variant defined)
fromMoves(config, moves)      → state               // replay; the save and link format rely on this
hash(state)                   → uint32              // for net desync check
```

`reason` is a stable machine key (e.g. `"not-your-board"`, `"occupied"`, `"rotate-pending"`) mapped to user text in the UI.

## Variant specifics

- **classic.ts**: `lines(size)`, `hints(state, mark) → {win: number[], block: number[]}`.
- **ultimate.ts**: `playable(state) → number[]` (board indexes); `claims(state)`.
- **cube.ts**: `FACES`, `rotateTable(axis, layer, dir) → number[54]`, `lines(state) → {X,O}`, `rotations() → Rotation[]` (27: 3 axes × 3 layers × {+90°, −90°, 180°}), `phase(state)`; `apply` accepts `place` while `phase==="place"` and `rotate` while `phase==="rotate"` only.

## AI

```text
chooseMove(variant, state, level, rng) → Move       // negamax, node budget, no clock
```

`rng` is `randomSource(seedNumber)` advanced identically on every device. The worker wraps this and posts `{move}`. Cube has no AI.

## Seed

```text
newSeed(variant, size?) → string      // uses crypto only here, at game creation
parseSeed(string)       → {variant, size, body} | {error}
rngFor(seed, moveIndex) → () => uint32
```

## UI adapter contract

UI components receive `state` and call `dispatch(move)`; they never compute legality. Hints, highlights and the playable-board outline come from core queries.
