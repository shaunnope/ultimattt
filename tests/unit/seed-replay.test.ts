import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseMove } from "../../src/core/ai.ts";
import { rngFor } from "../../src/core/seed.ts";
import { moduleFor } from "../../src/core/variants.ts";
import type { GameConfig, Level, Move } from "../../src/core/types.ts";
import { applySeedText, configFromSetup, DEFAULT_SETUP, type SetupState } from "../../src/ui/setup-model.ts";

// A seed fixes the computer's chance. With the same seed, level, mark and human moves the computer answers the same way,
// whichever way the seed was typed or reached (spec 008, guideline 1).

/** The config a player gets by typing `text` on the start screen at `base` and pressing Start. */
function configFor(text: string, base: SetupState): GameConfig {
  const { state, reading } = applySeedText(base, text);
  return configFromSetup(state, reading?.seed);
}

/** A whole game with a scripted human (a fixed walk through the legal moves) against the computer; returns every move. */
function play(config: GameConfig, level: Level): Move[] {
  const variant = moduleFor(config);
  const moves: Move[] = [];
  let state = variant.newGame(config);
  const humanFirst = config.humanMark === "X";
  for (let turn = 0; turn < 14 && variant.status(state).status === "playing"; turn++) {
    const legal = variant.legalMoves(state);
    const human = (turn % 2 === 0) === humanFirst;
    const move = human ? legal[(turn * 7 + 3) % legal.length]! : chooseMove(config.variant, state, level, rngFor(config.seed ?? "", moves.length));
    moves.push(move);
    state = variant.apply(state, move);
  }
  return moves;
}

const CLASSIC = { ...DEFAULT_SETUP, markChoice: "random" as const };
const ULTIMATE = { ...DEFAULT_SETUP, variant: "ultimate" as const, markChoice: "random" as const };

test("every spelling of a seed gives the same computer replies and the same chosen mark", () => {
  for (const [base, seed] of [[CLASSIC, "C33-BXK4-M9TR"], [ULTIMATE, "U33-BXK4-M9TR"]] as const) {
    const spelled = [seed, seed.toLowerCase(), seed.replaceAll("-", ""), ` ${seed.replaceAll("-", " ")} `, seed.replaceAll("-", "_")];
    for (const level of [1, 3, 5] as Level[]) {
      const games = spelled.map((text) => configFor(text, base));
      const first = play(games[0]!, level);
      for (const game of games) {
        assert.equal(game.seed, seed);
        assert.equal(game.humanMark, games[0]!.humanMark);
        assert.deepEqual(play(game, level), first, `${base.variant} level ${level}`);
      }
    }
  }
});

test("a seed made from text is reproduced by its shown form, in any spelling", () => {
  for (const base of [CLASSIC, ULTIMATE]) {
    const made = configFor("banana", base);
    const shown = made.seed!;
    for (const again of [shown, shown.toLowerCase(), shown.replaceAll("-", "")]) {
      const game = configFor(again, base);
      assert.equal(game.seed, shown);
      assert.equal(game.humanMark, made.humanMark);
      assert.deepEqual(play(game, 4), play(made, 4));
    }
  }
});

test("the same text reproduces the same game, and a different text plays differently somewhere", () => {
  const same = [configFor("banana", CLASSIC), configFor("BANANA", CLASSIC), configFor("b-a-n-a-n-a", CLASSIC)];
  for (const game of same) assert.deepEqual(play(game, 3), play(same[0]!, 3));
  const others = ["bananas", "apple", "x", "42", "hello world", "C33-AXK4-M9TR"].map((text) => configFor(text, CLASSIC));
  const differs = others.some((game) => JSON.stringify(play(game, 3)) !== JSON.stringify(play(same[0]!, 3)) || game.humanMark !== same[0]!.humanMark);
  assert.ok(differs, "six other texts all played exactly like banana");
});
