<script lang="ts">
  import { onMount } from "svelte";
  import { helpOpen, leaveHelp, openHelp } from "../state/help.ts";
  import { dialogs } from "../../ui/dialog-state.ts";
  import { appearanceIcon } from "../../ui/appearance.ts";
  import { currentPreference, MODE_EVENT } from "../../ui/theme.ts";
  import IconButton from "./IconButton.svelte";
  import Logo from "./Logo.svelte";

  // The top bar. Back is shown only while the help page is open, and the Help button is the current page then. The
  // appearance button shows the saved preference's own icon.
  const open = $derived(helpOpen());
  let pref = $state(currentPreference());

  onMount(() => {
    const repaint = (): void => {
      pref = currentPreference();
    };
    window.addEventListener(MODE_EVENT, repaint);
    return () => window.removeEventListener(MODE_EVENT, repaint);
  });

  // the two dialogs are loaded when first opened, so the start screen does not wait for their code
  const openSettings = async (): Promise<void> => {
    const { default: SettingsDialog } = await import("./SettingsDialog.svelte");
    void dialogs.open({ title: "Settings", component: SettingsDialog, actions: [{ label: "Done", value: "done", primary: true }] });
  };
  const openAppearance = async (): Promise<void> => {
    const { default: ThemeDialog } = await import("./ThemeDialog.svelte");
    void dialogs.open({ title: "Appearance", component: ThemeDialog, actions: [{ label: "Done", value: "done" }] });
  };
</script>

<header class="topbar glass" data-back={open ? "" : undefined}>
  <IconButton id="help-back" class="back-button" icon="back" label="Back" hidden={!open} onclick={() => void leaveHelp()} />
  <div class="app-brand">
    <Logo />
    <h1 class="app-title">Tic Tac Toe</h1>
  </div>
  <div id="header-actions" class="header-actions">
    <IconButton id="help-button" icon="help" label="Help" aria-current={open ? "page" : undefined} onclick={() => void openHelp()} />
    <IconButton id="appearance-button" icon={appearanceIcon(pref)} label="Appearance" onclick={() => void openAppearance()} />
    <IconButton icon="settings" label="Settings" onclick={() => void openSettings()} />
  </div>
</header>
