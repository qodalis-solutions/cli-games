import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliConnectFourCommandProcessor } from './lib';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-connect-four',
    processors: [new CliConnectFourCommandProcessor()],
};

bootCliModule(module);
