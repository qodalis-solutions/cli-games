import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliManagedInterval,
    CliKeyData,
    ICliCommandControls,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    Board,
    Direction,
    MAX_SIZE,
    MIN_SIZE,
    isSolved,
    shuffleBoard,
    slide,
} from '../board';

// -- Types ------------------------------------------------------------------

export interface FifteenPuzzleBest {
    moves: number;
    time: number;
    date: string;
}

/** Best results per board size, keyed by the size ('3', '4', '5'). */
export type FifteenPuzzleBestRecords = Record<string, FifteenPuzzleBest>;

// -- ANSI helpers -----------------------------------------------------------

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    fg: {
        white: `${CSI}97m`,
        black: `${CSI}30m`,
        cyan: `${CSI}36m`,
        yellow: `${CSI}93m`,
        brightGreen: `${CSI}92m`,
        gray: `${CSI}90m`,
    },
    bg: {
        blue: `${CSI}44m`,
        green: `${CSI}42m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
};

// Box-drawing characters
const BOX = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    teeDown: '┬',
    teeUp: '┴',
    teeRight: '├',
    teeLeft: '┤',
    cross: '┼',
};

const DEFAULT_SIZE = 4;
const CELL_WIDTH = 6; // a 5x5 board stays within 40 columns: 1 + 5 * 7 = 36
const HUD_HEIGHT = 5;
const HINT_WIDTH = 33; // the widest HUD line, the controls hint

// -- Processor --------------------------------------------------------------

export class CliFifteenPuzzleCommandProcessor implements ICliCommandProcessor {
    command = 'fifteen';

    description = 'Play the 15-puzzle (sliding tiles) in your terminal';

    aliases = ['fifteen-puzzle', '15puzzle'];

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'size',
            description: `Board size, ${MIN_SIZE} to ${MAX_SIZE} (default ${DEFAULT_SIZE})`,
            required: false,
            type: 'number',
            defaultValue: DEFAULT_SIZE,
        },
    ];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '🧩', // puzzle piece
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    controls: ICliCommandControls = {
        swipe: true,
        keys: [
            {
                label: 'ESC',
                key: 'Esc',
                data: CliKeyData.escape,
                description: 'Quit',
            },
            { label: 'NEW', key: 'R', data: 'r', description: 'New game' },
            {
                label: '←',
                key: 'Left',
                data: CliKeyData.left,
                description: 'Left',
                repeat: true,
            },
            {
                label: '↑',
                key: 'Up',
                data: CliKeyData.up,
                description: 'Up',
                repeat: true,
            },
            {
                label: '↓',
                key: 'Down',
                data: CliKeyData.down,
                description: 'Down',
                repeat: true,
            },
            {
                label: '→',
                key: 'Right',
                data: CliKeyData.right,
                description: 'Right',
                repeat: true,
            },
        ],
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            fifteenPuzzleBest: {},
        },
    };

    // -- Game state ---------------------------------------------------------

    private size = DEFAULT_SIZE;
    private board: Board = [];
    private moves = 0;
    private gameWon = false;
    private newRecord = false;
    private startTime = 0; // 0 until the first move
    private elapsedSeconds = 0;
    private timerHandle: ICliManagedInterval | null = null;
    private best: FifteenPuzzleBestRecords = {};
    private context: ICliExecutionContext | null = null;

    // Layout
    private offsetX = 0;
    private offsetY = 0;
    private cellHeight = 3;

    constructor() {
        this.registerSubProcessors();
    }

    // -- Lifecycle ----------------------------------------------------------

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<FifteenPuzzleBestRecords>((x) => x['fifteenPuzzleBest'])
            .subscribe((best) => {
                this.best = best ?? {};
            });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const size = Number(command.args?.['size'] ?? DEFAULT_SIZE);
        if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
            context.writer.writeError(
                `The size must be a whole number from ${MIN_SIZE} to ${MAX_SIZE}.`,
            );
            return;
        }
        this.context = context;
        this.size = size;
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.gameWon) {
            this.handleGameOverInput(data, context);
            return;
        }

        switch (data) {
            case `${ESC}[A`: // Up
            case 'w':
            case 'W':
                this.move('up', context);
                return;
            case `${ESC}[B`: // Down
            case 's':
            case 'S':
                this.move('down', context);
                return;
            case `${ESC}[D`: // Left
            case 'a':
            case 'A':
                this.move('left', context);
                return;
            case `${ESC}[C`: // Right
            case 'd':
            case 'D':
                this.move('right', context);
                return;
            case 'r':
            case 'R':
                this.startGame(context);
                return;
            case ESC:
                this.stopGame(context);
                return;
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('fifteen', CliForegroundColor.Cyan)}               Start a 4x4 game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('fifteen --size=3', CliForegroundColor.Cyan)}      Start a 3x3 game (3 to 5)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('fifteen scores', CliForegroundColor.Cyan)}        View best moves and times`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('fifteen reset', CliForegroundColor.Cyan)}         Reset best results`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Arrow keys / WASD', CliForegroundColor.Yellow)}  Slide a tile into the gap`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                  New game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
    }

    // -- Sub-processors -----------------------------------------------------

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'scores',
                description: 'View best moves and times for each size',
                processCommand: async (_, context) => {
                    const { writer } = context;
                    const sizes = Object.keys(this.best).sort();
                    if (sizes.length === 0) {
                        writer.writeInfo(
                            'No results yet. Solve a puzzle first!',
                        );
                        return;
                    }
                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  15-PUZZLE BEST RESULTS',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();
                    for (const size of sizes) {
                        const best = this.best[size];
                        writer.writeln(
                            `  ${writer.wrapInColor(`${size}x${size}`, CliForegroundColor.Cyan)}  ${`${best.moves}`.padStart(4)} moves  ${formatTime(best.time)}  ${best.date}`,
                        );
                    }
                    writer.writeln();
                },
            },
            {
                command: 'reset',
                description: 'Reset all best results',
                processCommand: async (_, context) => {
                    this.best = {};
                    context.state.updateState({ fifteenPuzzleBest: {} });
                    await context.state.persist();
                    context.writer.writeSuccess(
                        'Best results have been reset.',
                    );
                },
            },
        ];
    }

    // -- Game lifecycle -----------------------------------------------------

    private startGame(context: ICliExecutionContext): void {
        this.resetGameState();
        this.computeLayout(context);
        context.enterFullScreenMode(this);
        this.startTimer(context);
        this.render(context);
    }

    private stopGame(context: ICliExecutionContext): void {
        this.stopTimer();
        context.exitFullScreenMode();
        this.context = null;
    }

    onResize(cols: number, rows: number, context: ICliExecutionContext): void {
        this.computeLayout(context);
        this.render(context);
    }

    onDispose(_context: ICliExecutionContext): void {
        this.stopTimer();
    }

    private resetGameState(): void {
        this.board = shuffleBoard(this.size);
        this.moves = 0;
        this.gameWon = false;
        this.newRecord = false;
        this.startTime = 0;
        this.elapsedSeconds = 0;
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        // Tall cells (3 lines) when they fit, single-line cells on short screens
        const tallHeight = 2 + 1 + this.size * 4 + HUD_HEIGHT;
        this.cellHeight = rows >= tallHeight ? 3 : 1;

        const gridWidth = 1 + this.size * (CELL_WIDTH + 1);
        const gridHeight = 1 + this.size * (this.cellHeight + 1);
        // Centre the grid, but keep the hint inside narrow screens
        this.offsetX = Math.max(
            1,
            Math.min(
                Math.floor((cols - gridWidth) / 2) + 1,
                cols - HINT_WIDTH + 1,
            ),
        );
        this.offsetY = Math.max(
            1,
            Math.floor((rows - gridHeight - 2 - HUD_HEIGHT) / 2) + 1,
        );
    }

    // -- Timer --------------------------------------------------------------

    private startTimer(context: ICliExecutionContext): void {
        this.stopTimer();
        this.timerHandle = context.createInterval(() => {
            if (this.gameWon || this.startTime === 0) return;
            const prev = this.elapsedSeconds;
            this.elapsedSeconds = Math.floor(
                (Date.now() - this.startTime) / 1000,
            );
            if (this.elapsedSeconds !== prev && this.context) {
                this.render(this.context);
            }
        }, 500);
    }

    private stopTimer(): void {
        if (this.timerHandle !== null) {
            this.timerHandle.clear();
            this.timerHandle = null;
        }
    }

    // -- Moves --------------------------------------------------------------

    private move(direction: Direction, context: ICliExecutionContext): void {
        const next = slide(this.board, this.size, direction);
        if (!next) return;

        if (this.startTime === 0) {
            this.startTime = Date.now();
        }
        this.board = next;
        this.moves++;

        if (isSolved(this.board)) {
            this.handleWin(context);
            return;
        }
        this.render(context);
    }

    private async handleWin(context: ICliExecutionContext): Promise<void> {
        this.gameWon = true;
        this.stopTimer();
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);

        const key = `${this.size}`;
        const current = this.best[key];
        const moves = Math.min(this.moves, current?.moves ?? Infinity);
        const time = Math.min(this.elapsedSeconds, current?.time ?? Infinity);
        this.newRecord =
            !current || moves < current.moves || time < current.time;

        if (this.newRecord) {
            this.best = {
                ...this.best,
                [key]: { moves, time, date: new Date().toLocaleDateString() },
            };
        }
        // After the record is set, so the HUD's best shows it
        this.render(context);

        if (this.newRecord) {
            // onData gets the engine's context, whose state is the shared
            // store: save to this command's store, where initialize reads it
            const state = (this.context ?? context).state;
            state.updateState({ fifteenPuzzleBest: this.best });
            await state.persist();
        }
    }

    private handleGameOverInput(
        data: string,
        context: ICliExecutionContext,
    ): void {
        switch (data) {
            case 'r':
            case 'R':
            case '\r':
                this.startGame(context);
                break;
            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                break;
        }
    }

    // -- Rendering ----------------------------------------------------------

    private render(context: ICliExecutionContext): void {
        const buf: string[] = [];
        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        const size = this.size;
        const gridWidth = 1 + size * (CELL_WIDTH + 1);
        let row = this.offsetY;

        // -- Title ----------------------------------------------------------
        const title = size === 4 ? '15-PUZZLE' : `${size * size - 1}-PUZZLE`;
        buf.push(
            ansi.cursorTo(
                row,
                this.offsetX +
                    Math.max(0, Math.floor((gridWidth - title.length) / 2)),
            ),
            ansi.bold,
            ansi.fg.yellow,
            title,
            ansi.reset,
        );
        row += 2;

        // -- Grid -----------------------------------------------------------
        buf.push(ansi.cursorTo(row++, this.offsetX));
        buf.push(
            ansi.fg.gray,
            this.borderLine(BOX.topLeft, BOX.teeDown, BOX.topRight),
            ansi.reset,
        );

        for (let r = 0; r < size; r++) {
            for (let line = 0; line < this.cellHeight; line++) {
                const middle = line === Math.floor(this.cellHeight / 2);
                buf.push(ansi.cursorTo(row++, this.offsetX));
                for (let c = 0; c < size; c++) {
                    buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);
                    buf.push(this.cellText(r * size + c, middle));
                }
                buf.push(ansi.fg.gray, BOX.vertical, ansi.reset);
            }
            buf.push(ansi.cursorTo(row++, this.offsetX));
            buf.push(
                ansi.fg.gray,
                r < size - 1
                    ? this.borderLine(BOX.teeRight, BOX.cross, BOX.teeLeft)
                    : this.borderLine(
                          BOX.bottomLeft,
                          BOX.teeUp,
                          BOX.bottomRight,
                      ),
                ansi.reset,
            );
        }

        // -- HUD ------------------------------------------------------------
        row += 1;
        const best = this.best[`${size}`];
        buf.push(ansi.cursorTo(row++, this.offsetX));
        buf.push(
            ansi.fg.white,
            `Moves: ${this.moves}`,
            ansi.fg.gray,
            '  |  ',
            ansi.fg.white,
            `⏱ ${formatTime(this.elapsedSeconds)}`,
            ansi.reset,
        );
        buf.push(ansi.cursorTo(row++, this.offsetX));
        buf.push(
            ansi.fg.gray,
            'Best: ',
            ansi.fg.yellow,
            best ? `${best.moves} moves  ${formatTime(best.time)}` : '--',
            ansi.reset,
        );

        buf.push(ansi.cursorTo(row++, this.offsetX));
        if (this.gameWon) {
            buf.push(
                ansi.bold,
                ansi.fg.brightGreen,
                this.newRecord ? 'Solved! New record!' : 'Solved!',
                ansi.reset,
            );
            buf.push(ansi.cursorTo(row, this.offsetX));
            buf.push(ansi.dim, '[R] New game  [Q] Quit', ansi.reset);
        } else {
            buf.push(ansi.dim, '[←↑↓→] Slide  [R] New  [Esc] Quit', ansi.reset);
        }

        context.terminal.write(buf.join(''));
    }

    private borderLine(left: string, middle: string, right: string): string {
        const segment = BOX.horizontal.repeat(CELL_WIDTH);
        return left + Array(this.size).fill(segment).join(middle) + right;
    }

    private cellText(index: number, middle: boolean): string {
        const tile = this.board[index];
        if (tile === 0) {
            return ' '.repeat(CELL_WIDTH);
        }
        // Tiles already in their solved place are green
        const bg = tile === index + 1 ? ansi.bg.green : ansi.bg.blue;
        const label = middle ? `${tile}` : '';
        const left = Math.floor((CELL_WIDTH - label.length) / 2);
        const text =
            ' '.repeat(left) +
            label +
            ' '.repeat(CELL_WIDTH - left - label.length);
        return `${bg}${ansi.fg.white}${ansi.bold}${text}${ansi.reset}`;
    }
}

// -- Helpers ----------------------------------------------------------------

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
