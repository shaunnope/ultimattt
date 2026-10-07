<script lang="ts">
  import { onMount, tick, type Component } from "svelte";
  import DialogHost from "#lib/components/DialogHost.svelte";
  import Toasts from "#lib/components/Toasts.svelte";
  import TopBar from "#lib/components/TopBar.svelte";
  import UpdateBar from "#lib/components/UpdateBar.svelte";
  import { helpOpen, leaveHelp } from "#lib/state/help.ts";
  import { settings } from "#lib/state/settings.ts";
  import { applyMode, loadModePref } from "../ui/theme.ts";
  import { toast } from "../ui/ui.ts";

  let { children } = $props();

  // The saved appearance and settings are put into effect as soon as the shell is up.
  onMount(() => {
    applyMode(loadModePref());
    settings.apply();
  });

  // Help sits beside <main>, so opening or leaving it never touches whatever is on the screen: a game in progress carries on
  // exactly as it was. It is loaded when it is first opened, and is in the precache, so it works offline.
  const open = $derived(helpOpen());
  let HelpView = $state<Component<{ onBack: () => void }> | null>(null);
  let helpElement = $state<HTMLElement>();
  let mainElement = $state<HTMLElement>();
  let wasOpen = false;

  $effect(() => {
    if (!open || HelpView) return;
    import("#lib/components/Help.svelte")
      .then((module) => (HelpView = module.default))
      .catch(() => {
        toast("The game could not be loaded. Check your connection and try again; once it has loaded, it works offline.", 8000);
        void leaveHelp();
      });
  });

  // focus moves to the help page when it opens, and back to the screen when it closes
  $effect(() => {
    if (open && HelpView) {
      void tick().then(() => {
        helpElement?.focus();
        window.scrollTo?.(0, 0);
      });
      wasOpen = true;
    } else if (!open && wasOpen) {
      wasOpen = false;
      mainElement?.focus();
    }
  });
</script>

<a class="skip-link" href="#main">Skip to the game</a>
<div class="page">
  <UpdateBar />
  <TopBar />
  <main id="main" tabindex="-1" hidden={open} bind:this={mainElement}>{@render children()}</main>
  <section id="help-view" tabindex="-1" aria-label="Help" hidden={!open} bind:this={helpElement}>
    {#if HelpView}<HelpView onBack={() => void leaveHelp()} />{/if}
  </section>
</div>
<div id="status" class="sr-only" role="status" aria-live="polite"></div>
<Toasts />
<DialogHost />
<!-- the page colour as the browser sees it, for the theme-color meta tag (ui/theme.ts reads it) -->
<div id="page-colour" aria-hidden="true" style="position:absolute;visibility:hidden;pointer-events:none;background-color:var(--page)"></div>
