# Change Log

This document records all notable changes to the Qodalis CLI game plugins
(`@qodalis/cli-2048`, `-minesweeper`, `-snake`, `-tetris`, `-wordle`, `-sudoku`).
This project adheres to [Semantic Versioning](https://semver.org/); every game shares one version.

## Unreleased

### New games

- **Connect Four** (`@qodalis/cli-connect-four`, command `connect-four`, aliases `connect4`, `c4`): play against the computer on a 7x6 board. Choose a column with the arrow keys and drop with Enter, or press 1-7; swipe and tap on touch screens. The computer wins when it can, blocks your four and otherwise searches with minimax and alpha-beta pruning (`connect-four easy|medium|hard`). Wins, losses, draws and streaks are saved (`connect-four stats`, `connect-four reset`).
- **Hangman** (`@qodalis/cli-hangman`, command `hangman`): guess a word from a built-in list of 180 English words with its category as a hint, by typing letters or picking them on the on-screen alphabet with the arrow keys and Enter. Six misses complete the gallows. Games, wins and the current and best streak are saved (`hangman stats`, `hangman reset`).
- Both fit a 40-column terminal and are translated into the ten languages of the other games.

## v2.4.2

### The games moved to their own repository

- The six game plugins now live in [qodalis-solutions/cli-games](https://github.com/qodalis-solutions/cli-games), moved from [web-cli](https://github.com/qodalis-solutions/web-cli) with their history. The npm package names, module exports and commands are unchanged, so nothing changes for consumers.
- `@qodalis/cli-core` is a peer dependency (`^2.4.1`): the games use the core your terminal already has instead of pinning one.
- Built with tsup as before (CJS, ESM, type declarations and the IIFE bundle at `dist/umd/index.global.js` for `pkg add <game>`), tested on Karma ChromeHeadless.

Versions up to 2.4.1 were released from web-cli; see its [CHANGELOG](https://github.com/qodalis-solutions/web-cli/blob/main/CHANGELOG.md).
