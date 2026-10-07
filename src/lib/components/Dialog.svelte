<script lang="ts">
  import { onMount, type Component } from "svelte";
  import { dialogs, type DialogRequest } from "../../ui/dialog-state.ts";
  import Icon from "./Icon.svelte";
  import IconButton from "./IconButton.svelte";

  // A modal dialog: a bottom sheet on phones, centred from 640px (see the dialog rules in style.css). It opens and closes
  // by one class flip; the timing is CSS. A Close button, Escape and a click on the backdrop all dismiss it. Its request
  // settles with the chosen action's value, or null when dismissed, once the closing transition has played.
  let { request }: { request: DialogRequest } = $props();

  let dialog = $state<HTMLDialogElement>();
  let result: string | null = null;
  let closing = false;

  // a ported dialog hands its body over as a component
  const Body = $derived(request.component as Component<Record<string, unknown>> | undefined);

  /** Play the closing transition, then close for real. A timer covers the case where no transition runs. */
  function requestClose(value: string | null): void {
    const el = dialog;
    if (closing || !el) return;
    closing = true;
    result = value;
    el.classList.remove("is-open");
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      el.close();
    };
    el.addEventListener("transitionend", (event) => {
      if (event.target === el) finish();
    });
    setTimeout(finish, 400);
  }

  /** Put a DOM node (from a screen not yet ported) into its place. */
  function adopt(host: HTMLElement, node: Node): void {
    host.append(node);
  }

  onMount(() => {
    const el = dialog!;
    el.showModal();
    void el.offsetWidth; // start from the closed look, so adding the class below is a transition
    el.classList.add("is-open");
    (el.querySelector(".btn-primary") as HTMLElement | null)?.focus();
  });
</script>

<!-- The padding lives on an inner box, so a click on the dialog element itself can only be a click on the backdrop. Escape and the Close
     button do the same for the keyboard (a native dialog handles Escape), so the click has its keyboard equivalents. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  class="modal"
  aria-labelledby="dialog-title"
  bind:this={dialog}
  oncancel={(event) => {
    event.preventDefault();
    requestClose(null);
  }}
  onclick={(event) => {
    if (event.target === dialog) requestClose(null); // the backdrop is part of the dialog's own box
  }}
  onclose={() => dialogs.close(request.id, result)}
>
  <div class="modal-inner">
    <div class="modal-head">
      <h2 id="dialog-title">{#if request.icon}<Icon name={request.icon} />{/if}{request.title}</h2>
      <IconButton icon="close" label="Close" title="Close" small onclick={() => requestClose(null)} />
    </div>
    <div class="dialog-body">
      {#if Body}
        <Body {...request.props} />
      {/if}
      {#each request.body ?? [] as part, i (i)}
        {#if typeof part === "string"}<p>{part}</p>{:else}<div class="adopted" use:adopt={part}></div>{/if}
      {/each}
    </div>
    <div class="btn-row">
      {#each request.actions as action (action.value)}
        <button class={["btn", action.primary && "btn-primary"]} type="button" onclick={() => requestClose(action.value)}>{action.label}</button>
      {/each}
    </div>
  </div>
</dialog>
