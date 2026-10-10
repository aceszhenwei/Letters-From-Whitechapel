# Adaptive deception under opponent uncertainty (Study J3)

Can Jack choose **how much to deceive** from what he sees of the police, and beat [Jack AI v2](jack-ai-v2.md)'s fixed early detours? Does any gain come from the adaptation itself, or only from being less predictable?

**Answer: recommendation B. The best candidate is kept as an experimental research Jack, not promoted.** No production AI or difficulty level changed.

- **Reading the police across nights does not work.** The "pressure" signal (how much more the police guarded Jack's true hideout than the alternatives on earlier nights) has the same distribution against every detective. A Jack driven by it cannot tell them apart, and relaxing deception when pressure is low costs 5 to 14 points: low pressure is the deception working, not a weak detective. Mixing the extent of deception at random (unpredictability alone) also loses: −3.7 points on the held-out seeds.
- **A within-the-night rule helps a little.** `safe-skip` takes Jack AI v2's detours, but each detour step goes only to a circle no policeman can reach on his next turn; if every step away is in reach, that move is not a detour. On the 400 held-out seeds it beats Jack AI v2 by **+4.1 points** on the primary metric (95% interval +1.6 to +6.7). It beats a control that skips as often at random by +3.1 (+0.4 to +5.8). It is no worse than Jack AI v2 against any of six detectives, two of them never seen during development.
- **It fails two of the five pre-registered criteria.** The gain is below the +5-point bar. Its behaviour does not differ significantly between detectives (skip rates 10.9–14.3%, p 0.053), so it is a tactical safety rule, not opponent modelling.
- **Where the gain comes from:** fewer arrests on nights 1 and 2, the nights it detours with policemen nearby. Jack AI v2 lost 84 games on night 1 across the six detectives; `safe-skip` lost 12.
- **Jack AI v2's own independent validation** was also run (9,000 games, seeds 760001–761000):
  - It beats Strategic Jack against Detective AI v2 (65.8% against 30.0%, p 3.6 × 10⁻⁵⁶).
  - Its edge over Detour Jack is **not established** (65.8% against 64.1%, p 0.068).
  - It is **worse than Strategic Jack against the original police** (93.3% against 97.8%, p 7 × 10⁻⁷).

The pre-registration is [`research/jack-adaptive/PREREGISTRATION.md`](../research/jack-adaptive/PREREGISTRATION.md) and the gap assessment [`gap-assessment.md`](../research/jack-adaptive/gap-assessment.md). Scripts and result summaries are in [`research/jack-adaptive/`](../research/jack-adaptive/).

## Contents

1. [Research gap](#1-research-gap)
2. [Hypotheses and criteria](#2-hypotheses-and-criteria)
3. [Method](#3-method)
4. [Development (stage A)](#4-development-stage-a)
5. [Selection (stage B)](#5-selection-stage-b)
6. [Held-out results (stage C)](#6-held-out-results-stage-c)
7. [Ablation and evidence of adaptation](#7-ablation-and-evidence-of-adaptation)
8. [Failure analysis](#8-failure-analysis)
9. [Cost](#9-cost)
10. [Jack AI v2's independent validation](#10-jack-ai-v2s-independent-validation)
11. [Recommendation](#11-recommendation)
12. [Limitations](#12-limitations)
13. [Reproducing](#13-reproducing)

## 1. Research gap

The full assessment, written before any game, is [`gap-assessment.md`](../research/jack-adaptive/gap-assessment.md). In short:

- **Established:** hiding the hideout is what beats Detective AI v2, and not detouring on the last night helps ([Jack AI v2 §5](jack-ai-v2.md#5-controlled-comparison)). Learning a Jack's route style from earlier nights did not help the police ([Detective coordination and inference §5](detective-study.md#5-hideout-inference)).
- **Rejected before:** a planned waypoint detour, random near-best moves, containment awareness ([Jack AI v2 §4–5](jack-ai-v2.md#4-screening-the-prototypes)). Strategic waiting is small and uncertain ([Strategic waiting](jack-waiting.md)).
- **Open:**
  - Jack AI v2 had never been validated on unseen seeds.
  - Its deception is fixed in shape and extent; police that expect it had never been built.
  - It deceives against every detective, including those it doesn't fool.
  - Adaptation had never been separated from unpredictability.

This study tests deception chosen in response to the police, with Jack AI v2's own detour rule at different extents (no new planner). It adds police that model Jack AI v2's habit, and the controls needed to attribute a gain. It runs Jack AI v2's outstanding validation.

## 2. Hypotheses and criteria

Fixed before the first game ([pre-registration, part 1](../research/jack-adaptive/PREREGISTRATION.md#part-1-fixed-now)):

- **H1:** an adaptive Jack beats Jack AI v2 across detectives.
- **H2:** the gain comes from adaptation, not unpredictability: it beats a matched control that deceives as much, at random.
- **H3:** it doesn't regress against any detective, including held-out ones.

**Primary metric:** per seed, the mean over the four primary detectives of (candidate won − reference won), averaged over seeds, with a 95% normal interval.

**Criteria on the held-out stage**, all required for recommendation A:

1. Candidate − Jack AI v2 ≥ +5.0 points on the primary metric, with the interval above 0.
2. Candidate − matched control > 0, with the interval above 0.
3. No detective, primary or held out, more than 5 points below Jack AI v2, and none significantly worse (McNemar p < 0.05).
4. Its behaviour differs between detectives (chi-square, p < 0.01).
5. Mean decision time within 1.5× Jack AI v2's, maximum under 1 s.

**B (keep as experimental)** if the primary metric is positive but criteria fail; **C (reject)** if it is not positive.

## 3. Method

**Jacks** (`research/jack-adaptive/jacks.js`). Every one is the unchanged Strategic Jack plus Jack AI v2's detour rule, with a per-night extent: none, v2 (Jack AI v2's: detour while at most 3 moves made and 6 would stay spare) or long (up to 5 moves made). On the last night the extent is always none. A test checks that `fixed-v2` plays Jack AI v2's games exactly and `fixed-none` Strategic Jack's.

| Jack | How it chooses |
|---|---|
| `strategic` | Strategic Jack: no deception |
| `jack-v2` | Jack AI v2: v2 every night |
| `mixed` | none, v2 or long at random each night (⅓ each), ignoring the police: unpredictability alone |
| `adaptive` | v2 on night 1; then long if pressure ≥ 0.15, none if ≤ 0.02, else v2 |
| `adaptive-up`, `adaptive-down` | escalate only; relax only |
| `safe-steer` | v2, but each detour step to a circle out of the policemen's next-turn reach when one exists |
| `safe-skip` | v2, but each detour step only out of reach; no detour step when every step away is in reach |
| `matched` | the control for the selected candidate: v2, skipping each detour step at random at the candidate's stage B rate (0.12) |

**Pressure**, from Jack's view only: at each of his past moves, the public record shows where the policemen stood. For a hideout h, guard(h) is the share of those moments when a policeman stood within two crossings of a crossing beside h. Pressure is guard(true hideout) minus the mean guard over the hideouts the police could still suspect.

**Reach**, for the detour-step Jacks: every numbered circle next to a crossing within two of a policeman, from the tokens on the board (public).

**Detectives** (`research/jack-adaptive/police.js`). None was tuned against a candidate.

| Detective | | Role |
|---|---|---|
| `original` | The original police | Primary |
| `v2` | [Detective AI v2](detective-ai-v2.md) | Primary |
| `v3` | [Detective AI v3](detective-ai-v3.md) | Primary |
| `anti8` | Detective AI v2 whose hideout belief forgives up to 8 moves of detour a night: a legal model of Jack AI v2's habit, built for this study | Primary |
| `uniform+block` | Uniform hideout belief with blocking (the Jack v2 study's robustness police) | Held out: stage C only |
| `v3-anti6` | Detective AI v3 forgiving up to 6 moves | Held out: stage C only |

**Seeds** (none used by any earlier study; [Testing](testing.md#seeds)):

| Stage | Seeds | Games per matchup | Purpose |
|---|---|---:|---|
| A, development | 592001–592100 | 100 | Thresholds; exploratory |
| B, selection | 593001–593200 | 200 | Choose the candidate; exploratory |
| C, held out | 594001–594400 | 400 | Confirmatory, run once after part 2 of the pre-registration was written |

All Jacks share the harness's random streams (Jack `seed × 7919 + 1`, police `seed × 104729 + 2`); `mixed` and `matched` draw from streams of their own, so every comparison is paired by seed. **Strategic waiting is off in every Jack.**

**Statistics:**
- Win rates with Wilson 95% intervals.
- Paired differences with McNemar's exact test.
- The primary metric's interval is 1.96 standard errors over seeds.
- Criterion 4 uses a chi-square test of skips against detour steps on nights 1–3, by detective.

## 4. Development (stage A)

Exploratory: 100 games per matchup, four primary detectives ([`results/stage-a.md`](../research/jack-adaptive/results/stage-a.md)).

| Jack | Mean win rate | vs Jack AI v2 (points) | 95% interval |
|---|---:|---:|---|
| jack-v2 | 78.8% | | |
| strategic | 55.0% | −23.8 | −30.8 to −16.7 |
| fixed-long | 78.0% | −0.8 | −2.0 to +0.5 |
| mixed | 72.5% | −6.3 | −11.2 to −1.3 |
| adaptive | 73.8% | −5.0 | −9.6 to −0.4 |
| adaptive-up | 78.7% | +0.0 | −0.7 to +0.7 |
| adaptive-down | 73.8% | −5.0 | −9.5 to −0.5 |
| safe-steer | 76.5% | −2.3 | −6.4 to +1.9 |
| safe-skip | 76.3% | −2.5 | −7.5 to +2.5 |

**What this showed:**
- **Pressure doesn't tell the detectives apart.** Its mean on nights 2–3 is −0.04 against the original police, v2 and v3, and −0.06 against anti8. The adaptive Jack chose almost the same extents everywhere (about 39 / 43 / 18% none / v2 / long). No thresholds can make the extents depend on the detective when the signal doesn't, so the thresholds stayed as first written.
- **Relaxing deception costs** (adaptive, adaptive-down): low pressure follows from the deception working.
- **Long ≈ v2:** the 6-move reserve binds before the extra moves do.
- The detour-step Jacks were added in this stage, as a second family (adaptation within the night). Both were slightly behind Jack AI v2, within noise.

These findings and the selection rule were recorded in the pre-registration ([part 2](../research/jack-adaptive/PREREGISTRATION.md#after-stage-a-written-before-stage-b-was-run)) before stage B was run.

## 5. Selection (stage B)

Exploratory: 200 games per matchup ([`results/stage-b.md`](../research/jack-adaptive/results/stage-b.md)). Rule: the highest primary metric against Jack AI v2, whatever its value.

| Jack | Mean win rate | vs Jack AI v2 (points) | 95% interval |
|---|---:|---:|---|
| jack-v2 | 76.5% | | |
| safe-skip | 78.0% | +1.5 | −1.8 to +4.8 |
| safe-steer | 77.4% | +0.9 | −1.4 to +3.2 |
| adaptive-up | 76.4% | −0.1 | −0.6 to +0.3 |
| adaptive | 73.1% | −3.4 | −6.8 to +0.1 |
| mixed | 71.3% | −5.3 | −9.4 to −1.1 |
| strategic | 58.1% | −18.4 | −23.5 to −13.3 |

**`safe-skip` was selected.** It skipped 346 of 2,883 detour opportunities (12%), which fixed the matched control: Jack AI v2 skipping each detour step at random with probability 0.12. Both were recorded ([part 2](../research/jack-adaptive/PREREGISTRATION.md#after-stage-b-written-before-stage-c-was-run)) before stage C.

No pressure-adaptive Jack beat Jack AI v2 in either stage. `adaptive-up` is Jack AI v2 in all but a few nights, because pressure is rarely above 0.15.

## 6. Held-out results (stage C)

400 games per matchup, seeds 594001–594400, run once ([`results/stage-c.md`](../research/jack-adaptive/results/stage-c.md)). Jack's win rate (Wilson 95% interval), and the paired difference from Jack AI v2 (only this Jack won / only Jack AI v2 won, McNemar p).

| Detective | strategic | jack-v2 | mixed | safe-skip | matched |
|---|---:|---:|---:|---:|---:|
| original | 97.5% | 91.3% | 92.0% | **97.8%** (95.8–98.8) | 90.0% |
| v2 | 29.3% | 64.3% | 53.3% | **67.0%** (62.2–71.4) | 67.3% |
| v3 | 32.3% | 60.8% | 56.0% | **65.3%** (60.5–69.8) | 62.5% |
| anti8 | 65.5% | 70.3% | 70.5% | **73.0%** (68.4–77.1) | 71.0% |
| uniform+block (held out) | 66.0% | 70.3% | 69.8% | **72.8%** (68.2–76.9) | 71.0% |
| v3-anti6 (held out) | 61.8% | 65.5% | 68.3% | **71.0%** (66.4–75.2) | 67.5% |

`safe-skip` against Jack AI v2:

| Detective | Difference (points, 95%) | Only safe-skip / only jack-v2 | p |
|---|---|---:|---:|
| original | +6.5 (+3.6 to +9.4) | 31 / 5 | < 0.001 |
| v2 | +2.8 (−1.3 to +6.8) | 40 / 29 | 0.228 |
| v3 | +4.5 (+0.5 to +8.5) | 43 / 25 | 0.038 |
| anti8 | +2.8 (−1.3 to +6.8) | 39 / 28 | 0.222 |
| uniform+block | +2.5 (−1.4 to +6.4) | 37 / 27 | 0.260 |
| v3-anti6 | +5.5 (+1.5 to +9.5) | 45 / 23 | 0.010 |

**Primary metric** (the four primary detectives, paired by seed), against Jack AI v2:

| Jack | Points | 95% interval |
|---|---:|---|
| strategic | −15.5 | −19.2 to −11.8 |
| mixed | −3.7 | −6.5 to −0.9 |
| matched | +1.1 | −0.9 to +3.0 |
| **safe-skip** | **+4.1** | **+1.6 to +6.7** |

Over all six detectives the means are: Jack AI v2 70.4%, `safe-skip` 74.5% (+4.1, +1.6 to +6.6), `matched` 71.5%, `mixed` 68.3%, Strategic Jack 58.7%.

**Criteria** ([`results/criteria.md`](../research/jack-adaptive/results/criteria.md), `criteria.js`):

| # | Criterion | Result | |
|---|---|---|---|
| 1 | ≥ +5.0 against Jack AI v2, interval above 0 | +4.1 (+1.6 to +6.7) | **Not met** |
| 2 | Above the matched control, interval above 0 | +3.1 (+0.4 to +5.8) | Met |
| 3 | No regression against any of six detectives | Every difference positive; none worse | Met |
| 4 | Behaviour differs between detectives | χ² 10.9 on 5 df, p 0.053 | **Not met** |
| 5 | Cost | 13.5 ms mean against 13.0, max 125 ms | Met |

By the pre-registered rule: **B**.

**The anti-detour detectives.** Police that forgive Jack AI v2's detours (anti8, v3-anti6) don't exploit them: they beat Jack AI v2 less often than v2 and v3 do (Jack wins 70.3% and 65.5%, against 64.3% and 60.8%). Forgiving detours makes them believe every hideout more evenly, which is what the detours try to cause. Against them, Strategic Jack recovers most of the way (65.5% and 61.8%), so the risk named in [Jack AI v2 §10](jack-ai-v2.md#10-limitations-and-future-work) is real in shape but small for these models: a detective has to read the detours better than "forgive them" to punish them.

## 7. Ablation and evidence of adaptation

**Adaptation against unpredictability (H2).**
- `mixed` deceives about as much as the pressure-adaptive Jacks and loses to Jack AI v2 in every stage (−6.3, −5.3, −3.7). Varying the extent of deception at random only gives up deception.
- `matched` skips as many detour steps as `safe-skip` but at random. It is level with Jack AI v2 (+1.1, −0.9 to +3.0). `safe-skip` beats it by +3.1 (+0.4 to +5.8). **What helps is where the steps are skipped,** not how many.

**Is it adaptation to the opponent?**
- **Within the night, yes, by construction.** `safe-skip` skips only when every step away is within a policeman's next-turn reach (a unit test checks it). It reacts to where the policemen stand, which differs by detective.
- **Between detectives, not measurably.** Its skip rate on nights 1–3:

  | original | v2 | v3 | anti8 | uniform+block | v3-anti6 |
  |---:|---:|---:|---:|---:|---:|
  | 14.3% | 11.9% | 11.4% | 11.1% | 11.1% | 10.9% |

  χ² 10.9 on 5 df, p 0.053. The only visible difference is against the original police.
- **Across nights, no.** The pressure signal had the same distribution against every detective (section 4). Its premise, that police reading Jack guard his true hideout more than the alternatives, didn't show in the data. The police that read Jack best (v2, v3) are fooled by the detours, so their guarding is no more aimed at the true hideout than the original police's.

## 8. Failure analysis

Stage C, all six detectives (2,400 games per Jack):

| Jack | Arrested | Out of moves | Trapped | Lost on night 1 / 2 / 3 / 4 | Hideout walled off (nights 1–3) |
|---|---:|---:|---:|---|---:|
| jack-v2 | 445 | 261 | 5 | 84 / 134 / 182 / 311 | 5.9% |
| safe-skip | 322 | 285 | 6 | 12 / 82 / 200 / 319 | 6.3% |
| matched | 428 | 250 | 5 | 78 / 115 / 157 / 333 | 5.8% |

- **The gain is arrests avoided on nights 1 and 2.** Where only one of `safe-skip` and Jack AI v2 won, the loser's losses by night were:

  | Night | 1 | 2 | 3 | 4 |
  |---|---:|---:|---:|---:|
  | Jack AI v2 lost, `safe-skip` won | 57 | 62 | 43 | 73 |
  | `safe-skip` lost, Jack AI v2 won | 6 | 15 | 37 | 79 |

  Net, about +2.1 points come from night 1, +2.0 from night 2, and nothing from nights 3–4.
- **Night 1 is the same against every detective.** Jack AI v2 lost the same 14 seeds on night 1 against all six detectives, all arrests; `safe-skip` lost 2. No detective has a past night to read on night 1, so they play it alike. The night-1 part of the gain is one effect seen six times, not six independent confirmations (section 12).
- **Running out of moves rises slightly** (261 → 285). Skipped detours leave Jack somewhere other than the escape the strategic planner expected, and a few more nights are lost to the clock. Hiding is unchanged: Detective AI v2's belief in the true hideout at the start of nights 2–4 is 3.3–4.2% for both Jacks, within 0.1 point of each other against every detective.
- **Against the original police**, Jack AI v2's detours cost 6.3 points against Strategic Jack, all early arrests. `safe-skip` removes that cost (97.8% against Strategic Jack's 97.5%).

## 9. Cost

| | Games | Wall clock (4 cores) |
|---|---:|---:|
| Stage A | 3,600 | 13 min |
| Stage B | 5,600 | 18 min |
| Stage C | 12,000 | 37 min |
| Jack AI v2 validation | 9,000 | 27 min |

**Decisions:**
- `safe-skip` averages 13.5 ms a decision against Jack AI v2's 13.0, with a maximum of 125 ms.

## 10. Jack AI v2's independent validation

Run unchanged as pre-registered in [Jack AI v2 §9](jack-ai-v2.md#9-independent-validation): 1,000 games per matchup on seeds 760001–761000 ([`research/jack-v2/results/validation.md`](../research/jack-v2/results/validation.md)).

| Police | Strategic Jack | Detour Jack | Jack AI v2 | Jack AI v2 vs Strategic (only / only, p) | Jack AI v2 vs Detour (only / only, p) |
|---|---:|---:|---:|---|---|
| Detective AI v2 | 30.0% | 64.1% | **65.8%** (62.8–68.7) | 456 / 98, 3.6 × 10⁻⁵⁶ | 47 / 30, 0.068 |
| Original | 97.8% | 89.1% | **93.3%** (91.6–94.7) | 19 / 64, 7.4 × 10⁻⁷ | 46 / 4, 4.5 × 10⁻¹⁰ |
| Uniform+block | 66.2% | 69.9% | **73.8%** (71.0–76.4) | 231 / 155, 1.3 × 10⁻⁴ | 60 / 21, 1.7 × 10⁻⁵ |

- **(a) Against Detective AI v2, Jack AI v2 beats Strategic Jack: confirmed.** 65.8% against 30.0%.
- **(b) Jack AI v2 at least as strong as Detour Jack against v2: not established.** +1.7 points, p 0.068. It is no worse, but the night-4 rule's gain against v2 is not demonstrated.
- **(c) Regressions against police that don't read directness:** all four tests survive Holm's correction.
  - Against the original police, **Jack AI v2 is 4.5 points worse than Strategic Jack**. Its development seeds showed −1.5, not significant. The losses are early arrests while detouring: 24 on night 1, none for Strategic Jack. It is far better than Detour Jack there (+4.2), which is the last-night rule at work.
  - Against uniform blocking it beats both (+7.6 and +3.9).

**What this means for the game:**
- Hard (Jack AI v2) remains much stronger than Normal against the police that read routes. That is the reason it exists, and it is validated.
- Against the original police, which only play in Developer Mode, it is weaker than Normal. No player-facing level uses them.
- `safe-skip` removes that cost in this study's games. That would be the reason to revisit it after a validation of its own (section 11).

## 11. Recommendation

**B: keep `safe-skip` as an experimental research Jack.** Do not promote it, and do not change any difficulty level.

| For | Against |
|---|---|
| +4.1 points on held-out seeds, interval above 0 | Below the +5-point bar set in advance |
| Beats the matched control: the gain comes from where it skips | Not adaptation to the opponent: its behaviour doesn't differ between detectives |
| No regression against six detectives, two held out | Half the gain is night 1, where every detective plays alike |
| Removes Jack AI v2's cost against the original police | A second rule in Hard's Jack, for a gain the player may not see |
| Costs nothing measurable | |

**Negative findings, recorded:**
- Opponent modelling from earlier nights' police positions doesn't work with this signal.
- Random variation in how much Jack deceives costs games.
- Longer detours add nothing.
- Police that forgive detours don't beat Jack AI v2.

**If it is revisited:**
- Run a validation on fresh seeds (proposed: 400 games against v2, v3 and the original police on seeds 595001–595400, with `safe-skip`, Jack AI v2 and `matched`).
- Judge it as a safety rule for detours, not as adaptive deception.

## 12. Limitations

- **Correlated detectives.** On night 1 all six detectives play alike, so the six per-detective comparisons share their night-1 games. The primary metric averages over detectives per seed, and so counts that shared part once, but the per-detective p-values are not independent tests.
- **One signal across nights.** Pressure is one summary of the public record. Another (where police search, or how quickly they close in) might tell detectives apart; none was tried, to keep the candidate set fixed before selection.
- **The anti-detour detectives are simple.** They forgive a fixed number of detour moves. A detective that predicts the detour's direction, or that learns this Jack's habits within a game, was not built.
- **Selection on 200 seeds.** `safe-skip` led stage B by 0.6 points over `safe-steer`, well within noise; the held-out stage confirms `safe-skip`, not that it is the best of the family.
- **Computer opponents only.** Human detectives were not studied, and the human game records ([Game records](game-records.md)) are too few yet.
- **Waiting is off.** How `safe-skip` combines with strategic waiting is untested.

## 13. Reproducing

| Script | What it does |
|---|---|
| `research/jack-adaptive/experiment.js <jack> <police> <games> <first seed> [mix]` | Plays seeded games on every core; stores them, fingerprinted by the files they depend on (resumable) |
| `research/jack-adaptive/jacks.js` | The Jacks by name |
| `research/jack-adaptive/police.js` | The detectives by name |
| `research/jack-adaptive/summary.js` | Comparison tables with paired tests |
| `research/jack-adaptive/criteria.js [set] [candidate]` | Applies the pre-registered criteria |
| `stage-a.sh`, `stage-b.sh`, `stage-c.sh` | Sections 4, 5 and 6 (13, 18 and 37 minutes on 4 cores) |
| `research/jack-v2/validate.sh` | Section 10 (27 minutes) |

Per-game records are kept out of git (`research/jack-adaptive/results/*.json`); the summaries (`stage-a.md`, `stage-b.md`, `stage-c.md`, `criteria.md`) are committed. `test/unit/jack-adaptive.test.js` checks that the harness replays Jack AI v2 and Strategic Jack exactly, that the pressure reads only Jack's view, and `safe-skip`'s rule.
