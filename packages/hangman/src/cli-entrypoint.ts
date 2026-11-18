import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliHangmanCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-hangman',
    processors: [new CliHangmanCommandProcessor()],
};

bootCliModule(module);
