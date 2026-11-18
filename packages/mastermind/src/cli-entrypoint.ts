import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliMastermindCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-mastermind',
    processors: [new CliMastermindCommandProcessor()],
};

bootCliModule(module);
