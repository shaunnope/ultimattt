# Quickstart: Validating Twist Mode Display Polish and New Logo

Prerequisites: Node 22.18+, `npm install`. Hooks are in [contracts/ui-contracts.md](contracts/ui-contracts.md); derived values are in [data-model.md](data-model.md).

## Automated

```sh
npm run check        # build, scripted checks (names, precache, version, theme tokens), unit tests
npx playwright test  # e2e including pill, padlock, last-move, logo and offline
```

Expected: all pass. `check-version` passes only after `VERSION` is bumped to 5. `check-names` finds no reference project names in visible text.

## Manual scenarios

1. **Pill, all modes**: start Classic, Ultimate and Twist games. X's segment is highlighted; after each move the highlight slides to the other player. Classic and Ultimate show no scores; Twist shows `0` and `0`. With reduced motion on, there is no slide.
2. **Scores in Twist**: score a line (and a face in Faces mode). The scorer's number rises and the highlight stays on them through the layer turn, then moves. No "Lines" or "Faces" text in the pill, and no separate score line.
3. **Status line**: plain turns show nothing there. Resign, finish a game, play two-device (waiting message) and play Ultimate (where-to-play) still show their messages.
4. **Padlock**: Twist with lock on; score a line. The face shows a padlock icon and no word "Locked". Turn the cube and switch to flat view; the icon stays on its face. A screen reader still announces locked stickers (the padlock is decorative). The game title always names "lines scoring" or "faces scoring".
5. **Last move**: place marks on several faces with layer turns between. Exactly one cell has the inset ring and it follows the mark through turns. Undo moves it back. Reload (save) and open a replay link: the ring matches the last placement.
6. **Logo**: view the header logo in light and dark, the favicon at 16 px, the installed icon and the maskable crop. The cube outline and the X and O are readable, and all line ends are rounded.
7. **Narrow screen**: at 320 px wide in both themes, the pill, scores and padlock fit without clipping or horizontal scroll.
8. **Offline and compatibility**: go offline after first load; the logo and icons still load. Open a 001–004 save, link and seed: they play as before with the new display.
