# Change Log

This document records all notable changes to the Qodalis CLI game plugins
(`@qodalis/cli-2048`, `-minesweeper`, `-snake`, `-tetris`, `-wordle`, `-sudoku`).
This project adheres to [Semantic Versioning](https://semver.org/); every game shares one version.

## v2.4.2

### The games moved to their own repository

- The six game plugins now live in [qodalis-solutions/cli-games](https://github.com/qodalis-solutions/cli-games), moved from [web-cli](https://github.com/qodalis-solutions/web-cli) with their history. The npm package names, module exports and commands are unchanged, so nothing changes for consumers.
- `@qodalis/cli-core` is a peer dependency (`^2.4.1`): the games use the core your terminal already has instead of pinning one.
- Built with tsup as before (CJS, ESM, type declarations and the IIFE bundle at `dist/umd/index.global.js` for `pkg add <game>`), tested on Karma ChromeHeadless.

Versions up to 2.4.1 were released from web-cli; see its [CHANGELOG](https://github.com/qodalis-solutions/web-cli/blob/main/CHANGELOG.md).
