# 2×2 Twist-Tac-Toe analysis

Throwaway research, not part of the app or its build. Question: would a 2×2 Twist mode be meaningful, and does either player win under optimal play?

The game logic is reimplemented in C++ on bitmasks. The layer-turn permutations come from `src/core/cube.ts` (size 2 works there), so geometry is not duplicated.

## Run

```sh
node --experimental-strip-types gen-tables.ts > tables.h   # turn tables + windows, from src/core
g++ -O3 -march=native -o solve solve.cpp                   # exhaustive alpha-beta
g++ -O3 -march=native -o mcts mcts.cpp                     # self-play Monte Carlo tree search
./solve <lock 0|1> <faces 0|1> [log2 table size, default 27]
./mcts  <lock> <faces> <iterations per move> <seconds> <seed> [X iterations]
```

`lock` is the lock-scored-faces option; `faces` is count-faces scoring (otherwise lines). Win length is 2.

## Findings

- No lock, lines: always a draw. With every sticker filled and 12 marks each, X lines minus O lines on a face with x X-marks is 3x − 6, which sums to 0. Turns cannot change it. Confirmed by 200k random games and ~900 strong games, all ties.
- No lock, faces: mostly ties; O wins about 2.5× as often as X (151 vs 59 of 886 games, 20k iterations).
- Lock, lines: X 692, O 365, ties 323 (1380 games).
- Lock, faces: X 718, O 339, ties 398 (1455 games).
- The exhaustive solver did not finish for either lock case (about 4.5e9 positions in an hour, no verdict), so the lock results are strong-play evidence, not a proof.
