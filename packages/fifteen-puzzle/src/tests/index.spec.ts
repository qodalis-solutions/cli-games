import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    createSolvedBoard,
    isSolvable,
    isSolved,
    shuffleBoard,
    slide,
    tileForDirection,
} from '../lib/board';
import { CliFifteenPuzzleCommandProcessor } from '../lib/processors/cli-fifteen-puzzle-command-processor';

// ── Fake context ────────────────────────────────────────────

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        fifteenPuzzleBest: {},
        ...initialState,
    });
    const out = {
        info: [] as string[],
        success: [] as string[],
        errors: [] as string[],
        lines: [] as string[],
    };
    const context: any = {
        terminal: { cols: 40, rows: 30, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        createInterval: jasmine
            .createSpy('createInterval')
            .and.returnValue({ clear: jasmine.createSpy('clear') }),
        writer: {
            writeln: (t = '') => out.lines.push(t),
            writeInfo: (t: string) => out.info.push(t),
            writeSuccess: (t: string) => out.success.push(t),
            writeError: (t: string) => out.errors.push(t),
            wrapInColor: (t: string) => t,
        },
        state: {
            select: (fn: (s: any) => any) => state$.pipe(map(fn)),
            updateState: jasmine
                .createSpy('updateState')
                .and.callFake((patch: any) =>
                    state$.next({ ...state$.value, ...patch }),
                ),
            persist: jasmine.createSpy('persist').and.resolveTo(),
            getState: () => state$.value,
        },
    };
    return { context, out, state$ };
}

const LEFT = '\x1b[D';
const RIGHT = '\x1b[C';
const UP = '\x1b[A';

/** Starts a game of the given size, then replaces the board with a known one. */
async function startWith(
    board: number[],
    size = 4,
    state: Record<string, any> = {},
) {
    const processor = new CliFifteenPuzzleCommandProcessor();
    const { context, out, state$ } = createContext(state);
    await processor.initialize(context);
    await processor.processCommand(
        { command: 'fifteen', args: { size } } as any,
        context,
    );
    const internal = processor as any;
    internal.board = [...board];
    return { processor, internal, context, out, state$ };
}

/** A 4x4 board one move from solved: the gap is left of the 15. */
const ONE_FROM_SOLVED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15];

/** Shuffles with a seeded generator so specs are repeatable. */
function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
}

describe('15-puzzle board', () => {
    it('creates the solved board with the gap last', () => {
        expect(createSolvedBoard(3)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 0]);
        expect(isSolved(createSolvedBoard(4))).toBeTrue();
        expect(isSolved(ONE_FROM_SOLVED)).toBeFalse();
    });

    describe('solvability', () => {
        it('accepts the solved boards', () => {
            for (const size of [3, 4, 5]) {
                expect(isSolvable(createSolvedBoard(size), size))
                    .withContext(`${size}`)
                    .toBeTrue();
            }
        });

        it('rejects the classic 14-15 swap (Sam Loyd)', () => {
            const swapped = [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0,
            ];
            expect(isSolvable(swapped, 4)).toBeFalse();
        });

        it('rejects a 3x3 board with one swapped pair', () => {
            expect(isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBeFalse();
        });

        it('accounts for the gap row on even widths', () => {
            // One legal move up from solved keeps it solvable even though the
            // inversion count changes by three
            const moved = slide(createSolvedBoard(4), 4, 'down')!;
            expect(isSolvable(moved, 4)).toBeTrue();
        });

        it('every shuffle is solvable and not already solved', () => {
            for (const size of [3, 4, 5]) {
                const random = seeded(size * 7);
                for (let i = 0; i < 50; i++) {
                    const board = shuffleBoard(size, random);
                    expect(board.length).toBe(size * size);
                    expect([...board].sort((a, b) => a - b)).toEqual(
                        Array.from({ length: size * size }, (_, k) => k),
                    );
                    expect(isSolvable(board, size))
                        .withContext(board.join(','))
                        .toBeTrue();
                    expect(isSolved(board)).toBeFalse();
                }
            }
        });

        it('a zero-move shuffle still never returns the solved board', () => {
            expect(isSolved(shuffleBoard(4, seeded(1), 0))).toBeFalse();
        });
    });

    describe('move legality', () => {
        // Gap in the middle of a 3x3 board
        const middle = [1, 2, 3, 4, 0, 5, 6, 7, 8];

        it('slides the neighbour opposite the arrow into the gap', () => {
            expect(slide(middle, 3, 'left')).toEqual([
                1, 2, 3, 4, 5, 0, 6, 7, 8,
            ]);
            expect(slide(middle, 3, 'right')).toEqual([
                1, 2, 3, 0, 4, 5, 6, 7, 8,
            ]);
            expect(slide(middle, 3, 'up')).toEqual([1, 2, 3, 4, 7, 5, 6, 0, 8]);
            expect(slide(middle, 3, 'down')).toEqual([
                1, 0, 3, 4, 2, 5, 6, 7, 8,
            ]);
        });

        it('refuses moves with no tile on that side of the gap', () => {
            const solved = createSolvedBoard(3); // gap bottom-right
            expect(slide(solved, 3, 'left')).toBeNull();
            expect(slide(solved, 3, 'up')).toBeNull();
            expect(tileForDirection(solved, 3, 'right')).toBe(7);
            expect(tileForDirection(solved, 3, 'down')).toBe(5);
        });

        it('never wraps a row edge', () => {
            // Gap at the start of the second row: the tile left of it is on row 1
            const board = [1, 2, 3, 0, 4, 5, 6, 7, 8];
            expect(slide(board, 3, 'right')).toBeNull();
        });

        it('does not change the original board', () => {
            const board = [...middle];
            slide(board, 3, 'left');
            expect(board).toEqual(middle);
        });
    });
});

describe('CliFifteenPuzzleCommandProcessor', () => {
    it('registers the fifteen command in the games module', () => {
        const p = new CliFifteenPuzzleCommandProcessor();
        expect(p.command).toBe('fifteen');
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({
            fifteenPuzzleBest: {},
        });
        expect(p.processors!.map((x) => x.command)).toEqual([
            'scores',
            'reset',
        ]);
    });

    it('starts a 4x4 game in full-screen mode by default', async () => {
        const p = new CliFifteenPuzzleCommandProcessor();
        const { context } = createContext();
        await p.processCommand(
            { command: 'fifteen', args: {} } as any,
            context,
        );
        const internal = p as any;
        expect(context.enterFullScreenMode).toHaveBeenCalledWith(p);
        expect(internal.board.length).toBe(16);
        expect(isSolvable(internal.board, 4)).toBeTrue();
        expect(context.createInterval).toHaveBeenCalled();
    });

    it('starts a 3x3 game with --size=3 and refuses other sizes', async () => {
        const p = new CliFifteenPuzzleCommandProcessor();
        const { context, out } = createContext();
        await p.processCommand(
            { command: 'fifteen', args: { size: '3' } } as any,
            context,
        );
        expect((p as any).board.length).toBe(9);

        const q = new CliFifteenPuzzleCommandProcessor();
        const second = createContext();
        await q.processCommand(
            { command: 'fifteen', args: { size: 9 } } as any,
            second.context,
        );
        expect(second.context.enterFullScreenMode).not.toHaveBeenCalled();
        expect(second.out.errors.length).toBe(1);
        expect(out.errors.length).toBe(0);
    });

    it('fits within 40 columns', async () => {
        const { context } = await startWith(ONE_FROM_SOLVED);
        const output: string =
            context.terminal.write.calls.mostRecent().args[0];
        // Every cursor move targets a column whose text ends by column 40
        const lines = output.split(/\x1b\[\d+;\d+H/).slice(1);
        const columns = [...output.matchAll(/\x1b\[\d+;(\d+)H/g)].map(
            (m) => +m[1],
        );
        lines.forEach((line, i) => {
            const visible = line.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
            expect(columns[i] - 1 + [...visible].length).toBeLessThanOrEqual(
                40,
            );
        });
    });

    it('counts legal moves only', async () => {
        const { processor, internal, context } =
            await startWith(ONE_FROM_SOLVED);
        await processor.onData(RIGHT, context); // 14 slides right into the gap
        expect(internal.moves).toBe(1);
        expect(internal.board[14]).toBe(14);
        await processor.onData(UP, context); // gap on the bottom row: nothing below
        expect(internal.moves).toBe(1);
    });

    it('accepts WASD as well as the arrows', async () => {
        const { processor, internal, context } =
            await startWith(ONE_FROM_SOLVED);
        await processor.onData('s', context); // like Down: 11 slides down
        expect(internal.board[14]).toBe(11);
        await processor.onData(UP, context);
        expect(internal.board[14]).toBe(0);
    });

    it('wins on the solving move and saves the best moves and time', async () => {
        const { processor, internal, context, state$ } =
            await startWith(ONE_FROM_SOLVED);
        await processor.onData(LEFT, context); // 15 slides left: solved
        expect(internal.gameWon).toBeTrue();
        await Promise.resolve();
        expect(state$.value['fifteenPuzzleBest']['4']).toEqual(
            jasmine.objectContaining({ moves: 1, time: 0 }),
        );
        expect(context.state.persist).toHaveBeenCalled();
    });

    it('keeps the better of the old and new results per size', async () => {
        const { processor, context, state$ } = await startWith(
            ONE_FROM_SOLVED,
            4,
            {
                fifteenPuzzleBest: {
                    '4': { moves: 1, time: 0, date: 'x' },
                    '3': { moves: 9, time: 9, date: 'y' },
                },
            },
        );
        await processor.onData(LEFT, context);
        expect(context.state.updateState).not.toHaveBeenCalled();
        expect(state$.value['fifteenPuzzleBest']['3'].moves).toBe(9);
    });

    it('ignores moves after the win; R starts a new game and Q quits', async () => {
        const { processor, internal, context } =
            await startWith(ONE_FROM_SOLVED);
        await processor.onData(LEFT, context);
        await processor.onData(RIGHT, context);
        expect(internal.moves).toBe(1);
        await processor.onData('r', context);
        expect(internal.gameWon).toBeFalse();
        expect(internal.moves).toBe(0);
        await processor.onData(LEFT, context); // may or may not move; never throws
        internal.gameWon = true;
        await processor.onData('q', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('quits with Esc during a game', async () => {
        const { processor, context } = await startWith(ONE_FROM_SOLVED);
        await processor.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('lists and resets the best results', async () => {
        const p = new CliFifteenPuzzleCommandProcessor();
        const { context, out, state$ } = createContext({
            fifteenPuzzleBest: { '4': { moves: 120, time: 95, date: 'today' } },
        });
        await p.initialize(context);
        const [scores, reset] = p.processors!;
        await scores.processCommand({} as any, context);
        expect(
            out.lines.some((l) => l.includes('120') && l.includes('01:35')),
        ).toBeTrue();
        await reset.processCommand({} as any, context);
        expect(state$.value['fifteenPuzzleBest']).toEqual({});
        await scores.processCommand({} as any, context);
        expect(out.info.length).toBe(1);
    });
});
