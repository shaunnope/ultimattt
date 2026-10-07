// Carry out the opening decision (ui/boot.ts) for the page that was just opened cold: show what it says to show, clean the
// address and the save as it says, and return what to open. Null means the start screen.
import { loadSave, saveGame } from "../../adapters/store.ts";
import { decideBoot } from "../../ui/boot.ts";
import { toast } from "../../ui/ui.ts";
import type { Intent } from "./session.ts";

/** Take ?join= or ?watch= out of the address (the route in the hash stays). */
export function clearQuery(): void {
  history.replaceState(history.state, "", location.pathname + location.hash);
}

export function resolveBoot(): Intent | null {
  const { save, notice } = loadSave();
  const boot = decideBoot(location.search, save, notice);
  for (const text of boot.toasts) toast(text, 8000);
  if (boot.clearSave) saveGame(null);
  if (boot.clearQuery) clearQuery();
  switch (boot.screen) {
    case "join":
      return { kind: "join", code: boot.code };
    case "watch":
      return { kind: "watch", record: boot.record };
    case "host":
      return { kind: "host", config: boot.config, resume: { code: boot.code, moves: boot.moves } };
    case "rejoin":
      return { kind: "join", code: boot.code };
    case "game":
      return { kind: "resume", config: boot.config, restored: boot.restored };
    case "setup":
      return null;
  }
}
