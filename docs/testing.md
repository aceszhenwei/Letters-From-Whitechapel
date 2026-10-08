# Testing

## Running the tests

```
npm install
npm test
```

The tests use Node's built-in test runner (`node:test`). Most of them run the game's core directly in Node. Tests of the interface use [jsdom](https://github.com/jsdom/jsdom), a simulated browser, so no real browser is needed. They need Node.js 22 or later and take about two minutes; most of that is the golden traces and full-game tests, which play through the simulated page.

To run one file, or the tests whose names match a pattern:

```
node --test test/unit/rules.test.js
node --test --test-name-pattern="double event" "test/**/*.test.js"
```

GitHub Actions runs `npm test` on every push to `master` and on every pull request (`.github/workflows/test.yml`).

## Three ways in

| Layer | Loader | Speed | Use it for |
|---|---|---|---|
| **Core** | `loadCore({ seed })` in `test/helpers/core.js`: map, board, rules, engine and AI in a bare JavaScript context, with no page | Milliseconds | Rules, the engine, Jack's AI, the map |
| **Headless game** | `playHeadless(WC, game, { seed })` in `test/helpers/headless.js`: plays the police through engine actions | About 0.1 s per game | Whole games, simulations, comparing AIs |
| **Page** | `loadGame` and `startGame` in `test/helpers/game.js`: the real `index.html` and scripts in jsdom | Seconds per game | What the player sees and clicks |

If a core module touched the page, it would fail to load in the core loader. That makes the boundary in [Architecture](architecture.md) testable.

## What is tested

| File | Layer | Covers |
|---|---|---|
| `test/unit/map.test.js` | Page | Map data: two-way connections, numbers 1 to 195, planarity, alleys, stations and red circles |
| `test/unit/random.test.js` | Core | `int`, `safe` and `safeIndex` stay in range and are biased the right way |
| `test/unit/movement.test.js` | Core | Police and Jack movement, arrestable and searchable circles, distances |
| `test/unit/rules-api.test.js` | Core | Track labels, patrol placement, coach routes, escapes, and that no rule changes the state |
| `test/unit/rules.test.js` | Page | One test for each rule in [Game rules](game-rules.md), named after its rulebook phase |
| `test/unit/special-moves.test.js` | Core and page | Coach and alley options, when Jack uses them, and the bookkeeping when he does |
| `test/unit/engine.test.js` | Core | 20 complete games without a page; illegal police actions refused; search or arrest; AI decisions checked; another AI plugged in; events |
| `test/unit/jack-ai.test.js` | Core | The view hides patrol identities and the public record hides Jack's route; decisions only read the view; reproducible with its own random source |
| `test/unit/strategic-jack.test.js` | Core | The strategic AI over six whole games against the deductive police, and in positions set up by hand: only legal moves, never a token he doesn't have, goes home when time is short, keeps in time, avoids a walk the police could reach, keeps tokens when a walk does as well, same seed same game; what it may know: it only reads the view, the police view and public record hold nothing secret, the deduction never rules out the truth, and the AI files never read the state |
| `test/unit/difficulty.test.js` | Core and page | Easy is the baseline AI (the same object), Normal the strategic AI; the default is Easy; the order address > dialog > saved > default; whole games at each level with legal moves and only the view read; the rules and police view are the same at both levels; the setup dialog lists, pre-selects, applies, remembers and shows the level, and an address fixes it; the chosen AI makes every move of a whole page game |
| `test/unit/architecture.test.js` | Source | The module boundaries: the core (including the deduction) never touches the page, only the engine changes the state (not the rules, deduction, AIs or interface), only the engine runs the AI |
| `test/unit/ui.test.js` | Page | Pixel positions, visible numbers, streets, phase card, instructions, case log, Jack's status, game-over dialog |
| `test/regression/bugs.test.js` | Page | One test for each bug that has been fixed |
| `test/regression/ui-flows.test.js` | Page | Search, failed arrest, switching a patrol between real and fake, and Stay |
| `test/regression/full-game.test.js` | Page | Plays 8 seeded games to the end, checking the rules after every action |
| `test/regression/golden-traces.test.js` | Page | Plays 10 seeded games and compares them with recorded traces, step by step |

### Golden traces

`test/fixtures/golden-traces.json` records ten seeded games played through the page. For each game it keeps:

- every police action;
- Jack's moves and routes;
- the case log and the ending;
- a hash of the phase title, progress line, move track and Jack's panel after every action;
- a hash of the final state.

They were recorded from the code before the module refactor, and the refactored code reproduces them exactly. Any change that alters how a seeded game plays, even one random number, makes them fail and shows where the games diverge.

If a change is *meant* to alter behaviour (a rule fix, a new AI), regenerate them and say so in the pull request:

```
node test/fixtures/generate-golden-traces.js
```

Because the default AI draws on `Math.random`, which jQuery's selector engine also uses, a seemingly harmless change in the interface (filtering elements with certain selectors) can shift the random numbers and fail the traces. See "Coupling deliberately kept" in [Architecture](architecture.md).

### The strategic AI and the golden traces

The golden traces play the baseline AI, which is still the game's default, so they are unchanged. The strategic AI is checked by the properties above, and its playing strength by simulation, not by tests (`node tools/simulate.js`, see [Jack's AI](jack-ai.md#8-evaluation-method)): a test can say a move is legal, but only many games can say it is good.

## Test helpers

| Helper | What it does |
|---|---|
| `loadCore({ seed })` | The core in a bare context. Returns the context: `WC`, `map`, `_` |
| `nightState(WC, { base, from, police, remaining, carriages, alleys, timeOfCrime, crimeScenes })` | A state with one night set up by hand |
| `playHeadless(WC, game, { seed, check })`, `policeTurn(WC, game, random)` | Play the police through engine actions |
| `loadGame({ seed, base })` | The page in jsdom, not started. Page errors go to `window.errors` |
| `startGame({ seed, base })` | `loadGame`, then `game.start()`. Waits at Patrolling the streets |
| `placePolice`, `policeAction`, `playGame`, `advanceTo` | Play the police by clicking the page |
| `setupNight(window, {...})`, `chooseHideout(window)` | Set up a night, or the hideout, in the page |
| `traceGame(seed)` in `test/helpers/trace.js` | Record a game's trace |

## Writing a test

For a rule or a decision, use the core:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadCore, nightState } = require('../helpers/core');

const { WC } = loadCore();

test('Jack can walk from his crime scene', () => {
	const from = WC.board.numbered()[10];
	const state = nightState(WC, { base: WC.board.numbered()[50], from });
	assert.ok(WC.rules.jackCanMove(state));
});
```

Tips:

- **Arrays from the game belong to another JavaScript realm** (the jsdom window or the core context), so `deepStrictEqual` fails against a plain array literal. Compare `Array.from(array)` instead.
- **Seed everything that is random**, so a failure can be replayed exactly.
- **When fixing a bug, add a regression test first** and check that it fails without the fix.
- **Prefer the core over the page** unless the test is about what the player sees.

## Checking in a real browser

The tests don't render anything, so check visual changes in a browser. Open `index.html`, or drive it with Playwright, which is already installed in the Claude Code cloud environment.
