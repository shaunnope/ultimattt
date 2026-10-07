<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import type { Intent } from "../state/session.ts";
  import { hostRun, joinRun } from "../../ui/net-run.ts";
  import Game from "./Game.svelte";
  import Host from "./Host.svelte";
  import Join from "./Join.svelte";

  // A game between two devices: the host's waiting screen (or the guest's joining screen) until the other device answers, then
  // the game. The connection is made when this opens and dropped when it closes; opening help over it (a shallow route) leaves
  // this mounted, so the connection and the game carry on.
  let { intent, onExit }: { intent: Intent & { kind: "new" | "host" | "join" }; onExit: () => void } = $props();

  const joined = untrack(() => (intent.kind === "join" ? joinRun(intent.code, onExit) : null));
  const hosted = untrack(() => (intent.kind !== "join" ? hostRun(intent.config, onExit, intent.kind === "host" ? intent.resume : undefined) : null));
  const run = (joined ?? hosted)!.run;
  let playing = $state(false);

  onMount(() =>
    run.subscribe((r) => {
      playing = r.phase === "playing";
    }),
  );
  onDestroy(() => run.finish());
</script>

{#if playing}
  <Game config={run.session.config} net={run.hooks} {run} {onExit} />
{:else if joined}
  <Join {joined} />
{:else if hosted}
  <Host {hosted} />
{/if}
