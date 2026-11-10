# Qodalis CLI games

Terminal games for the [Qodalis CLI](https://github.com/qodalis-solutions/web-cli), each published as its own npm package and registered like any other plugin. They moved here from web-cli in v2.4.2 with their history; the package names, module exports and commands did not change.

| Package | Module | Command | Game |
| --- | --- | --- | --- |
| [`@qodalis/cli-2048`](https://www.npmjs.com/package/@qodalis/cli-2048) | `game2048Module` | `2048` | The 2048 sliding-tile puzzle |
| [`@qodalis/cli-minesweeper`](https://www.npmjs.com/package/@qodalis/cli-minesweeper) | `minesweeperModule` | `minesweeper` | Minesweeper |
| [`@qodalis/cli-snake`](https://www.npmjs.com/package/@qodalis/cli-snake) | `snakeModule` | `snake` | Snake |
| [`@qodalis/cli-sudoku`](https://www.npmjs.com/package/@qodalis/cli-sudoku) | `sudokuModule` | `sudoku` | Sudoku |
| [`@qodalis/cli-tetris`](https://www.npmjs.com/package/@qodalis/cli-tetris) | `tetrisModule` | `tetris` | Tetris |
| [`@qodalis/cli-wordle`](https://www.npmjs.com/package/@qodalis/cli-wordle) | `wordleModule` | `wordle` | Wordle |

Every game shares one version. `@qodalis/cli-core` is a peer dependency (`^2.4.1`).

## Use a game

```bash
npm install @qodalis/cli-snake
```

```typescript
import { snakeModule } from '@qodalis/cli-snake';

// Angular: <cli [modules]="[snakeModule]"></cli>  or  providers: [resolveCliModuleProvider(snakeModule)]
// React:   <Cli modules={[snakeModule]} />
// Vue:     <Cli :modules="[snakeModule]" />
// Vanilla: engine.registerModule(snakeModule)
```

Or at runtime, in a running terminal: `pkg add snake` (loads the IIFE bundle `dist/umd/index.global.js` from unpkg).

Each package's README documents its commands and keys; the docs site has a page per game at https://cli.qodalis.com/docs/plugins/.

## Develop

```bash
pnpm install
pnpm run build          # tsup in every package: dist/public-api.{js,mjs,d.ts} + dist/umd/index.global.js
pnpm test               # Jasmine specs on Karma ChromeHeadless (CI=1 adds --no-sandbox)
pnpm run lint           # ESLint flat config
pnpm run typecheck      # tsc over sources and specs (Karma only strips types)
pnpm run format         # Prettier
node tools/check-dist.js   # every entry point of every package.json exists after a build, and all six versions match
```

Layout: `packages/<game>/` with `src/public-api.ts` (the module and processor), `src/cli-entrypoint.ts` (the IIFE entry that calls `bootCliModule`), `src/lib/`, `src/tests/*.spec.ts`. No Nx: `pnpm -r run build` builds the packages.

Add a game with [`@qodalis/create-cli-plugin`](https://www.npmjs.com/package/@qodalis/create-cli-plugin) (`npx @qodalis/create-cli-plugin --name <game>`), then adjust the generated `package.json`, `tsup.config.ts` and `tsconfig.json` to match a sibling package.

## Release

Work on `feature/*` branches and open PRs into `develop` (rebase merges only). A release fast-forwards `main` to `develop`:

1. Bump every `packages/*/package.json` to the new version (`node tools/inject-versions.js` syncs the `version.ts` files and the root) and add a `## v<version>` section to `CHANGELOG.md`; CI fails a version bump without it.
2. Merge into `develop` and wait for its CI.
3. `pnpm run release` (`tools/release.sh`): checks that `main` is an ancestor of `develop`, that the changelog section exists and that develop's CI passed, then pushes `develop` to `main`.

Pushing `main` runs `deploy.yml`: it publishes every package to npm (skipping versions that already exist, secret `NPM_TOKEN`), then creates the tag `v<version>` and the GitHub release from the CHANGELOG section (`tools/release-notes.js`).

## License

MIT
