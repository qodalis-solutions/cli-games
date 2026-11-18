/*
 * Public API Surface of connect-four
 */

export * from './lib/processors/cli-connect-four-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliConnectFourCommandProcessor } from './lib/processors/cli-connect-four-command-processor';
import { API_VERSION } from './lib/version';

export const connectFourModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-connect-four',
    processors: [new CliConnectFourCommandProcessor()],
    translations: {
        es: {
            'cli.connect-four.description':
                'Jugar a Conecta 4 contra el ordenador',
        },
        fr: {
            'cli.connect-four.description':
                "Jouer au Puissance 4 contre l'ordinateur",
        },
        de: {
            'cli.connect-four.description':
                'Vier gewinnt gegen den Computer spielen',
        },
        pt: {
            'cli.connect-four.description': 'Jogar Lig 4 contra o computador',
        },
        it: {
            'cli.connect-four.description':
                'Giocare a Forza 4 contro il computer',
        },
        ja: {
            'cli.connect-four.description':
                'コンピューターと四目並べ（コネクトフォー）で対戦',
        },
        ko: { 'cli.connect-four.description': '컴퓨터와 커넥트 포 대결' },
        zh: { 'cli.connect-four.description': '与电脑玩四子棋' },
        ru: {
            'cli.connect-four.description':
                'Играть в «Четыре в ряд» против компьютера',
        },
        ro: {
            'cli.connect-four.description':
                'Joacă Connect Four împotriva calculatorului',
        },
    },
};
