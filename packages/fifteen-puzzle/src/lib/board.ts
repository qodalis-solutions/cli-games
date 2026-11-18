// -- Board logic ------------------------------------------------------------
//
// A board is a flat array of size*size cells, row by row: the tiles 1..n-1
// and 0 for the gap. Solved means 1..n-1 in order with the gap last.

export type Board = number[];

/** Direction a tile slides into the gap (the arrow key pressed). */
export type Direction = 'up' | 'down' | 'left' | 'right';

export const MIN_SIZE = 3;
export const MAX_SIZE = 5;

export function createSolvedBoard(size: number): Board {
    const board: Board = [];
    for (let i = 1; i < size * size; i++) {
        board.push(i);
    }
    board.push(0);
    return board;
}

export function isSolved(board: Board): boolean {
    for (let i = 0; i < board.length - 1; i++) {
        if (board[i] !== i + 1) return false;
    }
    return board[board.length - 1] === 0;
}

/**
 * Whether the position can reach the solved board. Odd widths: the number of
 * inversions is even. Even widths: inversions plus the gap's row counted from
 * the bottom (1-based) is odd.
 */
export function isSolvable(board: Board, size: number): boolean {
    const tiles = board.filter((t) => t !== 0);
    let inversions = 0;
    for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            if (tiles[i] > tiles[j]) inversions++;
        }
    }
    if (size % 2 === 1) {
        return inversions % 2 === 0;
    }
    const gapRowFromBottom = size - Math.floor(board.indexOf(0) / size);
    return (inversions + gapRowFromBottom) % 2 === 1;
}

/**
 * Index of the tile that slides into the gap for a direction, or -1 when no
 * tile can move that way. `left` moves the tile right of the gap to the left.
 */
export function tileForDirection(
    board: Board,
    size: number,
    direction: Direction,
): number {
    const gap = board.indexOf(0);
    const row = Math.floor(gap / size);
    const col = gap % size;
    switch (direction) {
        case 'left':
            return col < size - 1 ? gap + 1 : -1;
        case 'right':
            return col > 0 ? gap - 1 : -1;
        case 'up':
            return row < size - 1 ? gap + size : -1;
        case 'down':
            return row > 0 ? gap - size : -1;
    }
}

/** Slides a tile into the gap. Returns the new board, or null if illegal. */
export function slide(
    board: Board,
    size: number,
    direction: Direction,
): Board | null {
    const tile = tileForDirection(board, size, direction);
    if (tile < 0) return null;
    const next = [...board];
    const gap = next.indexOf(0);
    next[gap] = next[tile];
    next[tile] = 0;
    return next;
}

/**
 * Shuffles by random legal moves from the solved board, so every result is
 * solvable. Never undoes the previous move and never returns a solved board.
 */
export function shuffleBoard(
    size: number,
    random: () => number = Math.random,
    moves = size * size * 25,
): Board {
    const opposite: Record<Direction, Direction> = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left',
    };
    let board = createSolvedBoard(size);
    let last: Direction | null = null;
    for (let i = 0; i < moves || isSolved(board); i++) {
        const options = (['up', 'down', 'left', 'right'] as Direction[]).filter(
            (d) =>
                d !== (last ? opposite[last] : null) &&
                tileForDirection(board, size, d) >= 0,
        );
        const direction =
            options[
                Math.min(
                    options.length - 1,
                    Math.floor(random() * options.length),
                )
            ];
        board = slide(board, size, direction)!;
        last = direction;
    }
    return board;
}
