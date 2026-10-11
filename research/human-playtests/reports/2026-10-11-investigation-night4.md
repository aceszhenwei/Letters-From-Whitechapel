# Investigation: the night-4 escape next to home

- **Date:** 2026-10-11 · **Tier:** investigation ([docs/playtests.md](../../../docs/playtests.md#investigations-targeted)) · **Methodology version:** 1
- **Commissioned by:** the [batch-1 triage](2026-10-11-batch-1.md), recommendation 2.
- **Game:** `g6b7af2a30b071ae6` (already analysed by batch 1, so this report records no games). Section 4 also reads every Wretched move in all 7 human games.
- **Question:** On night 4 Jack killed at 142, one walk from his hideout 126, and was home on his first move. Did Detective AI v3 decide reasonably on what it knew, or did it fail to recognise and defend against an immediate escape threat?
- **Reproduce:**
  - `node research/human-playtests/reports/2026-10-11-investigation-night4.js forensics | counterfactual 25 | wretched` (sections 2–4);
  - `node research/human-playtests/reports/2026-10-11-investigation-night4-lure.js run <jack> <police> 200 614001`, then `summary 614001-200` (section 5).
  - Saved outputs are in `results/night4-*.json`; per-game files are regenerated.
- **What these scripts can see:** they replay the record and ask v3 itself, built from the same configuration (`WC.policeVariants.v3`), what it knew. They use only the police's view. The referee's knowledge (the true hideout) is used only to score.

Circle numbers are the printed ones. Crossings have no printed number, so they are given as map IDs.

## 1. Answer

**v3 made one avoidable bad decision, and the escape came from it. Its other decisions were reasonable. The flaw doesn't cost v3 games, so no AI change is justified.**

| Decision | What v3 knew | Verdict |
|---|---|---|
| Night 3, positioning for the last night | The 142 → 126 threat was 1.2% of the threat it weighs (rank 44 of 61). Its blocking crossings were 3 police turns from any policeman | **Reasonable.** This is uncertainty v3 couldn't avoid. Against 8 nearly equal hideouts, it closed what mattered more |
| Night 4, patrol tokens | It made the station 312 real instead of 93. 312 is next to two candidate hideouts, 126 and 101. The crossings that block 142 → 126 (map IDs 314 and 315) are not stations, and no policeman stood on them | **Reasonable.** No legal token placement could have blocked that walk |
| Night 4, **moving the Wretched after Jack waited** | The Wretched stood on 158, two walks from 126. By v3's own hideout belief, two of its 8 legal moves (172, 185) left **no** one-walk threat. v3 moved her to 142, the option with the **highest** total threat (0.777): 142 is one walk from 6 of the 8 candidate hideouts, the true one among them | **Avoidable.** v3 had the information. Its Wretched rule doesn't use it: it moves a Wretched towards the real patrols, and v3 had just placed a real patrol beside the likely hideouts |

**What the evidence says:**
- **In this game, the move decided the night.** Computer Jacks played on from the same position after each alternative move. Had the Wretched gone to 172 or 185, they got home in only 1 to 6 of 25 runs; from 142 they got home in 25 of 25 (section 3).
- **In general, it doesn't cost games.** A Jack built to play this lure on purpose got first-move escapes on 65 of 177 last nights against v3, against 11 with the `containWretched` option. But he won as often either way: 154 against 149 of 200 games, a difference of −2.5 points (95% CI −6.3 to +1.3; p = 0.30). He also won exactly as often without waiting at all (154 of 200).
- **Why:** once the one-walk escape is closed, Jack walks home a longer way and still escapes. This is the same finding as [Waiting against containment §5](../../../docs/waiting-containment.md#5-the-containwretched-option-re-tested), now confirmed against the exploiting Jack that study didn't build.

**Classification** ([finding labels](../../../docs/playtests.md#commissioning-an-analysis)):
- It is not a confirmed defect: the code does what it was designed to do.
- It is **not confirmed as a strategic weakness**: it costs no measurable games.
- **The decision-level flaw is confirmed and reproducible.** It stays a **pattern to watch**, with a specific signature (section 6).

**The production AI is unchanged.** The one candidate fix, `containWretched`, didn't show a meaningful improvement, so the held-out seeds reserved for confirming a change (615001–615400) were not used.

## 2. Forensics: what v3 knew at each decision

**v3's hideout belief on night 4.** It is fixed for the night, coming from nights 1–3. There were 8 candidates, nearly equal:

| 142 | 156 | 127 | 101 | **126** | 102 | 125 | 143 |
|---|---|---|---|---|---|---|---|
| 0.144 | 0.144 | 0.144 | 0.128 | **0.128** (5th) | 0.128 | 0.105 | 0.079 |

**Decision 1: night 3's hunting turns.** On night 3, v3 weighs containment for the last night (`contain` 10, coordinated across policemen).
- **Kill sites in its model:** red circles carry weight 1. Circles next to an unused red circle carry 0.5, because a waiting Jack lets the police move his Wretched one step.
- **Where 142 → 126 stood:** in all three of night 3's police turns, 61 threats were weighed. This one carried 1.2% of their weight, ranked 44th.
- **Could anyone have closed it?** After the last turn the policemen left 53% of the threat open. None was within 3 police turns of 314 or 315.

Spending a policeman on a 1.2% threat three turns away, against higher-weight ones, would not have been a sound decision.

**Decision 2: night 4's patrol tokens.**
- **The rules:** tokens must stand where the policemen ended night 3 (93, 95, 69, 78, 88). Two more go on free stations, and v3's `containPatrols` may make a station's token real instead of a policeman's.
- **What v3 did:** it swapped 93 for station 312. That closed 34.3% more of the night's threat as a share, over its 0.2 threshold.
- **Why that couldn't help here:** 312 is next to hideouts 126 and 101, but no station blocks 142 → 126. Neither 314 nor 315 is a station.
- **The threat at this point:** the women were on 3, 65, 27 and 158. The model gave 142 → 126 5.4% of the night's threat, as a neighbour of 158 at weight 0.5.

The decision was sound, and the threat couldn't be closed by tokens anyway.

**Decision 3: the Wretched, after Jack waited** (phase 5). Jack's only Wretched was on 158, two walks from home. v3 moves a Wretched to the legal circle nearest its real patrols (`police.js`, `moveWretched`). Its 8 legal moves, measured by v3's own belief (the "open threat" is the hideout weight left one open walk away):

| Move to | Walks from the nearest real patrol | Hideouts one walk away (v3's candidates) | Total threat | Open threat |
|---|---:|---|---:|---:|
| 172 | 3 | none | 0 | **0** |
| 185 | 3 | none | 0 | **0** |
| 159 | 2 | 143 | 0.079 | 0.079 |
| 183 | 2 | 156 | 0.144 | 0.144 |
| 171 | 2 | 156 | 0.144 | 0.144 |
| 157 | 2 | 156 | 0.144 | 0.144 |
| **142 (chosen)** | **1** | 101, **126**, 156, 125, 102, 127 | **0.777** | 0.377 |
| 143 | 1 | 101, 156, 125, 102, 127 | 0.649 | 0.521 |

**Why the rule chose 142:** v3 had just made 312 a real patrol, beside the likely hideouts. A rule that pulls the Wretched towards real patrols therefore pulled her towards the likely hideouts.

**What a threat-aware rule would have done:** `containWretched` (an option, off in v3) picks 172. The woman would have stayed 2 walks from home, with no open one-walk escape for any candidate hideout.

## 3. Counterfactual: the same position, with the Wretched moved elsewhere

**Method:**
- Replay the record to the Wretched move, move her to each legal circle in turn, and play on.
- **Jack:** a computer player standing in for the person, in two versions:
  - Jack AI v2 (`hard`), which on the last night plays as Strategic Jack;
  - Jack AI v2 with strategic waiting (`hard-waiting`), which may wait again.
- **Police:** v3.
- **Runs:** 25 per case, seeds 613001–613025. They vary the detectives' tie-breaks and Jack's random choices.
- **One extra case:** `containWretched`'s own choice, with the option kept on for any later move.

| Wretched moved to | Police | Jack AI v2: escaped (first move) | Waiting Jack: escaped (first move) |
|---|---|---:|---:|
| **142 (actual)** | v3 | **25 (25)** | **25 (25)** |
| 143 | v3 | 25 (25) | 25 (25) |
| 159 | v3 | 9 (0) | 9 (0) |
| 171 | v3 | 9 (0) | 25 (25) |
| 183 | v3 | 3 (0) | 25 (25) |
| 157 | v3 | 3 (0) | 25 (25) |
| 172 | v3 | 6 (0) | 1 (0) |
| 185 | v3 | 5 (0) | 1 (0) |
| 172 | v3 + containWretched | 6 (0) | 3 (0) |

**What it shows:**
- **In this position the Wretched move was decisive.** From the zero-threat circles, Jack got home in 1 to 6 of 25 runs; most runs ended in arrest. From 142 he always got home at once.
- **v3's rule can be exploited by waiting again.** From 157, 171 or 183 the waiting Jack waited once more, and v3 moved the Wretched on to 142 or 143, next to the same patrol. He then always escaped on his first move.
- **Limitation:** the stand-in is a computer Jack, not the person, and the runs differ only in their random choices, not their history.

## 4. Across the human games: is this a pattern?

`wretched` lists all 95 Wretched moves v3 made in the 7 human games (people wait often: 20 waits in 19 nights in batch 1).

| | Moves |
|---|---:|
| All moves | 95 (7 games) |
| Moved the victim nearer Jack's hideout / as near / farther | 36 / 48 / 11 |
| Moved her from two or more walks to one walk from home | 3 |
| Left more open threat (by v3's belief) than its best legal move | 68 |
| Last-night moves | 4, one of which made a one-walk escape: this game's |

**The predictable move.** v3's Wretched rule is deterministic, and night 1's patrols are always the same. So the same move recurs: **in 9 of the 10 times** a Wretched stood on 158, v3 moved her to 142, in 6 of the 7 games.
- **Who benefited:** 142 is one walk from 126, and the 3 moves into a one-walk position all came in the two games whose hideout was 126 (`g4e86b6b6af7cc2e1` night 1; `g6b7af2a30b071ae6` nights 1 and 4).
- **What we can't tell:** whether a player learnt it. The repeated hideout suggests the same person (batch 1, Limitations).

**Caveats:**
- On nights 1–3, v3 doesn't defend one-walk escapes (containment counts only for the last night), so open threat there costs it little. The tallies describe the Wretched rule, not losses.
- The "nearer home" count has no baseline of random legal moves. It is not evidence of bias by itself.

## 5. Targeted simulation: a Jack who plays the lure on purpose

The earlier study found that `containWretched` changed no win rate. It also noted, as a limitation, that "a Jack designed to exploit the police's Wretched moves on purpose was not built" ([Waiting against containment §8](../../../docs/waiting-containment.md#8-limitations)). This builds him.

**The lure Jack** (`-lure.js`) plays Jack AI v2, with these changes, using only Jack's view:
- **Hideout:** chosen at random among those two walks from a red circle (the lure) that has a circle next to it one walk from home.
- **Nights 1–3:** he keeps the lure free of Wretched.
- **Night 4:** he marks it and waits while his Wretched is not one walk from home and the Time of the Crime allows. Then he kills and walks home if he can.
- **The control (`lure-now`):** the same Jack and hideout, but he kills at once on night 4.

**Results:** 200 paired games per arm, seeds 614001–614200, all new.

| Jack | Police | Jack wins | Last nights: one-walk escape left open | First-move escapes | Last-night escapes |
|---|---|---:|---:|---:|---:|
| lure | v3 | **154** | 65 of 177 | **65** | 154 |
| lure | v3 + containWretched | **149** | 11 of 178 | **11** | 149 |
| lure-now (no wait) | v3 | 154 | 0 of 177 | 0 | 154 |
| lure-now (no wait) | v3 + containWretched | 155 | 0 of 178 | 0 | 155 |

| Comparison (paired by seed) | Wins only with the option / only without | Difference in Jack's wins | p (sign test) |
|---|---:|---:|---:|
| Lure: v3 + containWretched vs v3 | 5 / 10 | −2.5 points (95% CI −6.3 to +1.3) | 0.30 |
| No wait: v3 + containWretched vs v3 | 1 / 0 | +0.5 points | 1.00 |

The no-wait arm differs in one game: Jack AI v2 occasionally waits on nights 1–3, where the option also acts.

**Reading:**
- **The decision flaw reproduces.** Against the lure, v3 moved the victim into an open one-walk escape on 37% of last nights; `containWretched` cut that sixfold.
- **It doesn't change who wins.** The lure wins no more often than killing at once (154 against 154). Jack escapes on the same nights by a longer route when the short one is closed.
- **The threshold for an AI change, a meaningful improvement, isn't met.** The interval includes zero and its far end is 6 points. This repeats the earlier study's results (−2.0, −1.0, +1.5 points).

## 6. Conclusions and proposals

**Classification:**
- **Confirmed and reproducible: a decision-level flaw.** After Jack waits, v3 moves a Wretched without regard to its own one-walk threat model, towards real patrols that containment placed beside the likely hideouts.
- **Not a defect, and not confirmed as a strategic weakness:** it costs no measurable games, against the person's opponent model or against a Jack built to exploit it.
- **Kept as a pattern to watch.** Signature: a last-night Wretched moved from two or more walks to one walk from Jack's hideout, followed by a first-move escape.

**Proposals** (none applied):
1. **No AI change now.** If a future version of the police is commissioned, `containWretched`, or containment on the last night only, is the ready-made candidate: it closes these escapes six times as often at no measured cost. On its own it buys no wins.
2. **If triage sees the signature again,** count it across batches. The effect on wins could be meaningful against people who exploit it more effectively than the stand-in Jacks: they could combine it with other deceptions, or use the predictable 158 → 142 move on purpose.
3. **The reserved held-out seeds (615001–615400)** stay unused, for a confirmation run if a change is ever proposed.

## 7. Limitations

- **One human game** for the escape itself, and three night-4 waits in other games. The person's intent is unknown.
- **Stand-ins:** the counterfactual and the simulation use computer Jacks.
  - A person might find longer escapes, or fail to, differently.
  - The lure Jack is a simple scripted policy over Jack AI v2.
- **Samples:**
  - 25 runs per counterfactual case;
  - 200 paired games per arm in the simulation, enough to resolve about 5 points, not less.
- **The 7 stations are unverified** ([Known differences](../../../docs/game-rules.md#known-differences-from-the-physical-board)). Other stations could change which patrols can stand where.
