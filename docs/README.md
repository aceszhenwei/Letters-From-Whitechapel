# Letters From Whitechapel: documentation

A browser version of the board game *Letters from Whitechapel* (revised edition). You play the five police detectives; the computer plays Jack the Ripper. It is a static site: plain JavaScript with jQuery and Underscore, with no build step. The rules, the game engine and Jack's AI run without the page, so they can be tested and simulated in Node.

## Quick start

```
open index.html          # or serve the folder with any static web server
npm install && npm test  # run the automated tests (Node.js 22 or later)
```

## Documents

| Document | What it covers |
|---|---|
| [Architecture](architecture.md) | The modules (board, rules, engine, Jack's AI, interface), why they are split that way, the state and phases, and where new behaviour goes |
| [Game rules](game-rules.md) | The rules as implemented, where each lives in the code, and what is not implemented |
| [Map data](map-data.md) | The board graph in `js/data/map.js`: positions, streets, numbers, stations, alleys, and how to edit it safely |
| [Jack's AI](jack-ai.md) | How the computer plays Jack: hideout, targets, killing, walking, coaches and alleys |
| [User interface](ui.md) | Layout, components, design tokens, the CSS class contract, accessibility and responsiveness |
| [Testing](testing.md) | Running the tests, how they are organised, the test helpers, and writing new tests |
| [Contributing](contributing.md) | Setting up, code conventions, and the pull request checklist |
| [Roadmap](roadmap.md) | Known limitations and ideas for future work |
| [Changelog](changelog.md) | What changed, release by release |

## Glossary

| Term | Meaning |
|---|---|
| **Map id** | The index of a place in the `map` array (0 to 428). Code uses map ids everywhere. |
| **Number** | The number printed on a numbered circle (1 to 195). Players see numbers. `map[id].number` converts. |
| **Numbered circle** | Where Jack, women and Wretched stand. Jack walks between them. |
| **Crossing** | A place between numbered circles. Policemen and patrol tokens stand on crossings. |
| **Yellow-bordered crossing** | Where patrols can start (`map[id].station`). |
| **Red numbered circle** | Where women are placed and murders happen (`map[id].murder`). |
| **Hideout** | Jack's secret base (`game.state.base`). The code calls it *base*. |
| **Coach** | Jack's double move, which can pass police. Code calls it *carriage*. |
| **Alley** | Jack's move across a block to any circle around it. Older data called it *lantern*. |
| **Night** | One of the four rounds. Each has two parts: *Hell* (the murder) and *Hunting* (the chase). |
| **Move track** | The 20 spaces V, IV, III, II, I, 1 to 15 that time the night. |
