# Baseline (before 008)

- `npm run build && npm test && npm run check`: green (93 contract/unit subtests in the last block, 0 failures).
- Parity baseline retaken from the unchanged app on 2026-10-08 with the seed box masked: 28 captures, passed on a second run.
- Tests or source relying on the fixed placeholder text: none. The only fixed `placeholder` is `src/lib/components/Setup.svelte:181`; the string `C53-BXK4-M9TR` in tests is a value, not a placeholder.
- The working tree already held uncommitted edits to `src/lib/components/Setup.svelte` and `static/css/style.css` before this work; they are the user's and are kept.
