import { ICliCommandProcessor } from '@qodalis/cli-core';
import { CliHangmanCommandProcessor } from '../lib/processors/cli-hangman-command-processor';

describe('hangman controls', () => {
    const processor = new CliHangmanCommandProcessor();
    const withControls: ICliCommandProcessor[] = [processor];

    it('declare the keys it reads, for on-screen key rows', () => {
        for (const p of withControls) {
            const keys = p.controls?.keys ?? [];
            expect(keys.length).withContext(p.command).toBeGreaterThan(0);
            for (const key of keys) {
                expect(key.label).withContext(p.command).toBeTruthy();
                expect(key.data)
                    .withContext(`${p.command} ${key.label}`)
                    .toBeTruthy();
            }
            expect(new Set(keys.map((k) => k.label)).size)
                .withContext(p.command)
                .toBe(keys.length);
        }
    });

    it('a tap sends one of its keys', () => {
        for (const p of withControls) {
            const tap = p.controls?.tap;
            if (tap !== undefined) {
                expect(p.controls!.keys.some((k) => k.data === tap))
                    .withContext(p.command)
                    .toBeTrue();
            }
        }
    });

    it('a touch on the screen never guesses: the game reads typed letters', () => {
        // Touch hosts send `tap` for a touch on the terminal and arrows for
        // swipes; Hangman keeps the on-screen keyboard instead
        expect(processor.controls?.textInput).toBeTrue();
        expect(processor.controls?.tap).toBeUndefined();
        expect(processor.controls?.swipe).toBeFalsy();
    });
});
