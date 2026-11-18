import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliConnectFourCommandProcessor } from '../lib/processors/cli-connect-four-command-processor';
import { COMPUTER, EMPTY, PLAYER } from '../lib/board';

// ── Fake context ────────────────────────────────────────────

const EMPTY_STATS = {
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
};

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        connectFourStats: { ...EMPTY_STATS },
        ...initialState,
    });
    const out = { success: [] as string[], lines: [] as string[] };
    const context: any = {
        terminal: { cols: 40, rows: 20, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        writer: {
            writeln: (t = '') => out.lines.push(t),
            writeSuccess: (t: string) => out.success.push(t),
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
        },
    };
    return { context, out, state$ };
}

async function start(initialState = {}) {
    const p = new CliConnectFourCommandProcessor();
    const env = createContext(initialState);
    await p.initialize(env.context);
    await p.processCommand(
        { command: 'connect-four', args: {} } as any,
        env.context,
    );
    return { p, internal: p as any, ...env };
}

/** Board from rows drawn top to bottom: `X` player, `O` computer, `.` empty. */
function boardOf(...rows: string[]) {
    return rows.map((line) =>
        line
            .split('')
            .map((ch) => (ch === 'X' ? PLAYER : ch === 'O' ? COMPUTER : EMPTY)),
    );
}

function discs(board: number[][]) {
    return board.flat().filter((c) => c !== EMPTY).length;
}

/** Visible text of everything written to the terminal, without ANSI codes. */
function screen(context: any): string {
    const last = context.terminal.write.calls.mostRecent().args[0] as string;
    return last.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ' ');
}

/** Rightmost column any text of the last frame reaches. */
function rightmostColumn(context: any): number {
    const frame = context.terminal.write.calls.mostRecent().args[0] as string;
    const parts = frame.split(/\x1b\[(\d+);(\d+)H/);
    let max = 0;
    for (let i = 1; i < parts.length; i += 3) {
        const text = parts[i + 2].replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
        max = Math.max(max, Number(parts[i + 1]) + [...text].length - 1);
    }
    return max;
}

describe('CliConnectFourCommandProcessor', () => {
    it('registers the command with metadata, initial stats and sub-commands', () => {
        const p = new CliConnectFourCommandProcessor();
        expect(p.command).toBe('connect-four');
        expect(p.aliases).toEqual(['connect4', 'c4']);
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({
            connectFourStats: EMPTY_STATS,
        });
        expect(p.processors!.map((x) => x.command)).toEqual([
            'easy',
            'medium',
            'hard',
            'stats',
            'reset',
        ]);
    });

    it('starts on an empty board in full-screen mode with the player first', async () => {
        const { internal, context } = await start();
        expect(context.enterFullScreenMode).toHaveBeenCalled();
        expect(discs(internal.board)).toBe(0);
        expect(internal.cursorCol).toBe(3);
        expect(screen(context)).toContain('CONNECT FOUR');
    });

    it('fits a 40-column terminal', async () => {
        const { context } = await start();
        expect(rightmostColumn(context)).toBeLessThanOrEqual(40);
    });

    it('moves the column cursor with the arrow keys and stays on the board', async () => {
        const { p, internal, context } = await start();
        for (let i = 0; i < 5; i++) await p.onData('\x1b[D', context);
        expect(internal.cursorCol).toBe(0);
        for (let i = 0; i < 9; i++) await p.onData('\x1b[C', context);
        expect(internal.cursorCol).toBe(6);
        expect(discs(internal.board)).toBe(0);
    });

    it('drops a disc with Enter and the computer answers', async () => {
        const { p, internal, context } = await start();
        await p.onData('\x1b[D', context);
        await p.onData('\r', context);
        expect(internal.board[5][2]).toBe(PLAYER);
        expect(discs(internal.board)).toBe(2);
        expect(
            internal.board.flat().filter((c: number) => c === COMPUTER).length,
        ).toBe(1);
        expect(internal.message).toMatch(/^Computer played \d\. Your turn$/);
    });

    it('drops a disc in the column of a number key', async () => {
        const { p, internal, context } = await start();
        await p.onData('7', context);
        expect(internal.board[5][6]).toBe(PLAYER);
        expect(internal.cursorCol).toBe(6);
        await p.onData('8', context);
        await p.onData('0', context);
        expect(discs(internal.board)).toBe(2);
    });

    it('refuses a full column without letting the computer move', async () => {
        const { p, internal, context } = await start();
        internal.board = boardOf(
            'XO.....',
            'OX.....',
            'XO.....',
            'OX.....',
            'XO.....',
            'OX.....',
        );
        await p.onData('1', context);
        expect(discs(internal.board)).toBe(12);
        expect(internal.message).toBe('Column 1 is full');
    });

    it('records a win and the streak', async () => {
        const { p, internal, context, state$ } = await start({
            connectFourStats: {
                ...EMPTY_STATS,
                wins: 2,
                currentStreak: 2,
                bestStreak: 2,
            },
        });
        internal.board = boardOf(
            '.......',
            '.......',
            '.......',
            '.......',
            '....OO.',
            'XXX.OO.',
        );
        await p.onData('4', context);
        expect(internal.outcome).toBe('win');
        expect(internal.win.cells.length).toBe(4);
        expect(discs(internal.board)).toBe(8);
        expect(context.state.persist).toHaveBeenCalled();
        expect(state$.value['connectFourStats']).toEqual({
            wins: 3,
            losses: 0,
            draws: 0,
            currentStreak: 3,
            bestStreak: 3,
        });
        expect(screen(context)).toContain('You win!');
    });

    it('records a loss when the computer completes four', async () => {
        const { p, internal, context, state$ } = await start({
            connectFourStats: {
                ...EMPTY_STATS,
                wins: 1,
                currentStreak: 1,
                bestStreak: 4,
            },
        });
        internal.board = boardOf(
            '.......',
            '.......',
            '.......',
            'X.....O',
            'X.....O',
            'XX....O',
        );
        // The player does not block; the computer plays the seventh column
        await p.onData('3', context);
        expect(internal.outcome).toBe('loss');
        expect(internal.board[2][6]).toBe(COMPUTER);
        expect(state$.value['connectFourStats']).toEqual({
            wins: 1,
            losses: 1,
            draws: 0,
            currentStreak: 0,
            bestStreak: 4,
        });
    });

    it('records a draw when the last disc fills the board', async () => {
        const { p, internal, context, state$ } = await start();
        internal.board = boardOf(
            '.XOOXXO',
            'OOXXOOX',
            'XXOOXXO',
            'OOXXOOX',
            'XXOOXXO',
            'OOXXOOX',
        );
        await p.onData('1', context);
        expect(internal.outcome).toBe('draw');
        expect(state$.value['connectFourStats'].draws).toBe(1);
    });

    it('ignores moves after the game ends, restarts with R (computer first) and quits with Esc', async () => {
        const { p, internal, context } = await start();
        internal.board = boardOf(
            '.......',
            '.......',
            '.......',
            '.......',
            '....OO.',
            'XXX.OO.',
        );
        await p.onData('4', context);
        expect(internal.outcome).toBe('win');

        await p.onData('1', context);
        expect(discs(internal.board)).toBe(8);

        await p.onData('r', context);
        expect(internal.outcome).toBeNull();
        // Turns alternate: the computer opens the second game
        expect(discs(internal.board)).toBe(1);

        await p.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('starts a game at the chosen difficulty', async () => {
        const p = new CliConnectFourCommandProcessor();
        const { context } = createContext();
        await p.initialize(context);
        await p
            .processors!.find((x) => x.command === 'hard')!
            .processCommand({} as any, context);
        expect((p as any).difficulty).toBe('hard');
        expect(context.enterFullScreenMode).toHaveBeenCalled();
    });

    it('"stats" prints games, wins, losses and streaks', async () => {
        const p = new CliConnectFourCommandProcessor();
        const { context, out } = createContext({
            connectFourStats: {
                wins: 3,
                losses: 1,
                draws: 0,
                currentStreak: 2,
                bestStreak: 5,
            },
        });
        await p.initialize(context);
        await p
            .processors!.find((x) => x.command === 'stats')!
            .processCommand({} as any, context);
        const text = out.lines.join('\n');
        expect(text).toMatch(/Games Played:\s+4/);
        expect(text).toMatch(/Wins:\s+3/);
        expect(text).toMatch(/Win %:\s+75%/);
        expect(text).toMatch(/Best Streak:\s+5/);
    });

    it('"reset" clears and persists the stats', async () => {
        const p = new CliConnectFourCommandProcessor();
        const { context, out, state$ } = createContext({
            connectFourStats: { ...EMPTY_STATS, wins: 9 },
        });
        await p.initialize(context);
        await p
            .processors!.find((x) => x.command === 'reset')!
            .processCommand({} as any, context);
        expect(state$.value['connectFourStats']).toEqual(EMPTY_STATS);
        expect(context.state.persist).toHaveBeenCalled();
        expect(out.success.length).toBe(1);
    });
});
