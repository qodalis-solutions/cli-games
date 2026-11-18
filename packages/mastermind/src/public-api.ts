/*
 * Public API Surface of mastermind
 */

export * from './lib/code';
export * from './lib/processors/cli-mastermind-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliMastermindCommandProcessor } from './lib/processors/cli-mastermind-command-processor';
import { API_VERSION } from './lib/version';

export const mastermindModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-mastermind',
    processors: [new CliMastermindCommandProcessor()],
    translations: {
        es: {
            'cli.mastermind.description':
                'Jugar a Mastermind, el juego de descifrar códigos',
        },
        fr: {
            'cli.mastermind.description':
                'Jouer au Mastermind, le jeu de déchiffrage de code',
        },
        de: {
            'cli.mastermind.description':
                'Mastermind spielen, das Code-Knacker-Spiel',
        },
        pt: {
            'cli.mastermind.description':
                'Jogar Mastermind, o jogo de decifrar códigos',
        },
        it: {
            'cli.mastermind.description':
                'Giocare a Mastermind, il gioco per decifrare codici',
        },
        ja: {
            'cli.mastermind.description':
                'コード当てゲーム、マスターマインドをプレイ',
        },
        ko: {
            'cli.mastermind.description': '코드 해독 게임 마스터마인드 플레이',
        },
        zh: { 'cli.mastermind.description': '玩珠玑妙算（猜密码游戏）' },
        ru: {
            'cli.mastermind.description':
                'Играть в «Мастермайнд», игру-взлом кода',
        },
        ro: {
            'cli.mastermind.description':
                'Joacă Mastermind, jocul de spart coduri',
        },
    },
};
