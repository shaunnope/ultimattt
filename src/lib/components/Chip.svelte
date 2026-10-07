<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  // A small toggle button: pressed is shown by the fill, and announced through aria-pressed.
  interface Props extends Omit<HTMLButtonAttributes, "class"> {
    pressed: boolean;
    small?: boolean;
    class?: string;
    children?: Snippet;
  }
  let { pressed, small = true, class: extra = "", children, ...rest }: Props = $props();
</script>

<button class={["btn", small && "btn-small", extra]} type="button" aria-pressed={pressed} {...rest}>{@render children?.()}</button>
