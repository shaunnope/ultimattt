<script lang="ts">
  const label = "Done—really";
  const party = "Hooray 🎉";
  let open = $state(false);
</script>

<!-- a comment with a dash — and a bang! is not shown -->
<p>Well done — nice game</p>
<button aria-label="Close!" title="Fine">{open ? "Hide!" : "Show"}</button>
<input placeholder="Type here" alt="a — b" />
{#if !open}<span>All good</span>{/if}
<style>
  /* a style block is not copy */
  p { content: "!"; }
</style>
