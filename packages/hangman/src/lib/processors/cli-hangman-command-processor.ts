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
import { HangmanGame, MAX_MISSES, gallows } from '../game';
import { HangmanWord, WORD_LIST } from '../words';

// ── Types ────────────────────────────────────────────────────────────

interface HangmanStats {
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    bestStreak: number;
}

// ── ANSI helpers ─────────────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    fg: {
        green: `${CSI}92m`,
        red: `${CSI}91m`,
        yellow: `${CSI}93m`,
        cyan: `${CSI}36m`,
        white: `${CSI}97m`,
        gray: `${CSI}90m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    inverse: `${CSI}7m`,
    reset: `${CSI}0m`,
};

// ── Constants ────────────────────────────────────────────────────────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LETTERS_PER_ROW = 13;
// "A B C ... M": 13 letters with a space between
const PANEL_WIDTH = LETTERS_PER_ROW * 2 - 1; // 25
// title(2) + gallows(7) + gap(1) + hint(1) + word(2) + misses(1) + message(2) + alphabet(3) + hud(1) + controls(1)
const TOTAL_HEIGHT = 21;

const EMPTY_STATS: HangmanStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
};

// ── Processor ────────────────────────────────────────────────────────

export class CliHangmanCommandProcessor implements ICliCommandProcessor {
    command = 'hangman';

    description =
        'Play Hangman in your terminal: guess the word one letter at a time';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        module: 'games',
        icon: '\uD83D\uDD24', // abc emoji
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    controls: ICliCommandControls = {
        textInput: true,
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
                label: 'GUESS',
                key: 'Enter',
                data: CliKeyData.enter,
                description: 'Guess the selected letter',
            },
            {
                label: '←',
                key: 'Left',
                data: CliKeyData.left,
                description: 'Left',
                repeat: true,
            },
            { label: '↑', key: 'Up', data: CliKeyData.up, description: 'Up' },
            {
                label: '↓',
                key: 'Down',
                data: CliKeyData.down,
                description: 'Down',
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
            hangmanStats: { ...EMPTY_STATS },
        },
    };

    // ── Game state ───────────────────────────────────────────────────

    private game = new HangmanGame('');
    private category = '';
    private cursor = 0;
    private message = '';
    private stats: HangmanStats = { ...EMPTY_STATS };
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
            .select<HangmanStats>((x) => x['hangmanStats'])
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
        this.startGame(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.game.over) {
            this.handleGameOverInput(data, context);
            return;
        }

        // Quit (only Esc during play: every letter is a guess)
        if (data === ESC) {
            this.stopGame(context);
            return;
        }

        switch (data) {
            case `${ESC}[D`: // Left
                this.moveCursor(-1);
                break;
            case `${ESC}[C`: // Right
                this.moveCursor(1);
                break;
            case `${ESC}[A`: // Up
            case `${ESC}[B`: // Down
                this.moveCursor(
                    this.cursor < LETTERS_PER_ROW
                        ? LETTERS_PER_ROW
                        : -LETTERS_PER_ROW,
                );
                break;
            case '\r': // Enter
            case ' ':
                this.guess(ALPHABET[this.cursor]);
                break;
            default:
                if (/^[a-zA-Z]$/.test(data)) {
                    this.cursor = ALPHABET.indexOf(data.toUpperCase());
                    this.guess(data);
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
            `  ${writer.wrapInColor('hangman', CliForegroundColor.Cyan)}               Start the game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hangman stats', CliForegroundColor.Cyan)}         View statistics`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hangman reset', CliForegroundColor.Cyan)}         Reset statistics`,
        );
        writer.writeln();
        writer.writeln('Controls:');
        writer.writeln(
            `  ${writer.wrapInColor('A-Z', CliForegroundColor.Yellow)}                Guess a letter`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Arrow keys', CliForegroundColor.Yellow)}         Select a letter`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Enter / Space', CliForegroundColor.Yellow)}      Guess the selected letter`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('Esc', CliForegroundColor.Yellow)}                Quit game`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('R', CliForegroundColor.Yellow)}                  Restart (after game over)`,
        );
    }

    // ── Sub-processors ───────────────────────────────────────────────

    private registerSubProcessors(): void {
        this.processors = [
            {
                command: 'stats',
                description: 'View game statistics',
                processCommand: async (_, context) => {
                    const s = this.stats;
                    const winPct =
                        s.gamesPlayed > 0
                            ? Math.round((s.gamesWon / s.gamesPlayed) * 100)
                            : 0;
                    const { writer } = context;

                    writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            '  HANGMAN STATISTICS',
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
                        hangmanStats: { ...this.stats },
                    });
                    await context.state.persist();
                    context.writer.writeSuccess(
                        'Hangman statistics have been reset.',
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
        // Cleanup — no timers to stop
    }

    private resetGameState(): void {
        const pick: HangmanWord =
            WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
        this.game = new HangmanGame(pick.word);
        this.category = pick.category;
        this.cursor = 0;
        this.message = '';
    }

    private computeLayout(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;

        this.offsetX = Math.max(1, Math.floor((cols - PANEL_WIDTH) / 2) + 1);
        this.offsetY = Math.max(1, Math.floor((rows - TOTAL_HEIGHT) / 2) + 1);
    }

    // ── Guessing ─────────────────────────────────────────────────────

    private moveCursor(delta: number): void {
        this.cursor = (this.cursor + delta + ALPHABET.length) % ALPHABET.length;
    }

    private guess(letter: string): void {
        const result = this.game.guess(letter);
        const upper = letter.toUpperCase();
        switch (result) {
            case 'repeat':
                this.message = `You already tried ${upper}`;
                return;
            case 'hit':
                this.message = `${upper} is in the word`;
                break;
            case 'miss':
                this.message = `No ${upper}`;
                break;
            default:
                return;
        }

        if (this.game.won) {
            this.message = 'Saved! You win';
            this.updateStats(true);
        } else if (this.game.lost) {
            this.message = 'Hanged! Out of guesses';
            this.updateStats(false);
        }
    }

    private async updateStats(won: boolean): Promise<void> {
        this.stats.gamesPlayed++;
        if (won) {
            this.stats.gamesWon++;
            this.stats.currentStreak++;
            this.stats.bestStreak = Math.max(
                this.stats.bestStreak,
                this.stats.currentStreak,
            );
        } else {
            this.stats.currentStreak = 0;
        }

        if (this.context) {
            this.context.state.updateState({ hangmanStats: { ...this.stats } });
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

    private centered(text: string, row: number): string {
        const pad = Math.max(
            0,
            Math.floor((PANEL_WIDTH - [...text].length) / 2),
        );
        return ansi.cursorTo(row, this.offsetX + pad);
    }

    private render(context: ICliExecutionContext): void {
        const buf: string[] = [];
        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        const over = this.game.over;
        let row = this.offsetY;

        // ── Title ────────────────────────────────────────────────────
        const title = 'H A N G M A N';
        buf.push(
            this.centered(title, row),
            ansi.bold,
            ansi.fg.yellow,
            title,
            ansi.reset,
        );
        row += 2;

        // ── Gallows ──────────────────────────────────────────────────
        const misses = this.game.misses.length;
        const figureColor = this.game.lost
            ? ansi.fg.red
            : this.game.won
              ? ansi.fg.green
              : ansi.fg.white;
        for (const line of gallows(misses)) {
            buf.push(this.centered(line, row), figureColor, line, ansi.reset);
            row += 1;
        }
        row += 1;

        // ── Category hint ────────────────────────────────────────────
        const hint = `Category: ${this.category}`;
        buf.push(this.centered(hint, row), ansi.fg.cyan, hint, ansi.reset);
        row += 1;

        // ── Word ─────────────────────────────────────────────────────
        const word = this.game.masked(over);
        buf.push(this.centered(word, row), ansi.bold);
        for (let i = 0; i < this.game.word.length; i++) {
            if (i > 0) buf.push(' ');
            const letter = this.game.word[i];
            if (this.game.hasGuessed(letter)) {
                buf.push(ansi.fg.white, letter.toUpperCase());
            } else if (over) {
                buf.push(ansi.fg.red, letter.toUpperCase());
            } else {
                buf.push(ansi.fg.gray, '_');
            }
        }
        buf.push(ansi.reset);
        row += 2;

        // ── Misses ───────────────────────────────────────────────────
        const missed =
            `Misses ${misses}/${MAX_MISSES}: ${this.game.misses.map((l) => l.toUpperCase()).join(' ')}`.trimEnd();
        buf.push(this.centered(missed, row), ansi.dim, missed, ansi.reset);
        row += 1;

        // ── Message ──────────────────────────────────────────────────
        if (this.message) {
            const color = this.game.won
                ? ansi.fg.green
                : this.game.lost
                  ? ansi.fg.red
                  : ansi.fg.yellow;
            buf.push(
                this.centered(this.message, row),
                ansi.bold,
                color,
                this.message,
                ansi.reset,
            );
        }
        row += 2;

        // ── Alphabet ─────────────────────────────────────────────────
        for (let start = 0; start < ALPHABET.length; start += LETTERS_PER_ROW) {
            buf.push(ansi.cursorTo(row, this.offsetX));
            for (let i = start; i < start + LETTERS_PER_ROW; i++) {
                if (i > start) buf.push(' ');
                buf.push(this.renderLetter(i, over));
            }
            row += 1;
        }
        row += 1;

        // ── HUD ──────────────────────────────────────────────────────
        const hud = `Won ${this.stats.gamesWon}/${this.stats.gamesPlayed}  Streak ${this.stats.currentStreak}  Best ${this.stats.bestStreak}`;
        buf.push(this.centered(hud, row), ansi.dim, hud, ansi.reset);
        row += 1;

        // ── Controls hint ────────────────────────────────────────────
        const controls = over
            ? '[R] New Game  [Q] Quit'
            : 'A-Z/Enter Guess  Esc Quit';
        buf.push(this.centered(controls, row), ansi.dim, controls, ansi.reset);

        context.terminal.write(buf.join(''));
    }

    private renderLetter(index: number, over: boolean): string {
        const letter = ALPHABET[index];
        const selected = !over && index === this.cursor;
        let color = ansi.fg.white;
        if (this.game.hasGuessed(letter)) {
            // Hits in green, misses dimmed
            color = this.game.word.includes(letter.toLowerCase())
                ? ansi.fg.green
                : ansi.fg.gray + ansi.dim;
        }
        const style = selected ? ansi.inverse + ansi.bold : '';
        return `${style}${color}${letter}${ansi.reset}`;
    }
}
