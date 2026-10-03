// Compact text for moves (contracts/record-format.md). Pure, and small: the save file and replay links use it.
//
// Move tokens:
//   Classic  one character, 0-9 then a-o: the cell, reading along each row from the top left
//   Ultimate two characters: board 0-8, cell 0-8
//   Cube     two characters (face 0-5, cell 0-8) for a mark; "." axis layer way for a turn, e.g. ".x1+"
//            (way: "+" a quarter, "-" a quarter back, "2" a half turn)

import type { Axis, CubeMove, Move, RotateDir, Variant } from "./types.ts";

const CLASSIC_CHARS = "0123456789abcdefghijklmno";
const AXES = "xyz";
// A "+" typed into a web address is read back as a space, so a space is accepted as "+".
const DIR_CHARS: Record<string, RotateDir> = { "+": 1, " ": 1, "-": -1, "2": 2 };
const DIR_TEXT: Record<number, string> = { 1: "+", [-1]: "-", 2: "2" };

export function encodeMove(variant: Variant, move: Move): string {
  if (variant === "classic") return CLASSIC_CHARS[(move as { cell: number }).cell] ?? "?";
  if (variant === "ultimate") {
    const m = move as { board: number; cell: number };
    return `${m.board}${m.cell}`;
  }
  const m = move as CubeMove;
  if (m.t === "rotate") return `.${m.axis}${m.layer}${DIR_TEXT[m.dir]}`;
  return `${m.face}${m.cell}`;
}

export function encodeMoves(variant: Variant, moves: readonly Move[]): string {
  return moves.map((m) => encodeMove(variant, m)).join("");
}

const digit = (ch: string | undefined, max: number): number | null => {
  if (ch === undefined || ch < "0" || ch > "9") return null;
  const n = Number(ch);
  return n <= max ? n : null;
};

export function decodeMoves(variant: Variant, text: string): Move[] | { error: string } {
  const moves: Move[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (variant === "classic") {
      const cell = CLASSIC_CHARS.indexOf(ch);
      if (cell < 0) return { error: `"${ch}" is not a move.` };
      moves.push({ t: "place", cell });
      i += 1;
    } else if (variant === "ultimate") {
      const board = digit(ch, 8);
      const cell = digit(text[i + 1], 8);
      if (board === null || cell === null) return { error: "The moves are cut short or contain a bad character." };
      moves.push({ t: "place", board, cell });
      i += 2;
    } else if (ch === ".") {
      const axis = text[i + 1];
      const layer = digit(text[i + 2], 2);
      const dir = DIR_CHARS[text[i + 3] ?? ""];
      if (!axis || !AXES.includes(axis) || layer === null || dir === undefined) return { error: "A layer turn in the moves is cut short or malformed." };
      moves.push({ t: "rotate", axis: axis as Axis, layer: layer as 0 | 1 | 2, dir });
      i += 4;
    } else {
      const face = digit(ch, 5);
      const cell = digit(text[i + 1], 8);
      if (face === null || cell === null) return { error: "The moves are cut short or contain a bad character." };
      moves.push({ t: "place", face, cell });
      i += 2;
    }
  }
  return moves;
}

