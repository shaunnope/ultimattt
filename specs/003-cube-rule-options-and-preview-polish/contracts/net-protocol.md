# Contract: Two-device protocol

`PROTOCOL_VERSION` becomes 3. Message shapes are unchanged except that `welcome.config` is a full `GameConfig` including `scoring` and `lockFaces`, so the guest builds the same rules as the host before the first move.

- A `hello` with a different version gets `reject: "version"`; the guest shows that both devices need the latest version.
- A welcome whose config fails `parseConfig` is refused as before.
- Moves are exchanged unchanged. A refused placement on a locked face is refused locally on both devices by the same rules.
