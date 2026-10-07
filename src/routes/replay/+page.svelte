<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Replay from "#lib/components/Replay.svelte";
  import { clearQuery, resolveBoot } from "#lib/state/boot.ts";
  import { setIntent, setSetupSeed, takeIntent, type Intent } from "#lib/state/session.ts";
  import { loadSave, updateSettings } from "../../adapters/store.ts";
  import { configFromRecord } from "../../core/record.ts";

  // A replay opened from a ?watch= link. It never touches the viewer's own saved game. A reload here without the link goes to the
  // start screen (which then picks the saved game up, if there is one).
  let intent = $state.raw<(Intent & { kind: "watch" }) | null>(null);

  onMount(() => {
    const next = takeIntent() ?? resolveBoot();
    if (next?.kind === "watch") {
      intent = next;
    } else if (next) {
      setIntent(next);
      void goto("#/play", { replaceState: true });
    } else {
      void goto("#/", { replaceState: true });
    }
  });

  /** Leave a replay link behind: back to the player's own saved game, or the start screen. */
  function leave(): void {
    clearQuery();
    void goto("#/", { replaceState: true });
  }

  /** Only a game that has a seed (one against the computer) can be played again from its seed. */
  function playThisSeed(seed: string): void {
    setSetupSeed(seed);
    leave();
  }
</script>

{#if intent}
  {@const record = intent.record}
  {@const saved = loadSave().save.settings}
  <Replay
    config={configFromRecord(record)}
    moves={record.moves}
    {...record.end === "rx" ? { resigned: "X" as const } : record.end === "ro" ? { resigned: "O" as const } : {}}
    speed={saved.replaySpeed}
    onSpeed={(speed) => updateSettings({ replaySpeed: speed })}
    autoplay
    notation={saved.cubeNotation}
    onClose={leave}>
    {#snippet actions()}
      {#if record.seed}<button class="btn" type="button" onclick={() => playThisSeed(record.seed!)}>Play this seed</button>{/if}
    {/snippet}
  </Replay>
{/if}
