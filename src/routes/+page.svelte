<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Setup from "#lib/components/Setup.svelte";
  import { resolveBoot } from "#lib/state/boot.ts";
  import { setIntent, takeSetupSeed } from "#lib/state/session.ts";
  import type { GameConfig } from "../core/types.ts";

  // The start screen, and the way in: opened cold, it works out from the address and the saved game what to open (a game to
  // join, a replay, a game left in progress, or this screen). Starting a game replaces this entry, so Back never lands here.
  let showSetup = $state(false);
  let seed = $state<string | undefined>();

  onMount(() => {
    const intent = resolveBoot();
    if (!intent) {
      seed = takeSetupSeed() ?? undefined;
      showSetup = true;
      return;
    }
    setIntent(intent);
    void goto(intent.kind === "watch" ? "#/replay" : "#/play", { replaceState: true });
  });

  function start(config: GameConfig): void {
    setIntent({ kind: "new", config });
    void goto("#/play", { replaceState: true });
  }

  function join(code: string): void {
    setIntent({ kind: "join", code });
    void goto("#/play", { replaceState: true });
  }
</script>

{#if showSetup}<Setup onStart={start} onJoin={join} {...seed ? { seed } : {}} />{/if}
