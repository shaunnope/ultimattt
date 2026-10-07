<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconName } from "../../ui/icons.ts";
  import Icon from "./Icon.svelte";

  // An icon-only button: the accessible name and the tooltip are the same text unless a title is given.
  interface Props extends Omit<HTMLButtonAttributes, "title" | "class"> {
    icon: IconName;
    label: string;
    title?: string;
    small?: boolean;
    class?: string;
  }
  let { icon, label, title = label, small = false, class: extra = "", ...rest }: Props = $props();
</script>

<button class={["icon-btn", small && "small", extra]} type="button" aria-label={label} {title} {...rest}><Icon name={icon} /></button>
