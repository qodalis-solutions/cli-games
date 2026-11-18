/*
 * Public API Surface of fifteen-puzzle
 */

export * from './lib/board';
export * from './lib/processors/cli-fifteen-puzzle-command-processor';
export * from './lib/version';

import { ICliModule } from '@qodalis/cli-core';
import { CliFifteenPuzzleCommandProcessor } from './lib/processors/cli-fifteen-puzzle-command-processor';
import { API_VERSION } from './lib/version';

export const fifteenPuzzleModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-fifteen-puzzle',
    processors: [new CliFifteenPuzzleCommandProcessor()],
    translations: {
        es: {
            'cli.fifteen.description':
                'Jugar al 15-puzzle (fichas deslizantes)',
        },
        fr: { 'cli.fifteen.description': 'Jouer au taquin' },
        de: { 'cli.fifteen.description': '15-Puzzle (Schiebepuzzle) spielen' },
        pt: { 'cli.fifteen.description': 'Jogar o quebra-cabeça de 15' },
        it: { 'cli.fifteen.description': 'Giocare al gioco del 15' },
        ja: { 'cli.fifteen.description': '15パズル（スライドパズル）をプレイ' },
        ko: { 'cli.fifteen.description': '15 퍼즐(슬라이딩 퍼즐) 플레이' },
        zh: { 'cli.fifteen.description': '玩数字华容道（15 拼图）' },
        ru: { 'cli.fifteen.description': 'Играть в пятнашки' },
        ro: { 'cli.fifteen.description': 'Joacă jocul de 15 (puzzle glisant)' },
    },
};
