# Contract: Two-Device Protocol

Transport: PeerJS data channel, STUN only (explicit `iceServers`), host peer id `ttt-<CODE>`; code = 6 chars from the seed alphabet. PeerJS is loaded only on host or join; nothing else depends on it.

All messages are JSON `{v:1, type, ...}`. Receivers validate with `src/core/protocol.ts` and ignore anything unknown or out of turn.

| Type | From | Payload | Meaning |
|---|---|---|---|
| `hello` | guest | `{v}` | Join request; host replies `welcome` or `reject{reason}` (`full`, `version`) |
| `welcome` | host | `{config, moves}` | Game setup incl. seed, current moves (supports rejoin) |
| `move` | guest | `{n, move}` | Intent; `n` = expected move number |
| `applied` | host | `{n, move, hash}` | Move accepted and applied; both sides check `hash` |
| `refused` | host | `{n, reason}` | Illegal or out of turn |
| `undo-ask` | either | `{n}` | Request taking back to move `n` |
| `undo-answer` | other | `{n, ok}` | Accept or decline |
| `resign` | either | `{}` | Resign |
| `ping` / `pong` | either | `{}` | Liveness |
| `bye` | either | `{}` | Leaving |

Rules:
- Host is authoritative; host's own moves are broadcast as `applied` too.
- Hash mismatch → guest requests `welcome` to resync.
- Lost connection: both UIs show "connection lost"; host stays reachable on the same code for a rejoin; `welcome` carries the move log so the game resumes.
- Max one guest; further `hello` → `reject{full}`.
- Cube: a scoring placement and its rotation are two `applied` messages by the same player; the guest may not move during the host's pending rotation.
- Failure cases (symmetric NAT, client isolation) surface as a timeout with a hint to share a hotspot.
