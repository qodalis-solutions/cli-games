# @qodalis/cli-hangman

Play Hangman in the Qodalis CLI: guess the word one letter at a time.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-hangman.svg)](https://www.npmjs.com/package/@qodalis/cli-hangman)
[![license](https://img.shields.io/npm/l/@qodalis/cli-hangman.svg)](https://github.com/qodalis-solutions/cli-games/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-hangman
```

Or install it at runtime in a running terminal:

```bash
pkg add hangman
```

## Usage

Register `hangmanModule` with your terminal.

```typescript
import { hangmanModule } from '@qodalis/cli-hangman';

// Angular (template)
// <cli [modules]="[hangmanModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(hangmanModule)];

// React
<Cli modules={[hangmanModule]} />

// Vue
<Cli :modules="[hangmanModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(hangmanModule);
```

## Commands

`hangman`. Running `hangman` alone starts a game in full-screen mode.

| Command | Description |
|---|---|
| `hangman` | Start the game |
| `hangman stats` | Show statistics: games played, win rate and streaks |
| `hangman reset` | Reset all statistics |

```bash
hangman
hangman stats
hangman reset
```

Guess a random English word from the built-in list of 180 words (animals, food, countries, computers, sports, nature); its category is shown as a hint. Every wrong letter adds a part to the gallows, and the sixth one ends the game. The screen is 25 columns wide, so it fits a phone terminal.

## Controls

| Key | Action |
|---|---|
| `A`-`Z` | Guess a letter |
| `←` `→` `↑` `↓` | Select a letter on the on-screen alphabet |
| `Enter` / `Space` | Guess the selected letter |
| `Esc` | Quit |
| `R` / `Enter` | Play again (after the game ends) |
| `Q` | Quit (after the game ends) |

During a game only `Esc` quits, since `Q` is a letter. On touch screens, type on the on-screen keyboard, or select a letter with the arrow keys above it and press GUESS.

Statistics (games played, wins, current and best streak) are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/hangman

## License

MIT
