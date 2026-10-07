<script lang="ts">
  import { HELP_SECTIONS, type HelpBoard } from "../../ui/help-content.ts";
  import Mark from "./Mark.svelte";

  // The help page: static text from ui/help-content.ts in a centred column. Examples are drawn with the same mark
  // component as the boards, so they follow light and dark, and each carries a text alternative. The top bar's Back
  // button and the control at the end leave it.
  let { onBack }: { onBack: () => void } = $props();

  const isPointed = (board: HelpBoard, row: number, column: number): boolean => (board.mark ?? []).some(([r, c]) => r === row && c === column);
</script>

<article class="help card" aria-label="Help">
  {#each HELP_SECTIONS as section (section.id)}
    <section class="help-section" aria-labelledby={`help-${section.id}`}>
      <h2 id={`help-${section.id}`}>{section.title}</h2>
      {#each section.blocks as block, index (index)}
        {#if block.kind === "paragraph"}
          <p>{block.text}</p>
        {:else if block.kind === "steps"}
          <ol class="help-steps">
            {#each block.items as item (item)}<li>{item}</li>{/each}
          </ol>
        {:else}
          <div class="help-example" role="img" aria-label={`${block.title}. ${block.alt}`}>
            <p class="help-example-title" aria-hidden="true">{block.title}</p>
            <div class="help-boards">
              {#each block.boards as board, boardIndex (boardIndex)}
                <figure class="help-board-figure">
                  <div class="help-board" aria-hidden="true" style:--cols={board.rows[0]!.length}>
                    {#each board.rows as row, r (r)}
                      {#each [...row] as value, c (c)}
                        <span class="help-cell" data-point={isPointed(board, r, c) ? "true" : undefined}>{#if value === "X" || value === "O"}<Mark mark={value} />{/if}</span>
                      {/each}
                    {/each}
                  </div>
                  {#if board.label}<figcaption>{board.label}</figcaption>{/if}
                </figure>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </section>
  {/each}
  <div class="help-top"><button type="button" class="btn" onclick={onBack}>Back to the game</button></div>
</article>
