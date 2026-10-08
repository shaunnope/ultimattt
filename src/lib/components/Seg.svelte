<script lang="ts" generics="T extends string | number">
  import type { HTMLFieldsetAttributes } from "svelte/elements";
  import type { IconName } from "../../ui/icons.ts";
  import Icon from "./Icon.svelte";

  // A group of radio choices drawn as cards (a bold title, an optional line under it). The native radios stay, so the
  // keyboard and screen readers work as for any radio group.
  interface Option {
    value: T;
    title: string;
    blurb?: string;
    /** A 16px icon in line before the title; the title stays the accessible name. */
    icon?: IconName;
    disabled?: boolean;
  }
  interface Props extends Omit<HTMLFieldsetAttributes, "value" | "onchange"> {
    name: string;
    legend: string;
    options: Option[];
    value: T;
    onchange: (value: T) => void;
  }
  let { name, legend, options, value, onchange, ...rest }: Props = $props();
</script>

<fieldset data-group={name} role="radiogroup" {...rest}>
  <legend>{legend}</legend>
  <div class="choice-grid">
    {#each options as option (option.value)}
      <div class="choice">
        <input type="radio" {name} id={`${name}-${option.value}`} value={String(option.value)} checked={option.value === value} disabled={option.disabled} onchange={() => onchange(option.value)} />
        <label for={`${name}-${option.value}`}><strong>{#if option.icon}<Icon name={option.icon} />{/if}{option.title}</strong>{#if option.blurb}<small>{option.blurb}</small>{/if}</label>
      </div>
    {/each}
  </div>
</fieldset>
