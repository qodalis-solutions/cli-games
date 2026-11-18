import {
    Board,
    COMPUTER,
    EMPTY,
    PLAYER,
    chooseMove,
    createBoard,
    dropDisc,
    findWin,
    isFull,
    landingRow,
    validMoves,
} from '../lib/board';

/** Board from rows drawn top to bottom: `X` player, `O` computer, `.` empty. */
function boardOf(...rows: string[]): Board {
    return rows.map((line) =>
        line
            .replace(/ /g, '')
            .split('')
            .map((ch) => (ch === 'X' ? PLAYER : ch === 'O' ? COMPUTER : EMPTY)),
    );
}

const fixed = () => 0;

describe('connect-four board', () => {
    it('creates an empty 6x7 board', () => {
        const board = createBoard();
        expect(board.length).toBe(6);
        expect(
            board.every(
                (row) => row.length === 7 && row.every((c) => c === EMPTY),
            ),
        ).toBeTrue();
        expect(validMoves(board)).toEqual([3, 2, 4, 1, 5, 0, 6]);
    });

    it('stacks discs from the bottom and refuses a full column', () => {
        const board = createBoard();
        for (let i = 0; i < 6; i++) {
            expect(dropDisc(board, 2, i % 2 ? COMPUTER : PLAYER)).toBe(5 - i);
        }
        expect(landingRow(board, 2)).toBe(-1);
        expect(dropDisc(board, 2, PLAYER)).toBe(-1);
        expect(validMoves(board)).not.toContain(2);
        expect(landingRow(board, 7)).toBe(-1);
    });

    describe('win detection', () => {
        it('finds a horizontal line', () => {
            const board = boardOf(
                '.......',
                '.......',
                '.......',
                '.......',
                '.......',
                '.XXXXO.',
            );
            expect(findWin(board)).toEqual({
                disc: PLAYER,
                cells: [
                    [5, 1],
                    [5, 2],
                    [5, 3],
                    [5, 4],
                ],
            });
        });

        it('finds a vertical line', () => {
            const board = boardOf(
                '.......',
                '.......',
                '......O',
                '......O',
                'X.....O',
                'X.X...O',
            );
            expect(findWin(board)?.disc).toBe(COMPUTER);
            expect(findWin(board)?.cells).toEqual([
                [2, 6],
                [3, 6],
                [4, 6],
                [5, 6],
            ]);
        });

        it('finds both diagonals', () => {
            const rising = boardOf(
                '.......',
                '.......',
                '...X...',
                '..XO...',
                '.XOO...',
                'XOOO...',
            );
            expect(findWin(rising)?.disc).toBe(PLAYER);

            const falling = boardOf(
                '.......',
                '.......',
                'O......',
                'XO.....',
                'XXO....',
                'XXXO...',
            );
            expect(findWin(falling)?.disc).toBe(COMPUTER);
        });

        it('ignores three in a row and broken lines', () => {
            const board = boardOf(
                '.......',
                '.......',
                '.......',
                '.......',
                'O......',
                'XXX.XXX',
            );
            expect(findWin(board)).toBeNull();
        });

        it('reports a full board', () => {
            const board = boardOf(
                'XXOOXXO',
                'OOXXOOX',
                'XXOOXXO',
                'OOXXOOX',
                'XXOOXXO',
                'OOXXOOX',
            );
            expect(findWin(board)).toBeNull();
            expect(isFull(board)).toBeTrue();
        });
    });

    describe('computer player', () => {
        it('opens in the center', () => {
            expect(chooseMove(createBoard(), COMPUTER, 4, fixed)).toBe(3);
        });

        it('takes a winning move', () => {
            const board = boardOf(
                '.......',
                '.......',
                '.......',
                '.......',
                'X......',
                'XXXOOO.',
            );
            for (const depth of [1, 4, 6]) {
                expect(chooseMove(board, COMPUTER, depth, fixed))
                    .withContext(`depth ${depth}`)
                    .toBe(6);
            }
        });

        it('blocks the player from winning', () => {
            const board = boardOf(
                '.......',
                '.......',
                '.......',
                'X......',
                'X......',
                'X..O.O.',
            );
            expect(chooseMove(board, COMPUTER, 4, fixed)).toBe(0);
            expect(chooseMove(board, COMPUTER, 6, fixed)).toBe(0);
        });

        it('wins rather than blocks', () => {
            const board = boardOf(
                '.......',
                '.......',
                '.......',
                'X.....O',
                'X.....O',
                'X.....O',
            );
            expect(chooseMove(board, COMPUTER, 4, fixed)).toBe(6);
        });

        it('does not play under a square the player would win on', () => {
            const board = boardOf(
                '.......',
                '.......',
                '.......',
                '.......',
                '.XXX...',
                '.OXO...',
            );
            for (const r of [0, 0.3, 0.6, 0.99]) {
                expect([0, 4]).not.toContain(
                    chooseMove(board, COMPUTER, 4, () => r),
                );
            }
        });

        it('returns -1 on a full board', () => {
            const board = boardOf(
                'XXOOXXO',
                'OOXXOOX',
                'XXOOXXO',
                'OOXXOOX',
                'XXOOXXO',
                'OOXXOOX',
            );
            expect(chooseMove(board, COMPUTER, 4)).toBe(-1);
        });
    });
});
