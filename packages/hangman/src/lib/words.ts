/**
 * Built-in Hangman words, grouped by category; the category is shown as a hint.
 * Lowercase letters only, 4 to 10 letters, so the word fits a narrow terminal.
 */
export const WORD_CATEGORIES: Record<string, string[]> = {
    Animals: [
        'tiger', 'zebra', 'giraffe', 'dolphin', 'penguin', 'kangaroo', 'elephant', 'leopard',
        'panda', 'rabbit', 'squirrel', 'turtle', 'octopus', 'falcon', 'beaver', 'camel',
        'cheetah', 'gorilla', 'hamster', 'jaguar', 'lobster', 'monkey', 'ostrich', 'parrot',
        'raccoon', 'salmon', 'spider', 'walrus', 'wolf', 'buffalo',
    ],
    Food: [
        'banana', 'cherry', 'mango', 'orange', 'pineapple', 'avocado', 'broccoli', 'carrot',
        'cheese', 'chocolate', 'cookie', 'garlic', 'lemon', 'noodle', 'omelette', 'pancake',
        'pepper', 'potato', 'pumpkin', 'sandwich', 'spinach', 'tomato', 'waffle', 'yogurt',
        'apricot', 'biscuit', 'cabbage', 'muffin', 'peanut', 'walnut',
    ],
    Countries: [
        'canada', 'brazil', 'mexico', 'france', 'germany', 'italy', 'spain', 'portugal',
        'norway', 'sweden', 'finland', 'poland', 'romania', 'moldova', 'greece', 'turkey',
        'egypt', 'kenya', 'nigeria', 'morocco', 'india', 'china', 'japan', 'korea',
        'vietnam', 'thailand', 'australia', 'chile', 'peru', 'ireland',
    ],
    Computers: [
        'keyboard', 'monitor', 'browser', 'compiler', 'database', 'terminal', 'server', 'network',
        'router', 'python', 'kernel', 'cursor', 'binary', 'pixel', 'variable', 'function',
        'array', 'string', 'boolean', 'integer', 'syntax', 'debugger', 'commit', 'branch',
        'module', 'package', 'script', 'linux', 'memory', 'socket',
    ],
    Sports: [
        'soccer', 'tennis', 'hockey', 'boxing', 'rugby', 'cricket', 'golf', 'cycling',
        'skiing', 'surfing', 'karate', 'judo', 'archery', 'fencing', 'rowing', 'sailing',
        'climbing', 'bowling', 'baseball', 'handball', 'marathon', 'swimming', 'diving',
        'chess', 'skating', 'triathlon', 'volleyball', 'wrestling', 'badminton', 'darts',
    ],
    Nature: [
        'mountain', 'river', 'forest', 'desert', 'island', 'volcano', 'glacier', 'canyon',
        'valley', 'meadow', 'ocean', 'thunder', 'rainbow', 'tornado', 'blizzard', 'lightning',
        'sunset', 'breeze', 'cloud', 'storm', 'waterfall', 'jungle', 'lagoon', 'prairie',
        'tundra', 'swamp', 'pebble', 'boulder', 'comet', 'planet',
    ],
};

export interface HangmanWord {
    word: string;
    category: string;
}

/** Every word with its category. */
export const WORD_LIST: HangmanWord[] = Object.entries(WORD_CATEGORIES).flatMap(
    ([category, words]) => words.map((word) => ({ word, category })),
);
