# AGENTS.md

Guidance for coding agents working in this repository (`qodalis-solutions/cli-games`).

## What this is

Six Qodalis CLI game plugins, one package each under `packages/<game>/`, published as `@qodalis/cli-<game>` (2048, minesweeper, snake, tetris, wordle, sudoku). They were moved from `qodalis-solutions/web-cli` (where the engine, `@qodalis/cli-core`, and the other plugins live) with their git history. `@qodalis/cli-core` is a **peer dependency** on the published version (`^2.4.1`), never `workspace:*`.

## Commands

```bash
pnpm install
pnpm run build             # pnpm -r run build (tsup per package)
pnpm test                  # karma start karma.conf.cjs (Jasmine, ChromeHeadless, single run)
pnpm run lint              # eslint .
pnpm run typecheck         # tsc -p tsconfig.spec.json --noEmit (sources + specs)
pnpm run format            # prettier --write
node tools/check-dist.js   # verify every package's dist, entry points and that all six versions match
node tools/inject-versions.js
```

Kill Karma/Chrome processes after a test run if any linger (`pkill -f "karma|ChromeHeadless"`).

## Conventions

- TypeScript: 4-space indentation, single quotes, semicolons (`.editorconfig`, `.prettierrc`, `eslint.config.mjs`).
- Tests are Jasmine specs in `packages/<game>/src/tests/*.spec.ts`; they build a fake `ICliExecutionContext` and drive the processor directly.
- Every game shares one version; bump all six together and add the `## v<version>` CHANGELOG.md section in the same change.
- Git: `feature/*` branches, PRs into `develop`, rebase merges only, linear history; `main` is moved by fast-forward (`pnpm run release`). Pushing `main` publishes to npm and creates the GitHub release.
- New games: scaffold with `@qodalis/create-cli-plugin`, then mirror a sibling package's `package.json`, `tsup.config.ts` and `tsconfig.json`.
