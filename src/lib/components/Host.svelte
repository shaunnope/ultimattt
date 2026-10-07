<script lang="ts">
  import { onMount } from "svelte";
  import type { HostedRun } from "../../ui/net-run.ts";
  import { qrToSvg } from "../../ui/qr.ts";
  import { toast } from "../../ui/ui.ts";

  // The host's waiting screen: the code, the link and a QR code, until a friend joins. The game starts when they do.
  let { hosted }: { hosted: HostedRun } = $props();

  const qr = $derived(qrToSvg(hosted.link));
  let statusText = $state("");
  let statusError = $state(false);

  onMount(() =>
    hosted.status.subscribe((line) => {
      statusText = line.text;
      statusError = line.error;
    }),
  );

  function copy(): void {
    navigator.clipboard.writeText(hosted.link).then(
      () => toast("Link copied."),
      () => toast(hosted.link),
    );
  }
</script>

<section class="screen waiting" aria-labelledby="waiting-title">
  <h2 id="waiting-title">Waiting for a friend</h2>
  {#if hosted.note}<p class="hint-text">{hosted.note}</p>{/if}
  <div class="card">
    <p>Tell your friend this code:</p>
    <p id="join-code-display" class="big-code">{hosted.code}</p>
    <p>Or send them this link:</p>
    <p class="join-link">{hosted.link}</p>
    <div class="btn-row"><button class="btn" type="button" onclick={copy}>Copy link</button></div>
    <!-- the QR code is an SVG string built by ui/qr.ts from the link: a trusted constant of ours, never player text -->
    <div class="qr">{@html qr}</div>
    <p class="hint-text">Both devices need to be online. If they are on different networks and cannot connect, try the same wifi, or let one device share a hotspot.</p>
  </div>
  <p id="net-wait-status" class={["status-line", statusError && "net-error"]} role={statusError ? "alert" : "status"} data-tone={statusError ? "error" : ""}>{statusText}</p>
  <div class="btn-row"><button class="btn" type="button" onclick={() => hosted.cancel()}>Cancel</button></div>
</section>
