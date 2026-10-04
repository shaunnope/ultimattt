# Contract: Two-Device Protocol (delta to 001)

Baseline: [001 net-protocol](../../001-multi-variant-tictactoe/contracts/net-protocol.md). Message types, turn rules and failure handling are unchanged.

## Version

All messages carry `{ v: 2, … }`. The 001 value was `1`.

- A host receiving a `hello` whose `v` is not 2 replies `reject{ reason: "version" }`, as in 001. The guest shows: the other device needs the latest version of the app; reload to update.
- A guest receiving a `welcome` or any other message with a version other than 2 ignores it (existing behaviour), and on a `reject` shows the same message.

## `welcome` payload

`config` now contains `winLength` and has no `seed` (network games have no computer). `humanMark` is the host's mark, fixed at setup.

```json
{ "v": 2, "type": "welcome",
  "config": { "variant": "ultimate", "size": 4, "winLength": 3, "mode": "network", "humanMark": "X" },
  "moves": "<tokens>" }
```

Receivers validate with `parseConfig`: `winLength` in `[3, size]`, mode `network`, no seed required. Moves use the widened token alphabet from [record-format.md](record-format.md).

## Cube turn

Only the confirmed rotation travels. A preview is never sent: the other device first sees the turn animate when the host's `applied` message arrives. The pending-rotation rule from 001 is unchanged.

## Display preferences

Mark colours and turn notation never enter any message. Each device shows its own.
