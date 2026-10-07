<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { loadSave, updateSettings } from "../../adapters/store.ts";
  import { isValidCode, normaliseCode } from "../../core/pairing.ts";
  import type { GameConfig, Level, Mode, Variant } from "../../core/types.ts";
  import {
    applySeedToSetup, chooseMode, chooseSize, chooseVariant, configFromSetup, initialSetup, LEVEL_NAMES, modesFor, seedControlsVisible,
    VARIANTS, winLengthChoice, type SetupState,
  } from "../../ui/setup-model.ts";
  import Banner from "./Banner.svelte";
  import Logo from "./Logo.svelte";
  import Seg from "./Seg.svelte";

  // The start screen: pick a variant, a board size and win length, an opponent and options, then start. Against the computer a
  // seed can be pasted: it decides the variant, size and win length, and the game uses that seed. Only games with a computer
  // have a seed at all, so no other game shows a seed field. The rules are in ui/setup-model.ts.
  interface Props {
    onStart: (config: GameConfig) => void;
    /** Join a friend's game with their code. */
    onJoin: (code: string) => void;
    initial?: Partial<SetupState>;
    /** A seed to fill in, as when arriving from a replay link. */
    seed?: string;
  }
  let { onStart, onJoin, initial, seed: arrivedSeed }: Props = $props();

  // the screen opens on the last choices (and any the caller names); after that the player's own changes rule
  let choice = $state<SetupState>(untrack(() => initialSetup({ ...initialSetup(loadSave().save.settings.lastSetup), ...initial })));
  let seedText = $state("");
  /** The seed in the box, if it is a good one. */
  let seed = $state<string | null>(null);
  let seedError = $state("");
  let joinCode = $state("");
  let joinError = $state("");
  let online = $state(typeof navigator === "undefined" || navigator.onLine !== false);
  let seedInput = $state<HTMLInputElement>();
  let joinInput = $state<HTMLInputElement>();

  const showSeed = $derived(seedControlsVisible(choice));
  const win = $derived(winLengthChoice(choice));
  const allowedModes = $derived(modesFor(choice.variant));
  const modeOptions = $derived([
    ...(allowedModes.includes("computer") ? [{ value: "computer", title: "Computer" }] : []),
    { value: "local", title: "A friend on this device" },
    { value: "network", title: "A friend on another device", disabled: !online },
  ]);

  function clearSeed(): void {
    seed = null;
    seedText = "";
    seedError = "";
  }

  // a seed field that is not shown holds nothing
  $effect(() => {
    if (!showSeed && (seedText !== "" || seed !== null || seedError !== "")) clearSeed();
  });

  // Two-device play needs the internet to introduce the devices; everything else works without it.
  $effect(() => {
    if (!online && choice.mode === "network") choice.mode = modesFor(choice.variant)[0]!;
  });

  /** Take a seed from the box: a good one sets the variant, board and win length; a bad one is explained. */
  function readSeed(text: string): void {
    if (text.trim() === "") {
      seed = null;
      seedError = "";
      return;
    }
    const applied = applySeedToSetup(choice, text);
    if ("error" in applied) {
      seed = null;
      seedError = applied.error;
      return;
    }
    choice = applied;
    seed = text.trim().toUpperCase();
    seedError = "";
  }

  function pickVariant(value: Variant): void {
    choice = chooseVariant(choice, value);
    clearSeed();
  }
  function pickSize(value: number): void {
    choice = chooseSize(choice, value as 3 | 4 | 5);
    clearSeed();
  }
  function pickWinLength(value: number): void {
    choice.winLength = value;
    clearSeed();
  }
  function pickMode(value: Mode): void {
    const form = chooseMode({ choice: $state.snapshot(choice), seed }, value);
    choice = form.choice;
    if (form.seed === null && seedText !== "") clearSeed();
  }

  function start(): void {
    if (seedText.trim() !== "" && seed === null) {
      readSeed(seedText);
      seedInput?.focus();
      return;
    }
    const now = $state.snapshot(choice);
    updateSettings({ lastSetup: { ...now, winLength: win.value } });
    onStart(configFromSetup(now, now.mode === "computer" ? (seed ?? undefined) : undefined));
  }

  function join(): void {
    const code = normaliseCode(joinCode);
    if (!isValidCode(code)) {
      joinError = "A game code is six letters and digits, like BXK4M9.";
      joinInput?.focus();
      return;
    }
    joinError = "";
    onJoin(code);
  }

  onMount(() => {
    const update = (): void => {
      online = navigator.onLine !== false;
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (arrivedSeed) {
      seedText = arrivedSeed;
      readSeed(arrivedSeed);
    }
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  });
</script>

<section class="screen" aria-labelledby="setup-title">
  <h2 id="setup-title" class="sr-only">New game</h2>
  <div class="start-logo" aria-hidden="true"><Logo /></div>
  <div class="card">
    <Seg name="variant" legend="Game" options={VARIANTS.map((v) => ({ value: v.value, title: v.title, blurb: v.blurb }))} value={choice.variant} onchange={pickVariant} />
  </div>
  <div class="card">
    <div>
      <Seg name="size" legend="Board" options={[{ value: 3, title: "3×3" }, { value: 4, title: "4×4" }, { value: 5, title: "5×5" }]} value={choice.size} onchange={pickSize} />
    </div>
    <div>
      {#if win.fixed}
        <div class="field" data-group="winlength" data-fixed="true">
          <span class="field-label">Win length</span>
          <p id="win-fixed" class="fixed-value">3 in a row (fixed on 3×3)</p>
        </div>
      {:else}
        <Seg name="winlength" legend="Win length" options={win.options.map((n) => ({ value: n, title: String(n), blurb: "in a row" }))} value={win.value} onchange={pickWinLength} />
      {/if}
    </div>
  </div>
  <div class="card">
    <div>
      <Seg name="mode" legend="Opponent" options={modeOptions} value={choice.mode} onchange={(value) => pickMode(value as Mode)} />
      {#if choice.variant === "cube"}<p class="hint-text">Twist is for two players.</p>{/if}
    </div>
    <div class="field" hidden={choice.mode !== "computer"}>
      <label for="level">Computer level</label>
      <select id="level" value={String(choice.level)} onchange={(event) => (choice.level = Number(event.currentTarget.value) as Level)}>
        {#each Object.entries(LEVEL_NAMES) as [level, name] (level)}
          <option value={level}>{level}. {name}</option>
        {/each}
      </select>
    </div>
    <Seg
      name="mark"
      legend="Your mark"
      options={[{ value: "X", title: "X", blurb: "moves first" }, { value: "O", title: "O", blurb: "moves second" }, { value: "random", title: "Let the game decide" }]}
      value={choice.markChoice}
      onchange={(value) => (choice.markChoice = value as SetupState["markChoice"])}
      hidden={choice.mode === "local"} />
  </div>
  <div class="card" id="cube-options" hidden={choice.variant !== "cube"}>
    <fieldset data-group="cube-options">
      <legend>Twist rules</legend>
      <label class="check" for="opt-lock"><input type="checkbox" id="opt-lock" aria-describedby="opt-lock-hint" bind:checked={choice.lockFaces} /><span>Lock scored faces</span></label>
      <p class="hint-text" id="opt-lock-hint">A face holding a line takes no more marks, until a turn breaks the line.</p>
      <label class="check" for="opt-faces">
        <input type="checkbox" id="opt-faces" aria-describedby="opt-faces-hint" checked={choice.scoring === "faces"} onchange={(event) => (choice.scoring = event.currentTarget.checked ? "faces" : "lines")} /><span>Count faces, not lines</span>
      </label>
      <p class="hint-text" id="opt-faces-hint">Your score is the number of faces holding one of your lines.</p>
    </fieldset>
  </div>
  <div class="card" id="seed-card" hidden={!showSeed}>
    <div class="field">
      <label for="seed-input">Seed (optional)</label>
      <input
        id="seed-input"
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        placeholder="C53-BXK4-M9TR"
        aria-describedby="seed-error"
        aria-invalid={seedError === "" ? "false" : "true"}
        bind:this={seedInput}
        value={seedText}
        oninput={(event) => {
          seedText = event.currentTarget.value;
          readSeed(seedText);
        }} />
      <Banner as="p" id="seed-error" class="field-error" role="alert" tone="error" text={seedError} hidden={seedError === ""} />
    </div>
  </div>
  <div class="btn-row"><button class="btn btn-primary" type="button" onclick={start}>{choice.mode === "network" ? "Host game" : "Start game"}</button></div>
  <div class="card">
    <div class="field">
      <label for="join-code">Game code</label>
      <input
        id="join-code"
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="12"
        placeholder="BXK4M9"
        aria-describedby="join-error"
        disabled={!online}
        bind:this={joinInput}
        bind:value={joinCode}
        onkeydown={(event) => {
          if (event.key === "Enter") join();
        }} />
      <Banner as="p" id="join-error" class="field-error" role="alert" tone="error" text={joinError} hidden={joinError === ""} />
      <p class="hint-text">Joining a friend? Type the code from their screen, or scan their QR code.</p>
      <div class="btn-row"><button class="btn" type="button" disabled={!online} onclick={join}>Join game</button></div>
      <Banner as="p" id="offline-note" tone="warn" text="You are offline. Check your connection to play on two devices." hidden={online} />
    </div>
  </div>
</section>
