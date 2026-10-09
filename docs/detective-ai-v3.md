# Detective AI v3

Detective AI v3 is [Detective AI v2](detective-ai-v2.md) plus **containment for the decisive last night**. On night 3, each policeman also values standing where he could stop Jack from killing next to his hideout and walking home on his first move. On nights 2–4, a station's patrol token is made real instead of a policeman's position when that clearly closes more of the night's threat.

Fresh seeds 470001–470100 confirm it (100 games per Jack, paired by seed):

| Police wins | v2 | **v3** | Paired (only v3 / only v2) |
|---|---:|---:|---:|
| Short-return Jacks (three kinds, the 134 scheme excluded) | 14.0% | **32.7%** | 61 / 5 (p < 10⁻¹²) |
| The BoardGameGeek hideout-134 scheme | 0% | **100%** | 100 / 0 |
| Ordinary Jacks (Baseline, Strategic, Detour, Jack AI v2) | 56.3% | 56.5% | 46 / 45 (p = 1.0) |

In the game, **Hard police** plays it. Normal police (v2) and Easy police (the original) are unchanged.

The motivation is [Human strategy literature](human-strategy-literature.md): the forum's "Night 4 proximity trap", and two short-return schemes that beat Detective AI v2. Scripts and results are in [`research/detective-v3/`](../research/detective-v3/).

## Contents

1. [Executive summary](#1-executive-summary)
2. [BoardGameGeek motivation](#2-boardgamegeek-motivation)
3. [Game lifecycle audit](#3-game-lifecycle-audit)
4. [Failure analysis](#4-failure-analysis)
5. [Proposed mechanisms](#5-proposed-mechanisms)
6. [Candidate policies](#6-candidate-policies)
7. [Tactical scenarios](#7-tactical-scenarios)
8. [Experimental methodology](#8-experimental-methodology)
9. [Comparative results](#9-comparative-results)
10. [Ablation results](#10-ablation-results)
11. [Counterplay analysis](#11-counterplay-analysis)
12. [Performance benchmarks](#12-performance-benchmarks)
13. [Limitations](#13-limitations)
14. [Conclusion](#14-conclusion)
15. [Reproducing](#15-reproducing)

## 1. Executive summary

**What changed:**
- **A containment model** (`js/ai/containment.js`). A *threat* is a possible kill site one walk from a possible hideout. It is closed by a policeman on a crossing that walk passes, and a crossing is worth more the fewer police turns it is from one that closes a threat. Everything is derived from the map and the police's own beliefs; no circle is named in the code.
- **New police options** (`js/ai/police.js`), all off by default, so the original police and v2 play exactly as before.
- **Detective AI v3** (`WC.policeVariants.v3`): v2, plus containment on night 3 weighted by each threat's probability, plus the real-token choice. That choice is a legal decision the earlier police never used.
- **Hard police** in the setup dialog.

**Why:**
- **The short-return scheme exploits the clock, not the deduction.** A Jack who kills next to his hideout can end a night on his first move, before any policeman moves. Against the hideout-134 scheme, v2 gets 0, 1, 2 and 0 hunting turns on nights 1–4. A v2 told the true hideout loses exactly the same way.
- **The fix has to come before the night.** Only positions held from the end of the previous night (or a station's token made real) can stop it.

**What the research found:**

| Finding | Evidence |
|---|---|
| **The bottleneck is positioning, not information** | With the police's own belief, five policemen free to stand anywhere at the start of night 4 would close 99% of the weighted threat. They would also stop Jack's actual escape in 104 of 107 one-walk night-4 cases. Knowing the true hideout adds nothing (section 4) |
| **Containment must compete with the chase, and only when it matters** | Containing on every night halves the clues found and loses 9–16 points against ordinary Jacks. Containing on night 3 only, weighted by how likely the threat is, keeps v2's strength against ordinary Jacks |
| **Belief-weighted coverage is what generalises** | Defending only the likeliest hideout loses almost all the gain (ablation) |
| **The real-token choice is cheap and narrow** | It alone defeats the 134 scheme (its geometry needs the one station within reach). It changes nothing elsewhere |
| **Coordination is a trade-off, not a free gain** | Without it, v3 does better against one short-return Jack and worse against Strategic Jack, on both seed sets. It was kept, so as not to regress against the existing Jacks |
| **Some mechanisms were rejected:** | |
| — Weighting containment by how likely the night is to end | Too weak |
| — Weighting it by how concentrated the belief is | No better |
| — Containing as a share of the threat | Fires even when no threat is plausible |
| — Moving the Wretched by containment | No effect in the one scenario it was tried in |

**Recommendation:** add v3 as **Hard police** and keep v2 as Normal. Its gains are against short-return play, which none of the game's own Jack levels uses; against them it is as strong as v2 (section 14). A larger independent validation is proposed, not run (section 14).

## 2. BoardGameGeek motivation

[Human strategy literature](human-strategy-literature.md) found the police's largest gap: **they don't prepare the next night.** The forum's own words:
- *"I think an almost obligatory police general strategy should be positioning a bobby on the crossing adjacent to 65 and 66"* (Andrea Bampi).
- *"[Does Jack have a one-move Night 4 Win?] must be addressed no later than Night 3. the proximity trap should disallow this single move"* (rock lobster).
- *"the key lesson for the police is that the yellow crossing near 130 is an important initial position"* (ketigid).
- The sceptics' diagnosis of "broken" games: *"It means no trap-logic was in place"* (rock lobster).

Two schemes beat v2 there:
- **The 134 scheme:** a Wretched kept on 147, next to hideout 134.
- **A night-4 kill next to a central hideout.**

The study warned against treating the forum or small samples as proof, so v3 was developed against *generalised* short-return Jacks as well as the published schemes:
- **`short-return`:** a random hideout one walk from a red circle; that circle is saved for night 4.
- **`short-return-all`:** returns home in one move every night it can.

## 3. Game lifecycle audit

Where the police can legally act, from the engine (`js/core/engine.js`) and rules (`js/core/rules.js`):

| Phase | Who decides | What the police know | Effect on the next night | Used by v2? | Used by v3? |
|---|---|---|---|---|---|
| 1. The targets are identified | Jack: women on red circles that are not yet crime scenes | — | Night 4's women go exactly on the red circles still unused, so the possible kill sites are known on night 3 | — | It is what makes night-3 containment possible |
| 2. Patrolling the streets | **Police**: night 1, 5 real and 2 fake on the 7 stations. Nights 2–4: a token on every crossing a policeman ended on, 2 more on free stations; **any 5 of the 7 may be real** | Women's positions (face down), crime scenes, past nights | Real tokens become the policemen | Always makes the previous positions real | **Yes**: may make a station real |
| 5. Suspense grows (only when Jack waits) | **Police** move each Wretched one step; it may not end next to a patrol token | Wretched | Changes the kill site | Towards the real patrols | Option tried, left out |
| 7. Ready to kill | Jack reveals a patrol | — | Fakes removed | — | — |
| 9. Alarm whistles | — | — | Real patrols become policemen. **Jack moves first** (except on the double event) | — | — |
| Hunting: Jack moves | Jack; a walk can't pass a policeman | — | A walk onto the hideout ends the night at once | — | — |
| Hunting: police move | **Police**: each moves up to 2 crossings | The public record | **These positions become next night's tokens** whenever Jack's next move ends the night | Chase + hideout blocking | **Yes**: on night 3, containment for night 4 |
| Hunting: clues | **Police**: search or arrest | | | | Unchanged |

**Findings:**
- **There is no preparation turn**, and none was added. Every lever was already legal and exposed to the police AI (`turn(game, view, random)` sees phases 2, 5, 10 and 11). **No engine change** was needed.
- **On a single-victim night Jack moves before any policeman.** A murder one walk from the hideout can therefore only be stopped by a real policeman already standing on that walk. That policeman comes either from the previous night's last hunting turn, or from a station token made real.
- **The real-token choice was legal and unused.** It was a policy limitation, not an engine one.
- **No rule was changed.** The optional rules ("Rushing", "Catch me if you can") are not implemented and played no part.

## 4. Failure analysis

**The 134 scheme against v2:**
- **Turns.** v2 gets 0, 1, 2 and 0 hunting turns on nights 1–4, because Jack ends every night within two moves. At two crossings a turn, no policeman can reach the critical 111/134/147 crossing.
- **Distance.** Of the 7 stations, only 130/145 is within two police turns of that crossing; the others are 4–8 turns away. v2 makes that station's token fake on night 1, and on night 2 keeps the previous positions real.
- **Information is not the cause.** v2 told the true hideout plays the identical losing game (test: Scenario A).

**The generalised short-return Jacks against v2:**
- They won 77–83% of games.
- 75–80 of 100 games had a night ended on Jack's first move.
- Night-4 murders one walk from home were closed by a policeman at the start of the night only 4–10 times in 80–90.

**Information or position?** At the start of each night 4, five policemen could be placed on *any* crossings, chosen greedily by the police's own belief (`research/detective-v3/ceiling.js`, seeds 460001–460040):

| Jack | One-walk night 4s | Belief-weighted threat closed | Jack's actual escape closed (police belief) | Closed knowing the hideout |
|---|---:|---:|---:|---:|
| short-return | 34 | 99.6% | 33 | 33 |
| short-return-all | 34 | 99.2% | 32 | 32 |
| night-4 kill next to 51 | 39 | 98.5% | 39 | 39 |

**Positioning, not information, is the bottleneck.** On night 4 the women can only go on the red circles still unused, so the police know the possible kill sites a night in advance. The work is to get there by the end of night 3.

## 5. Proposed mechanisms

`js/ai/containment.js` (pure; no state, no randomness):

- **Kill sites.**
  - The red circles that aren't crime scenes yet (or, at patrol placement, the women on the board) have weight 1.
  - The circles one step from them (a waiting Jack lets the police move his Wretched) have weight `containNeighbours`, 0.5.
- **Threats.** Every (kill site, possible hideout) pair one walk apart. Its weight is the hideout's probability (v2's hybrid belief) × the site weight.
- **Closing a threat.** A policeman on any crossing the walk passes closes it (`walkBlockers`, computed once per pair and cached). One-walk escapes only: a two-move escape gives the police a turn, which v2's blocking already uses.
- **Value of a crossing.** For each threat, 1 on a closing crossing, otherwise 1 / (1 + police turns to the nearest one), up to 4 turns. With coordination, only the part beyond what the policemen already placed this turn achieve counts. Without the distance gradient, a policeman more than one move away felt no pull, and the policy never moved; that was the first version's failure.

In `js/ai/police.js`:
- **Hunting moves.** Each policeman's v2 score (chase + blocking) gets `contain × nightWeight × value`. Containment runs only on nights before the last (`containEarly` weights nights 1–2 against night 3). The weight is scaled by the threat's absolute probability (`containScale: 'absolute'`), so it fades when no likely hideout is next to a kill site. Optional scalings: `'ending'` (by the police's estimate that Jack is one walk from home), `'concentrated'` (by Σ belief²).
- **Patrols** (`containPatrols`). On nights 2–4 the tokens' crossings are fixed by the rules, but the police choose which 5 are real. A station is made real instead of a policeman's position only when it closes at least `containSwap` (0.2) more of tonight's threat. The positions the policemen ended on were chosen for the hunt.
- **Wretched** (`containWretched`). Move each Wretched where a murder would leave the least threat open. Tried and left out (section 6).

## 6. Candidate policies

Every candidate is v2 plus options (`research/detective-v3/configs.js`), so they share v2's code and can be switched one at a time.

| Candidate | Options | Purpose |
|---|---|---|
| A: defend the likeliest hideout | `contain: 1, containHideouts: 'top', containNeighbours: 0` | The minimal intervention |
| B: threat-weighted | `contain: 1` (every hideout by weight, sites and their neighbours) | Handles uncertainty |
| C: coordinated | B + `containCoordinate` | Avoids redundant coverage |
| + patrols / + Wretched | `containPatrols`, `containWretched` | The Hell-phase levers |
| D: when the night may be ending | `containTiming: 'ending'` | Adaptive balance by timing |
| E: when the belief is concentrated | `containTiming: 'concentrated'` | Adaptive balance by certainty |
| N3: night 3 only | `containEarly: 0` (± `containScale: 'absolute'`) | Prepares only the decisive night |
| **v3** (selected) | C + patrols, `contain: 10, containEarly: 0, containScale: 'absolute'` | |

**How the candidates evolved** (each step was driven by a measured failure, not a guess):

| Version | Result | Change it led to |
|---|---|---|
| A–C as first written | Didn't stop even the 134 scheme | A distance gradient (section 5), and the real-token lever |
| The real-token choice as first written | Sometimes picked 3 stations, which the rules refuse, so placement stalled | Fixed to the rule's structure: every previous position gets a token, plus 2 stations. Covered by a test |
| The first real-token rule | Swapped tokens for marginal gains, slightly hurting the hunt | The conservative swap threshold |
| Containment on every night | Lost 9–16 points against ordinary Jacks | Timing variants D, E and N3 |
| Normalised as a share of the threat | Fired at full strength when the threat was improbable, costing against Strategic Jack | The absolute scaling |

**The Wretched lever** was tried against the 134 scheme only. It made no difference there, alone or with C, and it is moot when Jack kills without waiting (as the short-return Jacks do). It was not screened further.

## 7. Tactical scenarios

Deterministic tests in `test/unit/containment.test.js` (printed numbers):

| Scenario | Initial state and information | Detective v2 | Counteraction | Does it solve it? |
|---|---|---|---|---|
| A. Hideout 134, Wretched on 147 | The scheme's game, seed 460001 | Loses: every night ends in ≤ 2 moves. v2 told the hideout loses identically | v3 makes the 130/145 station real on night 2; its policeman reaches 131/146 | **Yes**: arrested on night 3, every seed |
| B. Central hideouts 51/66/67, kill sites 65 and 84 | Belief split equally over the three hideouts | — | The best single crossing is 65/66: it closes more than half of the six threats. A second closes the rest | Yes, with two policemen (static) |
| C. Night-4 trap at 51 | No policeman: 65 → 51 in one walk | — | One policeman on 65/66: 65 → 51 takes 4 walks, 84 → 51 takes 5. A policeman on the far side of 51 closes nothing | It stops the *immediate* escape. A longer escape is not a capture: the police still need their turns to arrest or block |
| D. Uncertain hideout | 0.8/0.2 split between 51 and 134 | — | The defence follows the belief: 65/66 when 51 is likelier, 111/134/147 when 134 is. A station 5 turns from every closing crossing is worth 0. No hideout next to a kill site: no threat, no pull | Yes |
| Coordination | One threat | — | A second policeman gets no credit for a threat the first already closes | Yes |

**Negative cases** (when containment is the wrong choice) are covered by these tests and by the ordinary Jacks in play:
- **The hideout is unlikely:** the absolute scaling fades the threat.
- **No plausible hideout is next to a kill site:** no threats at all.
- **Containment is out of reach:** no value.
- **A useful chase is under way:** containment only adds to v2's score and never forces a move. The cost against ordinary Jacks is measured in section 9.

**Legality:** whole games against every kind of Jack, played twice for determinism, with 5 real and 2 fake tokens on every night.

## 8. Experimental methodology

- **Harness.** `research/detective-v3/experiment.js` plays seeded games on every core and records, as the referee:
  - the result and the night of defeat;
  - per night: moves used, whether the murder was one walk from home and whether a policeman closed that walk when the night began, nights ended on Jack's first move, clues and arrests;
  - police decision times.

  Jack and police use only their own views. The "oracle" police (diagnostic only) is the one exception, and is labelled.
- **Jack portfolio:** Baseline, Strategic, Detour, Jack AI v2, `short-return`, `short-return-all`, the night-4 central-hideout scheme (`bgg-51-night4`) and the 134 scheme.
- **The 134 scheme plays almost the same game every time.** It is reported separately and excluded from the decision.
- **Seeds:**

  | Seeds | Used for |
  |---|---|
  | 450001–450030 | Screening, 30 games |
  | 460001–460100 | Comparison and ablation, 100 games |
  | 470001–470100 | Confirmation, 100 games, untouched until the selection was made |
  | 800401–800420 | Benchmark |

- **Statistics.** Paired McNemar exact tests on the police's wins, pooled by Jack family and paired by (Jack, seed). Wilson 95% intervals.
- **The decision rule, written before the comparison:** raise police wins against the short-return family, and lose no more than 3 points against the ordinary family.
- **Budget.** About 11,600 recorded games in batches of under 10 minutes each, about 60 minutes in all. No research tier was run.

## 9. Comparative results

**Screening** (30 games, seeds 450001–450030; Jack's win rate; [`results/screening-overview.md`](../research/detective-v3/results/screening-overview.md)):

| Police | short-return | short-return-all | bgg-51-night4 | Jack AI v2 | Strategic | Detour | Police wins vs v2: short-return / ordinary (points) |
|---|---:|---:|---:|---:|---:|---:|---:|
| v2 | 80% | 83% | 93% | 57% | 27% | 60% | |
| patrols only | 80% | 80% | 93% | 57% | 30% | 60% | +1 / −1 |
| A + patrols | 77% | 77% | 70% | 67% | 37% | 63% | +11 / −8 |
| B + patrols | 60% | 60% | 63% | 67% | 47% | 63% | +24 / −11 |
| C + patrols | 60% | 67% | 90% | 70% | 40% | 63% | +13 / −10 |
| D (ending) | 77% | 67% | 100% | 67% | 43% | 60% | +4 / −9 |
| E10 (concentrated) | 63% | 67% | 83% | 63% | 33% | 57% | +14 / −3 |
| N3 (night 3, share) | 50% | 63% | 73% | 53% | 53% | 50% | +23 / −4 |
| **N3a10 (night 3, absolute) = v3** | 50% | 60% | 70% | 57% | 47% | 60% | **+26 / −7** |

The full table has 19 configurations. Containment on every night (B, B3, D10) can beat the short-return Jacks hard, but always at a cost of 8–16 points against ordinary Jacks.

**Comparison** (100 games, seeds 460001–460100; Jack's win rate; [`results/comparison.md`](../research/detective-v3/results/comparison.md)):

| Jack | v2 | patrols only | E10 | **v3** | N3, ending ×30 |
|---|---:|---:|---:|---:|---:|
| Baseline | 16% | 14% | 10% | 13% | 14% |
| Strategic | 33% | 34% | 35% | 38% | 31% |
| Detour | 65% | 66% | 62% | 60% | 66% |
| Jack AI v2 | 65% | 65% | 69% | 66% | 67% |
| short-return | 77% | 77% | 80% | **58%** | 72% |
| short-return-all | 76% | 76% | 72% | **58%** | 63% |
| bgg-51-night4 | 90% | 90% | 86% | **81%** | 75% |
| bgg-134 | 100% | **0%** | 0% | **0%** | 0% |
| Police wins vs v2, ordinary | | 0.0 | +0.8 | **+0.5** (52/50, p = 0.92) | +0.3 |
| Police wins vs v2, short-return without 134 | | 0.0 | +1.7 | **+15.3** (53/7, p < 10⁻⁹) | +11.0 |

**The decision rule.** Pooled with the 134 scheme, *every* candidate passes it: the scheme's 100 games dominate the pool. That made the rule as first written too weak, and the decision was taken on the family without it. There, only v3 and the "ending" variant improve, and v3 more.

**What changes, against the short-return Jacks:**

| Jack | Nights ended on Jack's first move, v2 → v3 | Night-4 one-walk murders closed at night start, v2 → v3 |
|---|---:|---:|
| short-return | 75 → 28 | 4 → 40 |
| short-return-all | 76 → 38 | 10 → 39 |
| bgg-51-night4 | 89 → 6 | 3 → 84 |

**Investigation is preserved.** Against ordinary Jacks, clues per game change by less than 0.5 (e.g. Jack AI v2: 6.39 → 5.91, Strategic: 4.14 → 3.93).

**Confirmation** on fresh seeds 470001–470100 ([`results/confirmation.md`](../research/detective-v3/results/confirmation.md)):

| Jack | v2 | **v3** | v3 without coordination |
|---|---:|---:|---:|
| Baseline | 15% | 19% | 18% |
| Strategic | 26% | 27% | 36% |
| Detour | 63% | 66% | 58% |
| Jack AI v2 | 71% | 62% | 60% |
| short-return | 83% | **64%** | 66% |
| short-return-all | 80% | **60%** | 60% |
| bgg-51-night4 | 95% | **78%** | 68% |
| bgg-134 | 100% | **0%** | 0% |

- **Ordinary family:** police wins 56.3% → 56.5% (46 / 45).
- **Short-return family without 134:** 14.0% → 32.7% (61 / 5, p < 10⁻¹²).
- **Per ordinary Jack,** the differences range from −4 to +9 points (Jack AI v2: 71% → 62%, p = 0.11). None is significant.

## 10. Ablation results

Seeds 460001–460100, 100 games ([`results/ablation.md`](../research/detective-v3/results/ablation.md)). Jack's win rate (clues per game in brackets where they moved):

| Police | short-return | bgg-51-night4 | Strategic | Jack AI v2 | Reading |
|---|---:|---:|---:|---:|---|
| v2 | 77% | 90% | 33% | 65% | |
| + patrols only | 77% | 90% | 34% | 65% | The real-token choice alone matters only for the 134 geometry |
| **v3** | **58%** | **81%** | 38% | 66% | |
| v3 without coordination | 53% | 66% | 42% | 67% | Better against short returns, worse against Strategic. The same on fresh seeds (27% vs 36%) |
| v3 without patrols | 57% | 81% | 39% | 66% | The same except the 134 scheme, which it no longer stops |
| v3 without neighbour kill sites | 67% | 71% | 36% | 65% | Mixed: worse against one short-return Jack, better against the other |
| v3 defending only the likeliest hideout | 75% | 88% | 31% | 66% | Loses almost all the gain: **belief-weighted coverage is what generalises** |
| v3 on every night | 61% (2.9 clues) | 85% (2.4) | 42% (2.8) | 69% (3.3) | Halves the clues found and is worse against ordinary Jacks: **night 3 only is right** |

**Each component, answered:**
- **Is pre-night positioning itself responsible?** Yes. Both levers act only on end-of-night positions.
- **Does belief weighting help generalise?** Yes, strongly.
- **Is coordination useful?** It trades short-return performance for ordinary performance, consistently on two seed sets. That echoes v2's study, where coordination hurt. It was kept, to protect the existing Jacks; the case for dropping it is close.
- **Does an elaborate trade-off help?** The simple night-3 restriction beat both adaptive timings (D, E).

## 11. Counterplay analysis

What v3 does *not* stop, and what it might open:

- **Short-return Jacks still win 58–78%.** The containment closes about half of the night-4 one-walk escapes; the policemen don't always get there, and most losses happen earlier. Against v3 these Jacks lose mostly on nights 3–4, against nights 2–3 before.
- **Special movement bypasses a closed walk only partly.** When their walk home is closed, the short-return Jacks fall back to Jack AI v2's play with coaches and alleys. Some still escape. A closed walk forces a longer escape; it is not a capture (Scenario C).
- **Direct, deceptive and switching Jacks don't exploit it measurably:**
  - Strategic: 26–33% → 27–38%;
  - Detour: 63–65% → 60–66%;
  - Jack AI v2: 65–71% → 62–66%;
  - short-return-all, which switches between short returns and Jack AI v2's ordinary nights, is contained.

  No ordinary Jack gains significantly on either seed set. Whether a Jack can exploit the police *concentrating* near the remaining red circles on night 3 is not established.
- **The hideout belief can be wrong.** Containment follows v2's hideout belief, and the deceptive Jacks (Detour, Jack AI v2) mislead it. Weighting by the belief, instead of the likeliest hideout, is what keeps it useful then (ablation).
- **The 134 counter is narrow.** The real-token choice works there because one station is within reach. A scheme with no reachable station must be met by the night-3 positions, which the generalised Jacks show is only partly achieved.
- **Not tested** (no new Jack AI was written, by the brief):
  - a Jack that sees where the patrols stand and then chooses which red circle to keep;
  - a Jack that waits on night 4 so the police must move his Wretched;
  - a Jack that reveals patrols to find the real ones before choosing.

## 12. Performance benchmarks

One thread, seeds 800401–800420 ([`results/benchmark.txt`](../research/detective-v3/results/benchmark.txt)). Times are per police decision, in ms:

| Decision | v2 mean / p99 / max | v3 mean / p99 / max |
|---|---|---|
| Moving the policemen (against Strategic Jack) | 4.2 / 17 / 19 | 14.6 / 51 / 106 |
| Moving the policemen (against a short-return Jack) | 5.4 / 23 / 26 | 25.4 / 72 / 84 |
| Placing patrols | 2.7–8.7 / 21–45 / 45 | 14.5–15.2 / 59–60 / 60 |
| Searching or arresting | unchanged | unchanged |

The containment model caches the map-only work (walk blockers, police-turn distances). The first call after loading takes about 90 ms, about 7 ms after that. Decisions stay far below the page's 700 ms pacing between police moves. Behaviour is deterministic under fixed seeds (tested).

## 13. Limitations

- **Against short-return play, v3 is better but far from solved:** these Jacks still win 58–78%. The ceiling analysis shows the positions exist; the police reach them in only about half of the cases.
- **It depends on v2's inference.** A Jack who misleads the hideout belief also misleads the containment.
- **Containment is one-walk only, and prepares only night 4.** Two-move escapes are left to v2's in-night blocking, and nights 2–3 are not prepared (that cost too much).
- **Coordination is a close call.** The ablation shows it trades short-return performance for ordinary performance.
- **Developed against AI Jacks.** A human Jack who sees the police gather near the unused red circles on night 3 may adapt in ways no tested Jack does. The study's short-return Jacks are generalised but not adversarial to containment.
- **Samples.** 100 games per Jack: differences under about 10 points against a single Jack are not resolved.
- **The decision rule as first written was too weak.** Pooling the deterministic 134 scheme let every candidate pass. The decision was made on the family without it, and the report says so.

## 14. Conclusion

**Should v3 replace v2?** As an *added* level, yes: **Hard police**. As a replacement for Normal, not yet:
- **It does what was asked.** It anticipates and prevents immediate escapes v2 can't:
  - nights ended on Jack's first move fall from 75–89 to 6–38 per 100 games;
  - night-4 one-walk murders closed at night start rise from 3–10 to 39–84;
  - police wins against short-return Jacks more than double;
  - the hideout-134 scheme is fully stopped.
- **It generalises across hideouts and map regions.** It is not a counter to circle 134: the generalised Jacks choose their hideouts at random.
- **It doesn't regress against the existing Jacks** (+0.3 to +0.5 points pooled, on two seed sets), and it stays fast and deterministic.
- **But the game's own Jack levels don't play short-return,** and against them v3 equals v2. Normal is kept as v2, so existing settings and recorded games are unaffected.

**Proposed independent validation (not run; needs approval).**
- **Games:** 500 games per matchup, v2 against v3, on seeds 480001–480500, against all 8 Jacks: 8,000 games.
- **Runtime:** about 27 minutes on 4 cores, from the measured rate of 2,400 games in 488 s.
- **Questions:**
  1. Is the gain against short-return Jacks at least 10 points (paired, pooled without 134)?
  2. Is any single ordinary Jack's police win rate lower by more than 5 points? This needs about 500 games per Jack to resolve.

**What would come next:**
- **Two-move escapes:** containment for them.
- **Earlier nights:** preparation without the cost to the chase.
- **A Jack that adapts to visible containment:** a robustness opponent.

## 15. Reproducing

| Command | What it does | Time |
|---|---|---|
| `node --test test/unit/containment.test.js` | The tactical scenarios (part of `npm test`) | 5 s |
| `bash research/detective-v3/screen.sh` | Screening → `results/screening.md`; `node research/detective-v3/overview.js 450001 30 <police> <jacks>` → `screening-overview.md` | 26 min from nothing |
| `bash research/detective-v3/compare.sh` | Comparison → `results/comparison.md` | 15 min |
| `bash research/detective-v3/ablation.sh` | Ablation → `results/ablation.md` | 9 min |
| `bash research/detective-v3/confirm.sh` | Confirmation → `results/confirmation.md` | 9 min |
| `node research/detective-v3/ceiling.js <jack> <games> <first seed>` | The positioning ceiling (section 4) | 30 s |
| `node research/detective-v3/benchmark.js` | Decision times | 1 min |
| `node research/detective-v3/experiment.js <jack> <police> <games> <first seed>` | One run (Jacks: `research/jack-v2/policies.js`, `research/human-strategy/policies.js`, `research/detective-v3/jacks.js`; police: `research/detective-v3/configs.js`) | |

**Test tiers:**
- Smoke plays Detective AI v3 against four Jacks and the 134 scheme.
- Medium adds `medium-detective-v3` (30 games against short-return and Strategic Jack, 40 s).
- Full adds `full-detective-v3` (comparison, ablation, confirmation).

Per-game records are kept out of git; the scripts rerun only the runs whose file is missing.
