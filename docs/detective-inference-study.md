# Detective inference: a study

Why does the strategic Jack beat the computer police in 97.2% of games (the 5,000-game evaluation in [Jack's AI](jack-ai.md), on the previous map), and what should be improved in the police next? This study compares the police's deduction with [whitechapelR](https://github.com/bmewing/whitechapelR), checks it against an exhaustive reference, and takes the police's play apart turn by turn.

Every script and result is in [`research/detective-inference/`](../research/detective-inference/), with the commands to reproduce them in its README. The study changed none of the game's AI or deduction code.

> **Map.** During the study, whitechapelR's map topology was made canonical for this project: 10 walking links were removed, 2 added and 1 alley added ([Map data](map-data.md#topology-corrections)). Unless marked otherwise, the numbers here are on the **corrected map**. Results from the first round, on the previous map, are kept in `research/detective-inference/results/previous-map/` and are labelled *(previous map)* where they are quoted. The conclusions are the same on both maps; where a number moved meaningfully, both are given.

## Contents

1. [Executive summary](#1-executive-summary)
2. [Research questions and method](#2-research-questions-and-method)
3. [whitechapelR: what it does](#3-whitechapelr-what-it-does)
4. [Audit of this project's deduction and police](#4-audit-of-this-projects-deduction-and-police)
5. [Capability matrix](#5-capability-matrix)
6. [Inference scenarios and correctness](#6-inference-scenarios-and-correctness)
7. [Deductive against random police](#7-deductive-against-random-police)
8. [Hideout information leakage](#8-hideout-information-leakage)
9. [Methods from the literature](#9-methods-from-the-literature)
10. [Recommendations](#10-recommendations)
11. [Limitations and open questions](#11-limitations-and-open-questions)

## 1. Executive summary

The police's **logical inference is sound and nearly complete**. Over 26,192 prefixes of public records from 120 games, the deduction never ruled out Jack's true circle. On the 20,755 short records that can be checked exhaustively, it found exactly the possible circles in 18,678 and a superset in the rest. Its only flaw is after a coach: it allows a coach to end where it started, which the rules forbid. whitechapelR computes the same sets in every scenario where it finishes, but it keeps every route separately, so its work grows about 8.6-fold per move (28.6 million routes and 344 seconds after 8 walks, against 3 ms for this project's deduction). The two maps now have identical topology, by project decision; the 13 links where they differed are resolved in whitechapelR's favour.

The police lose for two other reasons:

- **Belief estimation: the hideout weights point the wrong way.** The deduction weights each possible hideout as if Jack wandered at random. That favours circles near the crime scenes, but a Jack who goes straight home ends far from them. On nights when the strategic Jack took the shortest route, his real hideout got **0.13 times** the weight of a uniform guess over the remaining candidates. At the start of night 4, the deduction gives the true hideout 5.6% on average, where a uniform guess over the same candidates gives 9.4%.
- **Decision-making: the police never use what they know about the hideout.** They chase Jack's likely position tonight and stand next to his circle in only 2.3% of turns against the strategic Jack (10.8% against the baseline). The hideout, the one place Jack must reach, plays no part in where they stand: their blocking weight is set to 0.

Turning on the police's existing blocking (standing near the likely hideouts), with whitechapelR's uniform weighting of the candidates, cuts the strategic Jack's win rate from **98.6% to 71.6%** over 500 paired games (p < 10⁻⁶). On fresh seeds it falls from **97.4% to 68.4%**. (On the previous map: 97.8% to 67.0%, and 96.4% to 68.2%.) Against the baseline Jack the gain is smaller and less certain: 25.2% to 18.2% (p = 0.005) on the first seeds, but 24.0% to 20.6% (p = 0.21, not significant) on the fresh ones. With the current weighting, blocking helped against the strategic Jack (82.2%) but **hurt** against the baseline (30.0%). That is why it had been switched off when it was tuned against the baseline.

**Why random police do better than deductive police against the strategic Jack:** the strategic Jack's arrest-risk estimates were measured against the deductive police, who arrest only when they are at least 20% sure of a circle. So Jack sits next to policemen on circles the deduction rates low. Random police ignore the belief and arrest often (17.4 failed arrests a game, against 1.4), so they turn far more of their chances into arrests (11.5% against 2.4%). This is an exploited, predictable decision rule, not an inference problem.

**Recommendation:** the next implementation should focus on **detective action selection**: positioning that uses hideout knowledge, with better-calibrated hideout weights. A small correctness fix for coaches should go with it. A new deduction algorithm, or a port of whitechapelR, would not help: the sets it computes are already right.

## 2. Research questions and method

The central question is why the strategic Jack defeats the deductive police in 97.2% of games, and what would reduce that. Following the brief, the study separates three capabilities:

| Capability | Question | How it was measured |
|---|---|---|
| Logical inference | Which positions and routes are still possible? | Exhaustive enumeration of every legal route on short records; Jack's true circle checked on every prefix of every night (section 6) |
| Belief estimation | How likely is each possibility? | The probability on the truth, its rank, entropy, and comparison with a uniform guess (sections 7 and 8) |
| Decision-making | Which actions catch Jack? | Each police turn split into opportunity (a policeman next to Jack's circle), belief at that moment, and the action taken; then controlled changes to the police's decisions only (section 7) |

**Method.**

- **whitechapelR.** I cloned it (commit `20032d5`, version 0.3.0, MIT licence) outside this repository, read all six R source files, its tests and its history (18 commits), and installed R 4.3.3 with `plyr` to run it. Its functions were run on this project's map with the same public records. That was at first so that map differences couldn't confound the comparison; since the correction, the two topologies are identical anyway.
- **Map.** The first round ran on the previous map. After whitechapelR's topology was made canonical, every inference comparison was re-run on the corrected map: the map comparison, the scenarios, growth, soundness and hideout weighting. So were the main police diagnostics and the blocking experiments. The arrest-threshold experiments, the "uniform weights without blocking" check and the replays were not re-run; they are labelled *(previous map)*.
- **Ground truth.** `research/detective-inference/lib.js` lists every legal route that fits a record (`enumerate`). It is written from the rules in `js/core/rules.js`, not from the deduction, so the two check each other.
- **Games.** Seeded games use the same random streams as `tools/simulate.js`. The police experiments use 500 games per setting on seeds 1–500, and the main result was confirmed on fresh seeds 600001–600500. Paired comparisons use McNemar's exact test. Existing results from the previous study (5,000 games per Jack) were reused, and new simulations were run only to answer specific questions.
- **No hidden information in judgement.** The referee's view of where Jack really is is used only to score decisions afterwards, never to say what the police should have done with information they didn't have.

## 3. whitechapelR: what it does

whitechapelR ("Advanced Policing Techniques for the Board Game Letters from Whitechapel", Mark Ewing, 2018) is a small R package for a human police player at the table: the player types in what happened, and it lists where Jack could be. It is 251 lines in six files.

| Function (file) | What it does, from the source |
|---|---|
| `start_round(initial_murder)` (`R/start_round.R`) | Starts a list of paths, one per crime scene (one or two: the double event) |
| `take_a_step(paths, roads, blocked)` (`R/take_a_step.R`) | Extends every path by one edge of the given graph: `roads` for a walk, `alley` for an alley. `blocked` is a list of pairs of circles a policeman blocks, which removes paths whose last two circles are such a pair |
| `take_a_carriage(paths)` | Two road steps, ignoring police, then drops paths that end where they started (fixed in 0.3.0: "now it cannot end on the space where it started") |
| `trim_possibilities(paths, node)` | Drops paths that end on `node`: a failed arrest |
| `inspect_space(paths, space, clue)` (`R/inspect_space.R`) | A clue keeps only paths that passed one of `space`; nothing found drops every path that passed any of them |
| `end_round(paths, hideouts)` (`R/end_round.R`) | The paths' end circles; from the second night, intersected with the earlier set |
| `show_board(...)` (`R/show_board.R`) | Plots the board, colouring each circle by how many paths pass through it, and marking possible hideouts |

The map is a graph of the 195 numbered circles: 767 road pairs and 452 alley pairs (`data/roads.rda`, `data/alley.rda`), obtained "by computer vision" from the board (`R/data.R`). Its tests (`tests/testthat/test_whitechapel.R`) check single steps, a coach from 23, blocking, one clue, one empty search, and the hideout intersection.

**Assumptions and limitations, confirmed in the source:**

- **Crossings are not modelled.** Policemen stand on crossings, but whitechapelR's graph joins circles directly, so the player must work out which pairs of circles a policeman blocks. The README warns that blocking alleys "is not hardcoded into the function, so you could possibly mess up your information".
- **There is no time model.** It doesn't know the move track, so it can't rule out positions from which Jack couldn't get home in time.
- **There are no probabilities.** Paths are kept as a set. The only weighting is in the plot (the number of paths through a circle).
- **No undo, and no checking of input.** The README says: "the algorithms assume you never make mistakes ... If you input a space which Jack could never have visited and indicate you found a clue there, the path set will be reduced to 0".
- **Every route is a separate path.** Nothing is merged or pruned, so the list grows exponentially (section 6).
- **Order matters.** A search must be entered after exactly the moves made before it. Done that way, it matches the rule that a clue is only found where Jack has been so far.

**The two maps.** `compare-maps.js` compares them circle by circle:

| | Previous map | whitechapelR | Shared | Corrected map |
|---|---:|---:|---:|---:|
| Walking connections | 775 | 767 | 765 | 767, all shared |
| Alleys | 451 | 452 | 451 | 452, all shared |

The previous map had 10 walking links whitechapelR doesn't: 16–34, 165–189, 169–191, 172–183, 182–184, 182–185, 182–186, 182–193, 185–192 and 186–192. Six of these meet at circle 182, through one street between crossings 326 and 330. Only whitechapelR had 165–186 and 31–36, plus the alley 35–39.

These were **resolved in whitechapelR's favour by project decision**: its topology is canonical. The changes are in `map.topologyCorrections` in `js/data/map.js`, with regression tests in `test/unit/map-topology.test.js`. The drawn streets are unchanged, so the corrections apply to the circle-to-circle topology only. A link that was added passes no crossing, so no policeman can block it.

One caution remains. This project's board scan shows a street from 16 through crossings 50 and 52 to 34, and none joining 165 to 186 (about 320 board pixels apart) or 31 to 36. So some of whitechapelR's pairs may be errors in its computer-vision extraction: 165–186 against 165–189 looks like 186 and 189 confused. Each correction is one line, if a printed board says otherwise ([Map data](map-data.md#topology-corrections)).

## 4. Audit of this project's deduction and police

How information flows, from the map to the police's actions:

```
data/map.js (streets + topology corrections) ─► core/board.js: walk(from, police), alleys(from), distance
                      │
core/engine.js: recordPublic() writes the night's public record (state.police[n].log)
   { crime, scenes (sorted) } { move: walk|alley|carriage, police: [...] } { search, mapid, clue } { arrest, mapid } { escaped }
                      │
core/rules.js: publicLog(), policeView(), jackView()   (copies; no route, hideout or coach stop)
                      │
core/deduction.js: track(log, {remaining, hideouts, alleysLeft, trail}), hideouts(pastLogs, choices)
                      │                                         │
ai/police.js: belief() → movePolice(), clues()       ai/strategic-jack.js: policeKnowledge() → value of each move
```

The answers to the brief's questions:

1. **What does it track?** For each step of tonight, a probability over states (a circle plus which of the clue circles the route has passed, as a bit mask), in `track` (`js/core/deduction.js:115`). Its outputs are the distribution over Jack's circle now (`current`), its size and entropy, optionally how likely each circle is to be on his route (`trail`, a backward pass, line 248), and a cheap projection one move ahead (`next`, line 212), which Jack's AI uses.
2. **How does it update after a move?** Each state's weight is split equally among its successors (`successors`, line 96): walks not past the policemen recorded with that move, any alley, or two free steps for a coach. The equal split is the "uniform guess about which way Jack goes" in the header comment.
3. **Searches, clues and arrests?** `readLog` (line 66) attaches each observation to the step it was made at. A search that finds nothing excludes that circle at every step up to then. A clue must be in the route's mask by then. A failed arrest excludes the circle at that step. All of them are applied exactly when they happened (`settle`).
4. **Special movements?** Alleys use the alley graph and can't be blocked, which is correct. Coaches are two free steps, and the coach's stop counts as visited, as it does on the engine's sheet (`js/core/engine.js`, `moveJack`). **One defect:** two free steps can end where the coach started, which the rules forbid (`rules.canUseCarriage`: `to != from`). The deduction therefore keeps an impossible circle after some coaches (section 6). The header comment lists this as a deliberate simplification ("a coach's two stops treated as two free steps") that "only ever keeps more places possible".
5. **Uncertainty across nights?** Only through the hideout: `hideouts` (line 318) multiplies, over the escaped nights, the probability that the night ended on each circle, starting from equal weights, and normalises.
6. **Can it infer the hideout?** Yes. The set is the same as whitechapelR's `end_round` (section 6, scenario 8), but the weights are biased (section 8).
7. **Hidden information?** No. The deduction reads only the record (`test/unit/architecture.test.js` checks that its source never mentions the state). The record holds no route, hideout or coach stop (`test/unit/jack-ai.test.js`), and the police view hides them too (`test/unit/strategic-jack.test.js`). Changing the hidden route leaves the record and the deduction unchanged.
8. **Can it wrongly rule out a position?** No, as far as can be tested. Out of 26,192 prefixes, it never did without pruning. With the police's time-and-hideout pruning, it dropped Jack's circle only in 2 games, both of which Jack lost by running out of moves. It did so on the last few moves, once he could no longer get home in time. The pruning assumes Jack can still get home, which is only false when he is already beaten (section 6).
9. **Does it keep impossible positions?** Yes, after coaches only: in 2,077 of the 20,755 short records checked, with on average 10.0% of the belief on them (as much as 29%). Older clues beyond the most recent 10 are ignored (`maxClues`, line 18). That happened on 1 night of 1,998 in strategic Jack games, and on 3% of nights against the baseline (44 of 1,344). It keeps more places possible, never fewer.
10. **How is it used to choose actions?** In `js/ai/police.js`:
    - `movePolice` (line 86) moves each policeman in turn to the crossing that covers the most of tonight's belief no one else covers yet, plus `blockWeight` times nearness to the likely hideouts. **`blockWeight` is 0**, because blocking made the police weaker against the baseline Jack (line 19).
    - `clues` (line 115) arrests if a circle next to the policeman holds at least `arrestAt` = 20% of the belief, and otherwise searches circles in order of how likely they are to be on Jack's route.
    - The hideout belief is used only to prune tonight's positions (positions from which no candidate hideout is reachable in time), never to decide where to stand.
    - The strategic Jack runs the same deduction to estimate how sure the police could be of each move (`policeKnowledge`, `js/ai/strategic-jack.js:63`). Its arrest table (line 32) was measured against this police AI.

## 5. Capability matrix

whitechapelR is marked **explicit** (in the code and its tests), **partial**, **not supported**, or **unclear**.

| Capability | whitechapelR | This project | Difference | Kind | Importance |
|---|---|---|---|---|---|
| Legal moves and reachable circles | Explicit: `take_a_step` on a circle graph | Explicit: `board.walk` through crossings, with topology corrections | None now: whitechapelR's topology is canonical. The previous map differed on 13 pairs (section 3) | Data difference, resolved | Done; drawn streets still show the previous links |
| Reconstructing possible routes | Explicit: every route kept as a path | Explicit: states (circle and clue mask), merged | The same circles in every scenario; exponential against polynomial work | Equivalent representation; large efficiency difference | Low for logic, high for feasibility (a night is up to 15 moves) |
| Walks blocked by policemen | Partial: the user lists blocked pairs | Explicit: from the policemen's crossings, recorded with each move | The same once pairs are derived from crossings (scenario 6) | Equivalent; whitechapelR is error-prone to use | Low |
| Coaches | Explicit, including not ending on the start (0.3.0) | Partial: may end on the start | whitechapelR is right; this project keeps extra circles | **Logical (completeness) defect here** | Medium: 10% of belief on impossible circles when it happens |
| Alleys | Explicit (`alley` graph); blocking is not prevented | Explicit; never blocked | Equivalent if used correctly | Equivalent | Low |
| Double event | Explicit: two starting points | Explicit: two scenes, equal weight | Equivalent | Equivalent | Low |
| Negative evidence (search found nothing) | Explicit: `inspect_space(..., FALSE)` | Explicit, applied at its step | Equivalent (scenario 4) | Equivalent | — |
| Positive evidence (clue) | Explicit: `inspect_space(..., TRUE)` | Explicit, with a clue mask; at most 10 clues | Equivalent below 10 clues; here older clues beyond 10 are dropped (sound) | Approximation | Low (3% of baseline nights, 1 of 1,998 strategic Jack nights) |
| Failed arrests | Explicit: `trim_possibilities` | Explicit | Equivalent (scenario 6) | Equivalent | — |
| Other sightings | Not supported (the game has none beyond the above) | Not needed | — | Irrelevant | — |
| Time limit (move track) | Not supported | Explicit: positions from which no possible hideout is reachable in time are dropped | Here sharper, by 1.4 circles a turn against the baseline | Missing capability in whitechapelR | Low to medium |
| Probabilities | Not supported (plot colours count paths) | Explicit: equal split per step | Two different implicit priors, both "wandering" | Different assumption | **High**: drives the hideout bias (section 8) |
| Hideout inference | Explicit: intersection of end circles (`end_round`) | Explicit: product of end probabilities | **Same set**; whitechapelR's is effectively uniform, this project's is biased against direct routes | Belief-estimation difference | **High** |
| Across nights | Explicit, as a set of hideouts | Explicit, as weighted hideouts, plus pruning tonight | Same set | Equivalent logic | Medium |
| "Walked onto X and the night went on, so X isn't the hideout" | Not supported | Not supported | Neither uses it | Missing in both | Low (needs joint route and hideout inference) |
| Pruning and efficiency | Not supported: no merging or pruning | Merging, caches, time pruning; about 2 ms a turn | 8 walks: 28.6 million paths and 344 s, against 148 circles and 3 ms | Efficiency | High for usability |
| Use in decisions | Not supported: a display for a human | Explicit: police AI and Jack's AI | — | Out of whitechapelR's scope | — |

## 6. Inference scenarios and correctness

### Eight scenarios

`scenarios.js` builds each hidden route with the harness (checking every move against the rules), writes the public record, and gives the same record to the deduction, the exhaustive reference and whitechapelR. whitechapelR runs on this project's (now identical) topology. The full lists of circles are in `results/scenarios.json`; the previous map's run is in `results/previous-map/`.

| Scenario | Public record | Reference | Deduction | whitechapelR |
|---|---|---|---|---|
| 1. Walks | Crime at 94; three walks | 65 circles (387 routes, 22 to the truth) | Same 65 | Same 65 (387 paths) |
| 2. Coach | Crime at 137; walk; coach | 46 circles (266 routes) | Same 46 | Same 46 |
| 3. Alley | Crime at 16; alley; walk | 9 circles (13 routes) | Same 9 | Same 9 |
| 4. Search, nothing found | Three walks; nothing found at 200, next to the scene | 62 circles (330 routes) | Same 62 | Same 62 |
| 5. Clue | Four walks; clue on his second circle | 60 circles (1,652 routes, 239 to the truth) | Same 60; the truth has 18.3% | Same 60 |
| 6. Blocked walks, failed arrest | A policeman blocks some walks; a failed arrest | 37 circles (389 routes) | Same 37 | Same 37, with blocking given as pairs of circles |
| 7. Double event | Two scenes; three walks | 76 circles (1,195 routes) | Same 76 | Same 76 |
| 8. Strategic Jack's hideout across four nights (seed 52) | Four escaped nights | 20 possible hideouts | Same 20; the truth has almost no weight (0.0004%) | Did not finish in 10 minutes |

*(Previous map: the same agreement in every scenario. Scenarios 1, 6 and 7 had 64, 42 and 76 circles. In scenario 8, seed 52 was a different game, in which Jack was arrested on night 4 after three escapes: 13 possible hideouts, the truth at 15.5%.)*

Several routes fit the same record in every scenario (the "routes to the truth" counts), as the brief's case 7 asks: the record can't tell them apart, and no algorithm can. Scenario 8 is the strategic Jack's direct route home (case 8). The deduction's 20 possible hideouts are exactly the reference's. Its weights almost rule out the true hideout, an example of the bias in section 8. whitechapelR can't finish, because each night has several moves with policemen.

### Growth

`growth.js`: one hidden route of walks with no policemen, measured after each step.

| Walks | Possible circles | Deduction (ms) | whitechapelR paths | whitechapelR step (s) |
|---:|---:|---:|---:|---:|
| 1 | 8 | 1.2 | 8 | 0.01 |
| 2 | 17 | 1.0 | 70 | 0.00 |
| 3 | 28 | 1.4 | 610 | 0.00 |
| 4 | 45 | 2.5 | 5,271 | 0.05 |
| 5 | 73 | 0.7 | 45,336 | 0.44 |
| 6 | 99 | 3.1 | 388,921 | 3.4 |
| 7 | 127 | 3.2 | 3,334,609 | 32 |
| 8 | 148 | 2.8 | 28,609,218 | 344 |

whitechapelR's list grows about 8.6 times per walk (the previous map gave 28,616,780 paths and 348 s after 8). A full night (up to 15 moves) would need around 10¹⁴ paths. In a real game, police searches cut that down, but not by enough to make whitechapelR's approach usable in a browser.

### Soundness and completeness over real games

`soundness.js` checks every prefix of every night's record in 60 games per Jack (seeds 700001–700060, deductive police):

| | Baseline Jack | Strategic Jack | *Previous map: baseline / strategic* |
|---|---:|---:|---:|
| Prefixes checked | 13,855 | 12,337 | 14,098 / 12,092 |
| True circle ruled out (deduction alone) | 0 | 0 | 0 / 0 |
| True circle ruled out (with the police's time-and-hideout pruning) | 39 records from 2 games | 0 | 3 / 1 records |
| Short prefixes checked against the reference | 9,241 | 11,514 | 9,652 / 11,362 |
| Deduction misses a possible circle | 0 | 0 | 0 / 0 |
| Deduction equals the reference | 9,009 | 9,669 | 9,395 / 9,781 |
| Deduction keeps impossible circles | 232 (377 circles) | 1,845 (4,164 circles) | 257 / 1,581 |
| ... all after a coach | yes | yes | yes |

- **The pruned cases.** Both corrected-map games (seeds 700020 and 700028) are ones the baseline Jack lost by running out of moves. In seed 700020 he was 4 moves from any possible hideout with only 3 left, three moves before the end. The 39 records are those last moves, each counted once per observation recorded during them. The previous map's 4 cases were the same kind: final moves of games lost on time.

  The pruning keeps only positions from which a possible hideout can still be reached in time. That is safe for play, because a Jack who can't get home has already lost. But it is a conditional rule, not a strict deduction, and should be documented as such.
- **The impossible circles.** In every case they come from a coach ending where it started. On 20 strategic games, they hold 10.0% of the belief on average where they occur, and up to 29% (previous map: 10.8% and 47%). They matter more against the strategic Jack, who uses about 5.4 coaches a game.

  The fix is narrow: in `track` and `project`, take a coach's two steps together and drop endings on the starting circle. It wasn't made in this study, because it changes how both AIs play and every recorded result. It should be made with the next police change, with a re-run of the evaluation (recommendation H3).

## 7. Deductive against random police

### What each police does with its chances

`police-diagnostics.js`, seeds 1–500, corrected map (the previous map's run is in `results/previous-map/`, with the same pattern). An **opportunity** is a clue phase in which some policeman could arrest on Jack's true circle.

| | Strategic vs deductive | Strategic vs random | Baseline vs deductive | Baseline vs random |
|---|---:|---:|---:|---:|
| Jack wins | 98.6% | 94.6% | 25.2% | 48.4% |
| Clue phases with an opportunity | 2.3% | 2.6% | 10.8% | 3.3% |
| Games with at least one opportunity | 29.6% | 34.8% | 87.2% | 59.2% |
| At opportunities: belief on his circle | 0.029 | 0.017 | 0.111 | 0.047 |
| ... his circle the likeliest one they could arrest on | 7.8% | 19.9% | 25.4% | 35.2% |
| ... the best one they could arrest on held at least 20% | 2.9% | 1.3% | 19.0% | 6.8% |
| Opportunities turned into an arrest | 2.4% | 11.5% | 19.6% | 11.2% |
| Searches / clues / failed arrests per game | 175 / 5.7 / 1.4 | 135 / 1.7 / 17.4 | 213 / 11.9 / 3.4 | 223 / 3.7 / 29.4 |
| Belief: circles / share on his circle / his rank | 46 / 0.068 / 30 | 57 / 0.064 / 39 | 62 / 0.051 / 27 | 99 / 0.040 / 42 |

The table answers each hypothesis in the brief:

- **A rule or information-access issue: rejected.** The deduction never rules out the truth, the views hide nothing they shouldn't, and the deductive police beat the baseline Jack far more often than random police do (25.2% against 48.4% Jack wins). They have a real inference advantage.
- **The inference is correct but action selection is weak: supported.** Against the strategic Jack, the deductive police almost never stand next to him (2.3% of turns, against 10.8% for the baseline), and when they do, the deduction rates his circle low (2.9%).
- **Strategic Jack exploits a predictable decision rule: supported.** The deductive police arrest only at 20% or more; Jack's arrest-risk table was measured against exactly that, so he steps next to policemen on circles the deduction rates low. Random police, who arrest without regard to the belief, convert far more often (11.5% against 2.4%; previous map 9.1% against 4.5%).
- **Random police intercept routes the deductive police ignore: partly.** They have opportunities in more games (34.8% against 29.6%), but not much more often per turn.
- **The deductive police concentrate too narrowly, and favour immediate clues over the hideout: supported.** They chase tonight's belief, which the strategic Jack keeps away from. The hideout, where every route ends, is ignored (`blockWeight` 0).

### Changing only the police's decisions

`summarise.js`, McNemar's exact test on paired seeds (`results/paired-comparisons.md`):

| Change to the deductive police | Seeds | Strategic Jack wins | p | Baseline Jack wins | p |
|---|---|---:|---:|---:|---:|
| None | 1–500 | 98.6% | | 25.2% | |
| Blocking (`blockWeight` 1), current hideout weights | 1–500 | 82.2% | < 10⁻⁶ | 30.0% (worse for the police) | 0.074 |
| **Blocking, uniform hideout weights** | 1–500 | **71.6%** | < 10⁻⁶ | **18.2%** | 0.0049 |
| None | 600001–600500 | 97.4% | | 24.0% | |
| **Blocking, uniform hideout weights** | 600001–600500 | **68.4%** | < 10⁻⁶ | **20.6%** | 0.21 |
| *Previous map:* none | 1–500 | 97.8% | | 25.6% | |
| *Previous map:* arrest at 10% instead of 20% | 1–500 | 96.4% | 0.17 | | |
| *Previous map:* arrest at 5% | 1–500 | 93.6% | 0.00075 | | |
| *Previous map:* uniform hideout weights, no blocking | 1–500 | 97.8% (the same games) | 1.0 | | |
| *Previous map:* blocking, uniform hideout weights | 1–500 / 600001– | 67.0% / 68.2% | < 10⁻⁶ | 18.2% / 16.4% | 0.003 / 0.00002 |

- **The arrest threshold matters a little** *(previous map)*. At 5%, the police catch Jack more often, but they find half as many clues (3.0 a game against 5.9), because arrest attempts replace searches.
- **Uniform hideout weights alone change nothing** *(previous map)*. The games are identical, because the police don't use hideout weights to decide anything. The code path is the same on the corrected map.
- **Blocking matters most.**
  - With the current weights it helps against the strategic Jack but hurts against the baseline, which is why it was switched off.
  - With uniform weights, the strategic Jack loses 3 games in 10 instead of 1 in 70. He now often loses by running out of moves (67 of 142 losses), kept from home. This held on both maps and both seed sets.
  - Against the baseline Jack, uniform-weight blocking is better than nothing on three of the four runs. On the corrected map's fresh seeds, the 3.4-point gain is not significant (p = 0.21). So it is safe against the baseline but not clearly better; a tuned weight should be checked against it.

**Caveat.** Pairing random against deductive police by seed is weak. The two police place patrols differently, so the games differ from the first night. Pairing is exact for the other comparisons, which change only the police's movement or arrest decisions.

### Replays

Each replay is reproducible with `police-replay.js <seed> <jack> <police> <night>`. Each line shows what the police could know, with Jack's true circle for the reader only. *(Previous map: these replays were studied before the map correction. On the corrected map the same seeds play somewhat different games, but the patterns they illustrate are the ones the corrected-map tables above measure.)*

1. **Random police win, deductive police lose: seed 8, night 3.** With the random police, after a coach, the deduction spread Jack over 53 circles, with 0.5% on his real one, 79. A random policeman next to 79 arrested there, choosing among several circles at random. Deductive police would not have tried: no circle they could reach held 20%. (In the deductive police's own game on this seed, which differs from the first night, Jack escaped.) Jack's estimate put such a circle at about 1% risk, and against these police that was right; against random arrests it isn't. The random police didn't know more; they were less predictable.
2. **The deductive police catch the strategic Jack: seed 299, night 3.** The double event: the police move first and know Jack is on one of two crime scenes, 50% each. A policeman reached a crossing next to 182 and arrested there. The previous study made Jack's victim choice avoid this, but it still happens.
3. **Jack wins although the police narrowed his hideout: seed 7, night 4.** Only 2 possible hideouts are left, but the deduction gives the true one, 79, only 21%. The police found 6 clues on his trail (163, 160, 174, 398, 36, 351, 57) and followed it, but every arrestable circle stayed under 20%, and they never stood between him and the two possible hideouts. Guarding two circles with five policemen would most likely have ended the game. This is the clearest example of inference that is good enough, wasted by action selection.
4. **A night-4 arrest: seed 6.** With 12 possible hideouts, the true one, 209, gets almost no weight (0.000). The police still caught Jack, because a clue at 142 and two policemen nearby narrowed him to 4 circles at 25% each, and they arrested on the right one. When the belief is sharp, they convert.
5. **Repeated unproductive searches: seed 101, night 2.** The belief spreads from 5 to 121 circles in seven turns, and the police make 9 to 14 searches each turn, mostly finding nothing. They follow the mass towards 116–119 while Jack goes the other way (his circle's share falls to 0.0%). Each search was reasonable given the belief, but the belief assumed he wanders, and he didn't.

## 8. Hideout information leakage

1. **How it is calculated.** `deduction.hideouts` multiplies, over every escaped night, the probability (under the "wandering" model) that the night ended on each circle, and normalises. The set of possible hideouts is the intersection of each night's possible end circles: the same as whitechapelR's `end_round`.
2. **Is it sound?** The set is sound: it never excludes the true hideout, and it matched the exhaustive reference in scenario 8. The weights are not. `hideout-weighting.js` compares the weight on the true hideout with a uniform guess over the candidates (ratio 1 means equal), by how much longer Jack's route was than the shortest walk (300 games per Jack, corrected map):

   | Detour | Baseline: nights | Mean ratio | Below uniform | Strategic: nights | Mean ratio | Below uniform |
   |---|---:|---:|---:|---:|---:|---:|
   | Shorter than walking (coach or alley) | | | | 54 | 0.22 | 100% |
   | 0 (the shortest route) | 46 | 0.19 | 98% | 511 | 0.13 | 98% |
   | 1 | 80 | 0.39 | 89% | 369 | 0.22 | 96% |
   | 2 | 85 | 0.44 | 93% | 190 | 0.41 | 89% |
   | 3 | 68 | 0.71 | 79% | 41 | 1.05 | 63% |
   | 4 or more | 298 | 1.10 | 66% | 30 | 1.24 | 53% |

   The previous map gave the same picture: 0.14 and 0.19 for the shortest routes.

   A wandering walk rarely gets far from where it started, so the model puts little weight on the circles a direct route ends on. The more purposeful Jack is, the more the weights point away from his hideout.
3. **Do the police use it?** Only to prune tonight's positions. Their positioning ignores it (`blockWeight` 0), as the identical games with uniform weights show.
4. **Why did the hideout-hiding rule have no effect?** It protects against something these police don't do. The strategic Jack's hideout rule avoids ending a night when that would leave 1 or 2 candidates. But a smaller set of candidates costs Jack nothing against police who never guard them, and the weights, which steer the police's pruning, point away from his hideout anyway. A Jack AI can only learn the value of concealment from police who punish leakage.
5. **Do survival and concealment conflict?** Against these police, no: direct routes are safe and their leakage is free. Against blocking police, they do. The strategic Jack drops to 68–72%, and 67 of its 142 losses (out of 500 games) are now running out of moves, kept from home. This would be the point to re-measure Jack's concealment.
6. **Would stronger inference make concealment more valuable?** Better weights, yes, but only through decisions: uniform weights with blocking beat weighted weights with blocking (82.2% to 71.6% for the strategic Jack, p < 10⁻⁶; previous map 79.4% to 67.0%).

**Metrics, beyond counting candidates.** 17 candidates with one at 80% is very different from 17 at about 6% each, so the diagnostics report all of these, at the start of each night:

- the number of candidates;
- the probability on the true hideout, against a uniform guess;
- its rank;
- the entropy of the belief.

Against the strategic Jack, at the start of night 4: 23.9 candidates, P(true) 0.056 against a uniform 0.094, rank 19.8 of 23.9, entropy 2.60 bits. Against the baseline, the weights are about as good as uniform (0.047 against 0.044), because its wandering routes match the model. `police-replay.js` also shows each turn how close the nearest policeman is to the true hideout, which is the detectives' concentration near it.

**Calibrating hideout weights**, if probabilities replace the uniform set:

- fit the weighting to the route lengths Jack actually uses, on development seeds;
- check on held-out seeds with a log score and a reliability table (of hideouts given p ≈ x, how often is it the truth);
- check it against more than one Jack, because a weighting fitted to the strategic Jack is a model of that Jack.

The uniform set is the robust starting point: it makes no assumption about Jack, and it did better than the current weights against both Jacks.

## 9. Methods from the literature

| Method | Source | Status here | Fit for Letters from Whitechapel |
|---|---|---|---|
| Exhaustive tracking of possible positions (set or belief) | Standard in hidden-movement games; whitechapelR for this game | **Implemented**, as a belief (forward filter) | Done; only coach completeness is missing |
| Probability-weighted search | Probabilistic search, surveyed by Chung, Hollinger and Isler, "Search and pursuit-evasion in mobile robotics: A survey", *Autonomous Robots* 31(4), 2011 | **Implemented** for searches (route likelihood) | Depends on the prior; the uniform-wandering prior is the weak point (section 8) |
| Location categorisation: a learned prior over where the hidden player goes | Nijssen and Winands, "Monte-Carlo Tree Search for the Hide-and-Seek Game Scotland Yard", *IEEE Trans. Comp. Intelligence and AI in Games* 4(4), 2012 (and CIG 2011) | Not implemented | Directly relevant: it replaces "wanders" with "moves like Jack moves". It must be learnt from more than one Jack |
| Monte Carlo tree search with determinisation (sample a hidden position, plan as if known) | Nijssen and Winands 2012; Information Set MCTS, Cowling, Powley and Whitehouse, *IEEE TCIAIG* 4(2), 2012 (citation from memory: verify before relying on it) | Not implemented | Promising for coordinated multi-turn police play. Each rollout needs a fast Jack model; the strategic Jack's 27 ms a decision is too slow inside rollouts |
| Planning in partially observable worlds (POMCP) | Silver and Veness, "Monte-Carlo Planning in Large POMDPs", NIPS 2010 | Not implemented | The principled frame for the police's whole problem; heavy for a browser. Its particle belief could reuse this deduction |
| Coalition reduction (the seekers coordinate, valuing a teammate's catch slightly less than their own) | Nijssen and Winands 2012 | Not implemented; police are greedy, one at a time | Relevant to coordinated positioning (recommendation M2) |
| Cops and robbers on graphs: how many pursuers can guarantee a capture | Nowakowski and Winkler 1983; Aigner and Fromme 1984; survey in Chung et al. 2011 | Not applicable directly | Jack is hidden, has special moves and a time limit, so guarantees don't transfer. The idea of guarding a few key positions (here, the candidate hideouts) does |
| Interception and blocking | Pursuit-evasion literature (Chung et al. 2011) | **Implemented but switched off** (`blockWeight`) | The highest-value change (section 7) |
| Controlled randomisation (mixed strategies) | Game theory: a predictable rule can be exploited | Not implemented | Random police convert opportunities twice as well against the strategic Jack. Some randomness in arrests is worth testing (recommendation M1) |

Scotland Yard results don't transfer directly. Mr X surfaces at fixed turns, while Jack never surfaces, but clues mark his route. Jack must also reach a fixed but hidden hideout in limited time, and that is what makes blocking so effective here. It has no counterpart in Scotland Yard.

**Feasibility in a browser.** The deduction takes about 2 ms a turn and blocking adds a distance lookup per crossing, so both recommendations below fit easily. Sampling-based planning (MCTS or POMCP) with a fast Jack model could fit a one-second budget per police turn, but needs its own study.

### Human players and predictability

The evaluation has used one deterministic police policy (and a random one). Human detectives differ, and not only by making mistakes:

- **Confirmation bias.** They may chase an early theory after clues contradict it.
- **Risk.** Some are risk-averse and search rather than arrest; some are overconfident and arrest on a hunch.
- **Unusual moves.** They may search oddly or stand in odd places, sometimes on purpose, to tempt Jack or to hide what they know.
- **Adaptation.** They learn from Jack's earlier nights. A human who sees three direct routes home would guard the area on night 4, which is what blocking does.

Unpredictability is not irrationality. A detective who sometimes arrests on a 10% circle is less exploitable than one who never does, even if each such arrest is a poor bet on its own. The strategic Jack's 97.2% is partly a measure of how predictable one police policy is: its risk table encodes the deductive police's 20% rule. Future evaluations should use a population of police strategies. The current one, the blocking variant, different arrest thresholds and a randomised mix would do, and a Jack AI's strength should be reported against all of them, not just one. A human-behaviour simulator is out of scope.

## 10. Recommendations

### High priority: clear evidence, high value

**H1. Police positioning that uses the hideout (interception).**

| | |
|---|---|
| Problem | Police stand next to the strategic Jack in 2.3% of turns; the hideout, where every route ends, plays no part in where they stand |
| Evidence | Seed 7 *(previous map)*: 2 candidates, 6 clues, Jack walks home. `blockWeight` 1 with uniform weights on the corrected map: strategic Jack 98.6% → 71.6% (seeds 1–500) and 97.4% → 68.4% (fresh seeds), both p < 10⁻⁶. Baseline 25.2% → 18.2% (p = 0.005) and 24.0% → 20.6% (p = 0.21). The previous map gave the same picture |
| Approach | Turn on blocking, valuing crossings near candidate hideouts more as the candidates get fewer and the night goes on; tune the weight on development seeds (only 1 has been tried) |
| Expected benefit | Jack must reach a known small area at a known time; standing there turns inference into catches |
| Complexity | Low (the code exists in `movePolice`) |
| Runtime | Negligible |
| Validation | Paired seeds against both Jacks and random police, on fresh seeds; Jack's win rate, night-4 arrests, losses on time. The baseline result must become clearly significant, not just safe |
| Risks | Jack adapts by hiding the hideout (desired; then measure concealment); overfitting the weight to one Jack |

**H2. Hideout weights that don't assume Jack wanders.**

| | |
|---|---|
| Problem | The hideout weights point away from the truth for a purposeful Jack |
| Evidence | Ratio to uniform 0.13 on shortest-route nights (strategic) and 0.19 (baseline). P(true) at night 4 is 0.056 against a uniform 0.094 for the strategic Jack (about equal for the wandering baseline). Blocking with these weights made the police worse against the baseline (Jack 30.0%) |
| Approach | Use the set with equal weights (as whitechapelR does), or weights fitted to route lengths and validated on held-out games against several Jacks |
| Expected benefit | Makes H1 work against every Jack; better pruning of tonight's belief |
| Complexity | Trivial (equal weights) to moderate (calibrated) |
| Runtime | None |
| Validation | Log score and rank of the true hideout on held-out games; H1's win rates |
| Risks | Calibrated weights become a model of the Jacks used to fit them |

**H3. Correct coach moves in the deduction.**

| | |
|---|---|
| Problem | A coach may end where it started in the deduction, not in the rules |
| Evidence | 2,077 of 20,755 checked records keep impossible circles, with 10.0% of the belief on them on average (up to 29%); previous map 1,838 of 21,014, 10.8% |
| Approach | In `track` and `project`, take a coach's two steps together and drop endings on the start; add the exhaustive reference as a test |
| Expected benefit | Sharper beliefs after coaches, for the police and for the strategic Jack's model of them |
| Complexity | Low |
| Runtime | Negligible |
| Validation | `soundness.js`: no extra circles, truth never lost; then re-run both evaluations, as it changes both AIs |
| Risks | Small; changes every recorded result for the strategic Jack and the police (the golden traces are unaffected: the baseline doesn't use the deduction) |

### Medium priority: promising, needs validation

- **M1. Arrest decisions by expected value, with some randomness.**
  - *Problem:* the 20% rule is predictable, and the strategic Jack exploits it.
  - *Evidence:* random police convert 11.5% of opportunities against 2.4%. *(Previous map:)* a 5% threshold improved the police (p = 0.00075) but halved their clues.
  - *Approach:* arrest when P(Jack here) times the value of a catch beats the value of the search; occasionally arrest on a lower circle.
  - *Complexity and runtime:* low and none.
  - *Validation:* paired seeds against several Jacks.
  - *Risk:* lower search value.
- **M2. Coordinated positioning.**
  - *Problem:* policemen are placed one at a time, greedily.
  - *Evidence:* few opportunities; seed 101's police all follow the same mass.
  - *Approach:* jointly assign policemen to cover the belief and the ring around candidate hideouts (a small assignment problem over crossings within two steps).
  - *Complexity and runtime:* medium; milliseconds.
  - *Validation:* opportunity rate and win rate.
  - *Risk:* gains may overlap with H1.
- **M3. A better prior for tonight's position.**
  - *Problem:* the "wandering" step model.
  - *Evidence:* the strategic Jack's circle is ranked 30th of 45 and holds 6.8% on average; seed 101.
  - *Approach:* weight steps towards candidate hideouts (location categorisation), fitted on development games.
  - *Complexity:* medium. *Runtime:* low.
  - *Validation:* log score of Jack's circle on held-out games.
  - *Risk:* the prior becomes a model of one Jack, and a Jack AI that knows it can exploit it.
- **M4. Evaluate against a population.**
  - Report every Jack AI against several police policies (the current one, H1, M1 and random), and every police change against several Jacks. This is cheap with the existing tools.

### Low priority: speculative, expensive, or small

- **L1. Lift the 10-clue limit.** It applies on 3% of baseline nights and almost never for the strategic Jack. It is sound as it is.
- **L2. Confirm the topology corrections against a printed board.** Done for the topology by project decision: whitechapelR's map is canonical and the 13 differences are resolved. What remains is to confirm against a printed board the few corrections the board scan disputes (16–34, 31–36 and 165–186 against 165–189), and whether the drawn streets should show the added links.
- **L3. Use "a walk that didn't end the night wasn't onto the hideout".** This needs joint inference over route and hideout; the likely gain is small.
- **L4. Sampling-based planning for the police (MCTS or POMCP).** This is the principled long-term direction, but premature: H1 and H2 capture the obvious gains cheaply, and planning needs a fast Jack model.
- **Not recommended: porting whitechapelR.** It computes the same sets as the existing deduction, with exponential cost. Its one advantage, coach completeness and equal hideout weights, is covered by H2 and H3.

**Where the next implementation should focus:** detective action selection, H1 together with H2, plus H3 as a correctness fix. Inference correctness is not the bottleneck: the deduction is sound and almost complete. Coordinated planning (M2, L4) should wait until H1's gains are measured.

## 11. Limitations and open questions

- **The map was corrected mid-study.** whitechapelR's topology was made canonical after the first round. The inference comparisons, the main diagnostics and the blocking experiments were re-run on the corrected map, and the conclusions held. The arrest-threshold experiments, the uniform-weights-without-blocking check and the replays are from the previous map, as is the whole [Jack's AI](jack-ai.md) evaluation (including the strategic Jack's calibration tables). They are labelled as such and were not re-run.
- **Whether whitechapelR's map is right everywhere.** Its topology is canonical by decision, but this project's board scan disputes a few of its pairs (section 3), and the drawn streets don't show its added links.
- **Scenario 8 has no whitechapelR result:** it did not finish in 10 minutes. Its logic is identical in the other scenarios, but that one was not executed.
- **Only one blocking weight was tried** (1, besides the earlier 0.5 and 1.5 against the baseline only), so the 67% is a lower bound on what tuned blocking could do. Seeds 1–500 are also evaluation seeds of the earlier study; the main result was repeated on fresh seeds 600001–600500 with the same conclusion.
- **The Jacks don't adapt.** The strategic Jack's risk tables were measured against the current police. Against blocking police it would need re-measuring, and its win rate would recover some of the drop. The 67% is the police's gain against today's Jack, not an equilibrium.
- **Random against deductive police is not exactly paired.** The police place patrols differently, so those games differ from the first night.
- **The pruning's soundness is conditional:** it holds while Jack can still get home. Whether that should be stated in the code or relaxed is a design choice.
- **Open question: how much concealment is worth.** That depends on H1: it should be measured once blocking police exist, ideally against a population of police.
- **One citation unverified.** The Information Set MCTS reference (Cowling, Powley and Whitehouse 2012) is given from memory, as noted in section 9.

**Tools.** R 4.3.3 with `plyr` and `jsonlite` were installed from Ubuntu packages to run whitechapelR. `igraph` was not installed, so `show_board` (plotting only) was not run.
