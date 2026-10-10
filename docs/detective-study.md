# Detective AI coordination, hideout inference and interception: a study

Detective AI v3 (the Hard police) loses most games against Jack AI v2 and the short-return Jacks. Earlier studies proposed three explanations: the policemen don't coordinate, the police guess the wrong hideout, and the police fail to cut Jack off on the last night. This study tests which of these weaknesses is real, and whether any of them justifies a Detective AI v4. It changes no AI: every alternative is a research configuration, used on the last night only.

Scripts and results: [`research/detective-study/`](../research/detective-study/).

## Contents

1. [Answers](#1-answers)
2. [What was already known](#2-what-was-already-known)
3. [Method](#3-method)
4. [Coordination](#4-coordination)
5. [Hideout inference](#5-hideout-inference)
6. [Time-dependent interception](#6-time-dependent-interception)
7. [Robustness](#7-robustness)
8. [Causes](#8-causes)
9. [Recommendation](#9-recommendation)
10. [Findings and proposals](#10-findings-and-proposals)
11. [Limitations](#11-limitations)
12. [Reproducing](#12-reproducing)

## 1. Answers

| Question | Answer | Evidence |
|---|---|---|
| Do v3's policemen waste moves through poor coordination? | **No.** Their coverage overlaps somewhat, but making them coordinate spreads them away from the likeliest hideout, and they lose more | Coordinated blocking: 12 games won that v3 lost, 27 lost that v3 won (p = 0.02); from identical positions it cuts overlap (23% → 8% against Strategic Jack) and the policemen near the true hideout (2.87 → 2.35) |
| Do the police guess the wrong hideout? | **Yes, and it is the largest gap.** Told the true hideout on the last night only, v3 wins almost every game | 119 games won that v3 lost, 5 the reverse (p < 10⁻²⁸); at the start of night 4, the true hideout gets 4% of the belief against Jack AI v2 (median rank 13 of 51) |
| Can a better hideout weighting close that gap? | **No.** No weighting the police could use comes close. The best fixed weighting per Jack, chosen knowing the Jack, improves log loss by 2% | Mean log loss 3.686 (v3's hybrid), 3.655 (gentler decline), 3.842 (a style-learning model), 3.617 (the best per Jack, an oracle) |
| Do the police fail to cut Jack off when they could? | **Rarely through their own decisions.** Of 102 lost last nights, 41 had a cut the police could have made but their belief was too weak, and 3 a cut they knew enough to make (all against Strategic Jack, at the 20% threshold). 58 could not be decided within the search limit; none was provably unavoidable | Section 6 |
| Is any legal change better than v3? | **None is demonstrated.** Doubled blocking weight is the only one that didn't lose: +6 games on 400 new paired games, not significant | 12 against 6 discordant games (p = 0.24) |
| Is Detective AI v4 justified? | **No.** Keep v3 unchanged. The one demonstrated weakness, hideout inference, has no solution in sight within the public information tested | Section 9 |

## 2. What was already known

The study began with an inventory. *Confirmed* means measured in a game outcome; *speculative* means proposed but not measured.

| Mechanism | Previous evidence | Known limitation | Unanswered question | Status before this study |
|---|---|---|---|---|
| Sequential greedy placement (`movePolice` in `js/ai/police.js`): each policeman in turn picks his best crossing | [Detective AI v2 §3](detective-ai-v2.md#3-changes) | The search area's coverage is de-duplicated, but the blocking score is not: two policemen can both guard the same hideout | Does that redundancy cost games? | Limitation confirmed in the code; its cost speculative |
| Coordinated blocking (`coordinate`) | Worse against every Jack: Strategic Jack 31.6% → 71.4% ([Detective AI v2 §5](detective-ai-v2.md#5-results)) | Tested on every night, against the Jacks of the time | Is it worse on the last night alone, against today's Jacks? And why? | Confirmed worse, cause speculative ("it scattered them") |
| The cordon (`cordon`) and the hideout re-weighted each turn (`liveHideouts`) | Mixed or no effect ([Detective AI v2 §3](detective-ai-v2.md#blocking-and-its-variants-jsaipolicejs)) | Not tested against Jack AI v2 | Do they help on the last night? | Unresolved |
| Hideout weighting: hybrid, w 0.9, ρ 0.5 | Chosen in [Detective AI v2 §3](detective-ai-v2.md#hideout-weighting-deductionhideoutspastlogs-choices--weighting-w-rho-) | v2 noted that it leans on direct routes, and helps less against Detour Jack | How well calibrated is it against today's Jacks? Could the police learn a Jack's style? | Speculative |
| v3's containment, before the last night | [Detective AI v3](detective-ai-v3.md); [Waiting against containment](waiting-containment.md): never engaged against Jack AI v2 | Only one-walk escapes | Not this study's subject (out of scope) | Confirmed limited |
| The last-night chase: arrest at belief ≥ 0.2, blocking with weight 1 | [Waiting against containment §7](waiting-containment.md#7-recommendation) pointed here: Jack AI v2's last-night losses come from the chase | No time-dependent reachability, no assignment of policemen to approaches | Could the police have cut Jack off, and why didn't they? | Speculative |
| "Positioning, not information" | [Detective AI v3 §4](detective-ai-v3.md#4-failure-analysis), at the start of night 4, against short-return Jacks | Measured for one-walk escapes only | Does it hold for the whole last night, against Jack AI v2? | Confirmed for its case only |

## 3. Method

**Last-night counterfactuals.** Every game is played by v3 until the last night begins. Only then does the police switch to a variant. The two games are identical until that point, so each difference in outcome comes from the last night alone. Comparisons are paired: a game counts only where one police won and the other didn't (the *discordant* games), tested with a two-sided sign test.

**Variants** (`configs.js`, each v3 plus options):

| Variant | Change | Information |
|---|---|---|
| `coordinate` | Coordinated blocking | Legal |
| `cordon` | v2's cordon | Legal |
| `live` | Hideout weights recomputed every turn | Legal |
| `block0`, `block2` | Blocking weight 0 or 2 (v3: 1) | Legal |
| `uniform`, `conservative`, `gentle` | Hideout weighting: uniform; hybrid w 0.45; hybrid ρ 0.75 | Legal |
| `oracle-hideout` | The police are told Jack's true hideout | **ORACLE, not a policy** |
| `oracle-position` | The police are told Jack's true circle each turn | **ORACLE, not a policy** |
| `oracle-both` | Both | **ORACLE, not a policy** |

The oracles use information no player could have. They measure how much is lost to inference, not something that could be built.

**Opponents** (`jacks.js`): the baseline Jack, Strategic Jack, Jack AI v2, Detour Jack, Jack AI v2 with strategic waiting, and the two short-return Jacks. Jack AI v2 playing every night as if it were the last (`jack-v2-all-nights`) was held out: it was not used in any choice, and was played only at the end (section 7).

**Records.** For each move of the last night, `experiment.js` stores what the referee knows (Jack's circle, moves and tokens left) and what the police believed (the weight on Jack's true circle and true hideout, and the hideout's rank). The referee's knowledge is for the analysis only.

**Stages and cost** (4 cores):

| Stage | Games | Seeds | Time |
|---|---:|---|---|
| Exploration: 7 Jacks × 11 police × 30 | 2,310 | 590001–590030 (new) | about 8 min |
| Re-runs to add the move records to 3 variants | 360 | 590001–590030 | 2 min |
| Focused: 4 Jacks × {v3, `block2`, `gentle`} × 100 | 1,200 | 591001–591100 (new) | about 10 min |
| Held-out Jack × {v3, `oracle-hideout`, `block2`} × 30 | 90 | 590001–590030 | 1 min |
| Calibration, coordination and interception analyses | none (offline, from the records) | | about 25 min |

About 4,000 games in all. `research:full` was not run.

## 4. Coordination

**Outcomes** (police wins out of 30, seeds 590001–590030; in brackets, games only the variant won / only v3 won; [`results/variants-590001-30.md`](../research/detective-study/results/variants-590001-30.md)):

| Variant | baseline | strategic | jack-v2 | detour | jack-v2-waiting | short-return | short-return-all | Discordant | p |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **v3** | 26 | 18 | 7 | 9 | 11 | 6 | 11 | | |
| coordinate | 25 | 11 | 9 | 7 | 8 | 4 | 9 | 12 / 27 | 0.02 |
| cordon | 25 | 18 | 6 | 7 | 9 | 8 | 11 | 6 / 10 | 0.45 |
| live | 26 | 16 | 6 | 8 | 8 | 7 | 11 | 5 / 11 | 0.21 |
| block0 | 22 | 8 | 5 | 6 | 5 | 7 | 9 | 10 / 36 | 0.0002 |
| block2 | 26 | 19 | 7 | 9 | 12 | 8 | 12 | 8 / 3 | 0.23 |

Blocking matters: without it (`block0`) the police lose 26 more games. But coordinating it loses too.

**Why coordination loses** (the police's first move of the last night, from identical positions; [`results/coordination-590001-30.md`](../research/detective-study/results/coordination-590001-30.md)):

| Jack | Police | Approaches to the true hideout within reach | Policemen within one walk of it | Overlap of coverage | Nights won |
|---|---|---:|---:|---:|---:|
| strategic | v3 | 95% | 2.87 | 23% | 11 of 23 |
| strategic | coordinate | 100% | 2.35 | 8% | 4 |
| jack-v2 | v3 | 52% | 1.29 | 12% | 5 of 28 |
| jack-v2 | coordinate | 60% | 1.04 | 3% | 7 |
| jack-v2-waiting | v3 | 47% | 1.19 | 12% | 7 of 26 |
| jack-v2-waiting | coordinate | 58% | 1.08 | 3% | 4 |
| short-return | v3 | 93% | 2.73 | 12% | 2 of 15 |
| short-return | coordinate | 93% | 2.47 | 2% | 0 |

*Approaches*: the crossings beside the hideout, through which every walk home ends. *Overlap*: the share of covered circles that two or more policemen cover.

Coordination does what it was designed to do: it removes most of the overlap and reaches slightly more approaches. But it pulls policemen away from the true hideout, towards the less likely ones, and the police lose the concentration that wins games. v3's overlap is not waste: several policemen near the likeliest hideout is what makes the arrest. The cordon and `block2` move almost exactly like v3 (within 0.1 policemen and 2 points on every measure).

**Verdict:** no coordination weakness is demonstrated. Detective AI v2's explanation ("it scattered them") is confirmed and measured.

## 5. Hideout inference

**The gap.** Told the true hideout on the last night, with everything else unchanged, v3 wins 119 games it lost and loses 5 it won (p < 10⁻²⁸). Against Jack AI v2 it wins 28 of 30 instead of 7. Told Jack's true circle instead, it gains 54 / 0; told both, 99 / 0. The police's blocking and arrests are good enough. What they lack is the hideout.

**Calibration** (at the start of nights 2, 3 and 4, from the public record of the v3 games; 561 nights; [`results/calibration-590001-30.md`](../research/detective-study/results/calibration-590001-30.md)). Every model weights the same exact candidate set from the deduction, so a low weight on the truth is a weighting failure, never a deduction error:

| Model | P(true), mean | Log loss | Brier |
|---|---:|---:|---:|
| hybrid (v3) | 5.1% | 3.686 | 0.946 |
| gentle (ρ 0.75) | 4.9% | **3.655** | 0.946 |
| conservative (w 0.45) | 4.2% | 3.852 | 0.956 |
| uniform | 4.0% | 3.917 | 0.960 |
| walk (the original police) | 3.1% | 7.008 | 1.055 |
| adaptive (learns the Jack's route style, below) | 4.9% | 3.842 | 0.946 |
| *Best fixed model per Jack (ORACLE: knows the Jack)* | *5.2%* | *3.617* | *0.943* |

At the start of night 4:

| Jack | Candidates (median) | P(true), hybrid | Rank of the truth (median) |
|---|---:|---:|---:|
| Strategic | 13 | 23.8% | 2 |
| Jack AI v2 | 51 | 4.0% | 13 |
| short-return | 53 | 7.1% | 8 |
| baseline | 60 | 3.3% | 12 |

Against Strategic Jack the belief is useful; against Jack AI v2 the truth is one of about 50 almost equal candidates. Jack AI v2 and Detour Jack play identical nights 1–3 here, so they give the same numbers.

**Is learning a Jack's style feasible?** The adaptive model is a posterior over three route styles (direct, loose and uniform), each a proper likelihood of the move count, learnt from the game's earlier nights. It uses only the public record. It does not help: overall it is worse than v3's hybrid (3.842 against 3.686). It becomes over-confident against direct Jacks (log loss 3.49 against 1.85 for Strategic Jack on night 4). Even the oracle choice of a fixed model per Jack improves log loss by only 2%. That is consistent with the outcomes: the `uniform` (9 / 20) and `conservative` (9 / 21) weightings lose games, and the `gentle` one, best calibrated, loses 12 / 21 on the focused seeds (section 7).

**Verdict:** a demonstrated, large weakness, with no remedy in the information these models use. The move count over three nights does not say much more about the hideout than the hybrid already extracts. A fix would need different evidence (for example, Jack's route choices relative to the police, or deliberate detours), which is a research question, not an implementation.

## 6. Time-dependent interception

For each police move on a last night that Jack won, `interception.js` asks, with the referee's knowledge: could the policemen, each moving at most two crossings and never two on one crossing, have stood so that **no walk** from Jack's circle reaches his hideout within his remaining moves (a *cut*)? The search is exact but capped at 20,000 placements a move. The night is classified at its first move with a possible cut ([`results/interception-590001-30.md`](../research/detective-study/results/interception-590001-30.md)):

- **Inference:** a cut was possible, but the police's belief was too weak to find it (the true hideout ranked below 3rd, or Jack's true circle under 20%).
- **Decision:** a cut was possible and the police knew enough (hideout in the top 3, circle at least 20%), yet didn't make it.
- **Unavoidable:** no cut was possible on any move.
- **Unknown:** the search hit its cap before an answer.

| Jack | Last nights | Won | Lost | Inference | Decision | Unavoidable | Unknown |
|---|---:|---:|---:|---:|---:|---:|---:|
| baseline | 8 | 4 | 4 | 3 | 0 | 0 | 1 |
| strategic | 23 | 11 | 12 | 4 | 3 | 0 | 5 |
| jack-v2 | 28 | 5 | 23 | 6 | 0 | 0 | 17 |
| detour | 28 | 7 | 21 | 6 | 0 | 0 | 15 |
| jack-v2-waiting | 26 | 7 | 19 | 6 | 0 | 0 | 13 |
| short-return | 15 | 2 | 13 | 7 | 0 | 0 | 6 |
| short-return-all | 16 | 6 | 10 | 9 | 0 | 0 | 1 |
| **All** | **144** | **42** | **102** | **41** | **3** | **0** | **58** |

- **Decision failures are rare:** 3 of 102, all against Strategic Jack, and each at the edge of the thresholds (the truth ranked 2nd–3rd, Jack's circle at 20–25%).
- **Inference failures are common:** in 41 lost nights a cut existed, but the police didn't know where to put it.
- **A walk cut is not a win:** in all 102 lost nights Jack still held a coach or an alley. v3's own moves made a walk cut on 35 of its 42 won nights and on 7 lost ones, where Jack escaped through a special move. The classification overstates what a cut would have won.
- **The many unknowns** are early moves with many moves left, where the search space is largest. They hide no decision failure that the known cases suggest.

**Verdict:** the interception gap is an inference gap, as section 5 found. No decision weakness that costs games is demonstrated.

## 7. Robustness

**Focused comparison** on new seeds 591001–591100 (police wins out of 100; [`results/variants-591001-100.md`](../research/detective-study/results/variants-591001-100.md)):

| Jack | v3 | block2 | gentle |
|---|---:|---:|---:|
| Jack AI v2 | 26 | 29 (6 / 3) | 27 (5 / 4) |
| Strategic | 61 | 62 (2 / 1) | 54 (5 / 12) |
| Jack AI v2, waiting | 25 | 27 (3 / 1) | 22 (1 / 4) |
| short-return | 38 | 38 (1 / 1) | 38 (1 / 1) |
| **All** | **150** | **156 (12 / 6), p = 0.24** | **141 (12 / 21), p = 0.16** |

`block2`, the only legal change that didn't lose in the exploration, gains 1.5 points, not significant. Pooling it with the exploration (where it was chosen) would be biased; even so, 21 / 10 gives p = 0.07.

**Held-out Jack** (`jack-v2-all-nights`, never used before this check; 30 games):

| Police | Police wins | Discordant |
|---|---:|---:|
| v3 | 9 | |
| block2 | 9 | 1 / 1 |
| oracle-hideout (ORACLE) | 29 | 21 / 1 |

The held-out Jack shows the same pattern: the hideout is the gap, and blocking weight changes nothing.

**Across opponents:** no legal variant gains more than 2 games in 30 against any Jack (the most: `coordinate` against Jack AI v2, `cordon` and `block2` against short-return). Their losses are largest against Strategic Jack (`block0` −10, `coordinate` −7).

## 8. Causes

All from identical states (section 3):

| Observed outcome | Cause | Evidence |
|---|---|---|
| v3 loses most last nights against Jack AI v2 | The police don't know which of about 50 hideouts is his | `oracle-hideout`: 28 of 30 instead of 7; truth at 4%, rank 13 |
| Coordinated blocking loses | It spreads policemen away from the likeliest hideout | 0.5 fewer policemen near the true hideout from the same position, same reach to its approaches |
| Removing blocking loses | Blocking is the police's main source of wins | `block0`: 10 / 36 |
| Lost nights where a cut existed | Mostly the hideout belief, rarely the decision | 41 inference, 3 decision |
| Learning the Jack's style doesn't help | The move counts carry little information beyond what the hybrid uses, and the learner over-fits direct Jacks | Log loss 3.842 against 3.686 |

## 9. Recommendation

Ranked by demonstrated outcome impact:

| Rank | Area | Weakness demonstrated? | Outcome impact | Evidence strength | Decision |
|---:|---|---|---|---|---|
| 1 | Hideout inference on the last night | **Yes** | Large: about 70 points against Jack AI v2 with perfect information (28 of 30 instead of 7) | Strong (119 / 5; held-out 21 / 1) | **Defer**: no legal model recovers it. A research study of new evidence first |
| 2 | Jack's position on the last night | Yes, as an information gap | Medium (54 / 0 with perfect information) | Strong, but the deduction is exact ([Detective inference](detective-inference-study.md)) | **Reject** as an implementation: nothing legal to add |
| 3 | Blocking weight | No | +1.5 points, not significant | Weak (12 / 6, p = 0.24) | **Reject** for now; not worth a version |
| 4 | Hideout weighting (gentle, conservative, uniform, adaptive) | No: each is worse or no better | Negative | Moderate (12 / 21, 9 / 21, 9 / 20) | **Reject** |
| 5 | Coordination of blocking | No: the redundancy is useful | Negative | Moderate (12 / 27, p = 0.02), with a measured cause | **Reject** |
| 6 | Cordon, live hideouts | No | None measurable | Weak | **Reject** |
| 7 | Interception decisions | No: 3 of 102 lost nights, all borderline | Small at most | Moderate | **Reject**; no coordinated-containment engine |

**The smallest justified extension is none.** No Detective AI v4 implementation PR is justified by this evidence. v3 stays the Hard police, unchanged.

If detective work continues, the one open question worth a study is: **is there public evidence about Jack's hideout that the hybrid weighting misses?** Candidates are where Jack's routes go relative to the policemen, and the coach and alley uses. It should first be measured offline, by calibration, as in section 5, before any game is played; it should be judged against `oracle-hideout`'s ceiling.

## 10. Findings and proposals

**Findings** (measured here):
- Coordinated blocking loses on the last night, because it costs concentration near the likeliest hideout.
- Hideout inference is the main gap; the hybrid weighting is already about as well calibrated as any fixed or style-learning weighting tested.
- Decision failures in last-night interception are rare.
- No legal last-night change tested beats v3.

**Proposals** (not tested, not implemented):
- The study of new hideout evidence in section 9.
- Re-running the interception search with a larger cap, if the unknown cases matter to a later study.

## 11. Limitations

- **Last night only.** Every variant changes nights 4 only. An earlier-night change (for example, positioning on night 3) is not tested, except through v3's existing containment, which is out of scope here.
- **Samples.** 30 paired games per Jack in the exploration, 100 in the focused stage. Effects under about 5 points are not resolved, and none is claimed.
- **Interception.** The cut considers walks only, and checks one move at a time, not a plan over several moves. Many searches hit their cap. It shows where a cut existed, not that the police would have won with it.
- **Style models.** Only three route styles, scored on move counts. A richer model could do better; the oracle choice of a fixed weighting per Jack gives some idea of the room left (2%).
- **AI opponents only.** No human Jack was tested. A human might be easier to read, or harder.
- **The 7 stations are unverified** ([Known differences](game-rules.md#known-differences-from-the-physical-board)).

## 12. Reproducing

```
bash research/detective-study/explore.sh                                        # exploration, about 8 min on 4 cores
bash research/detective-study/focus.sh                                          # focused stage, about 10 min
node research/detective-study/experiment.js <jack> <variant> <games> <first seed>
node research/detective-study/summary.js 590001-30 <jacks, comma-separated>     # sections 4 and 7
node research/detective-study/summary.js 591001-100 jack-v2,strategic,jack-v2-waiting,short-return
node research/detective-study/coordination.js 590001-30 coordinate,cordon,block2 # section 4
node research/detective-study/calibration.js 590001-30                          # section 5
node research/detective-study/interception.js 590001-30                         # section 6, about 20 min
node --test test/unit/detective-study.test.js
```

**Jacks:** `baseline`, `strategic`, `jack-v2`, `detour`, `jack-v2-waiting`, `short-return`, `short-return-all`; held out: `jack-v2-all-nights`.

**Variants:** `v3`, `coordinate`, `cordon`, `live`, `block0`, `block2`, `uniform`, `conservative`, `gentle`, and the oracles `oracle-hideout`, `oracle-position`, `oracle-both`.

**Seeds:** 590001–590030 (exploration and held-out) and 591001–591100 (focused). None was used before.

Game records are cached in `research/detective-study/results/` (not committed); the summaries there are.
