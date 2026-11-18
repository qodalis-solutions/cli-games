import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliHangmanCommandProcessor } from '../lib/processors/cli-hangman-command-processor';
import { WORD_LIST } from '../lib/words';

// ── Fake context ────────────────────────────────────────────

const EMPTY_STATS = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
};

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        hangmanStats: { ...EMPTY_STATS },
        ...initialState,
    });
    const out = { success: [] as string[], lines: [] as string[] };
    const context: any = {
        terminal: { cols: 40, rows: 24, write: jasmine.createSpy('write') },
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

/** Start a game whose answer is `target` (must be in WORD_LIST). */
async function startWith(target: string, initialState = {}) {
    const index = WORD_LIST.findIndex((w) => w.word === target);
    if (index < 0) throw new Error(`${target} is not in WORD_LIST`);
    spyOn(Math, 'random').and.returnValue((index + 0.5) / WORD_LIST.length);
    const p = new CliHangmanCommandProcessor();
    const env = createContext(initialState);
    await p.initialize(env.context);
    await p.processCommand(
        { command: 'hangman', args: {} } as any,
        env.context,
    );
    return { p, internal: p as any, ...env };
}

async function type(p: CliHangmanCommandProcessor, context: any, text: string) {
    for (const ch of text) await p.onData(ch, context);
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

function screen(context: any): string {
    const frame = context.terminal.write.calls.mostRecent().args[0] as string;
    return frame.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

describe('CliHangmanCommandProcessor', () => {
    it('registers the command with metadata, initial stats and sub-commands', () => {
        const p = new CliHangmanCommandProcessor();
        expect(p.command).toBe('hangman');
        expect(p.metadata?.module).toBe('games');
        expect(p.controls.textInput).toBeTrue();
        expect(p.stateConfiguration?.initialState).toEqual({
            hangmanStats: EMPTY_STATS,
        });
        expect(p.processors!.map((x) => x.command)).toEqual(['stats', 'reset']);
    });

    it('picks a word and shows its category', async () => {
        const { internal, context } = await startWith('penguin');
        expect(internal.game.word).toBe('penguin');
        expect(internal.category).toBe('Animals');
        expect(context.enterFullScreenMode).toHaveBeenCalled();
        expect(screen(context)).toContain('Category: Animals');
    });

    it('fits a 40-column terminal, even with the longest word', async () => {
        const { p, context } = await startWith('volleyball');
        await type(p, context, 'qwxzjk');
        expect(rightmostColumn(context)).toBeLessThanOrEqual(40);
    });

    it('guesses typed letters and reports hits, misses and repeats', async () => {
        const { p, internal, context } = await startWith('penguin');
        await p.onData('N', context);
        expect(internal.message).toBe('N is in the word');
        await p.onData('z', context);
        expect(internal.message).toBe('No Z');
        await p.onData('z', context);
        expect(internal.message).toBe('You already tried Z');
        expect(internal.game.misses).toEqual(['z']);
        expect(internal.game.masked()).toBe('_ _ N _ _ _ N');
        // the selection follows the typed letter
        expect(internal.cursor).toBe(25);
    });

    it('selects letters with the arrow keys and guesses with Enter', async () => {
        const { p, internal, context } = await startWith('penguin');
        await p.onData('\x1b[D', context); // A -> Z (wraps)
        expect(internal.cursor).toBe(25);
        await p.onData('\x1b[C', context); // Z -> A
        await p.onData('\x1b[B', context); // A -> N
        expect(internal.cursor).toBe(13);
        await p.onData('\r', context);
        expect(internal.game.hasGuessed('n')).toBeTrue();
        await p.onData('\x1b[A', context); // N -> A
        expect(internal.cursor).toBe(0);
        await p.onData(' ', context);
        expect(internal.game.misses).toEqual(['a']);
    });

    it('wins when the word is complete and records the streak', async () => {
        const { p, internal, context, state$ } = await startWith('penguin', {
            hangmanStats: {
                gamesPlayed: 2,
                gamesWon: 2,
                currentStreak: 2,
                bestStreak: 2,
            },
        });
        await type(p, context, 'xpenguin');
        expect(internal.game.won).toBeTrue();
        expect(internal.message).toBe('Saved! You win');
        expect(context.state.persist).toHaveBeenCalled();
        expect(state$.value['hangmanStats']).toEqual({
            gamesPlayed: 3,
            gamesWon: 3,
            currentStreak: 3,
            bestStreak: 3,
        });
    });

    it('loses after six misses, reveals the word and resets the streak', async () => {
        const { p, internal, context, state$ } = await startWith('penguin', {
            hangmanStats: {
                gamesPlayed: 4,
                gamesWon: 3,
                currentStreak: 3,
                bestStreak: 5,
            },
        });
        await type(p, context, 'abcdfh');
        expect(internal.game.lost).toBeTrue();
        expect(screen(context)).toContain('P E N G U I N');
        expect(state$.value['hangmanStats']).toEqual({
            gamesPlayed: 5,
            gamesWon: 3,
            currentStreak: 0,
            bestStreak: 5,
        });
    });

    it('treats "q" as a guess during play, Esc quits, "R" restarts after game over', async () => {
        const { p, internal, context } = await startWith('penguin');
        await p.onData('q', context);
        expect(internal.game.misses).toEqual(['q']);
        expect(context.exitFullScreenMode).not.toHaveBeenCalled();

        await type(p, context, 'penguin');
        expect(internal.game.over).toBeTrue();
        await p.onData('a', context);
        expect(internal.game.misses).toEqual(['q']);

        await p.onData('r', context);
        expect(internal.game.over).toBeFalse();
        expect(internal.game.guesses).toEqual([]);

        await p.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('"stats" prints games, win percentage and streaks', async () => {
        const p = new CliHangmanCommandProcessor();
        const { context, out } = createContext({
            hangmanStats: {
                gamesPlayed: 4,
                gamesWon: 3,
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
        expect(text).toMatch(/Win %:\s+75%/);
        expect(text).toMatch(/Streak:\s+2/);
        expect(text).toMatch(/Best Streak:\s+5/);
    });

    it('"reset" clears and persists the stats', async () => {
        const p = new CliHangmanCommandProcessor();
        const { context, out, state$ } = createContext({
            hangmanStats: { ...EMPTY_STATS, gamesPlayed: 9 },
        });
        await p.initialize(context);
        await p
            .processors!.find((x) => x.command === 'reset')!
            .processCommand({} as any, context);
        expect(state$.value['hangmanStats']).toEqual(EMPTY_STATS);
        expect(context.state.persist).toHaveBeenCalled();
        expect(out.success.length).toBe(1);
    });
});
