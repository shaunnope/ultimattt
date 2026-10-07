<script lang="ts">
  // The body of the dialog that offers a replay link to copy by hand, when sharing and the clipboard are both unavailable.
  let { url }: { url: string } = $props();
</script>

<p>Copy this link to share the game:</p>
<input type="text" readonly value={url} class="link-box" aria-label="Replay link" />
