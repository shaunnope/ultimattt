<script lang="ts">
  import type { Cell, HintSet } from "../../core/types.ts";
  import { markOf } from "../../core/types.ts";
  import { playable, type UltimateState } from "../../core/ultimate.ts";
  import { boardName, cellPosition } from "../../ui/board-text.ts";
  import type { AnyHint } from "../../ui/hints.ts";
  import { markName } from "../../ui/mark.ts";
  import Mark from "./Mark.svelte";

  // The Ultimate board: N×N small boards in an N×N grid (N = 3 to 5). The board(s) you may play are outlined (a dashed
  // outline, not just a colour) and named in the status line; claimed boards show their owner as a large mark. Arrow keys
  // move across all N⁴ cells with one tab stop.
  interface Props {
    game: UltimateState;
    hints?: HintSet<AnyHint>;
    onMove?: (move: { t: "place"; board: number; cell: number }) => void;
    readOnly?: boolean;
  }
  let { game, hints = { win: [], block: [] }, onMove = () => undefined, readOnly = false }: Props = $props();

  const n = $derived(game.config.size);
  const n2 = $derived(n * n);
  let tab = $state({ board: 0, cell: 0 });
  const buttons = new Map<string, HTMLButtonElement>();
  const key = (b: number, c: number): string => `${b}:${c}`;

  // The first position drawn (a game picked up again) shows its marks in place; only a mark placed after that draws itself in,
  // and it keeps that look for as long as it stays there.
  let previous: Cell[][] | null = null;
  let freshBefore = new Set<string>();
  const fresh = $derived.by(() => {
    const now = new Set<string>();
    game.boards.forEach((cells, b) =>
      cells.forEach((value, c) => {
        if (value === 0 || previous === null) return;
        if (previous[b]![c] === 0 || (previous[b]![c] === value && freshBefore.has(key(b, c)))) now.add(key(b, c));
      }),
    );
    return now;
  });
  $effect(() => {
    previous = game.boards.map((cells) => cells.slice());
    freshBefore = fresh;
  });

  const open = $derived(new Set(playable(game)));
  const last = $derived(game.moves.length ? (game.moves[game.moves.length - 1] as { board: number; cell: number }) : null);
  const hintFor = (b: number, c: number): "win" | "block" | undefined =>
    hints.win.some((h) => h.board === b && h.cell === c) ? "win" : hints.block.some((h) => h.board === b && h.cell === c) ? "block" : undefined;

  const describe = (b: number, c: number, value: Cell): string =>
    `${boardName(b, n)}, row ${Math.floor(c / n) + 1}, column ${(c % n) + 1}, ${value === 0 ? "empty" : markName(markOf(value))}`;

  function subLabel(b: number): string {
    const claim = game.claims[b]!;
    const name = boardName(b, n);
    if (claim === 1 || claim === 2) return `${name}, won by ${markName(markOf(claim))}`;
    if (claim === 3) return `${name}, full, nobody won`;
    return open.has(b) ? `${name}, playable` : name;
  }

  function onKeydown(event: KeyboardEvent, b: number, c: number): void {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    const here = cellPosition.toGlobal(b, c, n);
    const row = Math.min(n2 - 1, Math.max(0, here.row + d[0]));
    const col = Math.min(n2 - 1, Math.max(0, here.col + d[1]));
    const next = cellPosition.fromGlobal(row, col, n);
    tab = next;
    buttons.get(key(next.board, next.cell))?.focus();
  }

  const range = (count: number): number[] => Array.from({ length: count }, (_, i) => i);
</script>

<div class={["board-wrap", "board-wrap-ultimate", readOnly && "read-only"]} style:--n={n}>
  <div class="board ultimate" role="group" aria-label="Ultimate tic tac toe board" style:--n={n}>
    {#each range(n2) as b (b)}
      {@const claim = game.claims[b]!}
      <div
        class="sub-board"
        role="group"
        data-board={b}
        aria-label={subLabel(b)}
        data-playable={String(open.has(b))}
        data-claim={claim === 1 ? "X" : claim === 2 ? "O" : claim === 3 ? "tie" : ""}
        data-win={game.winLine?.includes(b) ? "true" : undefined}>
        <div class="sub-grid">
          {#each range(n2) as c (c)}
            {@const value = game.boards[b]![c] as Cell}
            <button
              type="button"
              class="cell"
              data-board={b}
              data-cell={c}
              aria-label={describe(b, c, value)}
              tabindex={tab.board === b && tab.cell === c ? 0 : -1}
              data-mark={value === 0 ? "" : markOf(value)}
              data-last={last !== null && last.board === b && last.cell === c ? "" : undefined}
              data-hint={hintFor(b, c)}
              bind:this={() => buttons.get(key(b, c)), (element) => (element ? buttons.set(key(b, c), element) : buttons.delete(key(b, c)))}
              onclick={() => {
                tab = { board: b, cell: c };
                onMove({ t: "place", board: b, cell: c });
              }}
              onkeydown={(event) => onKeydown(event, b, c)}>{#if value !== 0}<Mark mark={markOf(value)} fresh={fresh.has(key(b, c))} />{/if}</button>
          {/each}
        </div>
        <div class={["claim-overlay", claim === 1 && "mark-x", claim === 2 && "mark-o"]} aria-hidden="true">{#if claim === 1 || claim === 2}<Mark mark={markOf(claim)} />{:else if claim === 3}tie{/if}</div>
      </div>
    {/each}
  </div>
</div>
