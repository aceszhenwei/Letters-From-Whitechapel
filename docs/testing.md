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

## Test tiers

The simulations and research behind the AIs take up to a couple of hours in full, so testing is split into tiers. Use the cheapest tier that covers a change; the expensive ones are for algorithmic changes and research milestones.

| Tier | Command | What it runs | When | Typical time (4 cores) |
|---|---|---|---|---|
| Fast | `npm test` (or `npm run test:unit`, `npm run test:regression`) | Unit and regression tests, including the golden traces | Every change; CI runs it | 1.7 min |
| Smoke | `npm run test:smoke` | Small simulations: every Jack against every police (4 games each), seeded determinism, the deduction against the exhaustive reference, the improved police from the research harness, Jack AI v2 against both police (each game twice), strategic waiting against Detective AI v3 (each game twice) | Any change to the AIs, rules, engine, map or research scripts; CI runs it too | 30 s (Jack v2's part 7 s) |
| Medium | `npm run eval:medium` | 500 games per Jack against the deductive police; the original against the study's improved police and against Detective AI v2 (300 games per Jack); Strategic, Detour and [Jack AI v2](jack-ai-v2.md) against Detective AI v2 (100 games each); [Detective AI v3](detective-ai-v3.md) against v2 (30 games each against a short-return Jack and Strategic Jack); a 10-game soundness check. Development seeds only. Results in `experiments/medium/` | Algorithmic changes to the AIs, the police or the deduction, before running the full tier | 13 min |
| Full | `npm run research:full` (set `WHITECHAPELR_CLONE` for the whitechapelR comparisons) | The [Detective AI v3](detective-ai-v3.md) study's comparison, ablation and confirmation (`research/detective-v3/`), the [Jack AI v2](jack-ai-v2.md) study's screening, comparison and ablation (`research/jack-v2/`), the [Detective AI v2](detective-ai-v2.md) evaluation (`research/detective-v2/run-evaluation.sh`), the whole detective study (`research/detective-inference/run-all.sh`) and the four 5,000-game evaluations of [Jack's AI](jack-ai.md) | Research milestones, and before publishing or relying on new numbers. Never routine | about 3 h 50 min: the Detective v3 study 35 min, the Jack v2 study 25 min, the v2 evaluation 63 min, the study 52 min, the four Jack evaluations about 50 min |

`node tools/tiers/run-tier.js <tier>` runs any tier and prints each step's time. Every tier is defined in `tools/tiers/tiers.js`.

**Not repeating expensive work.** Each medium and full step lists the files its results depend on: the game's code, the simulation tools, and for research steps the research scripts and fixtures. The runner keeps a fingerprint of those files and the command in `experiments/tiers/manifest.json`, together with how long the step took and when. If nothing a step depends on has changed and its outputs are still there, the step is skipped and its earlier results stand. Change one line of the police AI, and the research steps run again; change only the docs, and nothing does.

- `--force` runs a step regardless.
- `--dry-run` shows what would run.
- `--record <seconds>` marks steps whose outputs were produced outside the runner (for example by calling `run-all.sh` directly) as done with today's inputs.

The fast and smoke tiers are never skipped.

The Jack v2 study's own scripts (`research/jack-v2/run.js`) also keep every game they play, fingerprinted by the files it depends on, so an interrupted run resumes and an unchanged game is never played twice. Its independent validation (`research/jack-v2/validate.sh`) is in no tier: it runs only by hand, once approved (see [Jack AI v2](jack-ai-v2.md#9-independent-validation-proposed-not-run)).

**Runtimes.** `experiments/tiers/manifest.json` records the last time of every step the runner ran. The table above gives typical times, measured on an otherwise idle 4-core machine. Update it when a tier's cost changes noticeably.

## Seeds

Every experiment uses fixed seeds, so it plays the same games on every run and every machine. The ranges are kept apart, so no experiment is tuned on another's games. This table is the reference for every range in use or reserved; check it before choosing seeds for a new experiment.

| Seeds | Used for |
|---|---|
| 1–5,000 | Final evaluation of the Jack AIs, and the detective study's main runs |
| 300001 on | Development (the medium tier) |
| 410001–410100 | Jack v2 study: screening |
| 420001–420200 | Jack v2 study: controlled comparison and ablation |
| 440001–440100 | Human strategy study: experiments |
| 450001–450030 | Detective v3 study: screening |
| 460001–460100 | Detective v3 study: comparison and ablation |
| 470001–470100 | Detective v3 study: confirmation |
| 480001–480500 | Detective v3 study: reserved for its independent validation |
| 490001–490100 | Fake Wretched and fake patrol audit ([Deception audit](deception-audit.md)) |
| 530001–530050 | Strategic waiting: exploration ([Strategic waiting](jack-waiting.md)) |
| 540001–540050 | Strategic waiting: calibration of the escape table |
| 550001–550200 | Strategic waiting: focused comparison |
| 560001–560300 | Strategic waiting: independent validation |
| 570001–570050 | Waiting against containment: exploration ([Waiting against containment](waiting-containment.md)) |
| 580001–580200 | Waiting against containment: focused comparisons |
| 590001–590030 | Detective coordination and inference: exploration and held-out Jack ([Detective coordination and inference](detective-study.md)) |
| 591001–591100 | Detective coordination and inference: focused comparison |
| 600001–600500 | Fresh-seed validation in the detective study |
| 650001–650500 | Fresh-seed validation of Detective AI v2 |
| 700001–700060 | Deduction soundness checks |
| 760001–761000 | Jack v2 study: reserved for its independent validation |
| 800001 on | Smoke tests |
| 900001 on | Calibration of the strategic Jack |

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
| `test/unit/map-topology.test.js` | Core | The 13 connections verified against the physical board, the totals of walking links, alleys and streets, and the differences from whitechapelR's map ([Map data](map-data.md#verified-against-the-board)) |
| `test/unit/random.test.js` | Core | `int`, `safe` and `safeIndex` stay in range and are biased the right way |
| `test/unit/movement.test.js` | Core | Police and Jack movement, arrestable and searchable circles, distances |
| `test/unit/rules-api.test.js` | Core | Track labels, patrol placement, coach routes, escapes, and that no rule changes the state |
| `test/unit/rules.test.js` | Page | One test for each rule in [Game rules](game-rules.md), named after its rulebook phase |
| `test/unit/special-moves.test.js` | Core and page | Coach and alley options, when Jack uses them, and the bookkeeping when he does |
| `test/unit/engine.test.js` | Core | 20 complete games without a page; illegal police actions refused; search or arrest; AI decisions checked; another AI plugged in; events, including the `action` events |
| `test/unit/jack-ai.test.js` | Core | The view hides patrol identities and the public record hides Jack's route; decisions only read the view; reproducible with its own random source |
| `test/unit/strategic-jack.test.js` | Core | The strategic AI over six whole games against the deductive police, and in positions set up by hand: only legal moves, never a token he doesn't have, goes home when time is short, keeps in time, avoids a walk the police could reach, keeps tokens when a walk does as well, same seed same game; what it may know: it only reads the view, the police view and public record hold nothing secret, the deduction never rules out the truth, and the AI files never read the state |
| `test/unit/jack-v2.test.js` | Core | Jack AI v2 over whole games against Detective AI v2 and the original police, and in positions set up by hand: legal walks and special movements; detours only away from home, in a night's first moves, never on the last night, always keeping 6 moves to spare; no detour when time is short or policemen block every walk; the same seed plays the same game; a planner failure still gives a legal move; it only reads Jack's view and never changes the state |
| `test/unit/jack-waiting.test.js` | Core | Strategic waiting: positions set up by hand (time pays; no gain, so kill; the police could move the victim into a patrol's reach; a reveal that may clear the only patrol in reach; one wait left at IV; the last night's row), whole games against Detective AI v3 with every decision traced, the legal Wretched moves Jack is told match the rules, the same seed plays the same game, and no difficulty level plays it |
| `test/unit/police-undo.test.js` | Core | Undoing a policeman's move restores his crossing, route and turn; several moves undo newest first; Done only once everyone has moved, and no undo after it; moving and undoing record nothing; without the settings the computer police play whole games as before; the night review waits for `beginNextNight`; four-night games end on the last escape; night records are frozen, unchanged by later nights, and hold only public facts |
| `test/unit/waiting-containment.test.js` | Core | Waiting against v3's containment, in positions set up by hand: killing at once against a closed one-walk escape; one wait, where the police's move opens it or not; two waits, beyond the threat model; the model counting circles no Wretched can reach; across the board, how often v3's and `containWretched`'s moves open an escape; and that the police's choice never depends on Jack's true hideout |
| `test/unit/detective-study.test.js` | Core | The detective study's analysis tools: walking distance with policemen blocking crossings, and a cut on the 111/134/147 crossing; the cut search near and far from the hideout; the route-style likelihoods are distributions and the style-learning model is uniform before any night; log loss and Brier scores |
| `test/unit/game-records.test.js` | Core | Game records: every kind of action recorded and replayed exactly (four nights, waiting, coaches and alleys, searches and arrests, night reviews); what the police's and Jack's public records may show; the women before and after the victims are chosen; a full record only after the game ends or is ended on purpose; undone moves and patrol tokens taken back kept apart; each action's `known`; the example files, fixtures and the summary; malformed, tampered and incompatible records rejected; no personal data; recording changes no game |
| `test/regression/game-export-ui.test.js` | Page | The export dialog: a human detective's game played by clicking (with a move undone), both records saved and read back (the full one replays); a game in progress offers only the police's record until the player confirms ending it |
| `test/unit/containment.test.js` | Core | Detective AI v3's tactical scenarios: the blocking crossings of a one-walk escape; the hideout-134 scheme beats v2 (even when told the hideout) but not v3; central hideouts and the Night 4 trap; the defence following an uncertain belief; coordination; whole legal, deterministic games; v2 unchanged with the options off |
| `test/unit/human-strategy-scenarios.test.js` | Core | Board facts from the BoardGameGeek threads, in printed numbers: circle degrees, the circles next to two red circles, a coach and a step from 27, the 65/66 and 111/134/147 crossings' effect, a two-policeman cordon of 175 and 188 |
| `test/unit/deduction.test.js` | Core | The deduction against an exhaustive list of legal routes: a coach never ends where it started (in `track` and the projection), its stop counts as visited, random records with coaches, walks, alleys and searches match exactly, and real games never lose Jack's circle |
| `test/unit/police-levels.test.js` | Core and page | Who leads the detectives (Developer Mode, or the address): the player by default and outside Developer Mode, Easy is the original police, Normal is Detective AI v2, Hard is Detective AI v3; the address, dialog and saved choice; a computer police plays a whole page game by itself, independently of Jack's difficulty |
| `test/unit/difficulty.test.js` | Core and page | Easy is the baseline AI (the same object), Normal the strategic AI, Hard Jack AI v2, Hard, waiting Jack AI v2 with strategic waiting; the default is Normal; players are offered Normal and Hard only, by name, and lead the detectives; Developer Mode offers every level and saves its own choice, which never carries into an ordinary game; an address still selects a developer-only level; the order address > dialog > saved > default; whole games at each level with legal moves and only the view read; the rules and police view are the same at both levels; the setup dialog lists, pre-selects, applies, remembers and shows the level, and an address fixes it; the chosen AI makes every move of a whole page game |
| `test/unit/architecture.test.js` | Source | The module boundaries: the core (including the deduction) never touches the page, only the engine changes the state (not the rules, deduction, AIs or interface), only the engine runs the AI |
| `test/unit/ui.test.js` | Page | Pixel positions, visible numbers, streets, phase card, instructions, case log, Jack's status, game-over dialog |
| `test/regression/night-review-ui.test.js` | Page | The women ringed and all alike, the highlight; the Wretched shown and the selected one marked; undo and Done by clicking; the review board, its log (written only from the public record), walking distances, and that reviewing changes nothing; an earlier night during a later one; whole games through every review |
| `test/regression/bugs.test.js` | Page | One test for each bug that has been fixed |
| `test/regression/ui-flows.test.js` | Page | Search, failed arrest, switching a patrol between real and fake, and Stay; in Clues and suspicion one policeman acts at a time and a clue found never strands another (the reported softlock), policemen beside the same circle keep their own tokens, and the two faster search buttons; zooming the board (it scrolls when larger than the space), the board scrollable while watching the computer police, destination rings above the Stay pill, and a tapped policeman's pills brought to the front |
| `test/regression/full-game.test.js` | Page | Plays 8 seeded games to the end, checking the rules after every action |
| `test/regression/golden-traces.test.js` | Page | Plays 10 seeded games and compares them with recorded traces, step by step |

### Golden traces

`test/fixtures/golden-traces.json` records ten seeded games played through the page. For each game it keeps:

- every police action;
- Jack's moves and routes;
- the case log and the ending;
- a hash of the phase title, progress line, move track and Jack's panel after every action;
- a hash of the final state.

They were recorded from the code before the module refactor, and the refactored code reproduces them exactly. They were recorded before the page's confirm and review steps existed, so the trace harness switches `game.settings.confirmPoliceMoves` and `reviewNights` off; with them off, the same actions play the same game. Any change that alters how a seeded game plays, even one random number, makes them fail and shows where the games diverge.

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
