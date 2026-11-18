# @qodalis/cli-fifteen-puzzle

Play the 15-puzzle (sliding tiles) in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-fifteen-puzzle.svg)](https://www.npmjs.com/package/@qodalis/cli-fifteen-puzzle)
[![license](https://img.shields.io/npm/l/@qodalis/cli-fifteen-puzzle.svg)](https://github.com/qodalis-solutions/cli-games/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-fifteen-puzzle
```

Or install it at runtime in a running terminal:

```bash
pkg add fifteen-puzzle
```

## Usage

Register `fifteenPuzzleModule` with your terminal.

```typescript
import { fifteenPuzzleModule } from '@qodalis/cli-fifteen-puzzle';

// Angular (template)
// <cli [modules]="[fifteenPuzzleModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(fifteenPuzzleModule)];

// React
<Cli modules={[fifteenPuzzleModule]} />

// Vue
<Cli :modules="[fifteenPuzzleModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(fifteenPuzzleModule);
```

## Commands

`fifteen` (aliases `fifteen-puzzle`, `15puzzle`). Running `fifteen` alone starts a 4x4 game in full-screen mode.

| Command | Description |
|---|---|
| `fifteen` | Start a 4x4 game |
| `fifteen --size=3` | Start a 3x3 game (the 8-puzzle); sizes 3 to 5 |
| `fifteen scores` | Show the best moves and time for each size |
| `fifteen reset` | Reset the best results |

The board is shuffled by random legal moves from the solved position, so every puzzle can be solved. Put the tiles in order with the gap in the bottom-right corner. Tiles already in their place turn green. The timer starts with your first move.

The board fits a 40-column phone screen (a 5x5 board is 36 columns wide) and uses one-line cells when the screen is short.

## Controls

| Key | Action |
|---|---|
| Arrow keys / `W` `A` `S` `D` | Slide a tile into the gap: Left moves the tile right of the gap to the left |
| Swipe (touch screens) | Same as the arrow keys |
| `R` | New game |
| `Esc` | Quit |
| `R` / `Enter` | New game (after solving) |
| `Q` | Quit (after solving) |

The fewest moves and the shortest time per board size are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/fifteen-puzzle

## License

MIT
