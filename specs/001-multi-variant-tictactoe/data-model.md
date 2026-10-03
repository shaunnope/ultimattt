# Data Model: Multi-Variant Tic Tac Toe

All entities are plain JSON-serialisable values. Core functions are pure: `(state, action) → state`.

## Common

**GameConfig**
- `variant`: `"classic" | "ultimate" | "cube"`
- `size`: `3 | 4 | 5` (classic only; else fixed)
- `mode`: `"computer" | "local" | "network"` (cube: `local | network` only)
- `level`: `1..5` (computer mode)
- `humanMark`: `"X" | "O"` (computer/network; resolved from seed if "random")
- `seed`: string

**Move** (tagged union, serialised to one token each, see `contracts/record-format.md`)
- `{t:"place", cell}` classic: cell `0..size²-1`
- `{t:"place", board, cell}` ultimate: both `0..8`
- `{t:"place", face, cell}` cube: face `0..5`, cell `0..8`
- `{t:"rotate", axis, layer, dir}` cube layer rotation: axis `x|y|z`, layer `0..2`, dir `+1` (quarter), `-1` (quarter back), `2` (half); 27 rotate moves

**GameState** (common envelope)
- `config`, `moves: Move[]`, `toMove: "X"|"O"`, `status: "playing"|"won"|"draw"|"tie"`, `winner: "X"|"O"|null`, `result?: {resignedBy?}`

**Settings**: `hints`, `autoReplay`, `replaySpeed ∈ {0.5,1,2,4}`, `theme ∈ {auto,light,dark}`, `icons` (`{X: char, O: char}`, default `X`/`O`; validated: 1 grapheme, distinct, not blank; display-only mapping, never part of GameConfig, seed, move record, share link or net messages), `lastConfig`.

**SaveFile** (`localStorage`): `{schema:1, settings, game: {config, moves, startedAt} | null}`. State is rebuilt by replaying `moves`, so the save cannot disagree with the rules.

## Classic

**ClassicState**: `cells: (0|1|2)[size²]` (0 empty, 1 X, 2 O), `winLength` (3 for 3×3, 4 otherwise), `winLine?: number[]`.
Rules: winning lines enumerated per size; win = `winLength` consecutive in row/col/diag; draw when full.

## Ultimate

**UltimateState**
- `boards: (0|1|2)[9][9]` cell marks
- `claims: (0|1|2|3)[9]` per small board: 0 open, 1 X, 2 O, 3 full-unclaimed
- `forced: number | null` board index the next player must play (null = free)
- `winner`, `winLine?` (three claimed boards)
Validation: a move is legal iff `claims[board] === 0`, `cell` empty, and (`forced === null` or `board === forced`).
Transition: place → update claim → `forced = claims[cell] === 0 ? cell : null` → overall win/draw.

## Cube

**CubeState**
- `stickers: (0|1|2)[54]` index = `face*9 + row*3 + col`; faces U, D, F, B, L, R (fixed orientation in `src/core/cube.ts`)
- `phase: "place" | "rotate"` — `rotate` means the mover must rotate a layer next
- `lines: {X:number, O:number}` recomputed from `stickers` (8 lines × 6 faces)
- `empty: number` cells left (rotations do not change it)
- `pendingRotateFor: "X"|"O"|null`
Transitions:
1. `place` (phase `place`, empty cell) → recount; if mover's lines rose → `phase="rotate"`, same mover; else switch mover.
2. `rotate` (phase `rotate`) → apply permutation, recount, switch mover, `phase="place"`.
3. End: `empty === 0 && phase === "place"` → compare `lines`.
Invariants (tested): rotate tables are permutations; inverse composes to identity; mark counts conserved.

## Replay / Share

**ReplayRecord**: `{variant, seed, moves, players, end?: "resign-X"|"resign-O"}`. Reconstructed by folding moves through core.

## Two-device (see `contracts/net-protocol.md`)

**Session**: `{role: "host"|"guest", code, status: "pairing"|"connected"|"lost"|"closed", stateHash}`.
