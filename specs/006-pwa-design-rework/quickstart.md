# Quickstart: validating the PWA design rework

Prerequisites: Node 22.18+, `npm install`, Playwright browsers installed (`npx playwright install chromium`).

## 1. Automated gates

```bash
npm run build        # tsc emit, preload list, precache list
npm run check        # sw, precache, version, theme parity, theme tokens, contrast, names, preload
npm test             # typecheck, unit, contract (theme store, contrast, manifest colours)
npm run test:e2e     # theme dialog, layout audit, offline, subpath, a11y
npm run audit        # Lighthouse accessibility >= 90, axe, first load < 3 s
```

Expected: all pass. `check` fails if a colour literal appears outside `site/css/theme.css`, a declared contrast pair drops below its ratio in either mode, the pre-paint script disagrees with `resolveMode` for any stored value (including legacy `auto`), or cached files changed without a `VERSION` bump.

## 2. Theme behaviour (manual, 2 minutes)

1. Serve `site/` (`npx http-server site -p 8080`) and open it with the OS in dark mode. Expected: dark from the first frame, no white flash.
2. Open the theme modal from the top bar. Expected: System is pressed, with the note "Following your device. Currently dark."
3. Choose Light. Expected: applies at once, modal stays open, System is no longer pressed.
4. Choose System, flip the OS to light. Expected: the page follows, focus does not move.
5. Legacy migration: in devtools set `localStorage["ttt.theme"] = "dark"`, delete `ttt.mode`, reload. Expected: dark on first paint, then `ttt.mode = "dark"` and `ttt.theme` gone.
6. Private window. Expected: choosing a mode works for the visit; no errors.

## 3. Screen walkthrough (10 minutes)

For each of Classic, Ultimate and Twist: setup, play to a win and a draw, replay, share text, settings, help. Check at 320, 480 and 720 px and in both modes:

- Flat page, glass cards, controls in cards, no glass on glass.
- One primary button per view.
- Marks and cube faces keep exact colours with visible rims; state is readable in greyscale (devtools "emulate vision deficiency: achromatopsia").
- Sheets on phone width, centred at 640 px and above; close by button, Escape, backdrop.
- No horizontal scroll at 320 px.
- Tab through: skip link first, visible 2 px ring everywhere.
- Enable reduced motion: no visible animation; the computer still pauses before moving.

## 4. PWA shell

1. Install from the browser; open in standalone. Expected: top bar fits the notch, theme colour matches the page.
2. Go offline after one load; play a full game in each mode. Expected: works; multiplayer shows the offline banner with a next step.
3. Serve under `/ultimattt/` (the subpath e2e does this). Expected: manifest, icons and worker resolve.
4. Update flow: bump `VERSION`, rebuild, reload the open app. Expected: "A new version is ready." with Update; nothing changes until pressed; the game in progress survives.

## 5. Saves and links

Open the fixtures under `tests/fixtures/001` to `003` and a seed link from an earlier version. Expected: all load and play unchanged (the compat e2e covers this).

## Results (2026-10-07)

- `npm run check`, `npm test` (467 unit, 89 contract) and `npm run test:e2e` pass. Network and input specs flaked once each under full parallel load and pass alone.
- `npm run audit`: Lighthouse accessibility 100, first load interactive 2588 ms, axe serious 0, installability passes.
- `npm run test:perf`: the Twist 5x5 frame budget (66.7 ms against 50) fails on this machine, and also failed on the unchanged 005 baseline. The computer reply timings sit at the 1000 ms edge in some runs.
- Manual walkthrough of sections 2 to 4 was not done by a person; the e2e suites cover the same steps. Section 5 (old saves) is covered by `compat.spec.ts`.
