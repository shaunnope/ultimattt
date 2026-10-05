# Tic Tac Toe: Classic, Ultimate and Twist

An installable, offline-first web app with three ways to play tic tac toe:

| Variant | What it is |
| --- | --- |
| **Classic** | 3×3, 4×4 or 5×5, with a win length of 3 up to the board size (four in a row is the default on 4×4 and 5×5). X moves first. |
| **Ultimate** | N×N small boards in an N×N grid (N = 3, 4 or 5). The cell you play inside a small board decides which small board your opponent must play next. Win your win length of small boards in a line. Sent to a board that is won or full, the opponent may play anywhere open. |
| **Twist-Tac-Toe** (Twist) | Six N×N boards (N = 3 to 5) on the faces of a 3D cube you can turn and inspect. Every line scores a point. After a move that scores, you must turn one layer of the cube, which carries marks to other faces and can make or break lines. When every cell is full, most lines wins (a run longer than the win length scores once per stretch of that length). Based on *Rubik's-Tac-Toe* from the 1D Tic-Tac-Toe project (F02 Group 10, 2020). |

Play the computer (five levels, Beginner to Master, in Classic and Ultimate), a friend on the same device, or a friend on another device. Games against the computer have a seed that replays the same game. Every game ends with an instant replay that can be shared as a link, and can be saved, resumed and played offline. Hints, one of four fixed X and O colour pairs (one colour-blind safe), how Twist turns are named, and light and dark appearance are in Settings. A Help page explains the Classic rules, Ultimate and Twist-Tac-Toe.

It follows the Classic game of the reference project `tictactoe-game` (seeds, undo, hints, replay, share links, peer-to-peer play), without its scores and leaderboard.

## Playing

* **Computer.** Levels differ in how far they look ahead and how often they play a decent move that is not the best. Master cannot be beaten on 3×3. The computer never reads a clock or `Math.random`, so the same seed and the same moves are always the same game.
* **Whose turn.** A two-segment pill above the board, X then O, highlights the player to move in every mode; in Twist it also shows each player's score (lines or faces, as set up). The status line below it only speaks when there is something to say: a result, a resignation, a wait for your friend, a layer turn to make, where to play in Ultimate.
* **Undo** works in every mode. Against the computer it takes back your move and the reply. In a two-device game it asks your friend. In Twist, a mark that scored and the layer turn that followed are taken back together.
* **Seeds** exist only for games with a computer player, and look like `C53-BXK4-M9TR` (the prefix is the rules: variant letter, board size, win length). Paste one on the start screen to play that game again; it sets the variant, board and win length. 001 seeds (`3X3-…`, `ULT-…`) still work.
* **Replay and sharing.** When a game ends it plays back by itself (Settings can turn that off), with play, pause, steps, a slider, a move list and a speed (0.5×, 1×, 2×, 4×) that is remembered. *Share replay* makes a link that reproduces the whole game. A link carries the rules, the seed (computer games only), who played and the moves, never a result: the result is always recomputed by the rules. Opening one never touches your own saved game.
* **Two devices.** Host a game and share the six-character code, the link or the QR code; the other device joins. The two devices find each other through PeerJS's free public broker and then talk directly (WebRTC, STUN only, no TURN relay, no account, no server of ours). That means they must be able to reach each other: the same wifi, or one device sharing a hotspot, works; some mobile and guest networks do not. A game in progress is not saved if the page is closed.
* **Twist controls.** Drag, or use the arrow keys, to turn the view; the *Top / Bottom / Front / …* buttons bring a face to the front; *Flat view* shows the unfolded net. After a scoring move, pick a layer and a direction: the layer turns as a preview, and Confirm makes the turn (click outside the cube, or press Escape, to cancel and choose again). There are 9N turns on an N×N cube; Settings can name them in cube notation (R, U', F2, 2L). Hints, when on, mark winning cells with a dot and cells you must block with a dashed ring, and only look at placing a mark, not at what a later turn would do.

## Running it

Needs Node 22.18 or later (it runs TypeScript directly for the tests).

```text
npm install
npx playwright install chromium     # once, for the browser tests
npm run build                       # tsc: src/ -> site/js, src/sw.ts -> site/sw.js, preload list, precache list
npx http-server site -p 8080        # then open http://localhost:8080
```

There is no bundler: `tsc` emits plain ES modules and the browser loads them as they are.

## Tests and checks

```text
npm test            # type check, then the unit and contract tests (node:test, no browser)
npm run test:e2e    # the browser tests (Playwright; desktop and phone sizes)
npm run test:perf   # timing: computer reply time and cube frame times on a 4x slower CPU; runs alone
npm run check       # service worker rules, precache coverage, version bump, theme script, preload list
npm run audit       # release gate: Lighthouse accessibility >= 90, axe, first load under 3 s, installability, timing
```

Rules, the computer, seeds, replay links, the move codec, cube geometry and the two-device protocol are pure modules in `src/core/` with no DOM, storage or network, covered by tests that were written first. Twist-Tac-Toe's layer turns are checked against the original game's own turn logic: `scripts/cube-reference/` is a Python port of it that produced `tests/fixtures/cube-golden.json` (408 positions); run `python scripts/cube-reference/generate.py` to regenerate.

Two-device play is tested with a stand-in for PeerJS (`tests/e2e/fake-peerjs.js`) because the public broker cannot be relied on from a test run. The real PeerJS path is exercised by hand: host on one device, join on another.

## Layout

```text
src/core/        pure rules, computer, seeds, records, protocol, settings (no DOM, storage or network)
src/adapters/    localStorage (save file), PeerJS pairing
src/ui/          screens, boards, the 3D cube, replay, settings, service worker registration
src/sw.ts        the service worker
site/            what is deployed: HTML, CSS, icons; js/ and sw.js are build output
tests/           unit/ contract/ e2e/ fixtures/
scripts/         build and release scripts (precache list, preload list, checks, audit)
specs/           the specification, plan and tasks this was built from
```

## Releasing

1. Make sure everything passes: `npm test`, `npm run test:e2e`, and `npm run audit` (Lighthouse accessibility, axe, first-load time, installability, timing). The workflow runs the audit too and will not deploy without it, but running it first saves a failed run.
2. Bump `VERSION` in `src/sw.ts` whenever any cached file changed. Without it, returning visitors keep the old version. `npm run check` fails if the files changed and the version did not.
3. `npm run build`, then `node scripts/check-version.mjs --update` to record the released version and the hash of the cached files in `scripts/precache.lock.json`. That file is committed: it is what lets `npm run check` notice a change to the cached files that came without a new `VERSION`. Refresh it at every release.
4. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds, runs the checks, the tests and the audit, and only then publishes `site/` to GitHub Pages.

**Manual check before a release:** the new-player Twist test (success criterion SC-007: at least 9 in 10 new players complete a Twist game, including a layer turn, without help). It needs people, so it is not automated.

### GitHub Pages

In the repository's *Settings → Pages*, set *Source* to *GitHub Actions* and turn on *Enforce HTTPS*. The site works from a project path (`https://<user>.github.io/<repo>/`) because every address in it is relative; `tests/e2e/subpath.spec.ts` serves it under `/ultimattt/` and checks it. Pages cannot set response headers, so the service worker is the only cache control the site needs (browsers always revalidate a service worker script).

## Accessibility and offline

Every control works by keyboard and by touch; marks differ by shape as well as colour; claimed boards, winning lines, hints and the playable board are marked with outlines and patterns, not only colour. After the first load the whole app is cached by a versioned service worker and works offline; the game in progress and your settings are kept on the device. Two-device play is the only feature that needs the network.

## Credits

The Classic game, replay, seed and peer-to-peer design follow the reference project `tictactoe-game`. Twist-Tac-Toe is a re-imagining of *Rubik's-Tac-Toe* by F02 Group 10 (2020). The QR encoder was first written for uwuPromptr.
