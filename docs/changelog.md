# Changelog

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
