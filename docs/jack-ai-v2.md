# Jack AI v2

Jack AI v2 is the strategic Jack plus one habit: **on every night but the last, while he has moves to spare, his first moves walk away from his hideout.** The habit came out of a study of why the strategic Jack loses to [Detective AI v2](detective-ai-v2.md).

Against Detective AI v2, on development seeds 420001–420200 (200 games, paired by seed):

| Jack | Wins against Detective AI v2 | Against the original police | Against uniform-blocking police |
|---|---:|---:|---:|
| Strategic Jack | 32.0% | 97.0% | 67.5% |
| Detour Jack (the diagnostic Jack from the detective study) | 68.0% | 91.5% | 60.5% |
| **Jack AI v2** | **70.5%** (63.8–76.4%) | **95.5%** | **65.5%** |

- **Against Strategic Jack:** Jack AI v2 wins 70.5% where Strategic Jack wins 32.0% (p < 10⁻¹¹).
- **Against Detour Jack:** Jack AI v2 also does at least as well, on every police and on all three development seed sets. That margin is small, and against Detective AI v2 it is **not yet statistically established**.
- **Independent validation:** this has been proposed (section 9) and is **waiting for approval**. It has not been run.

In the game, Jack AI v2 is the new **Hard** difficulty. Easy (the baseline Jack) and Normal (the strategic Jack) are unchanged.

Scripts and results are in [`research/jack-v2/`](../research/jack-v2/).

## Contents

1. [Summary of findings](#1-summary-of-findings)
2. [Diagnosis: why the strategic Jack loses](#2-diagnosis-why-the-strategic-jack-loses)
3. [Hypotheses](#3-hypotheses)
4. [Screening the prototypes](#4-screening-the-prototypes)
5. [Controlled comparison](#5-controlled-comparison)
6. [Jack AI v2](#6-jack-ai-v2)
7. [Ablation and tests](#7-ablation-and-tests)
8. [Cost and test tiers](#8-cost-and-test-tiers)
9. [Independent validation (proposed, not run)](#9-independent-validation-proposed-not-run)
10. [Limitations and future work](#10-limitations-and-future-work)
11. [Reproducing](#11-reproducing)

## 1. Summary of findings

**Why Strategic Jack struggled.** His routes home are almost direct: 0.4 to 2.6 moves of detour a night. Detective AI v2 weights each possible hideout by how direct Jack's routes would have been to reach it, so direct routes point at the true hideout. By night 4, v2 puts on average 23% of its hideout belief on the true one, against 6% for Detour Jack. It then stands next to the hideout in 78% of turns, against 31% for Detour Jack.

| | Strategic Jack | Detour Jack |
|---|---:|---:|
| Win rate against police that block uniformly (direct routes tell them nothing) | 66.2% | 68.2% |
| Win rate against Detective AI v2 (direct routes point at the hideout) | 31.6% | 63.0% |

These are the detective study's fresh seeds, 650001–650500. The hybrid weighting costs Strategic Jack about 35 points and costs Detour Jack about 5.

**Running out of moves comes second.** 55% of Strategic Jack's losses are running out of moves, and every one of them had the hideout walled off by policemen at some point. The wall goes up early in the night: on average after 4.3 of 14.6 moves. Jack then hovers 2–3 moves from home until his time runs out.

| Hypothesis | Mechanism tested | Result | In Jack v2? |
|---|---|---|---|
| C. Purposeful deception | **Early detours** (Detour Jack's rule) | Strategic 32.0% → 68.0% against v2 | **Yes** |
| B. Movement budget | Early detours **not on the last night** | Detour Jack 68.0% → 70.5% against v2 (9 games to 4 on the same seeds, p = 0.27); +4.0 against the original police (8 to 0, p = 0.008); +5.0 against uniform blocking (14 to 4, p = 0.031) | **Yes** |
| C. Purposeful deception | A planned waypoint detour | Hid the hideout as well as early detours, but lost more nights to time (52% against 65%) | No |
| A + B. Containment awareness | Estimate the way home around the policemen where they stand | No gain against v2 (70.5% with or without it); −5.5 points against the original police | No |
| E. Stochastic movement | Random choice among nearly-best moves | No gain (28% against 34%); the hideout was no less exposed | No |
| D. Opponent modelling | Recalibrated arrest risk | Not prototyped: the arrest-risk table is roughly calibrated against v2 | No |
| F. Hideout selection | Hideouts that are harder to wall off | Not prototyped: no hideout feature predicted losses | No |

**Deception mattered far more than containment awareness.** Once the hideout is exposed, no short-horizon planning got Jack home against a policeman sitting next to it. The answer was to not expose it.

**More complexity did not pay.** The selected change is about 25 lines on top of the unchanged strategic Jack. The two more elaborate candidates, the waypoint planner and the blocked-distance model, did no better.

## 2. Diagnosis: why the strategic Jack loses

Strategic Jack and Detour Jack were played against Detective AI v2 on seeds 1–200, with every night and move recorded by the referee (`research/jack-v2/record.js`). These are the first 200 seeds of the detective study's evaluation, and all 400 games reproduce its stored results exactly. Full tables: [`results/diagnosis-v2-1-200.md`](../research/jack-v2/results/diagnosis-v2-1-200.md).

| Jack | Wins | Arrested (night 1/2/3/4) | Out of moves (1/2/3/4) |
|---|---:|---:|---:|
| Strategic | 30.5% | 63 (0/19/26/18) | 76 (0/5/31/40) |
| Detour | 65.0% | 42 (3/6/18/15) | 26 (0/4/6/16), and 2 trapped |

### Each night, as Detective AI v2 sees it

| Jack | Night | Survived | Hideout candidates (median) | v2's belief on the true hideout (mean) | Policeman next to the hideout (share of turns) | Detour when escaped (moves) |
|---|---:|---:|---:|---:|---:|---:|
| Strategic | 1 | 100% | 187 | 0.01 | 3% | 0.4 |
| Strategic | 2 | 88% | 78 | 0.04 | 22% | 1.3 |
| Strategic | 3 | 68% | 28 | 0.12 | 58% | 1.6 |
| Strategic | 4 | 51% | 15 | 0.23 | 78% | 2.6 |
| Detour | 1 | 99% | 187 | 0.01 | 3% | 3.2 |
| Detour | 2 | 94% | 105 | 0.01 | 10% | 3.5 |
| Detour | 3 | 87% | 63 | 0.04 | 20% | 2.6 |
| Detour | 4 | 81% | 45 | 0.06 | 31% | 3.3 |

### The seven questions

1. **Containment.** It is the immediate cause of most losses, but not the root cause.
   - The hideout was walled off in all 76 of Strategic Jack's out-of-moves losses. "Walled off" means no walk reaches it past the policemen where they stand.
   - In 42 of those losses he ended within 2 moves of home.
   - No loss had an open route and simply ran out of time.
   - The wall goes up early because v2 already knows where to stand. Detour Jack, whose hideout v2 knows far less about, was walled off in a third as many games.
2. **Predictability.** This is the root cause.
   - Direct routes shrink the set of possible hideouts faster: 28 candidates on night 3, against 63 for Detour Jack. They also concentrate the hybrid weights on the true hideout.
   - At the start of night 4, v2's belief on the true hideout was 0.35 on average in the games he then lost, against 0.13 in those he survived.
3. **Movement budget.** Not a problem for the strategic Jack.
   - His spare moves at the start of a night are the same as Detour Jack's (8–9).
   - None of his losses wasted moves on an open route.
   - Detour Jack, however, spends detours on the last night, where they protect nothing. That became Jack v2's second rule.
4. **Special movement.** A minor factor.
   - He uses most of his coaches (91% on night 4) and more alleys late (50–67% on nights 3–4).
   - Walled-off losses ended with 0.41 coaches and 0.12 alleys unused on average.
   - A coach can pass policemen but cannot end the night, and the last step home must be a walk. So spare tokens rarely break a wall at the hideout's own crossings.
5. **Risk estimation.**
   - His **arrest** table is roughly calibrated against v2:

     | Predicted arrest risk | Moves | Arrested straight after |
     |---|---:|---:|
     | 0.8% | 3,037 | 0.0% |
     | 1.5% | 1,253 | 3.1% |
     | 12.2% | 72 | 12.5% |
     | 39% | 23 | 30% |
     | 69% | 26 | 31% |

   - His **escape** table is badly calibrated against v2. It was measured against the original police and knows nothing of blocking:

     | Decisions | Predicted chance of getting home | Got home that night |
     |---|---:|---:|
     | v2's belief on the hideout at 0.3 or more | 70% | 11% |
     | Hideout walled off (810 decisions) | 69% | 8% |

6. **Hideout selection.** No evidence of a problem.
   - Win rates by the hideout's number of entry crossings show no clear trend: 28% with 2, 32% with 3 for Strategic Jack; 63% and 76% for Detour Jack.
   - The worst individual hideouts have only 3–5 games each.
   - Strategic Jack spreads his choice over 127 near-equivalent hideouts, so there is little to predict.
7. **Nights 3 and 4.** The hideout evidence accumulates from earlier nights, and the hideout candidates halve each night (187 → 78 → 28 → 15). At the same time Jack has fewer coaches and alleys (3/2/2/1 and 2/2/1/1), and night 3 is the double event.

### Representative losses

| Seed | Outcome | What happened |
|---|---|---|
| 1 | Night 3, out of moves | Detours of 0 and 1 moves on nights 1–2 left 3 possible hideouts. A policeman stood next to the hideout every turn of night 3. Jack reached 2 moves from home after his second move and stayed there until his time ran out |
| 7 | Night 4, out of moves | Detours of 0, 0 and 0 on nights 1–3 left 2 possible hideouts. The hideout was walled off from his fourth move. He then went back and forth between circles 2 moves from home for 10 moves |
| 3 | Night 3, arrested | A coach to a circle next to his hideout, where a guarding policeman arrested him |

## 3. Hypotheses

Ranked on the diagnosis by evidence, expected benefit, implementation cost, run time and how easily each can be tested alone:

| Rank | Hypothesis | Evidence | Cost | Prototyped as |
|---:|---|---|---|---|
| 1 | **C. Purposeful deception**: hide the hideout by not going straight home | Strong: the hybrid weighting alone costs him 35 points; v2's belief on his hideout is 4× Detour Jack's | Low | A planned waypoint, then Detour Jack's early detours |
| 2 | **A + B. Containment awareness and movement budget**: plan the way home around the policemen | Medium: his escape estimates ignore walls (69% predicted, 8% real) | Low to medium | The "moves home" estimate counts the policemen where they stand |
| 3 | **E. Stochastic movement** | Weak: Detour Jack's success might be its randomness | Very low | Random choice among moves valued within 0.03 of the best |
| 4 | D. Recalibrated arrest risk | Weak: the arrest table is roughly right | Medium (needs a calibration run) | Not prototyped |
| 5 | F. Hideout selection | None found | Low | Not prototyped |

## 4. Screening the prototypes

Each mechanism is a small wrapper around the **unchanged** strategic Jack (`research/jack-v2/policies/candidates.js`). Two kinds of wrapper were used:
- **A changed distance home:** the wrapper hands the strategic Jack a board whose `distance()` answers differently while he chooses a move. This was used for the waypoint and blocked-distance prototypes.
- **A changed choice:** the wrapper chooses among the strategic Jack's top-ranked moves (stochastic), or takes the move itself (early detours).

With every mechanism off, the wrapper replays the strategic Jack's games exactly (checked on 50 games). Its early-detour mechanism replays Detour Jack's games exactly (100 games).

Screening used Detective AI v2 on development seeds 410001–410100, 100 games each (the first 50 were looked at first). Full table: [`results/screening.md`](../research/jack-v2/results/screening.md).

| Candidate | Wins | vs Strategic: games only this won / only Strategic won (p) | v2's belief on hideout, night 4 | Detour, nights 1–3 | Decision |
|---|---:|---:|---:|---:|---|
| Strategic | 34% | | 0.18 | 0.9 | Reference |
| Detour Jack | 65% | 42 / 11 (p < 0.0001) | 0.07 | 3.3 | Reference |
| Waypoint (≥4 extra moves, keep 4 to spare) | 52% | 33 / 15 (p = 0.013) | 0.06 | 4.4 | Rejected: as well hidden as Detour Jack, but 13 points worse (16 / 29 against it, p = 0.072) |
| Waypoint, revised (keep 6, only away from home) | 41% | 18 / 11 (p = 0.27) | 0.14 | 2.2 | Rejected: few waypoints qualify, so little hiding |
| Waypoint, revised, last night too | 40% | 18 / 12 (p = 0.36) | 0.14 | 2.2 | Rejected |
| Blocked distance | 41% | 18 / 11 (p = 0.27) | 0.24 | 1.0 | Kept only as a combination |
| Stochastic | 28% | 17 / 23 (p = 0.43) | 0.25 | 1.4 | Rejected |

**Why a waypoint does worse than an early detour that hides as well.** The waypoint lost 15 games on night 2, against 8 for early detours, almost all by running out of moves.
- An early detour spends its moves in the first three moves, while the policemen are still around the crime scene. It always keeps 6 moves to spare.
- A waypoint spends them over a longer trip and keeps only 4. Its trip may also pass the hideout.
- The one revision tested (a reserve of 6, waypoints away from home) left too few waypoints to hide anything. Further tuning was stopped there, as planned.

Detour Jack's rule was then taken as a mechanism (`early`) and tested in two variants that the diagnosis suggested:

| Candidate (vs Detour Jack) | Wins | Only this / only Detour (p) |
|---|---:|---:|
| Early detours, not on the last night | 70% | 7 / 2 (p = 0.18) |
| Early detours + blocked distance | 68% | 18 / 15 (p = 0.73) |

## 5. Controlled comparison

These rules were written down before the run, which used fresh development seeds 420001–420200 (200 games per matchup):
- **Better than Detour Jack:** a candidate counts as better only if it is ahead of Detour Jack against v2 on both the screening seeds and these seeds, and no more than 5 points worse against the original police and against uniform blocking.
- **The blocked-distance estimate is kept only if** it adds 3 points or more on both seed sets, because it costs about 50% more decision time and more code.
- **No sample sizes were increased** after looking at results.

Full tables: [`results/comparison.md`](../research/jack-v2/results/comparison.md). The run took 11.3 minutes.

| Jack | v2 | vs Detour (only / only, p) | Original | vs Detour | Uniform blocking | vs Detour |
|---|---:|---:|---:|---:|---:|---:|
| Strategic | 32.0% | 20 / 92 (p < 10⁻¹¹) | 97.0% | 16 / 5 (0.027) | 67.5% | 55 / 41 (0.18) |
| Detour | 68.0% | | 91.5% | | 60.5% | |
| **Early, not on the last night** | **70.5%** | 9 / 4 (0.27) | **95.5%** | 8 / 0 (0.008) | **65.5%** | 14 / 4 (0.031) |
| Early + blocked | 70.5% | 28 / 23 (0.58) | | | | |
| Early, not last + blocked | 70.5% | 26 / 21 (0.56) | 90.0% | 9 / 12 (0.66) | 70.5% | 47 / 27 (0.027) |

**Decisions.**
- **"Early, not on the last night"** passes: it is ahead of Detour Jack on both seed sets and better against both other police.
- **The blocked-distance estimate** fails its rule:
  - It adds nothing against v2 (70.5% either way).
  - It is 5.5 points worse than its counterpart against the original police.
  - It changes how Jack loses rather than how often: fewer walled-off losses (17 against 24), more arrests and more losses on nights 1–2 (8/16 against 4/8).

  Its gain against uniform blocking (+5) is noted, but on its own it did not meet the rule.

A third development seed set, the medium test tier's (300001–300100), agrees: v2 against Jack v2 65%, Detour Jack 63%, Strategic Jack 35%.

## 6. Jack AI v2

`js/ai/jack-v2.js`, `WC.createJackV2(board, deduction, random, _, options)`.

**Algorithm.** For each move:

1. **Detour.** It applies only if all of these hold: this is not the last night; Jack has made at most 3 moves tonight; and at least 6 moves would still be spare after a step away (spare moves = moves left − walking distance home). Then he walks to a random adjacent circle **farther from his hideout**.
2. **Otherwise, the strategic Jack's move.** This is unchanged: the measured chances of surviving the police's next turn and of getting home in time, two moves ahead (see [Jack's AI](jack-ai.md)).
3. **Fallback.** If the strategic planner throws for any reason, he walks to the circle closest to home. If no walk is possible, he takes a legal special movement. The game never stalls on Jack.

The hideout choice, the victims, waiting and revealing patrols are all the strategic Jack's.

**Options** (the defaults are the evaluated policy):

| Option | Default | Meaning |
|---|---|---|
| `detourMoves` | 3 | Detours only while he has made at most this many moves tonight (so up to 4 detour steps) |
| `detourSpare` | 6 | Only while this many moves stay spare after the detour |
| `detourLastNight` | `false` | When `true`, he detours on the last night too: that is Detour Jack, and it replays Detour Jack's games exactly |

These values are Detour Jack's, which the detective study set before this work. They were **not tuned** here.

**Movement budget.** Each detour costs two moves of spare: one to go and one to come back. The 6-move reserve is where the strategic Jack's measured chance of getting home levels off (83% at 6 or more). A detour therefore never trades the night for deception, and the tests check this. On the last night, deception buys nothing, so he spends nothing on it.

**Risk estimation and special movement.** These are the strategic Jack's, unchanged:
- **Risk:** measured arrest and escape tables.
- **Special movement:** coaches and alleys valued like walks; a walk is preferred when it does as well, because tokens don't carry over.

The study tried changing his estimate of the way home (blocked distance) and kept nothing from it.

**Information.** He uses only Jack's view: his position, route, hideout, moves left, walks and special movements, and the strategic Jack's public-information model of the police. The tests read every view key he touches and check that the game state is unchanged.

**Run time.** On one thread, against v2, seeds 800301–800340 ([`results/benchmark.txt`](../research/jack-v2/results/benchmark.txt)):

| Jack | Decisions | Mean | p99 | Max | Max when walled off | Max when using a coach or alley |
|---|---:|---:|---:|---:|---:|---:|
| Strategic | 927 | 16.9 ms | 69.8 ms | 132 ms | 68 ms | 132 ms |
| Detour | 1,132 | 15.3 ms | 65.9 ms | 140 ms | 109 ms | 140 ms |
| Jack v2 | 1,082 | 16.7 ms | 76.2 ms | 113 ms | 113 ms | 95 ms |

Across all 7,400 games of the study, run four at a time, no Jack decision took more than 210 ms. The 5-second target and 30-second ceiling are far away. The strategic planner's work is bounded by its fixed beam, two moves deep, so no time budget is needed.

## 7. Ablation and tests

Jack v2 has two parts on top of the strategic Jack: early detours, and not detouring on the last night. Each switched off gives an existing Jack, so no extra policies were needed:

| Jack | Early detours | On the last night | v2 | Original | Uniform blocking |
|---|---|---|---:|---:|---:|
| Strategic | No | | 32.0% | 97.0% | 67.5% |
| Detour (= `detourLastNight: true`) | Yes | Yes | 68.0% | 91.5% | 60.5% |
| **Jack v2** | Yes | No | **70.5%** | **95.5%** | **65.5%** |

Seeds 420001–420200: [`results/ablation.md`](../research/jack-v2/results/ablation.md), which re-played the strategic and detour games and reproduced the comparison exactly.

**What each part does:**
- **Early detours** are what beat Detective AI v2, by 36 points. They cost a little against police that don't read Jack's directness: −5.5 against the original police and −7 against uniform blocking, without the last-night rule.
- **The last-night rule** recovers most of that cost (+4 and +5) and adds 2.5 against v2.
- **Through night 3, Jack v2 and Detour Jack play identical games.** Every difference between them is on night 4.

**Tests** (`test/unit/jack-v2.test.js`, 14 tests; with `difficulty.test.js` and `architecture.test.js`):

| Requirement | Test |
|---|---|
| Legal movement and special movement | Whole games against v2 and the original police: every walk is in Jack's walks, every coach and alley is among the rules' special moves |
| Route viability and movement limits | A detour always leaves 6 moves to spare; with too few spare (4, 6, 11 moves left at 4 from home) he doesn't detour; with exactly enough (12) he does |
| Detective blocking | Policemen on every crossing around him: no detour; a legal special movement |
| Determinism | The same seed plays the same game |
| Information visibility | Reads only Jack's view's keys; never changes the state; the file never touches the page, the engine, the state or the police's view |
| Planner fallback | A deduction that throws: a legal walk, or a coach when walled in |
| Night transitions | Every night with room for it (but the last) starts with a detour; detours only in a night's first moves |
| Deception against immediate survival | On the last night, and when time is short, he plays exactly the strategic Jack's move |

The full suite passes (`npm test`, 171 tests), as do the smoke tier and the medium step.

## 8. Cost and test tiers

**Simulations.** The study recorded 7,400 games, about 32 minutes of wall-clock time on 4 cores, nothing run in parallel with anything else:
- About 1,700 of these are deliberate replays, which confirmed that the stored results reproduce. They were triggered when the harness's own files changed.
- The detective study's unchanged experiments were not re-run.
- `npm run research:full` was not run.

| Run | Games | Wall clock |
|---|---:|---:|
| Diagnosis (seeds 1–200, 2 Jacks) | 400 | 1.6 min |
| Screening (seeds 410001–410100), with the re-record and the replay checks | about 2,300 | about 9 min |
| Controlled comparison (seeds 420001–420200) | 2,600 | 11.3 min |
| Ablation (re-played Strategic and Detour after a harness change; Jack v2) | 1,800 | 5.9 min |
| Medium tier step (seeds 300001–300100) | 300 | 1.3 min |
| Benchmark (one thread, seeds 800301–800340) | 120 | 1.8 min |

**Tiers** (`npm run tier <tier>`; [Testing](testing.md#test-tiers)):

| Tier | What it adds for Jack v2 | When |
|---|---|---|
| Fast (`npm test`) | `jack-v2.test.js`, the Hard level in `difficulty.test.js` | Every change; CI |
| Smoke (`npm run test:smoke`) | 4 whole Jack v2 games (v2 and original police), each played twice to check determinism, about 7 s | Any change to an AI; CI |
| Medium (`npm run eval:medium`) | `medium-jack-v2`: Strategic, Detour and Jack v2 against v2, 100 games each, 75 s | Milestones |
| Full (`npm run research:full`) | `full-jack-v2`: screening, comparison and ablation. About 25 minutes from nothing; seconds when nothing changed, since stored games are reused | Manually |

`research/jack-v2/run.js` stores every game as it ends, with a fingerprint of every file the game depends on:
- **Resuming:** an interrupted run resumes where it stopped.
- **Reuse:** a stored game is reused only while the code, the policy and the police configuration are identical.

`validate.sh` (section 9) is in no tier and runs only by hand.

## 9. Independent validation (proposed, not run)

**Not run. Waiting for approval.**

1. **Final candidate:** Jack AI v2 as in section 6 (`WC.createJackV2` defaults).
2. **Questions:**
   - (a) Does Jack v2 beat Strategic Jack against Detective AI v2 on unseen seeds?
   - (b) Is Jack v2 at least as strong as Detour Jack against v2? This is the night-4 rule, the one result not yet established.
   - (c) Does Jack v2 avoid regressions against police that don't read directness?
3. **Opponents:** Detective AI v2 (primary), the original police, and uniform-blocking police (`uniform+block`, robustness).
4. **Games:** 1,000 per matchup on seeds **760001–761000**, which nothing in this study touched. That is 3 Jacks × 3 police = 9,000 games. Strategic and Detour Jack have to be played on the new seeds for paired comparisons; no Detective AI v2 experiment is re-run.
5. **Runtime:** about 40 minutes on 4 cores. The measured pilot was 200 games of Jack v2 against v2 in 57 s, Detour Jack about the same, and Strategic Jack and the original police faster.
6. **Why the existing results aren't enough:**
   - Every seed so far was used to choose the policy.
   - Question (b) rests on 13 discordant games against v2 (9 to 4).
   - At the observed rate, 1,000 games give about 65 discordant games, enough for about 85% power to detect a 9:4 split at the 5% level.
7. **Statistics:**
   - Win rates with Wilson 95% intervals.
   - McNemar's exact test on paired seeds for (a) and (b) against v2, with no correction for those two primary tests.
   - For (c), the same tests reported with a Holm correction across the four comparisons.
   - Outcome breakdowns: arrests, out of moves, the night of defeat, how sure v2 was of the hideout, and how often it guarded it.

Command: `bash research/jack-v2/validate.sh` (resumable; writes `results/validation.md`).

## 10. Limitations and future work

**Dependence on the detectives:**
- **Its gain depends on how the police infer the hideout.** Jack v2's advantage comes from defeating one model: hideouts weighted by route directness.
  - Against police that block without that model, early detours cost a little: Jack v2 is 2 points behind the strategic Jack against uniform blocking (65.5% against 67.5%, not significant) and 1.5 points behind against the original police.
  - On the Normal police (Detective AI v2) it is far stronger. On Easy police it is about the same.
- **Overfitting.** The rule wasn't tuned (Detour Jack's parameters), but it was *selected* on development seeds against Detective AI v2. That is why validation on unseen seeds is needed.

**What remains of his weaknesses:**
- **Detours are predictable in shape.** They always come first, always lead away, and are always a few steps (at most 4). Police that model "Jack starts by walking away" could weight hideouts by the route *after* the detour and recover much of what v2 lost. A smarter deception (choosing when and how far to detour, or approaching from different sides) is the natural next step. The waypoint prototype shows it has to keep its time reserve to pay off.
- **Containment.** Once a policeman sits next to his hideout, Jack v2 still hovers nearby, as the strategic Jack did. In 24 of its 59 losses against v2 the hideout was walled off. Planning around the current policemen did not help; anticipating where they will be next turn might.
- **Escape estimates.** They are still the strategic Jack's, measured against the original police. Recalibrating them against blocking police (from Jack's view: how many possible hideouts the police could still believe, and whether policemen stand between him and home) was diagnosed but not tried.

**Scope of the evidence:**
- **AI against AI only.** Human detectives coordinate, bluff and read patterns over a game in ways neither computer police does. Nothing here claims Jack v2 plays at human level, or that Hard is hard for a person.

**Not in scope:** Detective AI v3, learning methods, game-tree search, and human playtesting.

## 11. Reproducing

| Script | What it does |
|---|---|
| `research/jack-v2/record.js` | Plays one seeded game and records, as the referee, what the study measures (never used to play) |
| `research/jack-v2/run.js <jack> <police> <games> <first seed>` | Many games, on every core, stored and fingerprinted (resumable) |
| `research/jack-v2/policies.js`, `policies/*.js` | The Jacks by name: the existing three, the candidates and Jack v2 |
| `research/jack-v2/diagnose.js` | Section 2 |
| `research/jack-v2/summary.js <police> <games> <first seed> <jacks> [reference]` | Comparison tables, with paired tests |
| `screen.sh`, `compare.sh`, `ablation.sh` | Sections 4, 5 and 7 |
| `benchmark.js` | Decision times on one thread |
| `validate.sh` | Section 9 (approval needed) |

**Seeds:**
- 1–200: diagnosis (the detective study's evaluation seeds).
- 410001–410100: screening.
- 420001–420200: comparison and ablation.
- 300001–300100: medium tier.
- 800301–800340: benchmark.
- **760001–761000: reserved for validation.**

Police configurations are `research/detective-v2/configs.js`. Per-game records are kept out of git (`research/jack-v2/results/games/`); the summaries are committed.
