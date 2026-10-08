# Testing

## Running the tests

```
npm install
npm test
```

The tests use Node's built-in test runner (`node:test`) and [jsdom](https://github.com/jsdom/jsdom), a simulated browser, so no real browser is needed. They need Node.js 22 or later and take a minute or two; most of that is the full-game tests.

To run one file, or the tests whose names match a pattern:

```
node --test test/unit/rules.test.js
node --test --test-name-pattern="double event" "test/**/*.test.js"
```

GitHub Actions runs `npm test` on every push to `master` and on every pull request (`.github/workflows/test.yml`).

## What is tested

| File | Covers |
|---|---|
| `test/unit/map.test.js` | Map data: two-way connections, numbers 1 to 195, planarity, alleys, stations and red circles |
| `test/unit/random.test.js` | `randomInt`, `randomSafe`, `randomSafeIndex` stay in range and are biased the right way |
| `test/unit/movement.test.js` | Police and Jack movement, arrestable and searchable circles, walking distances |
| `test/unit/special-moves.test.js` | Coach and alley options, when Jack uses them, and the bookkeeping when he does |
| `test/unit/rules.test.js` | One test for each rule in [Game rules](game-rules.md), named after its rulebook phase |
| `test/unit/ui.test.js` | The interface: pixel positions, visible numbers, streets, phase card, instructions, case log, Jack's status and the game-over dialog |
| `test/regression/bugs.test.js` | One test for each bug that has been fixed, so it can't come back unnoticed |
| `test/regression/full-game.test.js` | Plays 8 seeded games to the end, checking the rules after every action |

The full-game tests check after every action that there are no page errors, the map is drawn once, every crime scene is on the board and the Time of the Crime is between I and V. At the end of a game they check that the ending is one of the four allowed, every Jack move was legal, the move track adds up, special movement tokens were counted, victims per night were 1, 1, 2 and 1, and that every finished night ended with a normal move onto the hideout.

## Test helpers

`test/helpers/game.js` loads the game into jsdom:

| Helper | What it does |
|---|---|
| `loadGame({ seed, base })` | Loads the page and scripts without starting the game. With `seed`, `Math.random` is replaced with a seeded generator. Page errors are collected in `window.errors`. |
| `startGame({ seed, base })` | `loadGame`, then `game.start()`. The game waits at Patrolling the streets. |
| `placePolice(window)` | Places the patrol tokens (on later nights, real patrols where the policemen ended). |
| `policeAction(window, random)` | Takes one police action for the current phase. Returns `'over'` or `'stuck'` when it can't. |
| `playGame(window, { seed, check, maxActions })` | Plays as the police until the game ends, calling `check(window, action)` after each action. |
| `advanceTo(window, state, { seed })` | Plays until the game reaches a phase. |
| `setupNight(window, { base, from, police, remaining, carriages, alleys })` | Sets up a night by hand: Jack at `from`, policemen on the given crossings. |
| `numbered(window)`, `crossingsAround(window, mapid)` | Map lookups. |

## Writing a test

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadGame, setupNight, numbered } = require('../helpers/game');

test('Jack can walk from his crime scene', () => {
	const window = loadGame({ seed: 1 });
	const from = numbered(window)[10];
	setupNight(window, { base: numbered(window)[50], from });
	assert.ok(window.jack.canMove());
});
```

Tips:

- **Arrays from the page belong to another JavaScript realm**, so `deepStrictEqual` fails against a plain array literal. Compare `Array.from(windowArray)` instead.
- **Seed everything that is random**, so a failure can be replayed exactly.
- **When fixing a bug, add a regression test first** and check that it fails without the fix.

## Checking in a real browser

The tests don't render anything, so check visual changes in a browser. Open `index.html`, or drive it with Playwright, which is already installed in the Claude Code cloud environment.
