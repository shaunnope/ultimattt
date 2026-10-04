import { test } from "node:test";
import assert from "node:assert/strict";
import { HELP_SECTIONS, helpText, type HelpBlock, type HelpSection } from "../../src/ui/help-content.ts";

const section = (id: string): HelpSection => {
  const found = HELP_SECTIONS.find((s) => s.id === id);
  assert.ok(found, `section ${id}`);
  return found!;
};
const topics = (s: HelpSection): Set<string> => new Set(s.blocks.flatMap((b) => ("topic" in b && b.topic ? [b.topic] : [])));
const textOf = (s: HelpSection): string => helpText(s).toLowerCase();

test("the sections come in order: Classic rules, Ultimate, Twist-Tac-Toe, Setup options", () => {
  assert.deepEqual(HELP_SECTIONS.map((s) => s.title), ["Classic rules", "Ultimate", "Twist-Tac-Toe", "Setup options"]);
  assert.deepEqual(HELP_SECTIONS.map((s) => s.id), ["classic", "ultimate", "cube", "setup"]);
});

test("Classic rules covers the goal, turns, a draw, which lines count, and the win length for each board size", () => {
  const classic = section("classic");
  const found = topics(classic);
  for (const topic of ["goal", "turn", "end", "size"]) assert.ok(found.has(topic), `classic covers ${topic}`);
  const text = textOf(classic);
  assert.match(text, /x goes first|x moves first/);
  assert.match(text, /take turns|alternate/);
  assert.match(text, /rows?, columns? and (both )?diagonals?|row, a column or a diagonal/);
  assert.match(text, /draw/);
  assert.match(text, /3×3.{0,80}\b3 in a row/);
  assert.match(text, /4×4 and 5×5.{0,80}\b4 in a row/);
  assert.match(text, /win length/);
});

test("Classic rules has a worked example for a 3×3 line and one for a 4×4 line, each with a text alternative", () => {
  const examples = section("classic").blocks.filter((b): b is Extract<HelpBlock, { kind: "example" }> => b.kind === "example");
  assert.ok(examples.length >= 2);
  const sizes = examples.flatMap((e) => e.boards.map((b) => b.rows.length));
  assert.ok(sizes.includes(3) && sizes.includes(4));
  for (const e of examples) assert.ok(e.alt.trim().length > 20);
});

test("Ultimate and Twist-Tac-Toe each cover goal, turn, special rules, end of game, and the effect of size and win length", () => {
  for (const id of ["ultimate", "cube"]) {
    const found = topics(section(id));
    for (const topic of ["goal", "turn", "special", "end", "size"]) assert.ok(found.has(topic), `${id} covers ${topic}`);
  }
});

test("the Ultimate section explains where the next move goes, and what a closed board does", () => {
  const text = textOf(section("ultimate"));
  assert.match(text, /small board/);
  assert.match(text, /same position|cell you play|matching/);
  assert.match(text, /any open board|any board/);
  assert.match(text, /claim/);
});

test("the Cube section covers layer turns, preview and confirm, and both naming styles", () => {
  const text = textOf(section("cube"));
  assert.match(text, /layer/);
  assert.match(text, /preview/);
  assert.match(text, /confirm/);
  assert.match(text, /cancel|click outside|escape/);
  assert.match(text, /notation/);
  assert.match(text, /arrows|words/);
  assert.match(text, /score|line/);
});

test("the Cube help names the notation convention with the 4×4 and 5×5 example names", () => {
  const text = textOf(section("cube"));
  assert.match(text, /single layer|one layer/);
  assert.match(text, /nearer face|nearest face/);
  assert.match(text, /middle layer of an odd cube|middle layer of any odd cube|odd cube/);
  assert.match(text, /no wide turns|not wide turns|never wide/);
  for (const name of ["2l", "2r", "m", "e", "s"]) assert.ok(text.includes(name), name);
  assert.match(text, /2l 2r|2l and 2r/);
  assert.doesNotMatch(text, /3l/);
});

test("the Cube help explains both rule options and the end of the game", () => {
  const text = textOf(section("cube"));
  assert.match(text, /lock scored faces/);
  assert.match(text, /turn.{0,40}(reopen|open)/);
  assert.match(text, /no open face|no face left|ends at once|ends early/);
  assert.match(text, /count faces, not lines/);
  assert.match(text, /second line.{0,80}(no point|no extra point|nothing)/);
  assert.match(text, /still.{0,40}turn/);
  assert.doesNotMatch(text, /the player with more lines wins/);
  assert.match(textOf(section("setup")), /changing the board size.{0,60}(sets|resets|picks)/);
});

test("the setup options section explains board size, win length and turn notation", () => {
  const text = textOf(section("setup"));
  assert.match(text, /board size|4×4|5×5/);
  assert.match(text, /win length/);
  assert.match(text, /notation/);
});

test("every example has a text alternative, and every board in it is a rectangle of known cells", () => {
  let examples = 0;
  for (const s of HELP_SECTIONS) {
    for (const block of s.blocks as HelpBlock[]) {
      if (block.kind !== "example") continue;
      examples++;
      assert.ok(block.alt.trim().length > 20, `${s.id}: ${block.title} has a text alternative`);
      assert.ok(block.title.trim().length > 0);
      for (const board of block.boards) {
        assert.ok(board.rows.length > 0);
        const width = board.rows[0]!.length;
        for (const row of board.rows) {
          assert.equal(row.length, width, `${block.title}: rows have equal length`);
          assert.match(row, /^[XO.]+$/, `${block.title}: cells are X, O or .`);
        }
        for (const [r, c] of board.mark ?? []) assert.ok(r < board.rows.length && c < width, `${block.title}: a highlight is on the board`);
      }
    }
  }
  assert.ok(examples >= 2, "Ultimate and Cube each have an example");
});

test("the text never names the reference projects", () => {
  for (const s of HELP_SECTIONS) assert.doesNotMatch(helpText(s), /flagrant|tictactoe-game/i);
});

test("every block has some text, and steps are non-empty lists", () => {
  for (const s of HELP_SECTIONS) {
    assert.ok(s.blocks.length >= 3, s.id);
    for (const b of s.blocks) {
      if (b.kind === "paragraph") assert.ok(b.text.trim().length > 0);
      if (b.kind === "steps") assert.ok(b.items.length >= 2 && b.items.every((i) => i.trim().length > 0));
    }
  }
});
