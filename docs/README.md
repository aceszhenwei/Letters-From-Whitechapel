# Letters From Whitechapel: documentation

A browser version of the board game *Letters from Whitechapel* (revised edition). You play the five police detectives, or watch the computer police; the computer plays Jack the Ripper. It is a static site: plain JavaScript with jQuery and Underscore, with no build step. The rules, the game engine and the AIs run without the page, so they can be tested and simulated in Node.

## Quick start

```
open index.html          # or serve the folder with any static web server
npm install && npm test  # run the automated tests (Node.js 22 or later)
```

## Where to start

| I want to… | Read |
|---|---|
| Know the rules as this game plays them | [Game rules](game-rules.md) |
| Find my way around the code | [Architecture](architecture.md) |
| Know which AIs exist, which level plays each, and how they are configured | [AI overview](ai.md) |
| Run the tests or reproduce an experiment | [Testing](testing.md) |
| Export a game I played, or check and analyse exported games | [Game records](game-records.md) |
| Make a change | [Contributing](contributing.md) |
| Know why an AI is the way it is | [Research reports](#research-reports), below |

## Reference

The current description of the game and the code. Each topic has one page; the others link to it.

| Document | What it covers |
|---|---|
| [Architecture](architecture.md) | The modules (board, rules, engine, AIs, interface), why they are split that way, the state and phases, and where new behaviour goes |
| [Game rules](game-rules.md) | The rules as implemented, where each lives in the code, what is not implemented, and known differences from the physical game |
| [Map data](map-data.md) | The board graph in `js/data/map.js`: positions, streets, numbers, stations, alleys, its verification against the physical board, and how to edit it safely |
| [AI overview](ai.md) | Every Jack and police AI, the difficulty levels, their options, and the evidence behind each |
| [Jack's AI](jack-ai.md) | The interface every Jack AI implements, what Jack may know, the difficulty levels, and the baseline and strategic Jacks with their evaluation |
| [User interface](ui.md) | Layout, components, design tokens, the CSS class contract, accessibility and responsiveness |
| [Game records](game-records.md) | Exporting a game (public or full record), the record format and its versions, hidden information, checking and replaying records, summaries, test fixtures, privacy |
| [Testing](testing.md) | Running the tests, the test tiers, seeds and reproducibility, the test helpers, and writing new tests |
| [Contributing](contributing.md) | Setting up, code conventions, and the pull request checklist |

## Research reports

The studies behind the AIs, oldest first. They are kept as the evidence for the current AIs: their methods, seeds, negative results and limitations stand as written, and a later study builds on, rather than replaces, an earlier one. Each names its scripts and the commands that reproduce it; [Testing](testing.md#seeds) lists every seed range.

| Report | Question | Outcome | Scripts and results |
|---|---|---|---|
| [Jack's AI](jack-ai.md) (sections 1–10) | Can Jack plan by measured risk instead of rules of thumb? | Strategic Jack (Normal) | `tools/sim/`, [`experiments/`](../experiments/) |
| [Detective inference](detective-inference-study.md) | Why do the computer police lose to Strategic Jack? Is their deduction right? (compared with whitechapelR) | The deduction is sound; the police misuse it. Its recommendations led to Detective AI v2 | [`research/detective-inference/`](../research/detective-inference/) |
| [Detective AI v2](detective-ai-v2.md) | Can the police use what they know about the hideout? | Detective AI v2 (Normal police) and the coach deduction fix | [`research/detective-v2/`](../research/detective-v2/) |
| [Jack AI v2](jack-ai-v2.md) | Why does Strategic Jack lose to Detective AI v2, and what fixes it? | Jack AI v2 (Hard); its independent validation is proposed, not run | [`research/jack-v2/`](../research/jack-v2/) |
| [Human strategy literature](human-strategy-literature.md) | What do experienced players do that the AIs don't? | Gap analysis; no AI changed. It motivated Detective AI v3 | [`research/human-strategy/`](../research/human-strategy/) |
| [Detective AI v3](detective-ai-v3.md) | Can the police prepare for a Jack who kills next to his hideout? | Detective AI v3 (Hard police); its independent validation is proposed, not run | [`research/detective-v3/`](../research/detective-v3/) |
| [Fake Wretched and fake patrols](deception-audit.md) | Do the AIs use the preparation phase's deception mechanics strategically? | No: both follow fixed rules, and against the current AIs perfect information about either is worth nothing measurable. Not included in Detective AI v4's core | [`research/deception-audit/`](../research/deception-audit/) |
| [Strategic waiting](jack-waiting.md) | Why do Strategic Jack and Jack AI v2 never wait, and should they? | A fixed rule, right against the original police. A measured waiting policy gained against Detective AI v3 on two held-out sets (+8 and +4 points; the pre-registered test was not significant), but a third found 0.0; it doesn't regress. Patrol information is still worthless. An option and a research opponent, not a level | [`research/jack-waiting/`](../research/jack-waiting/) |
| [Waiting against containment](waiting-containment.md) | Does strategic waiting beat Detective AI v3's last-night containment, and should v3 change? | No: Jack AI v2 never kills one walk from home, so containment is never involved; waiting on the last night alone changes nothing; `containWretched` changes no win rate. No new detective version | [`research/waiting-containment/`](../research/waiting-containment/) |
| [Detective coordination and inference](detective-study.md) | Do v3's policemen fail through coordination, hideout inference or interception, and is Detective AI v4 justified? | Hideout inference is the one large gap (told the hideout, v3 wins 119 more games and loses 5), but no legal weighting recovers it; coordination loses; interception decisions rarely fail. No v4 | [`research/detective-study/`](../research/detective-study/) |

## Project

| Document | What it covers |
|---|---|
| [Roadmap](roadmap.md) | What is implemented, known limitations, potential research (not approved) and other ideas |
| [Changelog](changelog.md) | What changed, pull request by pull request |
| [Archive](archive/README.md) | Superseded plans and earlier rounds of results, kept for the record |

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
