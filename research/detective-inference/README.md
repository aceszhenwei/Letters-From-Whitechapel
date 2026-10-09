# Detective inference: research scripts

Supporting scripts and results for [docs/detective-inference-study.md](../../docs/detective-inference-study.md). They are research tools, not part of the game: nothing in `js/` loads them, and they don't change how the game plays.

## Setup

- Node.js 22 (as for the tests).
- For the whitechapelR comparison: R with the `plyr` and `jsonlite` packages (`apt-get install r-base-core r-cran-plyr r-cran-jsonlite` on Ubuntu), and a clone of [whitechapelR](https://github.com/bmewing/whitechapelR) **outside this repository** (it is MIT-licensed; none of its code is copied here). The study used commit `20032d5`. whitechapelR is used as an independent reference for inference algorithms only: its map is wrong in 13 places (see `compare-maps.js`), so `scenarios.js` and `growth.js` run its functions on this project's board-verified graph, not on its own.

```
git clone https://github.com/bmewing/whitechapelR.git /tmp/whitechapelR
```

## Scripts

| Script | Answers | Time |
|---|---|---|
| `export-whitechapelR-data.R <clone> fixtures` | Exports whitechapelR's map (roads and alleys between numbered circles) to `fixtures/` | seconds |
| `compare-maps.js` | How whitechapelR's map differs from this project's | seconds |
| `scenarios.js [<clone>]` | Eight inference scenarios: this project's deduction, the exhaustive reference and whitechapelR on the same public record (`results/scenarios.md`) | ~15 min with R (the last scenario times out in whitechapelR), seconds without |
| `growth.js <clone> [steps]` | How whitechapelR's route list and the deduction grow with the length of a night | ~7 min for 8 steps |
| `soundness.js [games] [first seed]` | Over every prefix of every night in seeded games: is Jack's true circle ever ruled out, and which impossible circles are kept | ~8 min for 60 games per Jack |
| `police-diagnostics.js <jack> <police> [games] [first seed] [--arrestAt x] [--blockWeight x] [--uniformHideouts]` | For each police turn: did a policeman stand next to Jack, how sure were they, what did they do; how much they know about the hideout | ~1 min for 500 games |
| `summarise.js` | Paired comparisons (McNemar) of every police variant against the original police (`results/paired-comparisons.md`) | seconds |
| `hideout-calibration.js [games]` | Are the hideout probabilities calibrated? Reliability tables and log scores, current weights against uniform | ~1 min |
| `run-all.sh [<clone>]` | Everything above, in order | ~1 hour |
| `police-replay.js <seed> [jack] [police] [night]` | One game from the police's side, round by round | seconds |
| `hideout-weighting.js [games]` | How the hideout belief weights the true hideout, by how direct Jack's route was | ~1 min |

`lib.js` holds what they share: playing a seeded game (the same random streams as `tools/simulate.js`, so seed *n* is the same game in both), cutting a night's public record into prefixes, and `enumerate`, an exhaustive reference for where Jack could be, written from the rules rather than from `js/core/deduction.js`.

## Reproducing the study

```
bash research/detective-inference/run-all.sh /tmp/whitechapelR
```

re-runs every experiment into `results/`: about an hour on 4 cores. All seeds are fixed, so the results are the same on every run and every machine. The per-game files (`results/police-*.json`) are left out of git; the summaries (`.txt`, `.md` and small `.json` files) are kept.

## Which board

`results/` is on the **board-verified map** ([docs/map-data.md](../../docs/map-data.md#verified-against-the-board)).

`archive/` keeps two earlier rounds:

- `archive/first-round/`: the study's first round, on the same verified board. Where an experiment was repeated, the results are identical.
- `archive/whitechapelR-topology/`: an interim round, run while the map followed whitechapelR's topology, which the physical board showed to be wrong in 13 places. It is not on the real board, and is kept only to show how much the conclusions depend on the map.
