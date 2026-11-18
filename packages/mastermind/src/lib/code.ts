// -- Code logic -------------------------------------------------------------
//
// A code is an array of CODE_LENGTH symbols, each 1..SYMBOLS. Symbols may
// repeat, as in the board game.

export type Code = number[];

export interface GuessFeedback {
    /** Right symbol in the right place */
    exact: number;
    /** Right symbol in the wrong place */
    partial: number;
}

export const CODE_LENGTH = 4;
export const SYMBOLS = 6;
export const MAX_GUESSES = 10;

export function generateSecret(
    random: () => number = Math.random,
    length = CODE_LENGTH,
    symbols = SYMBOLS,
): Code {
    return Array.from({ length }, () =>
        Math.min(symbols, Math.floor(random() * symbols) + 1),
    );
}

/**
 * Scores a guess. Each secret position counts at most once: exact matches
 * first, then partial matches from the symbols left over on both sides, so
 * `1 1 2 2` against `1 2 3 4` gives one exact and one partial.
 */
export function scoreGuess(secret: Code, guess: Code): GuessFeedback {
    let exact = 0;
    const secretLeft = new Map<number, number>();
    const guessLeft = new Map<number, number>();
    for (let i = 0; i < secret.length; i++) {
        if (guess[i] === secret[i]) {
            exact++;
        } else {
            secretLeft.set(secret[i], (secretLeft.get(secret[i]) ?? 0) + 1);
            guessLeft.set(guess[i], (guessLeft.get(guess[i]) ?? 0) + 1);
        }
    }
    let partial = 0;
    for (const [symbol, count] of guessLeft) {
        partial += Math.min(count, secretLeft.get(symbol) ?? 0);
    }
    return { exact, partial };
}

export function isWinningFeedback(
    feedback: GuessFeedback,
    length = CODE_LENGTH,
): boolean {
    return feedback.exact === length;
}
