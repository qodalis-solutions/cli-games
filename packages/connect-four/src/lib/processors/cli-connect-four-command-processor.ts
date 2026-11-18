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
    Board,
    COLS,
    COMPUTER,
    EMPTY,
    PLAYER,
    ROWS,
    Win,
    chooseMove,
    createBoard,
    dropDisc,
    findWin,
    isFull,
} from '../board';

// ── Types ────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

interface ConnectFourStats {
    wins: number;
    losses: number;
    draws: number;
    currentStreak: number;
    bestStreak: number;
}

type Outcome = 'win' | 'loss' | 'draw' | null;

// ── ANSI helpers ─────────────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    fg: {
        red: `${CSI}91m`,
        yellow: `${CSI}93m`,
        blue: `${CSI}94m`,
        green: `${CSI}92m`,
        cyan: `${CSI}36m`,
        gray: `${CSI}90m`,
        white: `${CSI}97m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    inverse: `${CSI}7m`,
    reset: `${CSI}0m`,
};

// ── Constants ────────────────────────────────────────────────────────

const DIFFICULTIES: Record<Difficulty, { label: string; depth: number }> = {
    easy: { label: 'Easy', depth: 1 },
    medium: { label: 'Medium', depth: 4 },
    hard: { label: 'Hard', depth: 6 },
};

const EMPTY_STATS: ConnectFourStats = {
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
};

// Each column is drawn as "│ ● " (4 chars), plus the closing "│"
const CELL_WIDTH = 4;
const BOARD_WIDTH = COLS * CELL_WIDTH + 1; // 29
// title(2) + cursor(1) + rows(6) + bottom(1) + numbers(1) + status(2) + hud(1) + controls(1)
const TOTAL_HEIGHT = 15;

const DISC = '\u25CF'; // ●
const HOLE = '\u00B7'; // ·

const BOX = {
    vertical: '\u2502',
    horizontal: '\u2500',
    bottomLeft: '\u2514',
    bottomRight: '\u2518',
    teeUp: '\u2534',
};

// ── Processor ────────────────────────────────────────────────────────

export class CliConnectFourCommandProcessor implements ICliCommandProcessor {
    command = 'connect-four';

    description = 'Play Connect Four against the computer in your terminal';

    aliases = ['connect4', 'c4'];

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83D\uDD34', // red circle emoji
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    controls: ICliCommandControls = {
        swipe: true,
        tap: CliKeyData.enter,
        keys: [
            {
                label: 'ESC',
                key: 'Esc',
                data: CliKeyData.escape,
                description: 'Quit',
            },
            {
                label: 'DROP',
                key: 'Enter',
                data: CliKeyData.enter,
                description: 'Drop a disc',
            },
            {
                label: '←',
                key: 'Left',
                data: CliKeyData.left,
                description: 'Left',
                repeat: true,
            },
            {
                label: '→',
                key: 'Right',
                data: CliKeyData.right,
                description: 'Right',
                repeat: true,
            },
            { label: 'R', key: 'R', data: 'r', description: 'New game' },
            ...Array.from({ length: COLS }, (_, i) => ({
                label: `${i + 1}`,
                key: `${i + 1}`,
                data: `${i + 1}`,
                description: `Drop in column ${i + 1}`,
            })),
        ],
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            connectFourStats: { ...EMPTY_STATS },
        },
    };

    // ── Game state ───────────────────────────────────────────────────

    private board: Board = createBoard();
    private cursorCol = Math.floor(COLS / 2);
    private difficulty: Difficulty = 'medium';
    private playerStarts = true;
    private outcome: Outcome = null;
    private win: Win | null = null;
    private lastComputerMove: [number, number] | null = null;
    private message = '';
    private stats: ConnectFourStats = { ...EMPTY_STATS };
    private context: ICliExecutionContext | null = null;

    // Layout
    private offsetX = 0;
    private offsetY = 0;

    constructor() {
        this.registerSubProcessors();
    }

    // ── Lifecycle ────────────────────────────────────────────────────

    async initialize(context: ICliExecutionContext): Promise<void> {
        context.state
            .select<ConnectFourStats>((x) => x['connectFourStats'])
            .subscribe((stats) => {
                if (stats) {
                    this.stats = { ...stats };
                }
            });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;
        this.difficulty = 'medium';
        this.playerStarts = true;
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.outcome) {
            this.handleGameOverInput(data, context);
            return;
        }

        switch (data) {
            case `${ESC}[D`: // Left
            case 'a':
            case 'A':
            case 'h':
                this.moveCursor(-1);
                break;
            case `${ESC}[C`: // Right
            case 'd':
            case 'D':
            case 'l':
                this.moveCursor(1);
                break;
            case '\r': // Enter
            case ' ':
            case `${ESC}[B`: // Down
            case 's':
            case 'S':
                this.playerMove(this.cursorCol);
                break;
            case 'r':
            case 'R':
                // New game, same player first (the R key of touch pads)
                this.computeLayout(context);
                this.resetGameState();
                break;
            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                return;
            default:
                if (/^[1-7]$/.test(data)) {
                    this.cursorCol = Number(data) - 1;
                    this.playerMove(this.cursorCol);
                }
                break;
        }

        this.render(context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('connect-four', CliForegroundColor.Cyan)}            Start a game (medium)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('connect-four easy', CliForegroundColor.Cyan)}       Start an easy game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('connect-four hard', CliForegroundColor.Cyan)}       Start a hard game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('connect-four stats', CliForegroundColor.Cyan)}      View statistics`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('connect-four reset', CliForegroundColor.Cyan)}      Reset statistics`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('Left / Right', CliForegroundColor.Yellow)}       Choose a column`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Enter / Space', CliForegroundColor.Yellow)}      Drop a disc`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('1-7', CliForegroundColor.Yellow)}                Drop a disc in that column`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                  New game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc / Q', CliForegroundColor.Yellow)}            Quit game`,
        );
    }

    // ── Sub-processors ───────────────────────────────────────────────

    private registerSubProcessors(): void {
        const difficultyProcessor = (
            difficulty: Difficulty,
        ): ICliCommandProcessor => ({
            command: difficulty,
            description: `Start a game against the ${difficulty} computer`,
            processCommand: async (_, context) => {
                this.context = context;
                this.difficulty = difficulty;
                this.playerStarts = true;
                this.startGame(context);
            },
        });

        this.processors = [
            difficultyProcessor('easy'),
            difficultyProcessor('medium'),
            difficultyProcessor('hard'),
            {
                command: 'stats',
                description: 'View game statistics',
                processCommand: async (_, context) => {
                    const s = this.stats;
                    const played = s.wins + s.losses + s.draws;
                    const winPct =
                        played > 0 ? Math.round((s.wins / played) * 100) : 0;
                    const { writer } = context;

                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  CONNECT FOUR STATISTICS',
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();
                    writer.writeln(
                        `  Games Played:  ${writer.wrapInColor(`${played}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Wins:          ${writer.wrapInColor(`${s.wins}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Losses:        ${writer.wrapInColor(`${s.losses}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Draws:         ${writer.wrapInColor(`${s.draws}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Win %:         ${writer.wrapInColor(`${winPct}%`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Streak:        ${writer.wrapInColor(`${s.currentStreak}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  Best Streak:   ${writer.wrapInColor(`${s.bestStreak}`, CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                },
            },
            {
                command: 'reset',
                description: 'Reset all statistics',
                processCommand: async (_, context) => {
                    this.stats = { ...EMPTY_STATS };
                    context.state.updateState({
                        connectFourStats: { ...this.stats },
                    });
                    await context.state.persist();
                    context.writer.writeSuccess(
                        'Connect Four statistics have been reset.',
                    );
                },
            },
        ];
    }

    // ── Game lifecycle ───────────────────────────────────────────────

    private startGame(context: ICliExecutionContext): void {
        this.computeLayout(context);
        this.resetGameState();

        context.enterFullScreenMode(this);
        this.render(context);
    }

    private stopGame(context: ICliExecutionContext): void {
        context.exitFullScreenMode();
        this.context = null;
    }

    onResize(cols: number, rows: number, context: ICliExecutionContext): void {
        this.computeLayout(context);
        this.render(context);
    }

    onDispose(context: ICliExecutionContext): void {
        // Nothing to clean up: the computer moves synchronously
    }

    private resetGameState(): void {
        this.board = createBoard();
        this.cursorCol = Math.floor(COLS / 2);
        this.outcome = null;
        this.win = null;
        this.lastComputerMove = null;
        this.message = this.playerStarts ? 'Your turn' : '';

        if (!this.playerStarts) {
            this.computerMove();
        }
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        this.offsetX = Math.max(1, Math.floor((cols - BOARD_WIDTH) / 2) + 1);
        this.offsetY = Math.max(1, Math.floor((rows - TOTAL_HEIGHT) / 2) + 1);
    }

    // ── Moves ────────────────────────────────────────────────────────

    private moveCursor(delta: number): void {
        this.cursorCol = Math.min(
            COLS - 1,
            Math.max(0, this.cursorCol + delta),
        );
    }

    private playerMove(col: number): void {
        if (dropDisc(this.board, col, PLAYER) < 0) {
            this.message = `Column ${col + 1} is full`;
            return;
        }
        if (this.checkGameOver()) return;
        this.computerMove();
    }

    private computerMove(): void {
        const col = chooseMove(
            this.board,
            COMPUTER,
            DIFFICULTIES[this.difficulty].depth,
        );
        const row = dropDisc(this.board, col, COMPUTER);
        this.lastComputerMove = [row, col];
        this.message = `Computer played ${col + 1}. Your turn`;
        this.checkGameOver();
    }

    /** Ends the game on a line of four or a full board; true if it ended. */
    private checkGameOver(): boolean {
        const win = findWin(this.board);
        if (win) {
            this.win = win;
            this.finish(win.disc === PLAYER ? 'win' : 'loss');
            return true;
        }
        if (isFull(this.board)) {
            this.finish('draw');
            return true;
        }
        return false;
    }

    private finish(outcome: Exclude<Outcome, null>): void {
        this.outcome = outcome;
        this.message =
            outcome === 'win'
                ? 'You win!'
                : outcome === 'loss'
                  ? 'The computer wins'
                  : 'Draw: the board is full';
        this.updateStats(outcome);
    }

    private async updateStats(outcome: Exclude<Outcome, null>): Promise<void> {
        if (outcome === 'win') {
            this.stats.wins++;
            this.stats.currentStreak++;
            this.stats.bestStreak = Math.max(
                this.stats.bestStreak,
                this.stats.currentStreak,
            );
        } else if (outcome === 'loss') {
            this.stats.losses++;
            this.stats.currentStreak = 0;
        } else {
            this.stats.draws++;
        }

        if (this.context) {
            this.context.state.updateState({
                connectFourStats: { ...this.stats },
            });
            await this.context.state.persist();
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
                // Take turns starting
                this.playerStarts = !this.playerStarts;
                this.computeLayout(context);
                this.resetGameState();
                this.render(context);
                break;
            case 'q':
            case 'Q':
            case ESC:
                this.stopGame(context);
                break;
        }
    }

    // ── Rendering ────────────────────────────────────────────────────

    private render(context: ICliExecutionContext): void {
        const buf: string[] = [];
        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        let row = this.offsetY;
        const x = this.offsetX;

        // ── Title ────────────────────────────────────────────────────
        const title = 'CONNECT FOUR';
        buf.push(
            ansi.cursorTo(
                row,
                x + Math.floor((BOARD_WIDTH - title.length) / 2),
            ),
        );
        buf.push(ansi.bold, ansi.fg.yellow, title, ansi.reset);
        row += 2;

        // ── Column cursor ────────────────────────────────────────────
        if (!this.outcome) {
            buf.push(ansi.cursorTo(row, x + 2 + this.cursorCol * CELL_WIDTH));
            buf.push(ansi.bold, ansi.fg.red, '\u25BC', ansi.reset); // ▼
        }
        row += 1;

        // ── Board ────────────────────────────────────────────────────
        const winning = new Set(
            (this.win?.cells ?? []).map(([r, c]) => `${r},${c}`),
        );
        for (let r = 0; r < ROWS; r++) {
            buf.push(ansi.cursorTo(row, x));
            for (let c = 0; c < COLS; c++) {
                buf.push(ansi.fg.blue, BOX.vertical, ansi.reset, ' ');
                buf.push(this.renderCell(r, c, winning.has(`${r},${c}`)), ' ');
            }
            buf.push(ansi.fg.blue, BOX.vertical, ansi.reset);
            row += 1;
        }
        buf.push(ansi.cursorTo(row, x));
        buf.push(ansi.fg.blue, BOX.bottomLeft);
        for (let c = 0; c < COLS; c++) {
            buf.push(
                BOX.horizontal.repeat(CELL_WIDTH - 1),
                c < COLS - 1 ? BOX.teeUp : BOX.bottomRight,
            );
        }
        buf.push(ansi.reset);
        row += 1;

        // ── Column numbers ───────────────────────────────────────────
        buf.push(ansi.cursorTo(row, x));
        for (let c = 0; c < COLS; c++) {
            const highlight = !this.outcome && c === this.cursorCol;
            buf.push(
                '  ',
                highlight ? ansi.bold + ansi.fg.white : ansi.dim,
                `${c + 1}`,
                ansi.reset,
                ' ',
            );
        }
        row += 2;

        // ── Status ───────────────────────────────────────────────────
        const color =
            this.outcome === 'win'
                ? ansi.fg.green
                : this.outcome === 'loss'
                  ? ansi.fg.red
                  : this.outcome === 'draw'
                    ? ansi.fg.yellow
                    : ansi.fg.white;
        buf.push(
            ansi.cursorTo(
                row,
                x +
                    Math.max(
                        0,
                        Math.floor((BOARD_WIDTH - this.message.length) / 2),
                    ),
            ),
        );
        buf.push(ansi.bold, color, this.message, ansi.reset);
        row += 1;

        // ── HUD ──────────────────────────────────────────────────────
        const hud = `W ${this.stats.wins}  L ${this.stats.losses}  D ${this.stats.draws}  ${DIFFICULTIES[this.difficulty].label}`;
        buf.push(
            ansi.cursorTo(
                row,
                x + Math.max(0, Math.floor((BOARD_WIDTH - hud.length) / 2)),
            ),
        );
        buf.push(ansi.dim, hud, ansi.reset);
        row += 1;

        // ── Controls hint ────────────────────────────────────────────
        const hint = this.outcome
            ? '[R] New Game  [Q] Quit'
            : '\u2190\u2192 Move  Enter/1-7 Drop  Esc Quit';
        buf.push(
            ansi.cursorTo(
                row,
                x + Math.max(0, Math.floor((BOARD_WIDTH - hint.length) / 2)),
            ),
        );
        buf.push(ansi.dim, hint, ansi.reset);

        context.terminal.write(buf.join(''));
    }

    private renderCell(r: number, c: number, winning: boolean): string {
        const cell = this.board[r][c];
        if (cell === EMPTY) {
            return `${ansi.fg.gray}${HOLE}${ansi.reset}`;
        }
        const color = cell === PLAYER ? ansi.fg.red : ansi.fg.yellow;
        const last =
            this.lastComputerMove !== null &&
            this.lastComputerMove[0] === r &&
            this.lastComputerMove[1] === c;
        const style = winning
            ? ansi.inverse + ansi.bold
            : last
              ? ansi.bold
              : '';
        return `${style}${color}${DISC}${ansi.reset}`;
    }
}
