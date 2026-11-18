import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliFifteenPuzzleCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-fifteen-puzzle',
    processors: [new CliFifteenPuzzleCommandProcessor()],
};

bootCliModule(module);
