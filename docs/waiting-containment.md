# Strategic waiting against Detective AI v3's containment

[Strategic waiting](jack-waiting.md) (PR #17) beat Detective AI v3 more often than plain Jack AI v2, and the gain seemed to sit on the last night. That study's explanation: waiting makes the police move Jack's victims off the red circles v3 prepares. This study asks whether that is true, and whether v3 has a weakness worth fixing. It changes no AI.

## Contents

1. [Answers](#1-answers)
2. [What was already known](#2-what-was-already-known)
3. [Is the advantage on the last night?](#3-is-the-advantage-on-the-last-night)
4. [Why v3 loses those games: failure modes](#4-why-v3-loses-those-games-failure-modes)
5. [The containWretched option, re-tested](#5-the-containwretched-option-re-tested)
6. [The waiting-aware threat model](#6-the-waiting-aware-threat-model)
7. [Recommendation](#7-recommendation)
8. [Limitations](#8-limitations)
9. [Reproducing](#9-reproducing)

## 1. Answers

| Question | Answer | Evidence |
|---|---|---|
| 1. Is strategic waiting more effective on night 4? | **No.** The night-4 concentration was a comparison of different games, not an effect of waiting on night 4 | Waiting on night 4 only, with nights 1–3 identical: −2.0 points (95% CI −6.6 to +2.6), 250 paired games |
| 2. What makes v3 lose containment after waiting? | **Nothing, against Jack AI v2: there is no containment to lose.** None of Jack AI v2's last-night murders was one walk from his hideout, waiting or not. v3's containment acts only on one-walk escapes. Where waiting does help Jack v2, the cause is extra moves and the victim moved closer to home (D) | 0 of 425 last nights here; 1 of about 850 in PR #17's games |
| 3. Does `containWretched` fix it? | **It isn't needed, and it changes no results.** It halves the escapes v3's Wretched moves open in positions built to test it, and cuts first-move escapes after a wait. But it moves no win rate | 100 paired games: −2.0 and −1.0 points against waiting short-return Jacks; 200 games: +1.5 against Jack v2 with waiting; none significant |
| 4. Does a changed threat model help? | **No demonstrated failure to fix.** No one-walk murder happened at a circle the model weights 0. Its known inaccuracies (illegal neighbours, one step only, the police's choice ignored) cost nothing measurable | Section 6 |
| 5. Is a new Detective AI version justified? | **No.** Keep v3 unchanged | |

Two corrections to PR #17 follow from this:
- **Its mechanism was wrong.** Waiting does not take Jack's murders off circles that v3's containment guards.
- **Its evidence for a gain is weaker than reported.** On new seeds the overall gain against v3 is 0.0 points (24 against 24 discordant games, 250 paired). Pooled with PR #17's sets (750 games): +3.7 points (95% CI +0.7 to +6.7). The sets differ: heterogeneity χ² = 4.65 on 2 degrees of freedom, p ≈ 0.10.

## 2. What was already known

| Known (not repeated) | Source |
|---|---|
| v3 weights the circles next to an unused red circle at 0.5 as kill sites (`containNeighbours`) | [Detective AI v3 §5](detective-ai-v3.md#5-proposed-mechanisms) |
| v3 coordinates containment (`containCoordinate`) | Same |
| Containing on earlier nights cost 9–16 points against ordinary Jacks | [Detective AI v3 §1](detective-ai-v3.md#1-executive-summary) |
| `containWretched` was tried only against the hideout-134 scheme, and changed nothing there | [Detective AI v3 §6](detective-ai-v3.md#6-candidate-policies) |
| Waiting gained +8 points (focused) and +4 (validation, not significant) against v3 | [Strategic waiting §6](jack-waiting.md#6-results) |
| Patrol reveals change no decision, with or without waiting | [Strategic waiting §7](jack-waiting.md#7-the-value-of-patrol-information-reassessed) |

What PR #17 did not establish:
- whether the gain is caused on the last night, since its waiting Jack also waited on nights 2–3, so the games diverge earlier;
- whether Jack AI v2's last-night murders are ever one walk from home, which is the only case v3's containment acts on;
- whether `containWretched` matters against a Jack who waits.

What can be reused:
- the waiting policy (`js/ai/jack-waiting.js`);
- v3's configurations and its `containWretched` option;
- the short-return Jacks of the v3 study;
- `containment.walkBlockers`, `killSites` and `exposure`.

## 3. Is the advantage on the last night?

**Counterfactual Jacks** (`research/waiting-containment/jacks.js`). Waiting decisions draw no random numbers, so a Jack that waits only on some nights plays exactly the same games as its counterpart until they first differ. This was checked: identical through night 3 in 50 of 50 games for each pair.
- `jack-v2-waiting-last`: waits by the policy on the last night only; nights 1–3 are Jack AI v2's, move for move.
- `jack-v2-waiting-early`: waits by the policy on nights 1–3, then kills at once on the last night; up to then it is `jack-v2-waiting`.

**Results.** Against v3, 250 paired games (seeds 570001–570050 and 580001–580200, all new):

| Comparison | Jack wins | Wins only first / only second | Difference (95% CI) | p |
|---|---|---:|---:|---:|
| Waiting on every night vs never | 68.0% vs 68.0% | 24 / 24 | 0.0 (−5.4 to +5.4) | 1.00 |
| **Last night only vs never** (the last night's effect, same history) | 66.0% vs 68.0% | 15 / 20 | −2.0 (−6.6 to +2.6) | 0.50 |
| Nights 1–3 only vs never | 68.4% vs 68.0% | 19 / 18 | +0.4 (−4.4 to +5.2) | 1.00 |
| Every night vs nights 1–3 only (the last night's effect, waiting history) | 68.0% vs 68.4% | 12 / 13 | −0.4 (−4.3 to +3.5) | 1.00 |

**Why PR #17 saw it on night 4.** In PR #17's games (500 paired), the waiting Jack escaped on 84.9% of last nights against 78.7%. Of the discordant games, 45 were games where only waiting won after the plain Jack lost on night 4, and 22 the reverse.

But that compares the last nights of two different populations of games. The waiting Jack had already waited on night 2 or 3 in 227 of 500 games, so he reached night 4 with a different history. The counterfactual removes that difference, and the last night's own effect disappears.

**Conclusion:** the night-4 concentration is not supported. Any gain from waiting is small, not located on one night, and not consistent across seed sets.

## 4. Why v3 loses those games: failure modes

The last night's mechanics, 250 paired games against v3 (referee's measures, `experiment.js`):

| Jack | Last nights | Waited | Killed off a red circle | One walk from home | Model weight 1 / 0.5 / 0 at the crime scene | Escaped |
|---|---:|---:|---:|---:|---|---:|
| Jack AI v2 | 215 | 0% | 0% | **0%** | 215 / 0 / 0 | 79% |
| ... waiting, every night | 210 | 85% | 81% | **0%** | 39 / 79 / 92 | 81% |
| ... waiting, last night only | 215 | 82% | 79% | **0%** | 45 / 101 / 69 | 77% |

Jack AI v2's hideout is a comfortable walk from the red circles, never next to one. On average his last-night crime scene is 6.2 walks from home without waiting and 5.6 with it. v3's containment only closes walks from a kill site straight onto a hideout. Against this Jack it has nothing to close, on any night, waiting or not.

| Failure mode | Verdict for Jack AI v2 with waiting |
|---|---|
| A. Initial deployment | Not involved: no one-walk escape exists to deploy against |
| B. Wretched movement | Not involved for containment. The police move a waited-for Wretched towards their real patrols, which sometimes happens to bring it nearer Jack's hideout |
| C. Threat model | Not involved: 92 last-night crime scenes had model weight 0, but none was one walk from home, so nothing was missed |
| **D. Other** | **Yes:** escape slack and where the victim ends up. Waiting adds up to 4 moves, and the police's move may shorten or lengthen his way home. These cut both ways and roughly cancel |

**Representative traces** (seeds 580001–580200, the last night with identical nights 1–3):
- **Seed 580008.** Plain: kills at 147, 8 walks from home, with 15 moves; runs out of moves. Waiting on the last night: waits twice; the police move the victim to 145, 6 walks from home; with 17 moves he escapes.
- **Seed 580012.** The same pattern: 147, 7 walks and 15 moves, out of moves; against 145, 5 walks and 17 moves, escaped.
- **Seed 580001, the reverse.** Plain: kills at 149, escapes. Waiting: waits three times, kills at 97 near the police, arrested.

**Against the Jacks containment was built for**, the short-return Jacks, waiting changes the picture: their crime scenes are one walk from home. These Jacks were given the waiting policy for this study:
- Waiting **hurts** them: short-return goes from 70% to 56% wins (1 game against 8, p = 0.04), and short-return-all from 70% to 68%.
- When they wait, the police move the victim, which on balance **closes** escapes. Across the waited nights v3's moves cut the open one-walk threats from 12 to 8 and from 11 to 9, and opened one on only one night each.

## 5. The containWretched option, re-tested

`containWretched` moves each Wretched where a murder would leave the least threat open, by the police's own hideout belief. It changes nothing unless Jack waits: games are identical for every Jack that never waits (Jack AI v2, the short-return Jacks, bgg-51-night4: 50 of 50 each).

| Against | Seeds | v3 + containWretched vs v3 (Jack wins) | Wins only with / only without | Difference (95% CI) | p |
|---|---|---|---:|---:|---:|
| Jack AI v2 with waiting | 580001–580200 | 70.5% vs 69.0% | 11 / 8 | +1.5 (−2.8 to +5.8) | 0.65 |
| Short-return Jack with waiting | 580001–580100 | 57.0% vs 59.0% | 1 / 3 | −2.0 (−5.9 to +1.9) | 0.63 |
| Short-return-all with waiting | 580001–580100 | 60.0% vs 61.0% | 1 / 2 | −1.0 (−4.4 to +2.4) | 1.00 |
| Jack AI v2, short-return Jacks, bgg-51-night4 (none wait) | 570001–570050 | Identical games | 0 / 0 | 0 | |

**What it changes:**
- First-move escapes after a wait fall from 17 to 11 of 88 waited nights for short-return, and from 16 to 13 of 87 for short-return-all.
- In the 50-game screen it cut the open one-walk threats across waited nights by 8 and 7 (11 to 3, 11 to 4), where v3's own rule cut them by 4 and 2.

**Why the results don't move:** where it prevented a first-move escape, Jack escaped later by a longer route in nearly every case (for example seeds 580008, 580017, 580032: v3 moved the Wretched onto an open one-walk circle; with `containWretched` Jack still escaped). Closing the one-move escape delays him; it doesn't catch him.

**Recommendation: reject, keep it as an option.** Leave it off in v3. It has no measurable benefit against any existing opponent, it can't regress against Jacks that never wait, and it is already there if a stronger waiting, containment-exploiting opponent appears.

## 6. The waiting-aware threat model

The checks below are positions set up by hand (`test/unit/waiting-containment.test.js`), and the referee's measures over every game above.

| Question | Finding |
|---|---|
| Is the fixed 0.5 neighbour weight reasonable? | Nothing shows it is wrong. Every one-walk murder after a wait was at a 0.5-weight circle, and none at a weight-0 circle. Against Jack AI v2 the weight doesn't matter: he never kills one walk from home |
| Does it tell legal Wretched moves from illegal ones? | **No.** The neighbours are every circle one walk from the red circle. From 147, with a patrol on 111/134/147, the model counts 111 and 134 (the hideout itself); only 133 and 146 are legal moves. Illegal circles get weight they can't use. That spends the police's attention, but caused no measured loss |
| Does it account for the police choosing the move? | **No.** It weights every neighbour as a possible kill site, though the police choose. In the built positions where one legal move opens an escape and another doesn't, v3's own Wretched rule (towards its real patrols) opens it in 19 of 37, about chance; `containWretched` in 8. In real games this mattered on 1 waited night per Jack |
| More than one wait? | **No:** the model looks one step out. In these games no one-walk murder was two or more steps from its red circle |
| Is containment still useful after the Wretched move? | Yes. The police's moves closed more one-walk threats than they opened (section 4), and `containWretched` closes more still |

**Alternatives.** A legal-move-aware weighting, or a joint choice of Wretched moves and patrols, would correct these inaccuracies. They were not built: no situation was found where the current model fails and the failure costs a game. Section 5 shows that even perfect handling of one-walk escapes after a wait moves no win rate. Building them would be a large change, roughly `containment.killSites` and `police.js`'s patrol and Wretched choices, for no demonstrated gain.

## 7. Recommendation

- **No new Detective AI version.** No correctable weakness of v3 was found that costs games against an existing opponent. v3 stays the Hard police, unchanged.
- **Correct PR #17's report.** The last-night mechanism is withdrawn, and the effect against v3 is described as small and uncertain (done in [Strategic waiting](jack-waiting.md)).
- **For future detective work:** Jack AI v2's last-night losses against v3 come from the chase, with arrests and out-of-moves losses in about equal numbers, not from containment. A detective improvement aimed at Jack AI v2 belongs there: hideout inference and blocking on the last night.
- **For Detective AI v4:** don't build waiting-specific containment. Keep `jack-v2-waiting` as an opponent in its evaluation, as PR #17 recommended.

## 8. Limitations

- **AI opponents only:** the short-return Jacks with waiting are artificial (the policy's table was calibrated for Jack AI v2). A Jack designed to exploit the police's Wretched moves on purpose was not built; the built positions show such a Jack could find openings in about half of them.
- **Samples:** 50–250 paired games per comparison. Differences under about 5 points are not resolved, and none is claimed.
- **The pooled +3.7 points** for waiting comes from seed sets that disagree, and PR #17's first set also chose its validation. It is not a pre-registered result.
- **The 7 stations are unverified** ([Known differences](game-rules.md#known-differences-from-the-physical-board)). Different stations could change which positions the police can hold.

## 9. Reproducing

```
node research/waiting-containment/experiment.js <jack> <police> <games> <first seed>
node research/waiting-containment/summary.js v3 570001-50,580001-200            # section 3 and 4
node research/waiting-containment/summary.js v3 580001-100 short-return-waiting@v3-wretched:short-return-waiting@v3
node --test test/unit/waiting-containment.test.js                              # section 6, positions set up by hand
```

**Jacks:** `jack-v2`, `jack-v2-waiting`, `jack-v2-waiting-last`, `jack-v2-waiting-early`, and `short-return`, `short-return-all`, `bgg-134` or `bgg-51-night4`, with `-waiting` for the short-return Jacks.

**Police:** `original`, `v2`, `v3`, `v3-wretched`.

**Seeds:** 570001–570050 (exploration) and 580001–580200 (focused). None was used before.

**Cost:** every run together is about 12 minutes on 4 cores. Results are cached in `research/waiting-containment/results/`, and the summaries are in `results/summary.md`. No validation run was needed: no candidate was adopted.
