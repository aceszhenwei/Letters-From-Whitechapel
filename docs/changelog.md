# Changelog

## Unreleased: difficulty levels

- **Jack's difficulty:** choose Easy (the baseline AI, the default) or Normal (the strategic AI) in the setup dialog. The level shows in the top bar and is remembered; `?difficulty=normal` (or the older `?jack=strategic`) fixes it for testing. Nothing else changes with the level. See [Jack's AI](jack-ai.md#difficulty-levels).

## Unreleased: a smarter Jack

- **Strategic Jack** (`js/ai/strategic-jack.js`): values each move by the measured chance of surviving the police's next turn and of getting home in time, looks two moves ahead, and makes its Hell choices with the same estimates. It wins 97.2% of 5,000 games against a deductive police AI, where the baseline wins 25.0% (94.2% against 46.9% against random police). The baseline stays the default; `index.html?jack=strategic` plays the strategic AI. See [Jack's AI](jack-ai.md).
- **Public record and deduction:** the engine records what the police see each night (`state.police[n].log`); `js/core/deduction.js` works out from it alone where Jack could be and where his hideout could be. Jack's view gains `publicLog()`, `pastLogs()` and `patrols()`; a new `rules.policeView` gives a computer police player only what the police know.
- **Computer police** (`js/ai/police.js`): a deductive player and a random one, for simulations.
- **Simulation tools:** `tools/simulate.js` (many seeded games, in parallel), and `tools/sim/` to compare runs (with McNemar's test), replay a game, diagnose losses, calibrate the estimates and benchmark decisions. Results are in `experiments/`.
- **Tests:** properties of the strategic AI (legal moves, resources, urgency, avoiding danger, keeping tokens, determinism) and of what it may know. The golden traces are unchanged: the baseline plays exactly as before.

## Unreleased: modules for maintainability

- **`js/script.js` split into modules** with one job each: `core/board.js` (map queries), `core/rules.js` (what is legal), `core/engine.js` (state, phases, effects, events), `ai/jack.js` (Jack's decisions) and `ui/renderer.js` (drawing and clicks). See [Architecture](architecture.md).
- **One source of truth for the rules.** The engine, Jack's AI and the interface ask `rules.js` instead of each deciding legality.
- **Jack's AI is replaceable.** It is six decision functions, given a view of what Jack knows. The engine checks each decision against the rules.
- **No behaviour change.** Ten golden traces recorded before the refactor are reproduced step by step. One visible fix: a policeman keeps his colour from Hunting the monster into Clues and suspicion.
- **Tests:** the core, a headless game and Jack's AI are tested without a page. Architecture tests guard the module boundaries.
- **Moved:** vendored libraries to `js/vendor/`, data to `js/data/`.

## Unreleased: clean-up

- Removed the unused Bootstrap 3 files and the `user-interface.html` mock-up.
- README: our own description, credit to the original project, and a note that this is an unofficial fan project. Removed the original author's donation link.

## Interface and documentation ([aceszhenwei/Letters-From-Whitechapel#4](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/4))

- **New interface:** a dark Victorian frame around a parchment board, a sidebar with the current phase, instructions and progress, Jack's public status and a case log, plus intro and game-over dialogs.
- **Board:** circle numbers are visible, streets are drawn as dotted lines from the map data, and tokens are modelled on the physical pieces (coloured policemen, translucent clue and crime scene markers).
- **Responsive:** the board scales to fit; on narrow screens the page becomes one column with the instructions first.
- **Fixes:** phase text no longer repeats every round; map pieces have proper `px` positions (they only worked in quirks mode before).
- **Documentation:** a new `docs/` folder.

## Following the rulebook ([aceszhenwei/Letters-From-Whitechapel#3](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/3))

- Women and Wretched per night, patrol placement on later nights, and a hideout that is never a red circle.
- The Time of the Crime token, the order of Suspense grows and Ready to kill, Wretched movement limits, and crime scenes that stay all game.
- The double event, the move track (15 to 19 moves), escape only by a normal move, and one action per policeman.

## Alleys, coaches and tests ([aceszhenwei/Letters-From-Whitechapel#2](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/2))

- Alleys computed from the map's blocks, and Jack's coach and alley moves.
- Automated unit and regression tests with jsdom, run by GitHub Actions.
- Fixes: finding a clue redrew the map, Jack couldn't walk through map id 0, and crime scene tokens piled up.

## Game logic fixes ([aceszhenwei/Letters-From-Whitechapel#1](https://github.com/aceszhenwei/Letters-From-Whitechapel/pull/1))

- Fixed out-of-range random picks, the hideout choice, `jack.canMove`, Jack heading home, and several display bugs.
- Added game endings and new nights.
