<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Game from "#lib/components/Game.svelte";
  import NetPlay from "#lib/components/NetPlay.svelte";
  import { resolveBoot } from "#lib/state/boot.ts";
  import { setIntent, takeIntent, type Intent } from "#lib/state/session.ts";

  // The game. Reached by Start, by resuming, or by a join link, each of which replaces its entry; a reload here picks the saved
  // game up again, and with nothing saved goes back to the start screen.
  let intent = $state.raw<Intent | null>(null);

  onMount(() => {
    const next = takeIntent() ?? resolveBoot();
    if (!next) {
      void goto("#/", { replaceState: true });
    } else if (next.kind === "watch") {
      setIntent(next);
      void goto("#/replay", { replaceState: true });
    } else {
      intent = next;
    }
  });

  const leave = (): void => void goto("#/", { replaceState: true });
</script>

{#if intent}
  {#if intent.kind === "resume" || (intent.kind === "new" && intent.config.mode !== "network")}
    <!-- a game on this device -->
    <Game config={intent.config} restored={intent.kind === "resume" ? intent.restored : undefined} onExit={leave} />
  {:else if intent.kind === "new" || intent.kind === "host" || intent.kind === "join"}
    <!-- a game between two devices: hosting, joining, or hosting again after a reload -->
    <NetPlay {intent} onExit={leave} />
  {/if}
{/if}
