# @qodalis/cli-connect-four

Play Connect Four against the computer in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-connect-four.svg)](https://www.npmjs.com/package/@qodalis/cli-connect-four)
[![license](https://img.shields.io/npm/l/@qodalis/cli-connect-four.svg)](https://github.com/qodalis-solutions/cli-games/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-connect-four
```

Or install it at runtime in a running terminal:

```bash
pkg add connect-four
```

## Usage

Register `connectFourModule` with your terminal.

```typescript
import { connectFourModule } from '@qodalis/cli-connect-four';

// Angular (template)
// <cli [modules]="[connectFourModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(connectFourModule)];

// React
<Cli modules={[connectFourModule]} />

// Vue
<Cli :modules="[connectFourModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(connectFourModule);
```

## Commands

`connect-four` (aliases `connect4`, `c4`). Running it alone starts a game against the medium computer in full-screen mode.

| Command | Description |
|---|---|
| `connect-four` | Start a game (medium) |
| `connect-four easy` | Start a game against the easy computer |
| `connect-four medium` | Start a game against the medium computer |
| `connect-four hard` | Start a game against the hard computer |
| `connect-four stats` | Show statistics: wins, losses, draws and streaks |
| `connect-four reset` | Reset all statistics |

```bash
connect-four
connect-four hard
connect-four stats
```

Drop your red discs into the 7x6 board and line up four in a row (across, down or diagonally) before the computer does with its yellow discs. A full board is a draw. You start the first game; after that you take turns starting.

The computer takes a winning move when it has one, blocks yours, and otherwise looks ahead with minimax and alpha-beta pruning, preferring the center: one move ahead on easy, four on medium, six on hard.

The board is 29 columns wide, so it fits a phone terminal.

## Controls

| Key | Action |
|---|---|
| `←` `→` (or `A`/`D`) | Choose a column |
| `Enter`, `Space` or `↓` | Drop a disc in the chosen column |
| `1`-`7` | Drop a disc in that column |
| `Esc` / `Q` | Quit |
| `R` | New game (during a game or after it ends) |

On touch screens, swipe left or right to choose a column and tap to drop; the key row also has the column numbers.

Statistics are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/connect-four

## License

MIT
