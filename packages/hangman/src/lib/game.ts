/**
 * Hangman rules, kept free of terminal code so the specs can drive them directly.
 */

export const MAX_MISSES = 6;

export type GuessResult = 'hit' | 'miss' | 'repeat' | 'invalid';

export class HangmanGame {
    readonly word: string;
    private readonly guessed = new Set<string>();

    constructor(word: string) {
        this.word = word.toLowerCase();
    }

    /** Letters guessed so far, in alphabetical order. */
    get guesses(): string[] {
        return [...this.guessed].sort();
    }

    /** Guessed letters that are not in the word, in guessing order. */
    get misses(): string[] {
        return [...this.guessed].filter((l) => !this.word.includes(l));
    }

    get won(): boolean {
        return [...this.word].every((l) => this.guessed.has(l));
    }

    get lost(): boolean {
        return this.misses.length >= MAX_MISSES;
    }

    get over(): boolean {
        return this.won || this.lost;
    }

    hasGuessed(letter: string): boolean {
        return this.guessed.has(letter.toLowerCase());
    }

    guess(letter: string): GuessResult {
        const l = letter.toLowerCase();
        if (!/^[a-z]$/.test(l) || this.over) return 'invalid';
        if (this.guessed.has(l)) return 'repeat';
        this.guessed.add(l);
        return this.word.includes(l) ? 'hit' : 'miss';
    }

    /** The word with unguessed letters as `_` (all letters once the game is lost). */
    masked(reveal = false): string {
        return [...this.word]
            .map((l) => (reveal || this.guessed.has(l) ? l.toUpperCase() : '_'))
            .join(' ');
    }
}

/** The gallows after `misses` wrong guesses: 7 lines, 9 columns wide. */
export function gallows(misses: number): string[] {
    const m = Math.min(Math.max(misses, 0), MAX_MISSES);
    const head = m >= 1 ? 'O' : ' ';
    const body = m >= 2 ? '|' : ' ';
    const leftArm = m >= 3 ? '/' : ' ';
    const rightArm = m >= 4 ? '\\' : ' ';
    const leftLeg = m >= 5 ? '/' : ' ';
    const rightLeg = m >= 6 ? '\\' : ' ';
    return [
        '  +---+  ',
        '  |   |  ',
        `  ${head}   |  `,
        ` ${leftArm}${body}${rightArm}  |  `,
        ` ${leftLeg} ${rightLeg}  |  `,
        '      |  ',
        '=========',
    ];
}
