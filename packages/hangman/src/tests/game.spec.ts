import { HangmanGame, MAX_MISSES, gallows } from '../lib/game';
import { WORD_CATEGORIES, WORD_LIST } from '../lib/words';

describe('hangman words', () => {
    it('are lowercase letters only and short enough for a narrow terminal', () => {
        expect(WORD_LIST.length).toBeGreaterThan(100);
        for (const { word } of WORD_LIST) {
            expect(word).toMatch(/^[a-z]{4,10}$/);
        }
    });

    it('have no duplicates and keep their category', () => {
        const words = WORD_LIST.map((w) => w.word);
        expect(new Set(words).size).toBe(words.length);
        for (const { word, category } of WORD_LIST) {
            expect(WORD_CATEGORIES[category]).toContain(word);
        }
    });
});

describe('HangmanGame', () => {
    it('masks the word until letters are guessed', () => {
        const game = new HangmanGame('Banana');
        expect(game.word).toBe('banana');
        expect(game.masked()).toBe('_ _ _ _ _ _');
        expect(game.guess('a')).toBe('hit');
        expect(game.masked()).toBe('_ A _ A _ A');
        expect(game.masked(true)).toBe('B A N A N A');
    });

    it('counts misses but not hits or repeats', () => {
        const game = new HangmanGame('banana');
        expect(game.guess('z')).toBe('miss');
        expect(game.guess('N')).toBe('hit');
        expect(game.guess('z')).toBe('repeat');
        expect(game.guess('n')).toBe('repeat');
        expect(game.misses).toEqual(['z']);
        expect(game.guesses).toEqual(['n', 'z']);
        expect(game.hasGuessed('Z')).toBeTrue();
    });

    it('ignores anything but a single letter', () => {
        const game = new HangmanGame('banana');
        expect(game.guess('1')).toBe('invalid');
        expect(game.guess('ab')).toBe('invalid');
        expect(game.guess(' ')).toBe('invalid');
        expect(game.guesses).toEqual([]);
    });

    it('is won once every letter is found', () => {
        const game = new HangmanGame('banana');
        game.guess('b');
        game.guess('a');
        expect(game.won).toBeFalse();
        game.guess('n');
        expect(game.won).toBeTrue();
        expect(game.over).toBeTrue();
        expect(game.guess('x')).toBe('invalid');
    });

    it(`is lost after ${MAX_MISSES} misses`, () => {
        const game = new HangmanGame('banana');
        for (const l of 'cdefg') game.guess(l);
        expect(game.lost).toBeFalse();
        game.guess('h');
        expect(game.lost).toBeTrue();
        expect(game.won).toBeFalse();
        expect(game.guess('b')).toBe('invalid');
    });
});

describe('gallows', () => {
    it('draws one more body part per miss in 7 lines of 9 columns', () => {
        for (let m = 0; m <= MAX_MISSES; m++) {
            const lines = gallows(m);
            expect(lines.length).toBe(7);
            expect(lines.every((l) => l.length === 9)).toBeTrue();
        }
        const parts = (m: number) =>
            gallows(m).slice(2, 5).join('').replace(/[ |]/g, '').length;
        expect(gallows(0).slice(2, 5).join('')).not.toContain('O');
        expect(gallows(1)[2]).toContain('O');
        // body, arms and legs: the body is a '|' on the rope side, the rest are slashes
        expect(gallows(2)[3].trimStart().startsWith('|')).toBeTrue();
        expect(parts(3)).toBe(2); // O /
        expect(parts(6)).toBe(5); // O / \ / \
        expect(gallows(99)).toEqual(gallows(MAX_MISSES));
    });
});
