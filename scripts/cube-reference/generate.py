"""
Generates tests/fixtures/cube-golden.json from the original game's logic (reference.py).

Sticker model (matches src/core/cube.ts): 54 stickers, index = face*9 + row*3 + col, faces
U, D, F, B, L, R = 0..5, each viewed from outside with up = +y (U: up = -z, D: up = +z).
The original's boards map onto it as: top->U, left->L, front->F, right->R, back->B, bottom->D,
with the original board[i][j] (column i, row j) being row j, column i of the face.

For every original operation the script finds, by brute force over all 27 geometric rotations
(3 axes x 3 layers x {+90, -90, 180} degrees, right-hand rule about +axis), the unique one that
reproduces the original's result on a position whose 54 stickers are all different. If none
matches, the mapping above is wrong and the script stops.

Run from the repo root:  python scripts/cube-reference/generate.py
"""
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from reference import Cube  # noqa: E402

FACE_OF_BOARD = {0: 0, 1: 4, 2: 2, 3: 5, 4: 3, 5: 1}  # original board index -> face (U=0, D=1, F=2, B=3, L=4, R=5)


def sticker_geometry(face, row, col):
    """Position (x, y, z) in {-1, 0, 1} and outward normal of a sticker."""
    if face == 0:
        return (col - 1, 1, row - 1), (0, 1, 0)
    if face == 1:
        return (col - 1, -1, 1 - row), (0, -1, 0)
    if face == 2:
        return (col - 1, 1 - row, 1), (0, 0, 1)
    if face == 3:
        return (1 - col, 1 - row, -1), (0, 0, -1)
    if face == 4:
        return (-1, 1 - row, col - 1), (-1, 0, 0)
    return (1, 1 - row, 1 - col), (1, 0, 0)


GEOM = [sticker_geometry(i // 9, (i % 9) // 3, i % 3) for i in range(54)]
INDEX_OF = {(p, n): i for i, (p, n) in enumerate(GEOM)}
AXES = ("x", "y", "z")


def rot90(v, axis):
    x, y, z = v
    if axis == "x":
        return (x, -z, y)
    if axis == "y":
        return (z, y, -x)
    return (-y, x, z)


def rotate_vec(v, axis, quarter_turns):
    for _ in range(quarter_turns % 4):
        v = rot90(v, axis)
    return v


def rotation_table(axis, layer, dir_):
    """table[dst] = src, for new[dst] = old[table[dst]]."""
    quarters = {1: 1, -1: 3, 2: 2}[dir_]
    a = AXES.index(axis)
    table = list(range(54))
    for i, (p, n) in enumerate(GEOM):
        if p[a] == layer - 1:
            j = INDEX_OF[(rotate_vec(p, axis, quarters), rotate_vec(n, axis, quarters))]
            table[j] = i
    return table


def apply_table(stickers, table):
    return [stickers[table[i]] for i in range(54)]


def to_stickers(boards):
    out = [0] * 54
    for b in range(6):
        face = FACE_OF_BOARD[b]
        for i in range(3):  # column
            for j in range(3):  # row
                out[face * 9 + j * 3 + i] = boards[b][i][j]
    return out


def to_boards(stickers):
    boards = [[[0] * 3 for _ in range(3)] for _ in range(6)]
    for b in range(6):
        face = FACE_OF_BOARD[b]
        for i in range(3):
            for j in range(3):
                boards[b][i][j] = stickers[face * 9 + j * 3 + i]
    return boards


def labelled():
    """A position where every sticker is different (labels 0..53), as 6 original boards."""
    return to_boards(list(range(54)))


def run_op(op, boards):
    cube = Cube(boards)
    kind = op["kind"]
    if kind == "turn":
        cube.make_turn(op["times"], op["index"], op["isCol"])
    elif kind == "view-up":
        cube.rotate_up(op["times"])
    else:
        cube.rotate_left(op["times"])
    return cube


def classify(op):
    """Find the geometric rotation(s) equal to an original operation, using the labelled position."""
    result = to_stickers(run_op(op, labelled()).snapshot())
    base = list(range(54))
    candidates = []
    for axis in AXES:
        for dir_ in (1, -1, 2):
            if op["kind"] == "turn":
                for layer in (0, 1, 2):
                    if apply_table(base, rotation_table(axis, layer, dir_)) == result:
                        candidates.append({"axis": axis, "layers": [layer], "dir": dir_})
            else:
                moved = base
                for layer in (0, 1, 2):
                    moved = apply_table(moved, rotation_table(axis, layer, dir_))
                if moved == result:
                    candidates.append({"axis": axis, "layers": [0, 1, 2], "dir": dir_})
    if len(candidates) != 1:
        raise SystemExit(f"cannot classify {op}: matches {candidates}")
    return candidates[0]


def main():
    ops = []
    for is_col in (True, False):
        for index in (0, 1, 2):
            for times in (1, -1, 2):
                ops.append({"kind": "turn", "isCol": is_col, "index": index, "times": times})
    for times in (1, -1, 2):
        ops.append({"kind": "view-up", "times": times})
        ops.append({"kind": "view-left", "times": times})

    rng = random.Random(20201212)
    positions = []
    for _ in range(8):
        positions.append([rng.choice([0, 0, 1, 2]) for _ in range(54)])  # sparse-ish
    for _ in range(8):
        positions.append([rng.choice([1, 2]) for _ in range(54)])  # full boards, many lines
    # a position with lines on several faces for the line-count checks
    lines_pos = [0] * 54
    for face in range(6):
        for c in range(3):
            lines_pos[face * 9 + c] = 1 if face % 2 == 0 else 2  # top row of each face
    positions.append(lines_pos)

    cases = []
    for op in ops:
        cls = classify(op)
        for pos in positions:
            before_boards = to_boards(pos)
            cube = run_op(op, before_boards)
            before = Cube(before_boards)
            cases.append(
                {
                    "op": op,
                    "classification": cls,
                    "before": pos,
                    "after": to_stickers(cube.snapshot()),
                    "winsBefore": {"O": before.wins()[1], "X": before.wins()[2]},
                    "winsAfter": {"O": cube.wins()[1], "X": cube.wins()[2]},
                }
            )

    out = {
        "note": "Generated by scripts/cube-reference/generate.py from the original 1D-Tic-Tac-Toe logic. "
        "Stickers: index = face*9 + row*3 + col, faces U,D,F,B,L,R. Values use the ORIGINAL convention: 1 = circle (O), 2 = cross (X); "
        "tests convert to this project's 1 = X, 2 = O.",
        "dirConvention": "dir +1 = +90 degrees right-hand rule about +axis (anticlockwise seen from the positive end), -1 = -90, 2 = 180. layer l turns the stickers whose coordinate on the axis is l-1.",
        "cases": cases,
    }
    path = os.path.join(os.path.dirname(__file__), "..", "..", "tests", "fixtures", "cube-golden.json")
    with open(path, "w", encoding="utf8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {len(cases)} cases to {os.path.normpath(path)}")
    for op in ops[:3] + ops[18:21]:
        print(op, "->", classify(op))


if __name__ == "__main__":
    main()
