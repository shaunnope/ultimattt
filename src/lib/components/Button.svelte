<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLButtonAttributes, "class"> {
    variant?: "default" | "primary" | "destructive";
    small?: boolean;
    class?: string;
    children?: Snippet;
  }
  let { variant = "default", small = false, class: extra = "", children, ...rest }: Props = $props();
</script>

<button class={["btn", variant === "primary" && "btn-primary", variant === "destructive" && "btn-destructive", small && "btn-small", extra]} type="button" {...rest}>{@render children?.()}</button>
