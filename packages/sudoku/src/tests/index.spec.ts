import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CliSudokuCommandProcessor } from '../lib/processors/cli-sudoku-command-processor';

function createContext() {
    const state$ = new BehaviorSubject<Record<string, any>>({
        sudokuBestTimes: { easy: null, medium: null, hard: null },
    });
    const context: any = {
        terminal: { cols: 80, rows: 40, write: jasmine.createSpy('write') },
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
        createInterval: jasmine
            .createSpy('createInterval')
            .and.returnValue({ clear: jasmine.createSpy('clear') }),
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
    return { context, state$ };
}

describe('CliSudokuCommandProcessor', () => {
    it('processor instance should be created', () => {
        const processor = new CliSudokuCommandProcessor();
        expect(processor).toBeDefined();
    });

    it('should have correct command name', () => {
        const processor = new CliSudokuCommandProcessor();
        expect(processor.command).toBe('sudoku');
    });

    it("saves the best time to the command's store, not the engine's", async () => {
        const p = new CliSudokuCommandProcessor();
        const { context, state$ } = createContext();
        await p.initialize(context);
        await p.processCommand({ command: 'sudoku', args: {} } as any, context);
        // Every cell solved but the one under the cursor
        const internal = p as any;
        internal.playerGrid = internal.solution.map((row: number[]) => [
            ...row,
        ]);
        internal.given = internal.given.map((row: boolean[]) =>
            row.map(() => true),
        );
        internal.given[0][0] = false;
        internal.playerGrid[0][0] = 0;
        internal.cursorRow = 0;
        internal.cursorCol = 0;

        // Keys reach onData with the engine's context, whose state is the
        // shared store (initialize reads the command's own store)
        const engine = createContext();
        await p.onData(`${internal.solution[0][0]}`, {
            ...context,
            state: engine.context.state,
        });
        await Promise.resolve();

        expect(internal.gameWon).toBeTrue();
        expect(state$.value['sudokuBestTimes'].easy).not.toBeNull();
        expect(engine.context.state.updateState).not.toHaveBeenCalled();
    });
});
