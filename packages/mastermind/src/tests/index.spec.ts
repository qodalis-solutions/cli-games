import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
    CODE_LENGTH,
    MAX_GUESSES,
    SYMBOLS,
    generateSecret,
    isWinningFeedback,
    scoreGuess,
} from '../lib/code';
import { CliMastermindCommandProcessor } from '../lib/processors/cli-mastermind-command-processor';

// ── Fake context ────────────────────────────────────────────

function createContext(initialState: Record<string, any> = {}) {
    const state$ = new BehaviorSubject<Record<string, any>>({
        mastermindStats: { gamesPlayed: 0, gamesWon: 0, bestGuesses: null },
        ...initialState,
    });
    const out = {
        info: [] as string[],
        success: [] as string[],
        lines: [] as string[],
    };
    const context: any = {
        terminal: { cols: 40, rows: 30, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        writer: {
            writeln: (t = '') => out.lines.push(t),
            writeInfo: (t: string) => out.info.push(t),
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
            getState: () => state$.value,
        },
    };
    return { context, out, state$ };
}

const ENTER = '\r';
const BACKSPACE = '\x7f';
const LEFT = '\x1b[D';
const RIGHT = '\x1b[C';
const UP = '\x1b[A';
const DOWN = '\x1b[B';

/** Starts a game, then replaces the secret with a known code. */
async function startWith(secret: number[], state: Record<string, any> = {}) {
    const processor = new CliMastermindCommandProcessor();
    const { context, out, state$ } = createContext(state);
    await processor.initialize(context);
    await processor.processCommand(
        { command: 'mastermind', args: {} } as any,
        context,
    );
    const internal = processor as any;
    internal.secret = [...secret];
    return { processor, internal, context, out, state$ };
}

async function type(
    processor: CliMastermindCommandProcessor,
    context: any,
    keys: string,
) {
    for (const key of keys) {
        await processor.onData(key, context);
    }
}

/** The text of the last frame without ANSI codes, one entry per cursor move. */
function frameLines(context: any): { col: number; text: string }[] {
    const output: string = context.terminal.write.calls.mostRecent().args[0];
    const cols = [...output.matchAll(/\x1b\[\d+;(\d+)H/g)].map((m) => +m[1]);
    return output
        .split(/\x1b\[\d+;\d+H/)
        .slice(1)
        .map((t, i) => ({
            col: cols[i],
            text: t.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''),
        }));
}

describe('Mastermind scoring', () => {
    const cases: [number[], number[], number, number][] = [
        // secret, guess, exact, partial
        [[1, 2, 3, 4], [1, 2, 3, 4], 4, 0],
        [[1, 2, 3, 4], [4, 3, 2, 1], 0, 4],
        [[1, 2, 3, 4], [5, 6, 5, 6], 0, 0],
        [[1, 2, 3, 4], [1, 3, 5, 6], 1, 1],
        // Duplicates in the guess count once per secret symbol
        [[1, 2, 3, 4], [1, 1, 1, 1], 1, 0],
        [[1, 2, 3, 4], [2, 2, 2, 2], 1, 0],
        [[1, 2, 3, 4], [1, 1, 2, 2], 1, 1],
        [[1, 2, 3, 4], [5, 1, 1, 5], 0, 1],
        // Duplicates in the secret
        [[1, 1, 2, 2], [1, 2, 1, 2], 2, 2],
        [[1, 1, 2, 2], [2, 2, 1, 1], 0, 4],
        [[1, 1, 2, 2], [1, 3, 3, 3], 1, 0],
        [[1, 1, 2, 2], [3, 1, 1, 3], 1, 1],
        [[6, 6, 6, 6], [6, 1, 6, 1], 2, 0],
        [[1, 1, 1, 2], [2, 1, 1, 1], 2, 2],
        [[3, 3, 5, 5], [5, 3, 3, 3], 1, 2],
    ];

    for (const [secret, guess, exact, partial] of cases) {
        it(`${secret.join('')} vs ${guess.join('')}: ${exact} exact, ${partial} partial`, () => {
            expect(scoreGuess(secret, guess)).toEqual({ exact, partial });
        });
    }

    it('is symmetric in exact + partial', () => {
        const random = (() => {
            let s = 7;
            return () => (s = (s * 16807) % 2147483647) / 2147483647;
        })();
        for (let i = 0; i < 200; i++) {
            const a = generateSecret(random);
            const b = generateSecret(random);
            const ab = scoreGuess(a, b);
            const ba = scoreGuess(b, a);
            expect(ab.exact + ab.partial).toBe(ba.exact + ba.partial);
            expect(ab.exact + ab.partial).toBeLessThanOrEqual(CODE_LENGTH);
        }
    });

    it('wins only on all exact', () => {
        expect(isWinningFeedback({ exact: 4, partial: 0 })).toBeTrue();
        expect(isWinningFeedback({ exact: 3, partial: 1 })).toBeFalse();
        expect(isWinningFeedback({ exact: 0, partial: 4 })).toBeFalse();
    });

    it('generates codes of 4 symbols from 1 to 6', () => {
        expect(generateSecret(() => 0)).toEqual([1, 1, 1, 1]);
        expect(generateSecret(() => 0.9999)).toEqual([6, 6, 6, 6]);
        for (let i = 0; i < 100; i++) {
            const code = generateSecret();
            expect(code.length).toBe(CODE_LENGTH);
            expect(code.every((v) => v >= 1 && v <= SYMBOLS)).toBeTrue();
        }
    });
});

describe('CliMastermindCommandProcessor', () => {
    it('registers the mastermind command in the games module', () => {
        const p = new CliMastermindCommandProcessor();
        expect(p.command).toBe('mastermind');
        expect(p.metadata?.module).toBe('games');
        expect(p.stateConfiguration?.initialState).toEqual({
            mastermindStats: { gamesPlayed: 0, gamesWon: 0, bestGuesses: null },
        });
        expect(p.processors!.map((x) => x.command)).toEqual(['stats', 'reset']);
    });

    it('starts in full-screen mode with an empty board', async () => {
        const { internal, context } = await startWith([1, 2, 3, 4]);
        expect(context.enterFullScreenMode).toHaveBeenCalled();
        expect(internal.guesses).toEqual([]);
        expect(internal.current).toEqual([0, 0, 0, 0]);
    });

    it('takes a typed guess and scores it', async () => {
        const { processor, internal, context } = await startWith([1, 2, 3, 4]);
        await type(processor, context, '1356' + ENTER);
        expect(internal.guesses.length).toBe(1);
        expect(internal.guesses[0]).toEqual({
            code: [1, 3, 5, 6],
            feedback: { exact: 1, partial: 1 },
        });
        expect(internal.current).toEqual([0, 0, 0, 0]);
    });

    it('ignores digits outside 1-6 and refuses an incomplete guess', async () => {
        const { processor, internal, context } = await startWith([1, 2, 3, 4]);
        await type(processor, context, '0789' + '12' + ENTER);
        expect(internal.guesses.length).toBe(0);
        expect(internal.current).toEqual([1, 2, 0, 0]);
        expect(internal.message).toContain('Pick');
    });

    it('clears slots with Backspace, last typed first', async () => {
        const { processor, internal, context } = await startWith([1, 2, 3, 4]);
        await type(processor, context, '1234');
        await processor.onData(BACKSPACE, context);
        expect(internal.current).toEqual([1, 2, 3, 0]);
        await processor.onData(BACKSPACE, context);
        expect(internal.current).toEqual([1, 2, 0, 0]);
    });

    it('builds a guess with the arrows alone', async () => {
        const { processor, internal, context } = await startWith([2, 6, 1, 1]);
        await processor.onData(UP, context); // 1
        await processor.onData(UP, context); // 2
        await processor.onData(RIGHT, context);
        await processor.onData(DOWN, context); // empty -> 6
        await processor.onData(RIGHT, context);
        await processor.onData(UP, context); // 1
        await processor.onData(RIGHT, context);
        await processor.onData(DOWN, context); // 6
        await processor.onData(UP, context); // wraps to 1
        await processor.onData(RIGHT, context); // stays on the last slot
        expect(internal.cursor).toBe(3);
        await processor.onData(LEFT, context);
        expect(internal.cursor).toBe(2);
        expect(internal.current).toEqual([2, 6, 1, 1]);
        await processor.onData(ENTER, context);
        expect(internal.gameWon).toBeTrue();
    });

    it('wins on the exact code and saves the best guess count', async () => {
        const { processor, internal, context, state$ } = await startWith([
            1, 1, 2, 2,
        ]);
        await type(processor, context, '1212' + ENTER);
        await type(processor, context, '1122' + ENTER);
        expect(internal.gameOver).toBeTrue();
        expect(internal.gameWon).toBeTrue();
        expect(state$.value['mastermindStats']).toEqual({
            gamesPlayed: 1,
            gamesWon: 1,
            bestGuesses: 2,
        });
        expect(context.state.persist).toHaveBeenCalled();
    });

    it("saves the stats to the command's store, not the engine's", async () => {
        const { processor, context, state$ } = await startWith([1, 1, 2, 2]);
        // Keys reach onData with the engine's context, whose state is the
        // shared store (initialize reads the command's own store)
        const engine = createContext();
        const engineContext = { ...context, state: engine.context.state };
        await type(processor, engineContext, '1122' + ENTER);
        expect(state$.value['mastermindStats'].gamesWon).toBe(1);
        expect(engine.context.state.updateState).not.toHaveBeenCalled();
    });

    it('keeps a better best score', async () => {
        const { processor, context, state$ } = await startWith([1, 1, 2, 2], {
            mastermindStats: { gamesPlayed: 4, gamesWon: 3, bestGuesses: 1 },
        });
        await type(processor, context, '6666' + ENTER + '1122' + ENTER);
        expect(state$.value['mastermindStats']).toEqual({
            gamesPlayed: 5,
            gamesWon: 4,
            bestGuesses: 1,
        });
    });

    it(`loses after ${MAX_GUESSES} wrong guesses and reveals the code`, async () => {
        const { processor, internal, context, state$ } = await startWith([
            1, 2, 3, 4,
        ]);
        for (let i = 0; i < MAX_GUESSES; i++) {
            await type(processor, context, '5555' + ENTER);
        }
        expect(internal.gameOver).toBeTrue();
        expect(internal.gameWon).toBeFalse();
        expect(state$.value['mastermindStats'].gamesPlayed).toBe(1);
        expect(state$.value['mastermindStats'].gamesWon).toBe(0);
        expect(
            frameLines(context).some((l) => l.text.startsWith('Code:')),
        ).toBeTrue();

        // No more guesses; R starts over
        await type(processor, context, '1234');
        expect(internal.guesses.length).toBe(MAX_GUESSES);
        await processor.onData('r', context);
        expect(internal.guesses.length).toBe(0);
        expect(internal.gameOver).toBeFalse();
    });

    it('fits within 40 columns with a full history', async () => {
        const { processor, context } = await startWith([1, 2, 3, 4]);
        for (let i = 0; i < MAX_GUESSES - 1; i++) {
            await type(processor, context, '4321' + ENTER);
        }
        await type(processor, context, '12');
        for (const line of frameLines(context)) {
            expect(line.col - 1 + [...line.text].length)
                .withContext(line.text)
                .toBeLessThanOrEqual(40);
        }
    });

    it('quits with Esc', async () => {
        const { processor, context } = await startWith([1, 2, 3, 4]);
        await processor.onData('\x1b', context);
        expect(context.exitFullScreenMode).toHaveBeenCalled();
    });

    it('shows and resets the statistics', async () => {
        const p = new CliMastermindCommandProcessor();
        const { context, out, state$ } = createContext({
            mastermindStats: { gamesPlayed: 4, gamesWon: 2, bestGuesses: 3 },
        });
        await p.initialize(context);
        const [stats, reset] = p.processors!;
        await stats.processCommand({} as any, context);
        expect(out.lines.some((l) => l.includes('50%'))).toBeTrue();
        expect(out.lines.some((l) => l.includes('3 guesses'))).toBeTrue();
        await reset.processCommand({} as any, context);
        expect(state$.value['mastermindStats']).toEqual({
            gamesPlayed: 0,
            gamesWon: 0,
            bestGuesses: null,
        });
    });
});
