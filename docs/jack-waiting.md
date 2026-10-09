# Strategic waiting and murder timing

Should Jack sometimes wait before he kills? The [deception audit](deception-audit.md) found that Strategic Jack and Jack AI v2 never wait (0 of 700 nights). This study asks why, measures what waiting is worth, builds a policy that waits only when its estimates say waiting is better, and reassesses what the revealed patrol tokens tell Jack. It changes no difficulty level: the policy is an option, `js/ai/jack-waiting.js`.

## Contents

1. [Summary](#1-summary)
2. [What waiting does](#2-what-waiting-does)
3. [Why the existing Jacks never wait](#3-why-the-existing-jacks-never-wait)
4. [What waiting is worth: forced waits](#4-what-waiting-is-worth-forced-waits)
5. [The waiting policy](#5-the-waiting-policy)
6. [Results](#6-results)
7. [The value of patrol information, reassessed](#7-the-value-of-patrol-information-reassessed)
8. [Limitations](#8-limitations)
9. [Implications for Detective AI v4](#9-implications-for-detective-ai-v4)
10. [Reproducing](#10-reproducing)

## 1. Summary

- **Why the Jacks never wait:** a fixed rule. Strategic Jack (and Jack AI v2, which inherits it) waits only while his best victim would leave fewer than 6 moves to spare. That is where the escape table, measured against the original police, levels off. His hideouts are chosen close to the red circles, so his victims are about 5.7 walks from home and he always has about 9 to spare. Waiting was never valued against its costs: the police moving the victims, and what a reveal shows.
- **Never waiting is not simply a defect:**
  - Against the original police it is right. Waiting a fixed number of times every night costs Jack v2 7–26 wins in 50, and Strategic Jack 7–23.
  - Against the blocking police (v2 and v3), waiting gives Strategic Jack time he lacks: forced waits raise his wins against v3 from 12 to 19–30 of 50, with out-of-moves losses falling from 18 to 6–16.
  - Jack AI v2, whose detours already buy time, gains nothing from fixed waits on average.
- **The policy:** wait only when the measured chance of escaping the night after waiting is higher than the chance of escaping now. The police are assumed to move the victims where it hurts Jack most. Calibrated on 1,500 games, it waits on about 35% of nights, never on night 1, and mostly on the last night.
- **Results for Jack AI v2 with waiting against Detective AI v3:**

  | Test | Seeds | Without | With | Wins only with / only without | p |
  |---|---|---:|---:|---:|---:|
  | Focused comparison | 550001–550200 | 66.0% | **74.0%** | 25 / 9 | 0.009 |
  | **Pre-registered validation** | 560001–560300 | 67.0% | 71.0% | 32 / 20 | **0.126** (not significant) |

  Pooled, the 500 games give 57 against 29 (p = 0.003), but the pooled test was not pre-registered.
  - There is no regression: against the original police −1.0 points (95% interval −3.4 to +1.4), against v2 +3.0 (−2.3 to +8.3).
  - Strategic Jack with waiting: +1.7 points against v3 on the validation seeds (not significant).
- **The mechanism (corrected):** as first written, the gain was on the last night, because waiting moved the murder off the red circles v3 prepares. [Waiting against containment](waiting-containment.md) found that wrong:
  - None of Jack AI v2's last-night murders is one walk from his hideout, so v3's containment never acts against him.
  - Waiting on the last night alone, with nights 1–3 identical, changes nothing (−2.0 points, 95% CI −6.6 to +2.6, 250 paired games).
  - On those new seeds the overall gain against v3 is 0.0 points. Pooled with the sets here it is +3.7 (+0.7 to +6.7), from sets that disagree.
  - Where waiting helps, the cause is extra moves and where the police happen to move the victim.
- **Patrol information is still worthless.** The reveals that come with waiting changed 0 of 319 decisions. A Jack blind to every reveal plays identical games. With the stations out of one police turn of every red circle, knowing which tokens are fake almost never changes which victim is safest.
- **Recommendation:** keep the policy as an option, not a difficulty level. Its gain against v3 is consistent across two held-out seed sets but was not confirmed by the pre-registered test. Use it as an opponent for Detective AI v4: v3's containment can be side-stepped by waiting.

## 2. What waiting does

Waiting happens in the Hell phases. At Blood on the streets, while the Time of the Crime is before V, Jack may wait instead of killing (`js/core/engine.js`, phases 4–6). Each wait:

- moves the Time of the Crime on, so Jack has one more move tonight: 15 moves when he kills on I, up to 19 on V;
- lets the police move every Wretched one step. A Wretched can't pass a patrol token, end next to one, or end on another Wretched or a crime scene (`rules.wretchedMoves`). The police choose where;
- reveals one patrol token Jack chooses. A fake one leaves the board.

So waiting trades time for control of the victim's position, plus a little information. The police move the Wretched towards their real patrols, so a waited-for victim is usually off its red circle and closer to the policemen.

## 3. Why the existing Jacks never wait

| Jack | Rule | Code |
|---|---|---|
| Baseline | A coin toss each time | `js/ai/jack.js:44` |
| Strategic | Wait while the best victim would leave fewer than 6 moves to spare. That is where the escape table (measured against the original police) levels off | `js/ai/strategic-jack.js:293` |
| Jack AI v2 | The strategic rule, inherited unchanged | `js/ai/jack-v2.js:73` |

The strategic rule only ever considers time, and only up to 6 spare moves. Strategic Jack chooses his hideout for the best average chance of getting home from the red circles (`strategic-jack.js:257`), so his best victim is about 5.7 walks from home. At I he has 15 moves, about 9 to spare, and the rule never fires.

The rule ignores:
- that the police move the victims;
- that a reveal may remove a threatening token;
- that extra moves may matter against police who wall the hideout off.

Against the police it was calibrated on, it is also right: waiting doesn't pay there (section 4).

## 4. What waiting is worth: forced waits

To separate the question from any policy, the base Jacks were made to wait exactly *k* times every night (`<base>-wait<k>` in `research/jack-waiting/jacks.js`). This is a diagnostic, not a strategy. Calibration seeds 540001–540050, 50 paired games per row; Jack wins out of 50:

| Waits a night | Jack v2 vs original | vs v2 | vs v3 | Strategic vs original | vs v2 | vs v3 |
|---:|---:|---:|---:|---:|---:|---:|
| 0 (as he plays) | 44 | 35 | 35 | 48 | 13 | 12 |
| 1 | 37 | 24 | 29 | 41 | 20 | 26 |
| 2 | 27 | 25 | 28 | 32 | 20 | 19 |
| 3 | 28 | 26 | 35 | 26 | 25 | 30 |
| 4 | 18 | 12 | 21 | 25 | 19 | 24 |

- **What waiting buys:** time. Strategic Jack's out-of-moves losses against v3 fall from 18 to 6–16.
- **What it costs:** position. 94–99% of waited-for murders are off a red circle, closer to the police, and arrests rise: against the original police, from 6 to 12–32 for Jack v2.
- **The balance depends on the opponent and on the Jack.** Waiting helps Strategic Jack against blocking police and hurts both Jacks against the original police. Jack AI v2 already spends spare moves on detours and gains nothing on average.
- **Information adds nothing:** with every reveal hidden from Jack (`-blind`), four forced waits give game-for-game identical results.

A fixed habit is clearly not the answer. Whether to wait depends on where the victims are and where the police could move them.

## 5. The waiting policy

`WC.createWaitingJack(board, base, _, options)` (`js/ai/jack-waiting.js`) returns any Jack AI with a new `wantsToWait`. Every other decision is the base AI's.

**The measure.** The chance of escaping the night was measured in the calibration games above: 1,500 games, both Jacks, 0–4 forced waits, every police weighted equally, since Jack doesn't know which he faces (`research/jack-waiting/fit.js`). It depends on three things Jack knows:

- the moves to spare after the murder (moves left minus the walk home from the crime scene), 0 to 15 or more;
- whether the crime scene is within one police turn of a patrol token that could be real (any token not revealed fake);
- whether it is the last night.

| Jack AI v2, nights 1–3 | 9 to spare | 12 | 15+ |
|---|---:|---:|---:|
| Crime scene clear of the patrols | 94.5% | 95.2% | 96.8% |
| Within one police turn of a token | 63.8% | 72.1% | 86.8% |

Cells are smoothed towards their row (5 pseudo-nights) and made non-decreasing in spare moves. One constraint is imposed: a patrol within reach can't make escaping likelier than a clear scene. Where few nights said otherwise, the in-reach chance is capped at the clear one.

**The decision:**
- Killing now is worth the best victim's chance.
- Waiting is worth what Jack can guarantee: the police may move each Wretched to whichever legal circle is worst for him, and then he faces the same choice with one more move, until V, when he must kill. The police move each Wretched separately, so this is a small exact recursion over single Wretched (`guaranteed` in the code). Jack's view now offers `wretchedMoves(mapid)`, the same public legal moves the police are offered.
- The token he will reveal next may be fake: the chance is the fakes still hidden over the tokens still hidden. Where that token alone puts a Wretched in reach, the possible clearing is weighed in.
- He waits only if waiting is worth more. Ties go to killing now.

There are no tuning parameters. Every number is a measured rate or a count from the rules.

**Decision trace.** After each decision, `debug.waiting` holds `{ night, timeOfCrime, killNow, waitAtWorst, revealFakeChance, decision }`.

**What it does.** On night 1 it never waits. Killing at once is worth about 0.95, and with the patrols spread over all 7 stations the police could push every victim into a patrol's reach (waiting is worth 0.72–0.87 at worst). On later nights the patrols stand where the policemen ended, often far from the victims, and it waits on 23–39% of nights. On the last night it waits on 85–88%, because time is worth most there: the measured escape chance rises from 80% to 89% with spare moves.

**Tests** (`test/unit/jack-waiting.test.js`):
- scenarios set up by hand: time pays; no gain, so kill; the police could move the victim into a patrol's reach; a reveal that may clear the only patrol in reach; one wait left at IV, and the last night's row;
- whole games: every decision traced and consistent;
- the legal moves Jack is told match the rules;
- the same seed plays the same game;
- no difficulty level plays the policy.

The smoke tier plays it against v3, each game twice.

## 6. Results

All comparisons are paired by seed: each seed is the same game setup with and without the policy.

**Exploration** (seeds 530001–530050, 50 games, not for claims): Jack v2 with waiting won 35 against 30 (v3), 35 against 35 (v2), 45 against 47 (original). Strategic Jack with waiting won 19 against 13 (v3), 16 against 12 (v2), and 50 against 50 (original). These justified a focused comparison.

**Focused comparison** (seeds 550001–550200, 200 games; nothing was designed on them):

| Jack | Police | Without | With | Wins only with / only without | p |
|---|---|---:|---:|---:|---:|
| Jack v2 | v3 | 66.0% | 74.0% | 25 / 9 | 0.009 |
| Jack v2 | v2 | 71.5% | 72.5% | 17 / 15 | 0.86 |
| Jack v2 | original | 94.0% | 91.0% | 4 / 10 | 0.18 |
| Strategic | v3 | 32.0% | 38.5% | 35 / 22 | 0.11 |
| Strategic | v2 | 33.0% | 37.5% | 34 / 25 | 0.30 |
| Strategic | original | 98.5% | 97.0% | 3 / 6 | 0.51 |

**Independent validation** (seeds 560001–560300, 300 games). The hypotheses were committed in `research/jack-waiting/validate.sh` before it ran.

| Jack | Police | Without | With (95% interval) | Wins only with / only without | Result |
|---|---|---:|---:|---:|---|
| Jack v2 | v3 | 67.0% | 71.0% (65.6–75.8%) | 32 / 20 | **Primary: p = 0.126, not significant** |
| Jack v2 | v2 | 64.7% | 67.7% | 37 / 28 | Secondary: +3.0 points (−2.3 to +8.3), no regression |
| Jack v2 | original | 93.0% | 92.0% | 5 / 8 | Secondary: −1.0 point (−3.4 to +1.4), no regression beyond 5 points |
| Strategic | v3 | 36.3% | 38.0% | 41 / 36 | +1.7 points, p = 0.65 |

**Night by night** (validation seeds, Jack v2 against v3; nights escaped). *Correction: this compares the last nights of different games. The waiting Jack had often waited on nights 2–3 too. A counterfactual with identical nights 1–3 shows no last-night effect ([Waiting against containment §3](waiting-containment.md#3-is-the-advantage-on-the-last-night)).*

| Night | Without | With | Nights he waited |
|---:|---:|---:|---:|
| 1 | 98% | 98% | 0 of 300 |
| 2 | 95% | 95% | 68 of 294 |
| 3 | 91% | 92% | 108 of 279 |
| 4 | 79% | 83% | 226 of 256 |

On the focused seeds the last night went from 79% to 88%, with 128 of 169 last-night murders off a red circle. Against v2, last nights were 82% and 85% on the validation seeds, and 85% and 85% on the focused seeds: little or no gain.

**Reading the results.** The policy improved Jack AI v2 against v3 on both held-out sets here (+8.0 and +4.0 points). A third set of 250 new paired games found 0.0 ([Waiting against containment](waiting-containment.md)). The pre-registered test alone did not reach significance, and the effect is probably nearer the smaller estimate. It never costs more than a few points against the other police. That supports an optional policy and a research opponent. It doesn't support a new difficulty level, or a claim that it is reliably stronger.

## 7. The value of patrol information, reassessed

The audit found fake patrols worthless to Jacks who never wait. With waiting, Jack does reveal tokens: 2.2 per game for Jack v2 with the policy. Yet:

- **Decisions:** the information term changed 0 of 319 wait-or-kill decisions (50 games against v3). The variant without it (`-noinfo`) played 295 of the 300 exploration games (both Jacks, all three police) exactly as the policy did, and changed one game's outcome.
- **Victims and moves:** with every reveal hidden from all decisions (`-blind`), forced waits gave game-for-game identical results. The audit's oracle had already shown that knowing every fake changed no victim choice.
- **Why:** no station is within one police turn of a red circle. On later nights the tokens stand where the policemen ended. After the police move a waited-for victim, it is either in reach of several tokens or of none, so removing one fake rarely changes anything.

**Conclusion:** on this board, patrol information has no measurable strategic value for Jack, with or without waiting. The value of waiting, where there is one, is time and where the victim ends up, not information. The audit's caveat stands: the 7 stations are unverified, and more stations near the red circles would change this.

## 8. Limitations

- **One measure for every police.** The escape table weights the three police equally. Waiting helps against v3 and slightly hurts against the original police. A Jack who could tell which police he faces (they behave differently in public) could do better.
- **In-night only.** The measure is the chance of escaping tonight. Longer routes on early nights also hide the hideout (Jack AI v2's detours), and waiting gives him room for more detours (3.8 against 3.2 detour moves a game). The policy doesn't value that.
- **Worst-case police.** He assumes the police move each victim where it hurts him most. Real police move them towards their real patrols, which is similar. A softer model might wait more.
- **Sample sizes.** The calibration cells below 9 spare moves are thin, and the last-night in-reach cells are confounded with forced waits (hence the cap).
- **AI against AI.** Nothing here says how a person would play the wait.

## 9. Implications for Detective AI v4

- *Corrected by [Waiting against containment](waiting-containment.md):* containment doesn't need to expect waiting against Jack AI v2, who never kills one walk from home.
- **`containWretched`, re-tested against waiting Jacks:** it cuts first-move escapes after a wait but changes no win rate. It stays an option, off.
- **Fake patrols remain a low priority.** Even with waiting, which token is fake doesn't change Jack's decisions on this board (section 7).
- **New opponent:** `jack-v2-waiting` (research name; `WC.createWaitingJack` around Jack AI v2) should be in v4's evaluation as an adaptive opponent v3 has not seen.

## 10. Reproducing

```
sh research/jack-waiting/calibrate.sh      # forced waits, 1,500 games on 540001-540050, then fit.js (about 8 min on 4 cores)
node research/jack-waiting/experiment.js <jack> <police> <games> <first seed>
sh research/jack-waiting/compare.sh        # focused comparison, 200 games each on 550001-550200 (about 12 min)
sh research/jack-waiting/validate.sh       # validation, 300 games each on 560001-560300 (about 13 min)
node research/jack-waiting/summary.js <seeds, e.g. 560001-300>
```

Jacks are `jack-v2`, `strategic`, `<base>-wait<k>[-blind]`, and `<base>-waiting[-noinfo|-blind]`; police are `original`, `v2` or `v3`. Results are cached per Jack, police and seeds. The summaries are in `research/jack-waiting/results/`: `calibration.md`, `exploration.md`, `comparison.md`, `validation.md` and `escape-table.txt`.
