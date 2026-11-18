import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    CliKeyData,
    ICliCommandControls,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    CODE_LENGTH,
    Code,
    GuessFeedback,
    MAX_GUESSES,
    SYMBOLS,
    generateSecret,
    isWinningFeedback,
    scoreGuess,
} from '../code';

// -- Types ------------------------------------------------------------------

export interface MastermindStats {
    gamesPlayed: number;
    gamesWon: number;
    /** Fewest guesses in a won game, null before the first win */
    bestGuesses: number | null;
}

interface GuessEntry {
    code: Code;
    feedback: GuessFeedback;
}

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
        red: `${CSI}91m`,
        gray: `${CSI}90m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
};

/** Background and text colour per symbol 1..6 */
const SYMBOL_COLORS: Record<number, string> = {
    1: `${CSI}41m${CSI}97m`, // red
    2: `${CSI}42m${CSI}30m`, // green
    3: `${CSI}43m${CSI}30m`, // yellow
    4: `${CSI}44m${CSI}97m`, // blue
    5: `${CSI}45m${CSI}97m`, // magenta
    6: `${CSI}46m${CSI}30m`, // cyan
};

const EXACT_PEG = '●'; // filled circle
const PARTIAL_PEG = '○'; // hollow circle
const NO_PEG = '·'; // middle dot

// Row: "10  " + 4 pegs of 3 chars with spaces (15) + "  " + 4 feedback pegs = 25
const BOARD_WIDTH = 4 + CODE_LENGTH * 4 - 1 + 2 + CODE_LENGTH;
// The widest line is the controls hint
const HINT_WIDTH = 35;
const LAYOUT_HEIGHT = 2 + MAX_GUESSES + 1 + 6;

function emptyStats(): MastermindStats {
    return { gamesPlayed: 0, gamesWon: 0, bestGuesses: null };
}

// -- Processor --------------------------------------------------------------

export class CliMastermindCommandProcessor implements ICliCommandProcessor {
    command = 'mastermind';

    description = 'Play Mastermind, the code-breaking game, in your terminal';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '🕵️', // detective
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
            { label: '1', key: '1', data: '1', description: 'Red' },
            { label: '2', key: '2', data: '2', description: 'Green' },
            { label: '3', key: '3', data: '3', description: 'Yellow' },
            { label: '4', key: '4', data: '4', description: 'Blue' },
            { label: '5', key: '5', data: '5', description: 'Magenta' },
            { label: '6', key: '6', data: '6', description: 'Cyan' },
            {
                label: '⌫',
                key: 'Backspace',
                data: CliKeyData.backspace,
                description: 'Clear a slot',
            },
            {
                label: 'ENTER',
                key: 'Enter',
                data: CliKeyData.enter,
                description: 'Submit the guess',
            },
            {
                label: '←',
                key: 'Left',
                data: CliKeyData.left,
                description: 'Previous slot',
                repeat: true,
            },
            {
                label: '↑',
                key: 'Up',
                data: CliKeyData.up,
                description: 'Next colour',
                repeat: true,
            },
            {
                label: '↓',
                key: 'Down',
                data: CliKeyData.down,
                description: 'Previous colour',
                repeat: true,
            },
            {
                label: '→',
                key: 'Right',
                data: CliKeyData.right,
                description: 'Next slot',
                repeat: true,
            },
        ],
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            mastermindStats: emptyStats(),
        },
    };

    // -- Game state ---------------------------------------------------------

    private secret: Code = [];
    private guesses: GuessEntry[] = [];
    private current: Code = []; // 0 = empty slot
    private cursor = 0;
    private gameOver = false;
    private gameWon = false;
    private message = '';
    private stats: MastermindStats = emptyStats();

    // Layout
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // -- Lifecycle ----------------------------------------------------------

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<MastermindStats>((x) => x['mastermindStats'])
            .subscribe((stats) => {
                this.stats = stats
                    ? { ...emptyStats(), ...stats }
                    : emptyStats();
            });
    }

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        this.message = '';

        if (this.gameOver) {
            this.handleGameOverInput(data, context);
            return;
        }

        switch (data) {
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
                this.current[this.cursor] = parseInt(data, 10);
                this.cursor = Math.min(this.cursor + 1, CODE_LENGTH - 1);
                break;

            case '\x7f': // Backspace
            case '\b':
            case `${ESC}[3~`: // Delete
                this.clearSlot();
                break;

            case `${ESC}[D`: // Left
            case 'a':
            case 'A':
                this.cursor = Math.max(0, this.cursor - 1);
                break;
            case `${ESC}[C`: // Right
            case 'd':
            case 'D':
                this.cursor = Math.min(CODE_LENGTH - 1, this.cursor + 1);
                break;
            case `${ESC}[A`: // Up
            case 'w':
            case 'W':
                this.cycleSlot(1);
                break;
            case `${ESC}[B`: // Down
            case 's':
            case 'S':
                this.cycleSlot(-1);
                break;

            case '\r':
            case '\n':
                await this.submitGuess(context);
                break;

            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                return;
        }

        this.render(context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln(
            `Guess the secret code of ${CODE_LENGTH} colours (1-${SYMBOLS}, repeats allowed) in ${MAX_GUESSES} tries.`,
        );
        writer.writeln(
            `After each guess, ${EXACT_PEG} marks a right colour in the right place, ${PARTIAL_PEG} a right colour in the wrong place.`,
        );
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('mastermind', CliForegroundColor.Cyan)}             Start the game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('mastermind stats', CliForegroundColor.Cyan)}       View statistics`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('mastermind reset', CliForegroundColor.Cyan)}       Reset statistics`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('1-6', CliForegroundColor.Yellow)}                Put a colour in the slot`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Left / Right', CliForegroundColor.Yellow)}       Move between slots`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Up / Down', CliForegroundColor.Yellow)}          Change the slot's colour`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Backspace', CliForegroundColor.Yellow)}          Clear a slot`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Enter', CliForegroundColor.Yellow)}              Submit the guess`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
    }

    // -- Sub-processors -----------------------------------------------------

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'stats',
                description: 'View game statistics',
                processCommand: async (_, context) => {
                    const { writer } = context;
                    const s = this.stats;
                    const winPct =
                        s.gamesPlayed > 0
                            ? Math.round((s.gamesWon / s.gamesPlayed) * 100)
                            : 0;
                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  MASTERMIND STATISTICS',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();
                    writer.writeln(
                        `  Games Played:  ${writer.wrapInColor(`${s.gamesPlayed}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Win %:         ${writer.wrapInColor(`${winPct}%`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Best:          ${writer.wrapInColor(s.bestGuesses !== null ? `${s.bestGuesses} guesses` : '--', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                },
            },
            {
                command: 'reset',
                description: 'Reset all statistics',
                processCommand: async (_, context) => {
                    this.stats = emptyStats();
                    context.state.updateState({ mastermindStats: this.stats });
                    await context.state.persist();
                    context.writer.writeSuccess(
                        'Mastermind statistics have been reset.',
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
        this.render(context);
    }

    private stopGame(context: ICliExecutionContext): void {
        context.exitFullScreenMode();
    }

    onResize(cols: number, rows: number, context: ICliExecutionContext): void {
        this.computeLayout(context);
        this.render(context);
    }

    onDispose(_context: ICliExecutionContext): void {
        // Nothing to clean up -- no timers in a turn-based game
    }

    private resetGameState(): void {
        this.secret = generateSecret();
        this.guesses = [];
        this.current = new Array(CODE_LENGTH).fill(0);
        this.cursor = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.message = '';
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        // Centre the board, but keep the hint lines inside narrow screens
        this.offsetX = Math.max(
            1,
            Math.min(
                Math.floor((cols - BOARD_WIDTH) / 2) + 1,
                cols - HINT_WIDTH + 1,
            ),
        );
        this.offsetY = Math.max(1, Math.floor((rows - LAYOUT_HEIGHT) / 2) + 1);
    }

    // -- Input --------------------------------------------------------------

    private clearSlot(): void {
        if (this.current[this.cursor] === 0 && this.cursor > 0) {
            this.cursor--;
        }
        this.current[this.cursor] = 0;
    }

    private cycleSlot(step: number): void {
        const value = this.current[this.cursor];
        if (value === 0) {
            this.current[this.cursor] = step > 0 ? 1 : SYMBOLS;
            return;
        }
        this.current[this.cursor] =
            ((value - 1 + step + SYMBOLS) % SYMBOLS) + 1;
    }

    private async submitGuess(context: ICliExecutionContext): Promise<void> {
        if (this.current.some((v) => v === 0)) {
            this.message = `Pick ${CODE_LENGTH} colours first`;
            return;
        }

        const code = [...this.current];
        const feedback = scoreGuess(this.secret, code);
        this.guesses.push({ code, feedback });
        this.current = new Array(CODE_LENGTH).fill(0);
        this.cursor = 0;

        if (isWinningFeedback(feedback)) {
            this.gameOver = true;
            this.gameWon = true;
        } else if (this.guesses.length >= MAX_GUESSES) {
            this.gameOver = true;
        }

        if (this.gameOver) {
            await this.updateStats(context);
        }
    }

    private async updateStats(context: ICliExecutionContext): Promise<void> {
        const stats = { ...this.stats };
        stats.gamesPlayed++;
        if (this.gameWon) {
            stats.gamesWon++;
            const guesses = this.guesses.length;
            if (stats.bestGuesses === null || guesses < stats.bestGuesses) {
                stats.bestGuesses = guesses;
            }
        }
        this.stats = stats;
        context.state.updateState({ mastermindStats: { ...stats } });
        await context.state.persist();
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

        const x = this.offsetX;
        let row = this.offsetY;

        // -- Title ----------------------------------------------------------
        const title = 'M A S T E R M I N D';
        buf.push(
            ansi.cursorTo(
                row,
                x + Math.max(0, Math.floor((BOARD_WIDTH - title.length) / 2)),
            ),
            ansi.bold,
            ansi.fg.yellow,
            title,
            ansi.reset,
        );
        row += 2;

        // -- Guess rows -----------------------------------------------------
        for (let i = 0; i < MAX_GUESSES; i++) {
            buf.push(ansi.cursorTo(row++, x));
            const isCurrent = !this.gameOver && i === this.guesses.length;
            buf.push(
                isCurrent ? ansi.fg.white + ansi.bold : ansi.fg.gray,
                `${i + 1}`.padStart(2),
                ansi.reset,
                '  ',
            );

            const entry = this.guesses[i];
            if (entry) {
                buf.push(
                    this.pegs(entry.code, -1),
                    '  ',
                    this.feedbackPegs(entry.feedback),
                );
            } else if (isCurrent) {
                buf.push(this.pegs(this.current, this.cursor));
            } else {
                buf.push(
                    ansi.fg.gray,
                    Array(CODE_LENGTH).fill(` ${NO_PEG} `).join(' '),
                    ansi.reset,
                );
            }
        }
        row += 1;

        // -- Result / message -----------------------------------------------
        buf.push(ansi.cursorTo(row++, x));
        if (this.gameWon) {
            const n = this.guesses.length;
            buf.push(
                ansi.bold,
                ansi.fg.brightGreen,
                `Cracked in ${n} ${n === 1 ? 'guess' : 'guesses'}!`,
                ansi.reset,
            );
        } else if (this.gameOver) {
            buf.push(
                ansi.bold,
                ansi.fg.red,
                'Code: ',
                ansi.reset,
                this.pegs(this.secret, -1),
            );
        } else if (this.message) {
            buf.push(ansi.bold, ansi.fg.red, this.message, ansi.reset);
        } else {
            buf.push(
                ansi.fg.gray,
                `${EXACT_PEG} right place  ${PARTIAL_PEG} wrong place`,
                ansi.reset,
            );
        }

        // -- Stats ----------------------------------------------------------
        const s = this.stats;
        buf.push(ansi.cursorTo(row++, x));
        buf.push(
            ansi.dim,
            `Played: ${s.gamesPlayed}  Won: ${s.gamesWon}  Best: ${s.bestGuesses ?? '--'}`,
            ansi.reset,
        );

        // -- Controls hint --------------------------------------------------
        row += 1;
        buf.push(ansi.cursorTo(row++, x));
        if (this.gameOver) {
            buf.push(ansi.dim, '[R] New game  [Q] Quit', ansi.reset);
        } else {
            buf.push(
                ansi.dim,
                '[1-6] Colour  [←→] Slot  [↑↓] Cycle',
                ansi.reset,
            );
            buf.push(ansi.cursorTo(row, x));
            buf.push(
                ansi.dim,
                '[⌫] Del  [Enter] Guess  [Esc] Quit',
                ansi.reset,
            );
        }

        context.terminal.write(buf.join(''));
    }

    /** Coloured pegs; the slot at `cursor` is bracketed (-1 for none). */
    private pegs(code: Code, cursor: number): string {
        return code
            .map((value, i) => {
                const selected = i === cursor;
                if (value === 0) {
                    return selected
                        ? `${ansi.bold}${ansi.fg.white}[_]${ansi.reset}`
                        : `${ansi.fg.gray} ${NO_PEG} ${ansi.reset}`;
                }
                const text = selected ? `[${value}]` : ` ${value} `;
                return `${SYMBOL_COLORS[value]}${ansi.bold}${text}${ansi.reset}`;
            })
            .join(' ');
    }

    private feedbackPegs(feedback: GuessFeedback): string {
        const none = CODE_LENGTH - feedback.exact - feedback.partial;
        return (
            ansi.fg.brightGreen +
            EXACT_PEG.repeat(feedback.exact) +
            ansi.fg.yellow +
            PARTIAL_PEG.repeat(feedback.partial) +
            ansi.fg.gray +
            NO_PEG.repeat(none) +
            ansi.reset
        );
    }
}
