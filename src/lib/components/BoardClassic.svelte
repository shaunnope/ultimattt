<script lang="ts">
  import type { ClassicState } from "../../core/classic.ts";
  import type { Cell, HintSet } from "../../core/types.ts";
  import { markOf } from "../../core/types.ts";
  import type { AnyHint } from "../../ui/hints.ts";
  import { markName } from "../../ui/mark.ts";
  import Mark from "./Mark.svelte";

  // The Classic board: a grid of buttons. Arrow keys move between cells (one tab stop), Enter or Space places a mark, marks
  // animate in, and a winning line is outlined and struck through. It shows the game it is given and reports clicks.
  interface Props {
    game: ClassicState;
    hints?: HintSet<AnyHint>;
    onCell?: (cell: number) => void;
    /** A replay shows positions but takes no moves. */
    readOnly?: boolean;
  }
  let { game, hints = { win: [], block: [] }, onCell = () => undefined, readOnly = false }: Props = $props();

  const size = $derived(game.size);
  let tabCell = $state(0);
  let buttons: (HTMLButtonElement | undefined)[] = [];

  // The first position drawn (a game picked up again) shows its marks in place; only a mark placed after that draws itself in,
  // and it keeps that look for as long as it stays there.
  let previous: Cell[] | null = null;
  let freshBefore = new Set<number>();
  const fresh = $derived.by(() => {
    const now = new Set<number>();
    game.cells.forEach((value, i) => {
      if (value === 0 || previous === null) return;
      if ((previous[i] === 0 && previous !== null) || (previous[i] === value && freshBefore.has(i))) now.add(i);
    });
    return now;
  });
  $effect(() => {
    previous = game.cells.slice();
    freshBefore = fresh;
  });

  const winCells = $derived(new Set(game.winLine ?? []));
  const lastCell = $derived(game.moves.length ? (game.moves[game.moves.length - 1] as { cell: number }).cell : -1);
  const hintFor = (cell: number): "win" | "block" | undefined => (hints.win.some((h) => h.cell === cell) ? "win" : hints.block.some((h) => h.cell === cell) ? "block" : undefined);

  const describe = (cell: number, value: Cell): string => `Row ${Math.floor(cell / size) + 1}, column ${(cell % size) + 1}, ${value === 0 ? "empty" : markName(markOf(value))}`;

  const strike = $derived.by(() => {
    const first = game.winLine?.[0];
    const last = game.winLine?.[game.winLine.length - 1];
    if (first === undefined || last === undefined) return null;
    const at = (i: number): [number, number] => [(((i % size) + 0.5) / size) * 100, ((Math.floor(i / size) + 0.5) / size) * 100];
    const [x1, y1] = at(first);
    const [x2, y2] = at(last);
    return { x1, y1, x2, y2 };
  });

  function focusCell(cell: number): void {
    tabCell = cell;
    buttons[cell]?.focus();
  }

  function onKeydown(event: KeyboardEvent, row: number, column: number): void {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    const nr = Math.min(size - 1, Math.max(0, row + d[0]));
    const nc = Math.min(size - 1, Math.max(0, column + d[1]));
    focusCell(nr * size + nc);
  }
</script>

<div class={["board-wrap", readOnly && "read-only"]}>
  <div class="board" role="grid" aria-label={`Tic tac toe board, ${size} by ${size}`} style:--n={size}>
    {#each Array.from({ length: size }, (_, r) => r) as r (r)}
      <div role="row" class="board-row">
        {#each Array.from({ length: size }, (_, c) => c) as c (c)}
          {@const cell = r * size + c}
          {@const value = game.cells[cell] as Cell}
          <div role="gridcell" class="board-cell">
            <button
              type="button"
              class="cell"
              data-cell={cell}
              aria-label={describe(cell, value)}
              tabindex={cell === tabCell ? 0 : -1}
              data-mark={value === 0 ? "" : markOf(value)}
              data-last={cell === lastCell ? "" : undefined}
              data-win={winCells.has(cell) ? "true" : undefined}
              data-hint={hintFor(cell)}
              bind:this={buttons[cell]}
              onclick={() => {
                tabCell = cell;
                onCell(cell);
              }}
              onkeydown={(event) => onKeydown(event, r, c)}>{#if value !== 0}<Mark mark={markOf(value)} fresh={fresh.has(cell)} />{/if}</button>
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <svg class={["win-line", strike && "show"]} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={strike?.x1} y1={strike?.y1} x2={strike?.x2} y2={strike?.y2} /></svg>
</div>
