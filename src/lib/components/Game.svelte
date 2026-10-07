<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { loadSave, saveGame, updateSettings } from "../../adapters/store.ts";
  import type { ClassicState } from "../../core/classic.ts";
  import type { CubeState } from "../../core/cube.ts";
  import { packLink, recordFromGame } from "../../core/record.ts";
  import type { CubeHint, GameConfig, HintSet, Mark, Move } from "../../core/types.ts";
  import type { UltimateState } from "../../core/ultimate.ts";
  import type { ConnectionView, NetHooks } from "../../ui/net-types.ts";
  import type { NetRun } from "../../ui/net-run.ts";
  import { variantName } from "../../core/variants.ts";
  import type { RestoredGame } from "../../ui/boot.ts";
  import { optionsNote } from "../../ui/cube-labels.ts";
  import { dialogs } from "../../ui/dialog-state.ts";
  import { GameSession } from "../../ui/game-session.ts";
  import { LEVEL_NAMES } from "../../ui/setup-model.ts";
  import { announce, toast } from "../../ui/ui.ts";
  import { settings } from "../state/settings.ts";
  import Banner from "./Banner.svelte";
  import BoardClassic from "./BoardClassic.svelte";
  import BoardUltimate from "./BoardUltimate.svelte";
  import Confetti from "./Confetti.svelte";
  import Icon from "./Icon.svelte";
  import CubeBoard from "./CubeBoard.svelte";
  import Pill from "./Pill.svelte";
  import Replay from "./Replay.svelte";
  import ShareLinkDialog from "./ShareLinkDialog.svelte";

  // The game on this device (against a friend or the computer): the title, the pill, the status line, the board and the controls.
  // What the game is lives in ui/game-session.ts; this shows it and turns clicks into moves.
  interface Props {
    config: GameConfig;
    restored?: RestoredGame;
    /** A game between two devices: its connection, and the run that tells this screen when something happens. */
    net?: NetHooks;
    run?: NetRun;
    /** Leave for the start screen. */
    onExit: () => void;
  }
  let { config, restored, net, run, onExit }: Props = $props();

  let session = $state.raw(untrack(() => new GameSession(config, { ...(restored ? { restored } : {}), ...(net ? { net } : {}) })));
  let version = $state(0);
  let refusal = $state<string | null>(null);
  let celebrating = $state(false);
  let replaying = $state(false);
  /** The settings the replay opens with (its speed is remembered as it is changed). */
  let saved = $state.raw(loadSave().save.settings);
  let resultShown = false;

  const view = $derived.by(() => {
    version; // every change in the session
    return {
      state: session.state,
      over: session.over,
      canUndo: session.canUndo,
      pill: session.pill(),
      statusText: session.statusText(),
      hints: session.hints($settings.hints),
    };
  });
  const statusLine = $derived(refusal ?? view.statusText);
  const sub = $derived(
    session.net
      ? `two devices, you are ${session.net.myMark}`
      : session.vsComputer
        ? `vs Computer (${LEVEL_NAMES[session.config.level ?? 3]}), you are ${session.human}`
        : "two players, this device",
  );
  let connection = $state.raw<ConnectionView>({ state: "connected" });

  // follow the session; a change clears an old refusal, and a game that has just ended shows its result once
  $effect(() => {
    const current = session;
    const stop = current.subscribe((s) =>
      untrack(() => {
        version++;
        refusal = null;
        if (s.net && !s.over) resultShown = false; // a finished two-device game can be taken back and played on
        if (s.change === "ended") void showResult();
      }),
    );
    return stop;
  });

  // two devices: the connection says when the shared position changed, how the connection is, and what to ask the player
  $effect(() => {
    if (!run) return;
    let seen = run.revision;
    const stop = run.subscribe((r) =>
      untrack(() => {
        connection = r.connection;
        if (r.revision !== seen) {
          seen = r.revision;
          session.sync();
        }
      }),
    );
    run.bind({ notify: (text) => toast(text), promptUndo });
    return () => {
      stop();
      run.bind(null);
    };
  });

  /** Ask the player whether their friend may take a move back. */
  async function promptUndo(by: Mark): Promise<boolean> {
    const choice = await dialogs.open({
      title: "Take back a move?",
      body: [`${by} asks to take back their last move.`],
      actions: [
        { label: "Not now", value: "no" },
        { label: "Allow", value: "yes", primary: true },
      ],
    });
    return choice === "yes";
  }

  // say it aloud, as a status change or the turn
  $effect(() => {
    announce(statusLine || view.pill.spoken);
  });

  onMount(() => {
    session.start();
    return () => session.cancel();
  });

  function refuse(result: { ok: boolean; reason?: string; silent?: true }): void {
    if (result.ok || result.silent) return;
    refusal = session.refusalText(result.reason ?? "");
    toast(refusal);
  }

  function onMove(move: Move): void {
    refuse(session.place(move));
  }

  function undo(): void {
    const result = session.undo();
    if (result.ok && session.net) toast("Asked your friend to take your move back.");
    else refuse(result);
  }

  async function resign(): Promise<void> {
    if (session.over) return;
    const who = session.resigner;
    const choice = await dialogs.open({
      title: "Resign this game?",
      body: [`${who} will lose.`],
      actions: [
        { label: "Keep playing", value: "no" },
        { label: "Confirm resign", value: "yes", primary: true },
      ],
    });
    if (choice !== "yes" || session.over) return;
    refuse(session.resign(who as Mark));
  }

  function leave(): void {
    session.leave(); // nothing to come back to
    onExit();
  }

  async function showResult(): Promise<void> {
    if (resultShown) return;
    resultShown = true;
    const result = session.result();
    if (!result) return;
    if (result.winner) celebrating = true; // nothing at all when the player has asked for reduced motion
    const choice = await dialogs.open({
      title: result.title,
      ...(result.winner ? { icon: "check" as const } : {}),
      body: [result.body],
      actions: [
        { label: "Watch replay", value: "replay", primary: true },
        ...(session.canPlayAgain ? [{ label: "Play again", value: "again" }] : []),
        { label: "New game", value: "new" },
      ],
    });
    if (choice === "again") {
      session.cancel();
      resultShown = false;
      session = new GameSession(session.nextConfig());
      session.start();
    } else if (choice === "new") {
      leave();
    } else if (choice === "replay" || $settings.autoReplay) {
      // the result was dismissed: the replay plays by itself unless the setting is off
      showReplay();
    }
  }

  /** Play the finished game back, at the speed the player last chose. */
  function showReplay(): void {
    session.cancel();
    saved = loadSave().save.settings;
    replaying = true;
  }

  function replayLink(): string {
    const record = recordFromGame(session.config, session.state.moves, session.resigned ?? undefined);
    const base = `${location.origin}${location.pathname}`;
    return base + packLink(record, 10_000 + Math.floor(Math.random() * 90_000));
  }

  async function shareReplay(): Promise<void> {
    const url = replayLink();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Tic Tac Toe replay", url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Replay link copied.");
    } catch {
      await dialogs.open({ title: "Replay link", component: ShareLinkDialog, props: { url }, actions: [{ label: "Done", value: "ok", primary: true }] });
    }
  }

  async function copySeed(): Promise<void> {
    try {
      await navigator.clipboard.writeText(session.config.seed ?? "");
      toast("Seed copied.");
    } catch {
      toast(`Seed: ${session.config.seed ?? ""}`);
    }
  }

</script>

{#if celebrating}<Confetti onDone={() => (celebrating = false)} />{/if}

  {#if replaying}
  <Replay
    config={session.config}
    moves={session.state.moves}
    {...session.resigned ? { resigned: session.resigned } : {}}
    speed={saved.replaySpeed}
    onSpeed={(speed) => updateSettings({ replaySpeed: speed })}
    autoplay
    notation={saved.cubeNotation}
    onClose={() => {
      replaying = false;
      session.start();
    }} />
{:else}
  <section class="screen" aria-label="Game">
    <div class="game-head">
      <span class="game-title" id="game-title">{variantName(session.config.variant, "short")} {session.config.size}×{session.config.size}, {session.config.winLength} in a row{optionsNote(session.config)}</span>
      <span class="game-sub">{sub}</span>
    </div>
    {#if session.config.seed}
      <div class="seed-row">
        <span id="game-seed" class="game-sub">Seed: {session.config.seed}</span>
        <button class="btn btn-small" type="button" onclick={() => void copySeed()}>Copy seed</button>
      </div>
    {/if}
    {#if session.net}
      <div class="net-bar">
        <span id="net-status" role="status" data-tone={connection.state === "connected" ? "" : "error"}>
          <Icon name={connection.state === "connected" ? "check" : "info"} />{connection.state === "connected" ? "Connected" : connection.message}
        </span>
        <button class="btn btn-small" type="button" hidden={!(connection.state === "lost" && connection.canReconnect)} onclick={() => session.net?.reconnect()}>Reconnect</button>
      </div>
    {/if}
    <Pill model={view.pill} />
    <Banner id="game-status" class="status-line" tone={refusal ? "error" : "info"} text={statusLine} hidden={statusLine === ""} />
    <div class="card board-card">
      {#key session}
        {#if session.config.variant === "ultimate"}
          <BoardUltimate game={view.state as UltimateState} hints={view.hints} {onMove} />
        {:else if session.config.variant === "cube"}
          <CubeBoard game={view.state as CubeState} hints={view.hints as HintSet<CubeHint>} notation={$settings.cubeNotation} {onMove} {...session.net ? { mayMove: (state: CubeState) => state.toMove === session.net!.myMark } : {}} />
        {:else}
          <BoardClassic game={view.state as ClassicState} hints={view.hints} onCell={(cell) => onMove({ t: "place", cell })} />
        {/if}
      {/key}
    </div>
    <div class="game-controls">
      <button class="btn" type="button" disabled={!view.canUndo} onclick={undo}>Undo</button>
      <button class="btn btn-destructive" type="button" disabled={view.over} onclick={() => void resign()}>Resign</button>
      <button class="btn" type="button" hidden={!view.over} onclick={showReplay}>Replay</button>
      <button class="btn" type="button" hidden={!view.over} onclick={() => void shareReplay()}>Share replay</button>
      <button class="btn" type="button" onclick={leave}>New game</button>
    </div>
  </section>
{/if}
