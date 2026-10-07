<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";

  // A status line: its colour on a tint of itself, an icon, then the text. A busy banner has a pulsing dot (CSS)
  // instead of an icon. An empty text leaves the banner empty.
  interface Props extends Omit<HTMLAttributes<HTMLElement>, "class"> {
    text?: string;
    tone?: "info" | "error" | "ok" | "warn" | "busy";
    /** The element to draw: a div, or a p where the banner sits in running text. */
    as?: "div" | "p";
    class?: string;
  }
  let { text = "", tone = "info", as = "div", class: extra = "", ...rest }: Props = $props();
</script>

<svelte:element this={as} class={["banner", extra]} data-tone={tone === "info" ? undefined : tone} {...rest}>
  {#if text !== ""}
    {#if tone !== "busy"}<Icon name={tone === "ok" ? "check" : "info"} />{/if}
    <span>{text}</span>
  {/if}
</svelte:element>
