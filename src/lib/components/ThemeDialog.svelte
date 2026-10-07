<script lang="ts">
  import { onMount } from "svelte";
  import { APPEARANCE_OPTIONS } from "../../ui/appearance.ts";
  import { settings } from "../state/settings.ts";
  import { currentMode, currentPreference, modeToTheme, MODE_EVENT, type ModePref } from "../../ui/theme.ts";
  import Icon from "./Icon.svelte";

  // The body of the appearance dialog: Light, Dark or System. The pressed option is the saved preference, not the mode being
  // shown; with System pressed a note says which mode the device is giving. Choosing applies at once and never closes it.
  let pref = $state<ModePref>(currentPreference());
  let mode = $state(currentMode());
  const buttons: (HTMLButtonElement | undefined)[] = [];

  const refresh = (): void => {
    pref = currentPreference();
    mode = currentMode();
  };

  function choose(value: ModePref): void {
    settings.update({ theme: modeToTheme(value) });
    refresh();
  }

  function onKeydown(event: KeyboardEvent): void {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const at = APPEARANCE_OPTIONS.findIndex((o) => o.value === currentPreference());
    const next = APPEARANCE_OPTIONS[(at + step + APPEARANCE_OPTIONS.length) % APPEARANCE_OPTIONS.length]!;
    choose(next.value);
    buttons[APPEARANCE_OPTIONS.indexOf(next)]?.focus();
  }

  // the device can change while the dialog is open: keep the note true
  onMount(() => {
    window.addEventListener(MODE_EVENT, refresh);
    return () => window.removeEventListener(MODE_EVENT, refresh);
  });
</script>

<!-- The arrow keys move between the radios inside (one tab stop), so the group itself is not a focus stop. -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div class="seg" role="radiogroup" aria-label="Colour mode" onkeydown={onKeydown}>
  {#each APPEARANCE_OPTIONS as option, i (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === pref}
      tabindex={option.value === pref ? 0 : -1}
      bind:this={buttons[i]}
      onclick={() => choose(option.value)}><Icon name={option.icon} />{option.label}</button>
  {/each}
</div>
<p id="theme-note" class="hint-text" aria-live="polite" hidden={pref !== "system"}>{pref === "system" ? `Following your device. Currently ${mode}.` : ""}</p>
