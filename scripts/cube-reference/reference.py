"""
Faithful port of the board logic in 1D-Tic-Tac-Toe/game.py (Rubik's-Tac-Toe), minus tkinter.

Used only to generate tests/fixtures/cube-golden.json, so the new TypeScript cube rules can be
checked against the original game's behaviour. Run generate.py to regenerate the fixtures.

Original conventions kept as they are:
  boards[0..5] = top, left, front, right, back, bottom, drawn as a cross net around the front face
  board[i][j]  = column i (left to right), row j (top to bottom) of that board
  values       = 0 empty, 1 circle (O), 2 cross (X)
"""
from copy import deepcopy


class Board:
    def __init__(self):
        self.board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]

    # recursive: rotate the face anticlockwise `times` times (original Board.rotate)
    def rotate(self, times=2):
        times %= 4
        if times == 0:
            return self.board
        old_board = deepcopy(self.board)
        self.board[0][0] = old_board[2][0]
        self.board[0][1] = old_board[1][0]
        self.board[0][2] = old_board[0][0]
        self.board[1][0] = old_board[2][1]
        self.board[1][2] = old_board[0][1]
        self.board[2][0] = old_board[2][2]
        self.board[2][1] = old_board[1][2]
        self.board[2][2] = old_board[0][2]
        self.rotate(times - 1)

    # original Board.count_wins
    def count_wins(self):
        wins = {1: 0, 2: 0}
        for i in range(3):
            row = self.board[i][0] * self.board[i][1] * self.board[i][2]
            col = self.board[0][i] * self.board[1][i] * self.board[2][i]
            if row in (1, 8):
                wins[int(round(row ** (1 / 3)))] += 1
            if col in (1, 8):
                wins[int(round(col ** (1 / 3)))] += 1
        diag1 = self.board[0][0] * self.board[1][1] * self.board[2][2]
        diag2 = self.board[0][2] * self.board[1][1] * self.board[2][0]
        if diag1 in (1, 8):
            wins[int(round(diag1 ** (1 / 3)))] += 1
        if diag2 in (1, 8):
            wins[int(round(diag2 ** (1 / 3)))] += 1
        return wins


class Cube:
    def __init__(self, boards=None):
        self.boards = [Board() for _ in range(6)]
        if boards is not None:
            for b, data in zip(self.boards, boards):
                b.board = deepcopy(data)

    def snapshot(self):
        return [deepcopy(b.board) for b in self.boards]

    def wins(self):
        total = {1: 0, 2: 0}
        for b in self.boards:
            w = b.count_wins()
            total[1] += w[1]
            total[2] += w[2]
        return total

    # original Cube.rotate_up: turns the whole cube about the left-right axis
    def rotate_up(self, times=1):
        times %= 4
        order = [0, 2, 5, 4, 0, 2, 5]
        order = order[times:times + 4]
        order = [order[0], 1, order[1], 3, order[3], order[2]]
        self.boards[4].rotate()
        old_boards = [deepcopy(face.board) for face in self.boards]
        for i in range(len(self.boards)):
            self.boards[i].board = old_boards[order[i]]
        self.boards[4].rotate()
        self.boards[1].rotate(times)
        self.boards[3].rotate(-times)

    # original Cube.rotate_left: turns the whole cube about the vertical axis
    def rotate_left(self, times=1):
        times %= 4
        order = [1, 2, 3, 4, 1, 2, 3]
        order = [0] + order[times:times + 4] + [5]
        old_boards = [deepcopy(face.board) for face in self.boards]
        for i in range(len(self.boards)):
            self.boards[i].board = old_boards[order[i]]
        self.boards[0].rotate(-times)
        self.boards[5].rotate(times)

    # original Cube.make_turn: turn one column (is_col) or row of the cube, relative to the front face
    def make_turn(self, times=1, index=1, is_col=True):
        times %= 4
        if is_col:
            order = [0, 2, 5, 4, 0, 2, 5]
            order = order[times:times + 4]
            order = [order[0], 1, order[1], 3, order[3], order[2]]
            self.boards[4].rotate()
            col = [deepcopy(board.board[index]) for board in self.boards]
            col = [col[i] for i in order]
            for i in range(6):
                self.boards[i].board[index] = col[i]
            self.boards[4].rotate()
            if index == 0:
                self.boards[1].rotate(times)
            elif index == 2:
                self.boards[3].rotate(-times)
        else:
            order = [1, 2, 3, 4, 1, 2, 3]
            order = [0] + order[times:times + 4] + [5]
            row = [[deepcopy(board.board[0][index]), deepcopy(board.board[1][index]), deepcopy(board.board[2][index])] for board in self.boards]
            row = [row[i] for i in order]
            for i in range(6):
                for j in range(3):
                    self.boards[i].board[j][index] = row[i][j]
            if index == 0:
                self.boards[0].rotate(-times)
            elif index == 2:
                self.boards[5].rotate(times)
