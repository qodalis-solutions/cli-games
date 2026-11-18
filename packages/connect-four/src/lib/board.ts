/**
 * Connect Four rules and the computer player, kept free of terminal code so
 * the specs can drive them directly.
 *
 * The board is `board[row][col]`, row 0 at the top, 6 rows by 7 columns.
 */

export const ROWS = 6;
export const COLS = 7;

export const EMPTY = 0;
export const PLAYER = 1;
export const COMPUTER = 2;

export type Disc = typeof PLAYER | typeof COMPUTER;
export type Cell = typeof EMPTY | Disc;
export type Board = Cell[][];

export interface Win {
    disc: Disc;
    cells: [number, number][];
}

/** Columns from the center outwards: the center takes part in the most lines. */
const CENTER_FIRST = [3, 2, 4, 1, 5, 0, 6];

const DIRECTIONS: [number, number][] = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal down-right
    [1, -1], // diagonal down-left
];

const WIN_SCORE = 1_000_000;

export function createBoard(): Board {
    return Array.from({ length: ROWS }, () =>
        new Array<Cell>(COLS).fill(EMPTY),
    );
}

export function cloneBoard(board: Board): Board {
    return board.map((row) => [...row]);
}

export function opponent(disc: Disc): Disc {
    return disc === PLAYER ? COMPUTER : PLAYER;
}

/** Row a disc dropped into `col` lands on, or -1 when the column is full. */
export function landingRow(board: Board, col: number): number {
    if (col < 0 || col >= COLS) return -1;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === EMPTY) return r;
    }
    return -1;
}

/** Drops `disc` into `col`; returns the row it landed on, or -1 if it can't. */
export function dropDisc(board: Board, col: number, disc: Disc): number {
    const row = landingRow(board, col);
    if (row >= 0) board[row][col] = disc;
    return row;
}

/** Playable columns, center first. */
export function validMoves(board: Board): number[] {
    return CENTER_FIRST.filter((c) => board[0][c] === EMPTY);
}

export function isFull(board: Board): boolean {
    return validMoves(board).length === 0;
}

/** The first line of four found on the board, with its cells. */
export function findWin(board: Board): Win | null {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const disc = board[r][c];
            if (disc === EMPTY) continue;
            for (const [dr, dc] of DIRECTIONS) {
                const cells: [number, number][] = [];
                for (let i = 0; i < 4; i++) {
                    const rr = r + dr * i;
                    const cc = c + dc * i;
                    if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
                    if (board[rr][cc] !== disc) break;
                    cells.push([rr, cc]);
                }
                if (cells.length === 4) return { disc, cells };
            }
        }
    }
    return null;
}

/** Whether dropping `disc` into `col` wins on the spot. */
export function isWinningMove(board: Board, col: number, disc: Disc): boolean {
    const row = landingRow(board, col);
    if (row < 0) return false;
    board[row][col] = disc;
    const win = findWin(board);
    board[row][col] = EMPTY;
    return win !== null && win.disc === disc;
}

// ── Computer player ──────────────────────────────────────────────────

function scoreWindow(window: Cell[], disc: Disc): number {
    let own = 0;
    let theirs = 0;
    let empty = 0;
    for (const cell of window) {
        if (cell === disc) own++;
        else if (cell === EMPTY) empty++;
        else theirs++;
    }
    if (own === 3 && empty === 1) return 5;
    if (own === 2 && empty === 2) return 2;
    if (theirs === 3 && empty === 1) return -4;
    return 0;
}

/** Heuristic value of a position without a winner, from `disc`'s side. */
export function evaluate(board: Board, disc: Disc): number {
    let score = 0;
    for (let r = 0; r < ROWS; r++) {
        if (board[r][3] === disc) score += 3;
    }
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            for (const [dr, dc] of DIRECTIONS) {
                const endR = r + dr * 3;
                const endC = c + dc * 3;
                if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS)
                    continue;
                const window: Cell[] = [];
                for (let i = 0; i < 4; i++)
                    window.push(board[r + dr * i][c + dc * i]);
                score += scoreWindow(window, disc);
            }
        }
    }
    return score;
}

function minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    disc: Disc,
): number {
    const win = findWin(board);
    if (win) {
        // Prefer quicker wins and slower losses.
        return win.disc === disc ? WIN_SCORE + depth : -WIN_SCORE - depth;
    }
    const moves = validMoves(board);
    if (moves.length === 0) return 0;
    if (depth === 0) return evaluate(board, disc);

    const mover = maximizing ? disc : opponent(disc);
    let best = maximizing ? -Infinity : Infinity;
    for (const col of moves) {
        const row = dropDisc(board, col, mover);
        const value = minimax(board, depth - 1, alpha, beta, !maximizing, disc);
        board[row][col] = EMPTY;
        if (maximizing) {
            best = Math.max(best, value);
            alpha = Math.max(alpha, value);
        } else {
            best = Math.min(best, value);
            beta = Math.min(beta, value);
        }
        if (alpha >= beta) break;
    }
    return best;
}

/**
 * Column the computer plays for `disc`: a winning move if there is one,
 * otherwise a block of the opponent's winning move (from depth 2), otherwise
 * the best column found by a depth-limited minimax with alpha-beta pruning.
 * Ties go to a random column among the best, so games differ.
 */
export function chooseMove(
    board: Board,
    disc: Disc,
    depth: number,
    random: () => number = Math.random,
): number {
    const moves = validMoves(board);
    if (moves.length === 0) return -1;

    const win = moves.find((c) => isWinningMove(board, c, disc));
    if (win !== undefined) return win;

    if (depth >= 2) {
        const block = moves.find((c) =>
            isWinningMove(board, c, opponent(disc)),
        );
        if (block !== undefined) return block;
    }

    const work = cloneBoard(board);
    let bestScore = -Infinity;
    let best: number[] = [];
    for (const col of moves) {
        const row = dropDisc(work, col, disc);
        const score = minimax(
            work,
            depth - 1,
            -Infinity,
            Infinity,
            false,
            disc,
        );
        work[row][col] = EMPTY;
        if (score > bestScore) {
            bestScore = score;
            best = [col];
        } else if (score === bestScore) {
            best.push(col);
        }
    }
    return best[Math.floor(random() * best.length)] ?? moves[0];
}
