/*
 * Public API Surface of hangman
 */

export * from './lib/processors/cli-hangman-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliHangmanCommandProcessor } from './lib/processors/cli-hangman-command-processor';
import { API_VERSION } from './lib/version';

export const hangmanModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-hangman',
    processors: [new CliHangmanCommandProcessor()],
    translations: {
        es: { 'cli.hangman.description': 'Jugar al ahorcado' },
        fr: { 'cli.hangman.description': 'Jouer au pendu' },
        de: { 'cli.hangman.description': 'Galgenmännchen spielen' },
        pt: { 'cli.hangman.description': 'Jogar à forca' },
        it: { 'cli.hangman.description': "Giocare all'impiccato" },
        ja: { 'cli.hangman.description': 'ハングマンをプレイ' },
        ko: { 'cli.hangman.description': '행맨 플레이' },
        zh: { 'cli.hangman.description': '玩猜单词（吊死鬼）游戏' },
        ru: { 'cli.hangman.description': 'Играть в «Виселицу»' },
        ro: { 'cli.hangman.description': 'Joacă Spânzurătoarea' },
    },
};
