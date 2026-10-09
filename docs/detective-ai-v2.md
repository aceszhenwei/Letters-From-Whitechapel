# Detective AI v2

Detective AI v2 is a stronger computer police. It plays the same game from the same information as the original police (only the police view), but it uses what it knows about the hideout to **stand between Jack and home**, instead of only chasing where he probably is now.

On fresh seeds that nothing was tuned on, it cuts the win rate of each Jack:

| Jack | Original police | v2 |
|---|---:|---:|
| Strategic Jack | 98.0% | 31.6% |
| Baseline Jack | 21.8% | 12.6% |
| Detour Jack (a diagnostic opponent that walks away from home first) | 88.8% | 63.0% |

All three gains have p < 0.0001 on paired seeds.

In the game, the player can watch it play: choose **Normal police** in the setup dialog. **Easy police** is the original.

It builds on the [detective inference study](detective-inference-study.md), which found that the police's deduction was sound but their decisions weren't. Scripts and results are in [`research/detective-v2/`](../research/detective-v2/).

## Contents

1. [Summary](#1-summary)
2. [The original police's weaknesses](#2-the-original-polices-weaknesses)
3. [Changes](#3-changes)
4. [Method](#4-method)
5. [Results](#5-results)
6. [Robustness and exploitability](#6-robustness-and-exploitability)
7. [Cost](#7-cost)
8. [In the game](#8-in-the-game)
9. [Limitations and future work](#9-limitations-and-future-work)

## 1. Summary

| | Change | Evidence | In v2? |
|---|---|---|---|
| Deduction | **Coaches can't end where they started** (a correctness fix, for every AI) | Before: 10.8% of the belief on impossible circles after coaches. After: the deduction equals an exhaustive list of legal routes on all 21,019 short records checked | Yes (fixes the shared deduction) |
| Hideout belief | **Hybrid weighting**: a possible hideout is likelier the less of a detour Jack's routes would have been to reach it, with a uniform floor | Best log score for every Jack, night and move budget on held-out seeds: −3.39, against −3.83 uniform and −7.05 current | Yes |
| Positioning | **Blocking**: each policeman also values standing near the likely hideouts | With hybrid weights, fresh seeds: strategic Jack 98.0% → 31.6%, baseline 21.8% → 12.6%, detour 88.8% → 63.0% | Yes |
| Coordination | Later policemen credited only for guarding a hideout better than earlier ones | Worse against every Jack: strategic 71.4% instead of 31.6% on fresh seeds | **No** |
| Cordon | Value the crossings next to a likely hideout | Helps against the baseline Jack, hurts against the detour Jack (tuning) | **No** |
| Live hideouts | Count only hideouts Jack can still reach tonight | No gain (tuning) | **No** |
| Arrests | Arrest at 15% instead of 20% | No significant gain against any Jack; worse against the baseline Jack on fresh seeds (15.2% against 12.6%, p = 0.085) | **No** |

**The answer to the central question is yes.** Using what they already know, the detectives can stop Jack reaching his hideout. Against the strategic Jack, 177 of v2's 342 wins on fresh seeds come from Jack running out of moves with a policeman next to his hideout. The original police managed that in none of 500 games.

## 2. The original police's weaknesses

From the [detective inference study](detective-inference-study.md), confirmed on the verified board:

- **The hideout weights were badly calibrated.** Candidates rated at 50% or more were the true hideout only 4–11% of the time.
- **Positioning ignored the hideout.** `blockWeight` was 0, so the police chased tonight's belief, which the strategic Jack kept away from. They stood next to him in 2.5% of turns.
- **Blocking alone helped only one Jack.** With the old weights it helped against the strategic Jack and hurt against the baseline Jack.
- **The fixed 20% arrest rule was predictable**, and the strategic Jack's risk model is calibrated against it.
- **The deduction kept impossible positions after coaches.**

## 3. Changes

### The coach fix (`js/core/deduction.js`)

The deduction treated a coach as two free steps, so it allowed one to end where it started, which `rules.canUseCarriage` forbids. Now the state between a coach's two stops remembers where the coach set off (the state number is `((origin × 512) + circle) × 4096 + mask`), and the second stop may not return there. The fix applies to `track` (forward pass, backward trail pass) and to the one-move projection the strategic Jack uses.

- **Reproduced first.** After a crime at map id 137 and one coach, the old deduction gave the impossible start 12.7% of its belief.
- **Checked:**
  - `test/unit/deduction.test.js` covers every start in 60 circles, two coaches in a row, clues at a coach's stop, 40 random records against the exhaustive reference, and real games.
  - `soundness.js` on 60 games per Jack: the deduction equals the reference on all 21,019 short records (before: 1,838 had extra circles) and never rules out Jack's circle.
- **Cost:** 0.20 → 0.30 ms per record (`results/deduction-benchmark.txt`).
- **Side effects:** the fix sharpens what the original police, and the strategic Jack's model of them, believe. Against the original police on seeds 1–500, the strategic Jack now wins 97.2% (before the fix 97.8%) and the baseline Jack 25.0% (25.6%). The baseline Jack itself doesn't use the deduction, and the golden traces are unchanged.

### Hideout weighting (`deduction.hideouts(pastLogs, choices, { weighting, w, rho })`)

The set of possible hideouts is exact; the weighting is a model. Three were compared:

- **walk**: the original, as if Jack wandered at random;
- **uniform**: equal weights over the set, as whitechapelR keeps it;
- **hybrid**: each escaped night multiplies a hideout's weight by (1 − w) + w·ρ^detour. The detour is the moves Jack used beyond the walking distance from the crime scene to that hideout. The uniform part (1 − w) means no detour is ever ruled unlikely, so the model doesn't assume Jack takes the shortest route.

The hybrid's two parameters were fitted on calibration seeds 900001–900150, pooled equally over three Jacks (baseline, strategic, detour): w = 0.9, ρ = 0.5. They were then tested on seeds 1–300 (`results/hideout-models.txt`):

| Held-out beliefs | Walk: log score / P(true) / rank | Uniform | Hybrid |
|---|---|---|---|
| Baseline Jack (512) | −5.80 / 0.024 / 34.3 | −4.06 / 0.023 / 35.7 | **−3.76 / 0.034 / 17.2** |
| Strategic Jack (898) | −7.02 / 0.034 / 36.4 | −3.46 / 0.058 / 23.5 | **−2.73 / 0.102 / 6.5** |
| Detour Jack (882) | −7.81 / 0.018 / 47.1 | −4.07 / 0.024 / 36.7 | **−3.85 / 0.034 / 21.0** |
| Night 2 / 3 / 4, all Jacks | −6.85 / −6.76 / −7.62 | −4.40 / −3.72 / −3.26 | **−4.05 / −3.30 / −2.70** |
| Few spare moves (under 6) / 6–8 / 9 or more | (no beliefs) / −9.09 / −6.48 | — / −3.86 / −3.82 | — / **−3.06** / **−3.48** |

The hybrid is best for every Jack, night and move budget. It is also fairly well calibrated: of the candidates it rates at 20% or more (30% on average), 38% were the hideout. The walk weighting rated 1,325 candidates that high, and only 6% of them were.

**Belief quality and decision quality are measured separately.** Better weights change nothing on their own, because the original police never use the weights to decide anything: the "uniform" and "hybrid" rows in section 5 play exactly the original's games. They matter only once blocking uses them.

### Blocking and its variants (`js/ai/police.js`)

`WC.createPolice` gained options, all off by default, so the original police play byte-identical games:

- `hideoutWeighting`, `hideoutW` and `hideoutRho`;
- `blockWeight`, which already existed;
- `coordinate`, `cordon` and `liveHideouts`.

Detective AI v2 is the preset `WC.policeVariants.v2 = { hideoutWeighting: 'hybrid', hideoutW: 0.9, hideoutRho: 0.5, blockWeight: 1 }`.

Blocking scores each crossing a policeman could move to by two things:

- how much of Jack's likely position it would newly cover, as before;
- the blocking weight times the sum, over the likely hideouts, of P(hideout) / (1 + walking distance from the crossing's circles to it).

This is the simple heuristic the study supported. It is not a planner.

The other options were tried and left out:

- **Coordination** spread the policemen across hideouts. It lost the concentration that makes blocking work: worse against every Jack.
- **The cordon** helped against the baseline Jack but hurt against the detour Jack, which suggests it leans on direct routes.
- **Live hideouts** made no difference.
- **Arrests at 15%** gave no significant gain against any Jack, and in v2 a policeman who arrests is not searching.

## 4. Method

**Jacks.** The original police serve as the control throughout. The opponents are:

- **Baseline Jack**;
- **Strategic Jack**;
- **Detour Jack**, a fixed, rule-following research policy (`research/detective-v2/jacks.js`). It is the strategic Jack, except that on the first 3 moves of each night, while he has at least 6 moves to spare, he walks away from his hideout. It tests whether v2 depends on Jack heading straight home. It is not the future Deceptive Jack.

No Jack AI was changed. The coach fix changes what the strategic Jack believes the police know, because it shares the deduction.

**Seeds** (kept apart, see [Testing](testing.md#test-tiers)):

| Seeds | Used for |
|---|---|
| 900001–900150 | Fitting the hybrid weighting |
| 300001–300300 | All policy tuning (`tune.sh`, two rounds, 300 games per Jack per setting) |
| 1–500 | Evaluation |
| 650001–650500 | Fresh validation, never used before |

**Statistics.** Jack's win rate has 95% Wilson intervals. Every police is compared with the original, and v2 with each of its parts, on paired seeds with McNemar's exact test. A change counted as an improvement only if it helped against every Jack on the tuning seeds and held up on both evaluation sets.

**Reproducing.**

- `bash research/detective-v2/tune.sh` and `bash research/detective-v2/tune.sh round2` re-run the tuning.
- `bash research/detective-v2/run-evaluation.sh` re-runs the evaluation (63 minutes on 4 cores).
- `node research/detective-v2/hideout-models.js` re-runs the hideout comparison.
- `npm run research:full` runs all of it as part of the [full test tier](testing.md#test-tiers), skipping steps whose inputs haven't changed.

## 5. Results

### Ablation: Jack's win rate (lower is better for the police)

`results/evaluation/comparison.md` has the full tables.

| Police | Strategic Jack, seeds 1–500 | fresh | Baseline Jack, seeds 1–500 | fresh | Detour Jack, seeds 1–500 | fresh |
|---|---:|---:|---:|---:|---:|---:|
| Original | 97.2% | 98.0% | 25.0% | 21.8% | 89.8% | 88.8% |
| Uniform weights only | 97.2% | 98.0% | 25.0% | 21.8% | 89.8% | 88.8% |
| Hybrid weights only | 97.2% | 98.0% | 25.0% | 21.8% | 89.8% | 88.8% |
| Blocking only (old weights) | 79.0% | 76.6% | 26.6% | 27.6% | 75.2% | 75.4% |
| Uniform weights + blocking (the study's proposal) | 61.8% | 66.2% | 18.6% | 18.2% | 64.4% | 68.2% |
| **Hybrid weights + blocking = v2** | **31.0%** | **31.6%** | **14.0%** | **12.6%** | **64.2%** | **63.0%** |
| v2 + coordination (rejected) | 71.8% | 71.4% | 16.6% | 17.8% | 78.4% | 76.0% |
| v2 + arrests at 15% (rejected) | 31.6% | 32.0% | 12.0% | 15.2% | 62.4% | 63.0% |

95% intervals for v2 on fresh seeds:

- strategic Jack: 27.7–35.8%;
- baseline Jack: 10.0–15.8%;
- detour Jack: 58.7–67.1%.

**v2 against the original, paired** (games only the original's Jack won : games only v2's Jack won):

| Jack | Seeds 1–500 | Fresh seeds |
|---|---|---|
| Strategic | 336 : 5 (p < 10⁻⁶) | 337 : 5 (p < 10⁻⁶) |
| Baseline | 88 : 33 (p < 10⁻⁶) | 87 : 41 (p = 0.000059) |
| Detour | 155 : 27 (p < 10⁻⁶) | 156 : 27 (p < 10⁻⁶) |

**v2 against the study's proposal (uniform weights + blocking), paired:**

| Jack | Seeds 1–500 | Fresh seeds |
|---|---|---|
| Strategic | p < 10⁻⁶ | p < 10⁻⁶ |
| Baseline | p = 0.023 | p = 0.0023 |
| Detour | 101 : 100 (p = 1.0) | p = 0.062 |

The hybrid's gain over uniform weights comes almost entirely against Jacks who go home fairly directly.

### Strategic outcomes, fresh seeds 650001–650500

| | Strategic: original | Strategic: v2 | Baseline: original | Baseline: v2 | Detour: original | Detour: v2 |
|---|---:|---:|---:|---:|---:|---:|
| Police wins by arrest | 9 | 150 | 255 | 279 | 55 | 110 |
| Jack out of moves (a policeman next to his hideout) | 1 (0) | 187 (177) | 136 (9) | 158 (43) | 1 (0) | 75 (51) |
| Police wins on nights 1/2/3/4 | 1/0/2/7 | 1/33/140/168 | 110/79/171/31 | 110/121/168/38 | 10/13/11/22 | 10/28/54/93 |
| Clues found a game | 5.5 | 4.3 | 12.0 | 8.9 | 8.8 | 5.8 |
| Arrest attempts a game (successful) | 1.32 (1.4%) | 1.85 (16.2%) | 3.70 (13.8%) | 2.90 (19.3%) | 2.04 (5.4%) | 1.87 (11.8%) |
| Share of the possible hideouts with a policeman next to them (from night 2) | 6.8% | 34.3% | 7.1% | 17.7% | 6.6% | 20.6% |
| Turns with a policeman next to the true hideout | 2.6% | 56.2% | 2.7% | 20.2% | 2.7% | 22.4% |

What these show:

- **Interception, not just proximity.** "Jack out of moves with a policeman next to his hideout" counts games where Jack was kept from home: he reached the end of the track while a policeman stood on a crossing next to his hideout. Against the strategic Jack that is 177 of v2's 342 wins. Proximity alone would show only in the coverage rows.
- **Arrests improve too.** Blocking brings policemen close to where Jack must go. They catch the strategic Jack 150 times (against 9), and their arrests succeed 16% of the time (against 1.4%).
- **The price is clues.** v2 finds 22–34% fewer clues, because blocking policemen search less. Against the baseline Jack this does not cost games (21.8% → 12.6%), but it is the trade-off v2 makes.
- **Night 4 matters most.** The hideout is best known then, so most of v2's extra wins come on nights 3 and 4. Night 1 is unchanged: with no earlier nights, there is nothing to block.

## 6. Robustness and exploitability

- **Both Jacks the police were designed against, and the detour Jack, lose more.** No regression is hidden: v2 is better than the original against the baseline Jack on both seed sets. Blocking alone, with the old weights, was not (27.6% against 21.8% on fresh seeds), which is why v2 pairs blocking with the hybrid weights.
- **v2 depends partly on efficient routes.** Against the detour Jack, hybrid weighting is no better than uniform. Blocking still works, but the gain is smaller (88.8% → 63.0%, against 98.0% → 31.6% for the strategic Jack). A Jack that detours on purpose, more cleverly than this fixed policy, would erode the hybrid's advantage first.
- **The detour Jack is only a partial probe.** It detours at the start of each night and then heads straight home. A Jack who ended nights from different directions, or doubled back late, would test the hideout model harder.
- **The decision thresholds are still predictable.** Arrests stay at 20%. A slight randomisation was not tried, because there was no evidence it would help; the rejected 15% threshold shows that lowering it alone doesn't. A Jack that learnt v2's blocking pattern could approach his hideout along routes the blocking score values least.
- **Search and arrest capability.** v2 finds fewer clues, but converts more arrests. Against all three Jacks, net results improved.
- **Hideout choice is not a target.** As discussed during the study, the strategic Jack's hideout choice is spread over 127 hideouts. v2 does not use any knowledge of it (that would be modelling one Jack's code, not the table).

### Where blocking still fails

v2 places policemen one at a time, each near the likeliest hideouts. It does not plan a cordon:

- **Several approaches.** When a hideout has several approaches, nothing ensures each is covered; v2 just tends to put several policemen near the same likely hideouts.
- **Several candidates.** When candidates are spread out, blocking covers the likeliest and leaves the rest.
- **The tried fix was too blunt.** The coordination option, meant to spread policemen across hideouts, made things worse, because it scattered them. A real cordon needs time-dependent reachability (which crossing must be held on which move) and an assignment of policemen to approaches. That is the Advanced Coordinated Containment project, and not part of this extension.

## 7. Cost

`results/police-benchmark.txt` measured police decision times over 30 games against the strategic Jack, on one thread:

| Decision | Original: mean / p95 / max (ms) | v2: mean / p95 / max (ms) |
|---|---|---|
| Moving the policemen | 3.6 / 9.3 / 21 | 3.3 / 8.5 / 25 |
| A search or arrest | 3.6 / 22 / 71 | 4.6 / 25 / 90 |
| Placing patrols | 8.5 / 22 / 29 | 8.0 / 18 / 28 |

v2 costs about the same as the original. Blocking adds a distance lookup per crossing and hideout. The coach fix makes each deduction about 46% slower (0.2 → 0.3 ms), which is negligible here.

The tuning took 57 runs of 300 games each, and the evaluation 48 runs of 500 games (63 minutes). The medium test tier now includes a v2 check, and the full tier the whole evaluation; both are skipped while their inputs are unchanged.

## 8. In the game

The setup dialog asks **Who leads the detectives?**:

- **You** (the default, as before);
- **Easy police**: the original detective AI;
- **Normal police**: Detective AI v2.

With a computer police:

- the player watches the hunt. `js/ui/autopolice.js` plays the police's actions through the engine, about 0.7 s apart.
- the board takes no clicks, and the subtitle says the player is watching.
- the police AI sees only the police view, so Jack's secrets stay hidden.

**Jack's difficulty is chosen separately and is unaffected.** `index.html?police=easy|normal|you` fixes the choice for testing. The address beats the dialog, which beats the saved choice, which beats the default, as for Jack's difficulty.

The labels are provisional. "Normal" means "v2", not a claim about human players.

The game has no mode where a person plays Jack. So "playable" means watchable for now: a human-Jack mode remains on the roadmap. `test/unit/police-levels.test.js` plays whole page games with each computer police.

## 9. Limitations and future work

- **One fixed opponent set.** The strategic Jack's risk model was calibrated against the original police; against v2 it would need re-measuring, and would recover some ground. v2's 31.6% is today's Jack, not an equilibrium.
- **The hybrid weighting is a model.** It is fitted to three Jacks. It rewards direct routes and could be misled by a Jack that ends nights deceptively. The uniform floor limits the damage, and against the detour Jack it was never worse than uniform.
- **Blocking is a heuristic.** v2 has no cordon planning, no time-dependent reachability, and no assignment of policemen to approaches (see [Where blocking still fails](#where-blocking-still-fails)).
- **Clues fall.** v2 trades searching for blocking. A policy that decides per policeman whether to search or to guard might keep both.
- **Sample sizes.** 500 games per setting and seed set: enough for the main effects (all p < 0.0001), not for small ones such as the arrest threshold.

**Next, as planned and not part of this extension:**

- **Deceptive Jack:** detours, doubling back, short special moves and hiding the hideout, aimed at v2's hideout model.
- **Advanced coordinated containment:** cordons from time-dependent reachability and graph cuts, with policemen assigned to approaches. It should beat v2 especially against the detour Jack.
- **Re-measuring the strategic Jack's risk tables against v2**, and evaluating every Jack against a population of police (original, v2 and random) rather than one.
