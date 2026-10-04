// The help page's words, as static data (research R16). English only, no DOM: help.ts draws it. Each Ultimate and
// Cube section covers the goal, a turn, the special rules, the end of the game, and how board size and win length
// change things. Examples are small boards written as rows of X, O and . with a text alternative.

export type HelpTopic = "goal" | "turn" | "special" | "end" | "size";

/** A small board for an example: rows of X, O and ., plus cells to point out as [row, column]. */
export interface HelpBoard {
  rows: string[];
  mark?: [number, number][];
  label?: string;
}

export type HelpBlock =
  | { kind: "paragraph"; text: string; topic?: HelpTopic }
  | { kind: "steps"; items: string[]; topic?: HelpTopic }
  | { kind: "example"; title: string; alt: string; boards: HelpBoard[]; topic?: HelpTopic };

export interface HelpSection {
  id: "ultimate" | "cube" | "setup";
  title: string;
  blocks: HelpBlock[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "ultimate",
    title: "Ultimate",
    blocks: [
      {
        kind: "paragraph",
        topic: "goal",
        text: "Ultimate tic tac toe is played on a big board made of small boards. Win small boards to claim them, and claim a line of small boards in a row on the big board to win the game.",
      },
      {
        kind: "steps",
        topic: "turn",
        items: [
          "X goes first and may play in any cell of any small board.",
          "The cell you play inside a small board decides which small board your opponent must play in next. Play the top right cell, and your opponent plays in the top right small board.",
          "You then play in the board you were sent to, and your choice of cell sends your opponent on.",
        ],
      },
      {
        kind: "example",
        topic: "turn",
        title: "Sending your opponent",
        alt: "Two small diagrams. In the first, X has just played the top right cell of a small board. In the second, the big board, the top right small board is highlighted: it is the only board where O may play next.",
        boards: [
          { rows: ["OX.", ".X.", "O.."], mark: [[0, 2]], label: "X plays the top right cell" },
          { rows: ["...", "...", "..."], mark: [[0, 2]], label: "O must play in the top right board" },
        ],
      },
      {
        kind: "paragraph",
        topic: "special",
        text: "Make your win length in a row inside a small board to claim it. A claimed board takes no more marks. If a small board fills up with no line, it is closed and counts for nobody.",
      },
      {
        kind: "paragraph",
        topic: "special",
        text: "If you are sent to a board that is already claimed or full, you may play in any open board. The outlined boards on screen show where you may play.",
      },
      {
        kind: "paragraph",
        topic: "end",
        text: "The game is won by the first player to claim their win length of small boards in a row on the big board, across, down or diagonally. If every board is closed and nobody has a line, it is a draw.",
      },
      {
        kind: "paragraph",
        topic: "size",
        text: "Boards come in 3×3, 4×4 and 5×5: that many small boards across the big board, each with that many cells across. The cell you play still sends your opponent to the board in the same place, so on a larger board there are more boards to be sent to. The win length, from 3 up to the board size, is used both inside each small board and on the big board. A longer win length makes lines, and claims, harder to get.",
      },
    ],
  },
  {
    id: "cube",
    title: "Cube",
    blocks: [
      {
        kind: "paragraph",
        topic: "goal",
        text: "The Cube has six faces, each a board. Score more than your opponent: by default, more lines. A line is your win length in a row on one face, across, down or diagonally. A longer run scores once for each stretch of that length inside it: four in a row with a win length of three scores two lines.",
      },
      {
        kind: "steps",
        topic: "turn",
        items: [
          "Place a mark on any empty square of any face. Drag the cube, use the face buttons, or switch to the flat view to reach every face.",
          "If your mark makes a new line, you score, and you must then turn one layer of the cube before your opponent moves.",
          "Choose a layer and a direction with the turn buttons. The cube shows a preview: the layer turns, and stays turned, so you can see the result.",
          "Press Confirm to make the turn. To change your mind, click outside the cube and the buttons, or press Escape: the preview turns back and you choose again. Choosing another turn replaces the preview.",
        ],
      },
      {
        kind: "example",
        topic: "turn",
        title: "Scoring a line",
        alt: "One face of the cube as a three by three board. X holds the top left and top middle squares, O holds the middle square, and the top right square is highlighted: X plays there to complete the top row, scores a line, and must then turn a layer.",
        boards: [{ rows: ["XX.", ".O.", "..."], mark: [[0, 2]], label: "X completes the top row" }],
      },
      {
        kind: "paragraph",
        topic: "special",
        text: "A layer turn carries marks from face to face, so it can make new lines or break lines, for either player. A turn that makes a line gives no extra turn. After your layer turn, your opponent moves.",
      },
      {
        kind: "paragraph",
        topic: "special",
        text: "Lock scored faces (an option when you set up a Cube game): a face holding a line, yours or your opponent's, takes no more marks. Turning a layer is never blocked, and a turn that breaks the line reopens the face. If no empty square is left on an open face, the game ends at once and the scores decide it.",
      },
      {
        kind: "paragraph",
        topic: "special",
        text: "Count faces, not lines (an option when you set up a Cube game): your score is the number of faces that hold at least one of your lines, however many lines are on them. Both players can count the same face. A second line on a face you already count gives no extra point, but it is still a line, so you must still turn a layer.",
      },
      {
        kind: "paragraph",
        topic: "special",
        text: "The turn buttons show arrows by default, with the full words as their names for screen readers. In Settings you can switch to cube notation: R, L, U, D, F and B for the outer layers, a ' for the opposite way and a 2 for a half turn. Every name is a single layer, never wide turns. An inner layer is named by its depth from the nearer face: on a 4×4 the layers across are L, 2L and 2R, R (with D, 2D, 2U, U and B, 2B, 2F, F the other ways), and on a 5×5 they are L, 2L, M, 2R, R. The middle layer of an odd cube is M, E or S, as on a 3×3: M turns like L, E like D and S like F. Words or notation only changes how turns are named; the game is the same.",
      },
      {
        kind: "paragraph",
        topic: "end",
        text: "The game ends when every square is filled and no turn is waiting. The player with the higher score wins, and equal scores are a tie. The score is lines, or faces if you chose to count faces. With the lock on, the game also ends at once when no empty square is left on an open face.",
      },
      {
        kind: "paragraph",
        topic: "size",
        text: "The Cube comes in 3×3, 4×4 and 5×5. A larger cube has more layers on each axis, so more turns to choose from, including inner layers. The win length, from 3 up to the face size, sets how long a line must be to score, and a longer win length means fewer lines.",
      },
    ],
  },
  {
    id: "setup",
    title: "Setup options",
    blocks: [
      {
        kind: "paragraph",
        text: "Board size: Classic, Ultimate and the Cube can each be played on 3×3, 4×4 or 5×5 boards.",
      },
      {
        kind: "paragraph",
        text: "Win length: how many in a row make a line, from 3 up to the board size. On 3×3 it is always 3. Changing the board size sets the usual win length for that size: 3 on a 3×3 board and 4 on 4×4 and 5×5. You can then choose another.",
      },
      {
        kind: "paragraph",
        text: "Opponent: play the computer (Classic and Ultimate), a friend on this device, or a friend on another device. A game against the computer has a seed you can copy and paste to play that exact game again.",
      },
      {
        kind: "paragraph",
        text: "In Settings you can pick one of four mark colour pairs, including one for colour-blind players, choose light or dark appearance, and choose whether Cube turns are named with arrows and words or in cube notation. These are kept on your device only.",
      },
    ],
  },
];

/** All the words of a section as one string (used by tests and for a plain-text view). */
export function helpText(section: HelpSection): string {
  const parts: string[] = [section.title];
  for (const block of section.blocks) {
    if (block.kind === "paragraph") parts.push(block.text);
    else if (block.kind === "steps") parts.push(...block.items);
    else parts.push(block.title, block.alt, ...block.boards.flatMap((b) => (b.label ? [b.label] : [])));
  }
  return parts.join("\n");
}
