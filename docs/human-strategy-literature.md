# Human strategy literature and AI gap analysis

This study asks what experienced *Letters from Whitechapel* players know about the game that our AI does not. It reviews BoardGameGeek (BGG) strategy discussions, compares each claim with the AIs ([Jack AI v2](jack-ai-v2.md), [Detective AI v2](detective-ai-v2.md) and their predecessors), and tests the claims that can be tested: on the board graph, in deterministic scenarios, and in small paired simulations.

No production code changed for this study. Scripts and results are in [`research/human-strategy/`](../research/human-strategy/).

## Contents

1. [Executive summary](#1-executive-summary)
2. [Methodology](#2-methodology)
3. [Source catalogue](#3-source-catalogue)
4. [Strategy taxonomy](#4-strategy-taxonomy)
5. [Human–AI comparison matrix](#5-humanai-comparison-matrix)
6. [Tactical case studies](#6-tactical-case-studies)
7. [Experimental results](#7-experimental-results)
8. [Contradictions](#8-contradictions)
9. [Strategic blind spots](#9-strategic-blind-spots)
10. [Prioritised recommendations](#10-prioritised-recommendations)
11. [Reproducing](#11-reproducing)

## 1. Executive summary

**The most important missing idea is on the detectives' side.** Experienced players stress positioning *before* a night starts. A policeman should already be standing between Jack and the red circles next to his likely hideout, because a night that ends on Jack's first or second move gives the police no time to react:
- Andrea Bampi recommends "a bobby on the crossing adjacent to 65 and 66".
- Pokey 64 would "stake out at 3, 65 and 84".
- rock lobster's "Night 4 proximity trap": "[Does Jack have a one-move Night 4 Win?] must be addressed no later than Night 3."

Neither of our police AIs does this. Detective AI v2's blocking acts only during hunting turns, and short nights have almost none. Two forum schemes built on that gap beat it:
- **ketigid's "134" scheme beats both computer police.** It keeps a Wretched on 147, next to hideout 134, and lets the police move it before each kill. Both sides play it almost deterministically, so this is one game repeated, not a win rate: v2 loses it every time, and so does a v2 variant that knew the hideout for certain from night 3. On night 4 Jack kills and walks home before any policeman moves.
- **Keeping a red circle next to home for night 4 works** (from grey_wolf's and mark_xiii's central-hideout schemes). Jack won night 4 in a single move in 85 of 100 games against v2, against 0 single-move night-4 wins by our Jacks in the earlier Jack v2 study.

The forum's own counter works on the board:
- One policeman on the 65/66 crossing makes the walk from hideout 51 to red circle 65 take 4 moves instead of 1, and to 84 take 5 instead of 1.
- One policeman on the crossing between 111, 134 and 147 doubles the 147 → 134 escape to 2 walks.

**The most important finding about our own research: whether deception or directness wins depends on how the detectives model Jack.** The forum argued this out in 2011:
- grey_wolf: deception is "utterly overrated"; a Jack should minimise his moves.
- rock lobster: "a fast 'home' *is* EVIDENCE."
- Georgios P.: "I'd probably assume that you will usually take the shortest and most direct route."

Our experiments reproduce the whole argument:

| Jack | Original police | Detective AI v2 | v2 told to expect early detours |
|---|---:|---:|---:|
| Direct (Strategic Jack) | 97.0% | 25% | **78%** |
| Early detours (Jack AI v2) | 95.5% | 76% | **49%** |

The original-police column is from the Jack v2 study (seeds 420001–420200); the other two columns are from this study (seeds 440001–440100), 100–200 games each.

Jack AI v2's advantage disappears against detectives who know its habit. Neither side's inference or movement is robust to an opponent that adapts.

**Some popular human advice fails under controlled conditions.**
- **"Always coach on the first move"** made Jack AI v2 *worse* (55% against 76% against v2, p = 0.002). Its stated benefit, expanding where Jack might be, is worth little against an exact deduction.
- **grey_wolf's quick-home double event fails in the rules as implemented.** The police move first and Jack stands on one of two known crime scenes, so the full scheme lost 36 of 100 games on night 3.
- **The forum's counter of moving the Wretched away from the likely hideout** made no difference to the 134 scheme on its own.

**What experienced players knew, and our research independently found:**
- Direct routes expose the hideout.
- Guarding the hideout beats chasing clues.
- Arrest only when the evidence supports it.
- Night 3 is the police's best chance.

**What remains missing:**
- **For the police:** cross-night positioning, Wretched handling that knows the hideout, and adapting to Jack's habits.
- **For Jack:** planning victims and hideout across nights, short nights next to home, and varied strategies.

**Follow-up:** [Detective AI v3](detective-ai-v3.md) took up recommendation 1. It is the Hard police: it stops the 134 scheme and more than doubles the police's wins against generalised short-return Jacks, without losing against the ordinary ones.

**Recommendation:** the next priority is **the detectives**, specifically cross-night positioning, the "proximity trap". It is the largest demonstrated gap. Simple human schemes beat our best police through it. Improving Jack first would mostly teach him to exploit a mistake that, according to the experienced players here, competent human detectives do not make.

## 2. Methodology

**Sources.** BoardGameGeek could not be reached from this environment: the network policy blocks boardgamegeek.com and archive mirrors. The user supplied five cleaned transcripts of BGG threads instead (section 3). The cleaning removed navigation and formatting only; post order, authors, dates and wording are kept. Everything in this document comes from those transcripts. Where they quote other material (the rulebook, an FAQ, threads they link to), it is reported as quoted, not verified.

**Not covered.** Other BGG threads, the Files section, the official FAQ, and the FFG forums were not reached. Web search found many more relevant BGG thread titles, without their content:
- "Investigator Strategy: The Stakeout"
- "Blitz Strategy – 1 Coach Move, 1 Normal Move"
- "'Rushing' from the rulebook?"
- "Special Movement to Hideout"
- "Strategies for winning as Jack"
- "Balancing rules for Letters from Whitechapel"

They are listed as follow-up reading, and nothing here relies on them.

**Selection.** All five supplied threads were read in full. A claim was extracted when it proposed a strategy, a tactic, a counter, or a factual statement about the board or rules. Social and psychological advice is recorded but classed as inapplicable to AI against AI. Disagreements are recorded on both sides. Confidence is not treated as evidence.

**Editions.** The threads span 2011–2015, across the first edition and the revised edition and its FAQ. Our engine implements the revised edition rulebook ([Game rules](game-rules.md)) without its optional rules. The rule interpretations that matter here agree:
- A coach can pass policemen.
- Jack must *walk* onto his hideout to end the night ("Page 19 in that hard to miss, red outlined and orange filled box").
- A Wretched killed on the hideout means Jack must step off and back (FAQ, as cited by Pieter).
- Jack may reuse a red circle each night until a murder happens there.

House rules and optional rules discussed in the threads are outside the engine:
- no repeat victim spot;
- random hideouts;
- "Catch me if you can";
- "Run";
- a third police move;
- Jack's letters.

**Testing.** Each testable claim was checked in three ways:
1. **Exact graph analysis** on our map, in the printed numbers the posts use (`research/human-strategy/board.js`, `scenarios.js`).
2. **Deterministic rule checks.**
3. **Small paired simulations**, where a claim needs play: 100 games per matchup on fresh seeds 440001–440100, never used before (`experiment.js`, about 8 minutes in all).

The simulations follow these rules:
- The forum's schemes are played by scripted Jacks that fall back to Jack AI v2 whenever the script doesn't apply. A comparison with Jack AI v2 therefore isolates the scheme.
- Every policy uses only its own side's view.
- McNemar's exact test pairs games by seed. Wilson intervals give 95% confidence. Fifteen-odd comparisons were made without correction, so isolated p-values near 0.05 are weak evidence.

## 3. Source catalogue

| # | Thread | Opened by, date | Posts | Strategy proposed | Main counterarguments | Rules assumptions | Strength and limits of the evidence |
|---|---|---|---:|---|---|---|---|
| S1 | [An almost perfect winning scheme for Jack](https://boardgamegeek.com/thread/659433/an-almost-perfect-winning-scheme-for-jack) | grey_wolf (Michael), 2 June 2011 | 49 (to 28 Nov 2014) | Hideout 51; kill at 27, coach (29, 66), home; one ordinary night; nights 3 and 4 kill at 3 + 84, then 65, one walk from home. Generalised: minimise moves; coach immediately to multiply possibilities; deception is overrated | The police can arrest at 66 or read the coach (Pokey 64, Georgios P.); stake out 3, 65 and 84; a bobby on the 65/66 crossing (Andrea Bampi); "a fast 'home' *is* EVIDENCE" (rock lobster); the scheme relies on predictable police (joedogboy, Max) | First edition plus FAQ; coaches pass police | Strongest thread: concrete numbers, two graph analyses (degrees, coach reachability), a played-out test by Max. But grey_wolf concedes "it is merely a device", and he estimates his win chances from assumed probabilities |
| S2 | [Near perfect play for Jack at 134](https://boardgamegeek.com/thread/660373/near-perfect-play-for-jack-at-134) | ketigid, 4 June 2011 | 17 (to 3 Jan 2014) | Hideout 134; place a Wretched on 147 each night, wait once, kill where the police moved it, walk home; night 4 kill at 147 at once | Police on the 130/145 station or the 131/146 crossing (Jason Lindahl); detectives who have seen it guard 133/134 and the hideout is given away (Pieter); move the Wretched away: 147 → 146 → 131 → 106 → 105 (Pas L); house rules | Rules as written; FAQ: killing in the hideout means moving off and back | Precise and testable. The counters are argued, not tested. Pas L's assumes "four cops in the area" |
| S3 | [Winning strategy for Jack? Is this game broken?](https://boardgamegeek.com/thread/853918/winning-strategy-for-jack-is-this-game-broken) | mark_xiii, 9 Sept 2012 | 33 (to 20 Aug 2013; ends in an off-topic personal exchange, not used) | Hideout next to two central crime scenes (66, 51, 67; or 82, 63, 83 at two moves): nights 3–4 become one-move kills | "That's a lot of ifs" (Pokey 64); fixes: random hideouts, "Catch me if you can", a third police move; win records 24–18 for Jack (xpiredsodapop) | Revised edition optional rules | Mostly about balance and house rules. One concrete claim (which hideouts), checked in section 6 |
| S4 | [A quick guide to playing Investigator(s)](https://boardgamegeek.com/thread/787745/quick-guide-playing-investigators) | rock lobster (rainofwalrus), 6 Apr 2012 | 18 (to 3 Jan 2014) | Don't move predictably; don't over-chase (stay in position for the next night); "think like Jack" with a notepad; random arrests along the trail to deter backtracking (Don D.); the Night 4 "proximity trap"; lock Wretched in place; night 3 is key and blocking a clump of hideouts works (Pas L) | Traps need information you only get by chasing (jbrier, Don D.); a good Jack keeps two Wretched options for night 4 | Rules as written | Experienced players (Don D. reports almost 100 games). Advice is general, with few positions to test |
| S5 | Jack's advice for rookie policemen (URL not in the transcript) | Patrick Rael (prael), 4 Sept 2013 | 4 (to 14 Jul 2015) | Goal of night 1 is information about the lair, not finding Jack; don't flood the crime scene; chase from behind with the nearest policeman; watch the main roads; cover the lair once suspected; record clues; arrest only when sure | Don D.'s refinement of the arrest rule: also arrest when only one adjacent circle could give a clue and a clue there would mean Jack is there now | Rules as written | A novice (3 games) with an experienced correction. Sensible but general |

## 4. Strategy taxonomy

Claims are grouped as the brief asks. Two categories the brief did not list are added at the end of each side: **Wretched handling**, and **the opponent at the table**.

### Jack

| Category | Claims (source) |
|---|---|
| **Hideout selection** | Central, one walk from two red circles: 51, 66, 67 (S1 Andrea Bampi; S3). Many approaches, since some hideouts can be cordoned by two policemen and others need five (S1 grey_wolf). A hideout reachable from the Wretched's spawn point, e.g. 134 next to 147 (S2) or 136 next to 149 (S1 Robert Birmley) |
| **Murder strategy** | Kill next to home on the last nights so the night ends at once (S1, S2, S3). Reuse one red circle by letting the police move its Wretched (S2). Never kill on a red start spot on nights 1–2; keep two realistic Wretched for night 4 (S4 Don D.) |
| **Movement** | Minimise moves; long tours give clues and time (S1 grey_wolf), against "a fast home is evidence" (S1 rock lobster). Coach immediately to multiply possible positions from 3–9 to "usually up to 30" (S1 grey_wolf, Andy Holt, Andrea Bampi, Statalyzer). Use high-degree circles as "option multipliers"; avoid poorly connected areas like 70/71/72/87/88; alley walk to the main road (S1). Backtracking is powerful (S4 Don D.). Linger near the hideout when the police don't pressure (S4 jbrier) |
| **Deception** | Exploit the police's known habits, e.g. coach a route their usual first move won't search (S1 grey_wolf). Bluff by the choice of coach (S1 Georgios P., as the police's view). Educated bluffs: deliberately avoid the best-connected circles (S1 grey_wolf) |
| **Endgame** | A one- or two-move night 4 from a kill next to home (S1, S2, S3). Escape cordons with special moves; keep many approaches (S1) |
| **Wretched handling** (added) | Wait once so the police must move the Wretched, keeping 147 free for the next night (S2) |
| **The opponent at the table** (added) | Play differently once the police adapt; abandon the scheme when the first clue is found (S1 grey_wolf). Write the planned route down first and count how often the police force a change (S1 joedogboy) |

### Detectives

| Category | Claims (source) |
|---|---|
| **Inference** | "Think like Jack": track his possible moves on a notepad (S4). Use timing and the absence of clues ("no evidence is also evidence", strong at low-degree circles, weak at circles like 125) (S1 grey_wolf; S4 Pas L). Trace the trail back to the lair over two or three nights (S5). Read the player: why did he coach? Does he usually go straight home? (S1 Georgios P.) |
| **Investigation** | Night 1 is for information about the lair, not for catching Jack (S5). Don't arrest unless sure, or when a clue at the only possible adjacent circle would mean Jack is there now (S5 Don D.). Arrests are themselves information (S4 Pas L). Random arrests along the trail deter backtracking (S4 Don D.), but feel like flukes (rock lobster) |
| **Containment** | Cover the lair once suspected (S5); put yourself between Jack and his hideout as night 4 approaches (S4 jbrier). Block a clump of possible hideouts (S4 Pas L). A bobby on the 65/66 crossing (S1). Stake out the remaining kill sites (S1 Pokey 64). Night 4 proximity trap (S4). Watch the main roads (S5). Don't cordon too tightly (S5) |
| **Counterplay** | Don't over-chase: a good Jack leads you out of position for the next night (S4). Don't move predictably (S4). The yellow crossing near 130 matters in the opening (S2). After seeing a scheme once, defend its hideout (S2 Pieter) |
| **Wretched handling** (added) | Move the Wretched away from Jack's area (S2 Pas L). Lock a Wretched in place with back-and-forth moves, revealed patrols and earlier crime scenes (S4 rock lobster) |
| **The opponent at the table** (added) | Confer openly to unsettle Jack; appear confident (S4). Size up the person across the table (S1 Georgios P.) |

## 5. Human–AI comparison matrix

The classifications follow the brief:
- **Implemented:** an AI mechanism does it.
- **Rediscovered:** our earlier experiments found it independently.
- **Partial:** similar behaviour exists, but the reasoning is missing.
- **Missing:** nothing like it exists.
- **Contradicted:** our evidence suggests it fails.
- **Unresolved:** there isn't enough evidence either way.
- **Inapplicable:** it depends on rules we don't implement, or on human interaction.

"Our Jacks" means Strategic Jack and Jack AI v2. Statistics about them come from the Jack v2 study's stored games (seeds 420001–420200, against v2).

### Jack

| Strategy | Source | Human reasoning | Current AI equivalent | Existing evidence | Missing capability | Classification | Priority |
|---|---|---|---|---|---|---|---|
| Central hideout next to two red circles (51/66/67) | S1, S3 | Two one-move kill sites for the last nights | Strategic Jack's hideout choice favours hideouts with short walks to the red circles in general, then picks at random among about 127 near-equal ones. It never targets 51/66/67 | Hideout 51 with Jack AI v2's play: 86% against v2 vs 76% with its own hideout (20/10, p = 0.099); 99% vs 96% against the original police | Choosing the hideout *with* a plan for later kills | **Partial**; weak support | Medium |
| Kill next to home so a night ends in one or two moves | S1, S2, S3 | The police move after Jack; a one-move night gives them no move | **None.** Both Jacks place their marked victims about 7 moves from home (the baseline's `placeWomen`). Nights start 5.4–6.5 moves from home; 0% start within 1; none of 250 (Strategic) or 167 (Jack v2) night 4s ended in one move | Keeping 65 for night 4: 85 one-move night-4 wins of 100 against v2 (section 7, E1b) | Planning victims across nights; reserving a home-adjacent red circle | **Missing**; works against our police | High (but see section 9) |
| Reuse one red circle by letting the police move the Wretched (134 scheme) | S2 | Each move of the Wretched stays next to home | None | Beats both police deterministically (E2) | As above | **Missing**; works against our police | (as above) |
| Quick-home double event (kill at 3 and 84, walk to 51) | S1 | Police "react once" | n/a | Lost 36 of 100 games on night 3 against v2 (12 against the original): on the double event the police move first, Jack stands on a known crime scene, and they arrest | — | **Contradicted** under the implemented rules | — |
| Coach on the first move to multiply possibilities | S1 (four posters) | 3–9 possible circles after a step, "up to 30" after a coach; the police must spread their deductions | Strategic Jack's first move is a coach on 68% of night 1s and 1–27% of later nights. Jack AI v2's on 4–12%: its detour walk comes first | Coach first instead of Jack AI v2's first move: 55% vs 76% against v2 (12/33, p = 0.002); 89% vs 96% against the original (p = 0.092) | — | **Contradicted** against exact deduction | — |
| Minimise moves vs deceive (zig-zag, false trails) | S1 (grey_wolf vs rock lobster); S4 jbrier | Fewer moves give fewer clues and police turns, against "a fast home is evidence" | Jack AI v2's fixed early detours, against Strategic Jack's direct routes | Depends on the police's model: direct wins against the original police (97.0% vs 95.5%, Jack v2 study) and detour-aware police (78% vs 49%); detours win against v2 (76% vs 25%) (E4) | Choosing between them from what the police appear to believe; mixing | **Rediscovered**, and context-dependent | High |
| Backtracking | S4 Don D. | Police chase forwards | Not deliberate; 18–19% of our Jacks' nights revisit a circle | None | Deliberate backtracking | **Unresolved** | Low |
| Use high-degree circles as option multipliers; avoid 70/71/72/87/88 | S1 grey_wolf | More possible next circles means less information per clue | Implicit: Strategic Jack's arrest risk uses how sure the police could be of his circle, which is lower in well-connected areas | The degrees match (section 6); no test of the advice itself | — | **Partial** (implicit) | Low |
| Hideout with many approaches | S1 grey_wolf | Harder to cordon | None | Jack v2 study: no clear effect of the number of entry crossings (28% with 2, 32% with 3, Strategic against v2; small samples) | — | **Unresolved** | Low |
| Exploit the police's habits | S1 grey_wolf | Police are predictable in their first moves | Partial: Strategic Jack's arrest table is measured against the original police | Jack AI v2 exploits v2's directness model (76% vs 25%) | Learning *this* opponent's habits in-game | **Partial** | Medium |
| Keep two realistic Wretched for night 4; don't spend red circles early | S4 Don D. | Flexibility on the last night | None: victims are chosen night by night | None | Cross-night victim planning | **Missing** | Medium |
| Bluffing, reading the police, table talk | S1, S4 | Psychology | — | — | — | **Inapplicable** | — |

### Detectives

| Strategy | Source | Human reasoning | Current AI equivalent | Existing evidence | Missing capability | Classification | Priority |
|---|---|---|---|---|---|---|---|
| Track every possible route ("think like Jack") | S4, S1 | Exhaustive tracking | `deduction.track`: exact; matches an exhaustive enumeration on 21,019 records | Detective AI v2 study | — | **Implemented** (beyond human capacity) | — |
| Eliminate hideouts across nights; trace the lair over two or three nights | S5, S4 | Accumulate evidence | `deduction.hideouts`: the exact set of possible hideouts | Candidates fall from 187 to about 15–19 by night 4 against direct Jacks (Jack v2 study) | — | **Implemented** | — |
| Read the player: does he go straight home? | S1 Georgios P. | People have habits | Detective AI v2's hybrid weighting assumes directness, fitted once on calibration games. It does not adapt | A v2 told to expect early detours beats Jack AI v2 (49% vs 76%, 7/34, p = 0.00003) but loses badly to a direct Jack (78% vs 25%) | Inferring the opponent's style from the nights played | **Partial** (a fixed model) | **High** |
| Cover the lair once suspected; stand between Jack and home | S5, S4 | Deny access instead of arresting | Detective AI v2 blocking | Strategic Jack 98% → 31.6% (Detective AI v2 study) | Coordination; see the next row | **Implemented**, rediscovered | — |
| Pre-position before the night: stake out kill sites next to the likely hideout; the Night 4 proximity trap; a bobby on 65/66 | S1, S4 | A one-move night can only be stopped by a policeman already there | **None.** Blocking acts only during hunting turns. Neither police values where policemen end a night, though those positions are where the next night's patrols start | v2 loses every game of the 134 scheme, and so does a variant that knew its hideout with certainty from night 3 (E2, E2b); 85 one-move night-4 wins against v2 (E1b). The forum's counters work on the board (section 6) | Valuing end-of-night positions, and the kill sites next to likely hideouts | **Missing** | **Highest** |
| Opening patrol placement (the station near 130; man the edges) | S2, S5 | Cover kill sites and escape routes | `placePatrols` ranks the stations by the red circles near them; it ignores hideout knowledge | The 7 stations leave only the real/fake choice on night 1 | Later-night placement from hideout knowledge (placement follows end-of-night positions; see the row above) | **Partial** | (with the row above) |
| Move the Wretched away from Jack's area; lock Wretched | S2 Pas L, S4 | Deny Jack his kill sites | `moveWretched` moves Wretched *towards* the real patrols, ignoring the hideout. Against the 134 scheme it moved the Wretched onto Jack's hideout | Moving Wretched away from likely hideouts alone did not stop the 134 scheme (E2b) | Hideout-aware Wretched handling, combined with pre-positioning | **Missing**; contradicted as a counter on its own | Medium |
| Don't over-chase; keep a sensible spread; don't flood the crime scene | S4, S5 | Stay in position for the next night | v2 positions by how much of Jack's likely position each policeman covers, plus blocking | Coordination of the policemen made v2 worse (Detective AI v2 study) | Next-night value | **Partial** | (with pre-positioning) |
| Arrest only when sure, or when a clue at the only adjacent circle would mean Jack is there | S5 | Wasted arrests lose clues | Arrest when one circle holds at least 20% of where Jack could be (the deduction covers the single-circle case exactly) | Arresting at 15% failed validation (Detective AI v2 study) | — | **Implemented**, rediscovered | — |
| Night 3 is key | S4 Pas L | The double event fixes Jack on known crime scenes | Belief-based arrests at the double event's crime scenes | The quick-home double event lost 36% of games to v2 on night 3 (E1) | — | **Implemented** in effect | — |
| Random arrests along the trail; unpredictable movement | S4 | Deter backtracking; deny a pattern | Deterministic police (ties broken at random) | Untested; our Jacks don't backtrack deliberately | Mixed strategies | **Unresolved** | Low |
| Block a clump of possible hideouts | S4 Pas L | Covering many is as good as knowing one | v2 blocking weights every possible hideout | Detective AI v2 study | — | **Implemented** | — |
| Confer, look confident, unsettle Jack | S4 | Psychology | — | — | — | **Inapplicable** | — |

## 6. Tactical case studies

Every number below is printed by `node research/human-strategy/scenarios.js` ([`results/scenarios.md`](../research/human-strategy/results/scenarios.md)). The board facts are pinned by `test/unit/human-strategy-scenarios.test.js`.

### The map agrees with the forum's board

Four graph facts the posters computed by hand all match our map:

| Claim | Poster | Our map |
|---|---|---|
| Fewest walking neighbours 2 (81, 61), most 15 (125), about 8 on average | Andrea Bampi | 2 at 61 and 81; 15 at 125 (and 159); mean 7.95 |
| Only 51, 66 and 67 are one walk from two red circles | Andrea Bampi | Exactly 51, 66 and 67, each next to 65 and 84 |
| The 55 circles reachable from 27 by a coach and one step | grey_wolf | The same 55 circles, none missing, none extra |
| The circles a coach from 27 could reach only by passing a policeman on 29/30/50: "30, 49, 50, 64 and 66" | Georgios P. | Exactly 30, 49, 50, 64, 66 |

Three more agree:
- 147 walks to 111, 133, 134 and 146, as in S2.
- "Catch me if you can" excludes 26% of hideouts, "about a quarter".
- 175 and 188 can be cordoned together by two policemen, as Andrea Bampi said.

The low-degree area grey_wolf calls "dreadful for Jack" (70, 71, 72, 87, 88) has 4–6 neighbours per circle, against a mean of 7.9. This is an independent check on our map data, complementing the earlier [whitechapelR comparison](map-data.md).

### grey_wolf's scheme (hideout 51)

| Night | Plan | Legal? | Moves | What the rules give the police |
|---|---|---|---:|---|
| 1 | 27 → coach (29, 66) → 51 | Yes; the coach passes the 29/30/50 station | 3 | One turn, after the coach |
| 2 | 149 → 148 → 114 → 96 → coach (78, 80) → coach (82, 65) → 51 | Yes; uses both coaches | 8 | A normal night |
| 3 | kill at 3 and 84 → 51 | Yes | 1 | One turn, **before** Jack moves (double event) |
| 4 | kill at 65 → 51 | Yes | 1 | **None** |

The counters, checked:
- **Pokey 64's night-1 arrest at 66 is possible.** From the 29/30/50 station a policeman reaches the 64/66 crossing in one turn.
- **Andrea Bampi's standing counter works.** With a policeman on the 65/66 crossing:
  - 51's walks shrink from 31, 50, 52, 65, 66, 67, 84 to 31, 50, 52, 67;
  - 51 → 65 takes 4 walks and 51 → 84 takes 5;
  - the shortest walk between any two red circles goes from 1 to 3, "BY TWO" as claimed.

  The remaining 3-walk routes include the four the forum lists: 65-83-99-84, 65-83-100-84, 3-2-28-27 and 3-2-26-27. Our map adds 3-9-26-27, 3-9-28-27 and 27-48-63-65. The forum's notation "(83-99)" means the intermediate circles of a three-walk route.
- **Night 3 is where the scheme breaks.** It is not the night 1 grey_wolf worried about. On the double event the police move first, knowing Jack is on 3 or 84 (section 7).

### ketigid's scheme (hideout 134)

- **The geography holds.** 147 walks to 111, 133, 134 and 146. From those, home is 1, 1, 0 and 2 walks away, and from 147 itself 1.
- **The proposed counters work on the board:**
  - The walk 147 → 134 passes one crossing, 111/134/147. A policeman standing there at the start of night 4 turns the one-move escape into two walks.
  - The 130/145 station reaches the crossing next to 146 in one turn, as ketigid warns.
  - Pas L's Wretched path 147 → 146 → 131 → 106 → 105 is legal. But 131 and 106 are still one walk from 134, so moving the Wretched only helps if it reaches 105 or is combined with a stake-out.
- **The rules check out.** A Wretched killed on the hideout doesn't end the night: Jack must step off and back, as the FAQ cited by Pieter says. Reusing 147 is legal until someone is killed there.
- **In play** (E2), our police never use any counter, and the scheme wins (section 7).

### Hideouts next to two crime scenes (mark_xiii)

| Hideout | Red circles within two walks |
|---|---|
| 66 | 65 and 84 at 1; 27 at 2 |
| 51 | 65 and 84 at 1 |
| 67 | 65 and 84 at 1 |
| 82 | 65 at 1; 84 at 2 |
| 63 | 65 at 1; 27 and 84 at 2 |
| 83 | 65 at 1; 84 at 2 |

The claim is correct as stated.

## 7. Experimental results

**Setup.** 100 games per matchup, seeds 440001–440100, paired by seed. "Only this / only ref" counts the games each side of the comparison won alone. Full tables: [`results/experiments.md`](../research/human-strategy/results/experiments.md). It took 8.4 minutes on 4 cores for 2,200 games.

**E1, E1b, E2, E3: the forum's ideas against the original police and Detective AI v2**

| Jack | Original police | vs Jack AI v2 | Detective AI v2 | vs Jack AI v2 | Losses by night (v2) | One-move night-4 wins (v2) |
|---|---:|---:|---:|---:|---:|---:|
| Jack AI v2 (its own hideout) | 96% | | 76% | | 2/3/7/12 | 0 |
| Jack AI v2, hideout 51 | 99% | 4/1 (0.38) | 86% | 20/10 (0.099) | 0/1/7/6 | 1 |
| **E1** grey_wolf's scheme (51; nights 3 and 4 next to home) | 88% | 3/11 (0.057) | 63% | 18/31 (0.085) | 0/1/**36**/0 | 63 |
| **E1b** night 4 only (65 kept for the last night) | 99% | | 89% | (vs hideout 51 alone: 3/0, p = 0.25) | 0/1/7/**3** | **85** |
| Jack AI v2, hideout 134 | 79% | 3/20 (0.0005) | 40% | 13/49 (< 0.0001) | 11/3/19/27 | 0 |
| **E2** ketigid's scheme (134) | 100% | | 100% | | 0/0/0/0 | 100 |
| **E3** coach on the first move | 89% | 3/10 (0.092) | 55% | 12/33 (0.002) | 1/11/15/18 | 0 |

- **E1:** the scheme loses on the double event, as described above. Every night 4 it reached, it won in one move.
- **E1b:** the night-4 part alone keeps hideout 51's strength and halves its night-4 losses. The effect is small and not significant, but the mechanism is clear: 85 one-move nights.
- **E2 is not a win rate.** Both sides play the scheme almost deterministically. Against v2 all 100 games are the same game; against the original police there are two variants (65 and 35 games). What it shows is that **these police have no answer to it**, not how often it wins.
  - Against v2, the 147 Wretched was moved onto 134 on night 2, so Jack killed at home and stepped off and back.
  - v2's belief in the true hideout is one sixth on night 2 and 9–22% after that; in the v2-wretched-away variant (E2b) it is certain from night 3. Either way, with 1–2 moves a night, the police never get the turns to use that knowledge.
- **E3:** with a coach first, Jack ran out of moves more often (21 games against 8). A coach spends two moves and replaces Jack AI v2's first detour. Against an exact deduction, the extra possible positions buy little.
- **The hideout matters on its own.** Jack AI v2 with hideout 134 but without the scheme is much *worse* (40%). The scheme, not the hideout, is what wins.

**E2b: the forum's Wretched counter.** In v2-wretched-away, Detective AI v2 moves each Wretched as far as it can from the hideouts it thinks likely, instead of towards its patrols. The 134 scheme still won every game, now with a 2-move night 2. Jack AI v2's games were identical to its games against v2, so the change costs nothing. On its own, though, it is not a counter.

**E4: detectives who expect Jack AI v2's habit.** In v2-detour-aware, Detective AI v2's hideout weighting favours hideouts that imply a detour of about 3 moves, Jack AI v2's average, instead of 0. It models detectives who have learnt the opponent's style; it is not a proposed AI.

| Jack | v2 | v2, detour-aware | Paired (only aware / only v2) |
|---|---:|---:|---:|
| Strategic Jack (direct) | 25% | **78%** | 56 / 3 (p < 10⁻¹²) |
| Detour Jack | 75% | 54% | 5 / 26 (p = 0.0002) |
| Jack AI v2 | 76% | **49%** | 7 / 34 (p = 0.00003) |

Against Jack AI v2, the detour-aware police had a policeman next to the true hideout in 48% of night-4 turns, against 28% for v2.

## 8. Contradictions

| Disagreement | Human view | Our evidence | Why they differ |
|---|---|---|---|
| Coach first | Always coach at the start of a night to "rapidly expand their footprint" (S1) | It made Jack AI v2 worse (E3) | **Limits of our inference model**, in the other direction from usual: an exact deduction is not slowed by more possibilities, while human trackers are. The coach also spends two of Jack's moves. Only one way of coaching first was tested |
| Minimise moves vs deceive | Both sides argued in S1 | Each is right against a different police (E4; the Jack v2 study) | **Different assumptions about the opponent.** grey_wolf's police didn't read directness ("assume you take the shortest route" is Georgios P.'s *counter*); rock lobster's did. The forum's disagreement is a real property of the game, not a mistake on one side |
| The double event as a quick home run | Nights 3 and 4 are "almost done deals" (S1) | Lost 36% of games on night 3 to v2, 12% to the original (E1) | **Incorrect human assumption** (or edition), plus **opponent skill**: the police move first on the double event, and policemen near the red circles arrest at a known crime scene. Pokey 64's stake-out at 3, 65 and 84 anticipated this |
| "The game is broken in Jack's favour" vs "the police can counter" | S1, S2, S3 vs joedogboy, Max, Pieter, rock lobster | Simple schemes beat both our police (E2; E1b) | **Unrepresentative simulation opponents.** Our police have no "trap logic", rock lobster's term for exactly the missing capability: "It means no trap-logic was in place". The evidence supports the sceptics' diagnosis, not the claim that the game is broken |
| Moving the Wretched away counters the 134 scheme | S2 Pas L | Not on its own (E2b) | **Tactical situations absent**: Pas L assumes "four cops in the area"; our police aren't there, because they don't pre-position |
| More approaches make a safer hideout | S1 grey_wolf | No clear effect (Jack v2 study) | **Insufficient statistical evidence** (small samples per hideout) |
| "Jack can play almost at random and still win 50/50" | S4 rock lobster | The baseline Jack wins 22% against the original police and 13% against v2 (Detective AI v2 study) | **Different opponents**: exact computer deduction against human trackers |

## 9. Strategic blind spots

Ranked on the brief's criteria: evidence from players, relevance to observed weaknesses, importance, genuine absence, ease of testing, and cost.

1. **The police don't prepare the next night.** This covers the Night 4 proximity trap, stake-outs at kill sites next to likely hideouts, end-of-night positions, and hideout-aware Wretched handling.
   - Two threads independently.
   - The simplest schemes beat our best police through it (E2, E1b).
   - A v2 variant lost even knowing the hideout.
   - The forum's counters are verified on the board.
   - It is absent from both police.
   - It is easy to test with deterministic scenarios.

   **Research question:** *does valuing where policemen stand at the end of a night (next to likely hideouts' entries and the red circles one walk from them) stop one-move nights without weakening the hunt?*
2. **Neither side models its opponent's style.**
   - Players read habits (S1 Georgios P.; S4 "don't move predictably").
   - v2 assumes direct routes; Jack AI v2 always detours early. Each beats the other's fixed habit and loses to the opposite one (E4).
   - It is absent from both sides.

   **Research question:** *can detectives infer a Jack's detour habit from the nights already played (public move counts and crime scenes), and can Jack vary his own (sometimes direct, sometimes detouring) so that a fixed model is unprofitable?*
3. **Jack doesn't plan victims and hideout across nights.**
   - All of S1–S3: kill next to home, keep a home-adjacent red circle for the last night, choose the hideout for it.
   - It is absent; it works against our police (E1b).
   - Its value against competent detectives is unknown until gap 1 is closed, which is why it ranks third.

   **Research question:** *after the police learn to pre-position, is a hideout next to a red circle (and saving that circle for night 4) still an advantage?*

Not selected:
- **Coach-first movement and quick double events:** contradicted.
- **Backtracking and random arrests:** unresolved, little evidence.
- **Hideout approach counts:** unresolved.
- **Psychology:** inapplicable.

## 10. Prioritised recommendations

**Next priority: the detectives.** The largest gap is theirs. While it stays open, any Jack improvement risks exploiting a weakness that experienced human detectives say they don't have. Jack AI v2's own result illustrates the danger: it beats v2 by its fixed habit and loses to detectives who know it.

| # | Recommendation | Kind | Cost | Why |
|---:|---|---|---|---|
| 1 | Research question 1: a police option (off by default, like v2's options) that values end-of-night positions next to likely hideouts' entries and the red circles one walk from them. Test first on the deterministic E2 and E1b scenarios, then on development seeds against Strategic Jack, Jack AI v2 and the two schemes | Detective research | Medium | Closes the demonstrated gap; easy to verify |
| 2 | Hideout-aware Wretched movement, tested only together with 1 | Detective research | Low | The forum's counter; on its own it did not help (E2b) |
| 3 | Research question 2: detectives that estimate a Jack's habitual detour from earlier nights instead of a fixed one (the E4 variant is the fixed-detour version); then a Jack that randomises its detours | Both | Medium | E4 shows both fixed models are exploitable |
| 4 | Research question 3: cross-night victim and hideout planning for Jack, evaluated only against the police from 1 | Jack research | Medium | Valuable only if it survives competent containment |
| 5 | Read the uncollected BGG threads (section 2), especially "Investigator Strategy: The Stakeout" and "Blitz Strategy", once BGG is reachable or uploaded | Literature | Low | Likely more detective positioning tactics |

Not recommended:
- Coaching first, or quick-home double events, as Jack policies.
- Random arrests as a police habit, until a Jack exploits their absence.
- Hideout-approach heuristics, until evidence appears.

**Proposed follow-up experiment** (not run, at most a few minutes): the E2 and E1b scenarios against a police version from recommendation 1. It would answer research question 1 directly, and it needs that police option to exist first.

## 11. Reproducing

| Command | What it does | Time |
|---|---|---|
| `node research/human-strategy/scenarios.js` | Every graph and rule check in section 6 → `results/scenarios.md` | 2 s |
| `node --test test/unit/human-strategy-scenarios.test.js` | Pins the board facts (part of `npm test`) | 1 s |
| `bash research/human-strategy/run-experiments.sh` | Every run of section 7 → `results/experiments.md` (skips runs whose results file exists; delete `results/*.json` after code changes) | 8.4 min from nothing |
| `node research/human-strategy/experiment.js <jack> <police> <games> <first seed>` | One run | — |
| `node research/human-strategy/summary.js <police> <games> <first seed> <jacks> <reference>` | One table | — |

**Policies** (`research/human-strategy/policies.js`): `jack-v2@51`, `jack-v2@134`, `bgg-51`, `bgg-51-night4`, `bgg-134` and `coach-first`. Any name from `research/jack-v2/policies.js` also works.

**Police:**
- The configurations in `research/detective-v2/configs.js`.
- `v2-detour-aware` and `v2-wretched-away` (in `experiment.js`).

**Seeds:** 440001–440100, used by no other study.

**Statistics from the Jack v2 study's stored games** (start distances, first-move coaches, revisits) were computed from `research/jack-v2/results/games/` (seeds 420001–420200, against v2). Those files are kept out of git, and `research/jack-v2/compare.sh` regenerates them.

The BGG transcripts the user supplied are not committed; the threads are cited by URL. Quotations are kept short.
