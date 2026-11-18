# @qodalis/cli-mastermind

Play Mastermind, the code-breaking game, in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-mastermind.svg)](https://www.npmjs.com/package/@qodalis/cli-mastermind)
[![license](https://img.shields.io/npm/l/@qodalis/cli-mastermind.svg)](https://github.com/qodalis-solutions/cli-games/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-mastermind
```

Or install it at runtime in a running terminal:

```bash
pkg add mastermind
```

## Usage

Register `mastermindModule` with your terminal.

```typescript
import { mastermindModule } from '@qodalis/cli-mastermind';

// Angular (template)
// <cli [modules]="[mastermindModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(mastermindModule)];

// React
<Cli modules={[mastermindModule]} />

// Vue
<Cli :modules="[mastermindModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(mastermindModule);
```

## Commands

`mastermind`. Running `mastermind` alone starts the game in full-screen mode.

| Command | Description |
|---|---|
| `mastermind` | Start the game |
| `mastermind stats` | Show games played, win rate and the fewest guesses in a win |
| `mastermind reset` | Reset the statistics |

The secret code has 4 colours, numbered 1 to 6 (red, green, yellow, blue, magenta, cyan); colours can repeat. You have 10 guesses. After each guess:

- `●` (green): a right colour in the right place
- `○` (yellow): a right colour in the wrong place

Each colour of the code counts once: guessing `1 1 1 1` against `1 2 3 4` gives one `●` and nothing else. The board fits a 40-column phone screen.

## Controls

| Key | Action |
|---|---|
| `1`-`6` | Put a colour in the current slot and move to the next |
| Left / Right (`A` / `D`) | Move between slots |
| Up / Down (`W` / `S`) | Change the colour in the current slot |
| Swipe (touch screens) | Same as the arrow keys |
| `Backspace` | Clear a slot |
| `Enter` | Submit the guess |
| `Esc` / `Q` | Quit |
| `R` / `Enter` | New game (after the game ends) |

Statistics (games played, games won, fewest guesses) are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/mastermind

## License

MIT
