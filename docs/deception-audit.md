# Fake Wretched and fake patrols: an audit

Do the AIs use the preparation phase's two deception mechanics strategically, or only satisfy the rules? This audit answers from the code, and measures what each hidden choice is worth with value-of-information bounds. It changes no AI. It is Part 0 of the Detective AI v4 extension.

The rulebook's "fake Wretched" are the **unmarked women**: face-down woman tokens that look like the marked ones (the Wretched) until the victims are chosen. The "fake police" are the two **fake patrol tokens** among the seven.

## Summary

- **Both mechanics are handled by fixed rules, not used strategically.** No AI places women or fake patrols to mislead, and no AI infers the other side's hidden choice from what it sees.
- **Against the current AIs, both are worth nothing measurable.**
  - Telling Strategic Jack or Jack AI v2 which patrols are fake changed no game's outcome in 800 games (seeds 490001–490100). None of 137 victim choices checked one by one changed either.
  - Telling Detective AI v3 which women are marked changed its choice of fakes on 1 night of 979.
  - Choosing the fakes at random made no significant difference against any Jack.
- **Why: the board and the Jacks leave the mechanics no room.**
  - Women always fill every legal red circle unless an earlier victim was killed off one, so their positions tell the police nothing.
  - No patrol station reaches a red circle within one police turn, so whether a token is real never changes which victim is exposed.
  - Strategic Jack and Jack AI v2 never wait (0 of 700 nights), so they never reveal a token.
- **The police's choices are predictable and leak.** Someone watching (a person, not the current AIs) could exploit this:
  - Night 1's fakes are the same two stations in every game.
  - On nights 2–4 the fakes are always the two free stations: 100% of nights for the original police and v2, 96% for v3.
  - The police move every Wretched towards the real patrols. On the baseline Jack's wait nights, those moves alone narrow the 21 possible choices of real tokens to 3.7 on average, and identify every fake on 36% of nights.
- **Recommendation: leave both mechanics out of Detective AI v4's core.** Add a patient, observant Jack to v4's final validation as a counter-strategy. Make the police's preparation less predictable (R1 below) only if that Jack exploits it. Section 7 ranks the improvements.

> **Follow-up:** [Strategic waiting](jack-waiting.md) re-tested patrol information with a Jack who waits and reveals tokens. It still changed none of his decisions (section 7 there).

## 1. How the mechanics work here

The preparation phase runs in this order (`js/core/engine.js`):

| Engine phase | Who decides | What the other side knows |
|---|---|---|
| 1. The targets are identified (`engine.js:138`) | Jack places women on red circles, choosing which are marked (`ai.placeWomen`) | The police see every woman face down (`rules.policeView`, `rules.js:335`) |
| 2. Patrolling the streets (`engine.js:147`) | The police place 5 real and 2 fake tokens (`rules.patrolPositions`, `rules.js:72`) | Jack sees seven tokens; he learns which are real only by revealing them (`rules.patrolKnowledge`, `rules.js:282`) |
| 3. The victims are chosen (`engine.js:151`) | Marked women become Wretched; the others leave | The police now see the Wretched (`rules.js:336`) |
| 4–6. Blood on the streets, Suspense grows, Ready to kill | Jack kills or waits. Each wait gives one more move tonight (I gives 15 moves, V gives 19). The police then move every Wretched one step, and Jack reveals one token; a fake one leaves | A Wretched can't pass a token or end next to one, real or fake (`rules.wretchedMoves`, `rules.js:151`) |
| 8. Alarm whistles (`engine.js:202`) | Real tokens become policemen; fakes leave | |

Two facts about this board set what the mechanics can do:

- **There are as many women as legal circles.** The game has 8, 7, 6 and 4 women for 8, 7, 6 and 4 red circles left, so they fill every red circle unless an earlier victim was killed off one (`rules.js:12`, `rules.targetCircles`). That only happens after a Wretched has been moved, so after Jack waited. With Strategic Jack and Jack AI v2 the women filled every legal circle on 100% of nights; with the baseline, on 62–66%.
- **Patrols start far from the murders.** On night 1 the patrols go on the 7 yellow-bordered crossings, exactly one per token. On later nights 5 tokens must go where the policemen ended, and 2 on free stations (`rules.js:72`). None of the 7 stations is within one police turn of a red circle: the nearest red circle is 1–2 walks from a station's circles. So right after a murder at a red circle, a patrol there can never be one turn from the victim. This rests on the 7 stations in the map data, which have not been checked against a printed board ([Known differences](game-rules.md#known-differences-from-the-physical-board)).

## 2. A. Fake Wretched (unmarked women): Jack's AI

| Question | Finding |
|---|---|
| A1. How are they placed? | Every Jack uses the baseline's rule (`js/ai/jack.js:26`): sort the legal red circles by how far their walk to the hideout is from 7 moves, then mark circles with a draw biased to the front of that list (`random.safeIndex(0.9, …)`, `jack.js:32`). The unmarked women go on random circles from the rest. Strategic Jack delegates to it (`strategic-jack.js:273`), and Jack AI v2 inherits Strategic Jack's preparation unchanged (`jack-v2.js:73`). Since the women usually fill every circle, the only real decision is which circles are marked. |
| A2. Real versus fake? | Only through the marking: the marked circles are the possible victims. Every later decision (waiting, victims, the reveal) looks only at the Wretched. Unmarked women never enter a decision. |
| A3. Misdirection? | No. The women's positions are fixed by the board (above). The police place patrols before the marking is known, and no police AI reads the women when placing, except v3, which treats every woman as a possible victim. |
| A4. Hideout, escape, police, deception? | Hideout distance only, through the 7-move rule. Jack ignores the police, even though on nights 2–4 he knows where 5 of the 7 tokens will go before marking (where the policemen ended). It ignores escape routes beyond distance and has no notion of deception value. The 7-move habit also leaks the hideout: the Wretched, revealed at phase 3, are mostly about 7 moves from it. No police AI uses that, and using it would mean modelling one programmed Jack. |
| A5. Differences between Jacks? | None in placing women. The Jacks differ only after it: waiting (baseline: a coin toss, `jack.js:44`; Strategic and v2: only when the best victim would leave fewer than 6 moves to spare, `strategic-jack.js:293`), victims (`jack.js:49` against `strategic-jack.js:306`) and the reveal (`jack.js:66` against `strategic-jack.js:327`). |
| A6. Deterministic, random or heuristic? | A heuristic with a seeded random draw. |
| A7. Information rules? | Respected. Jack's view holds his own marked women and the tokens, with `real` set only once revealed (`rules.js:282`). The police's view shows the women face down and the Wretched only from phase 3 (`rules.js:335–336`). |

## 3. B. Fake patrols: the Detective AI

| Question | Finding |
|---|---|
| B1. How are they placed? | `placePatrols` (`js/ai/police.js:94`) ranks the allowed crossings by how many red circles are within one police turn (`nearRed`). That is 0 for every station, so the ranking is the stations' fixed order. **Night 1:** the first five are real and the last two fake, the same pair in every game. **Nights 2–4:** the five crossings where policemen ended are the real tokens; the fakes go on the two free stations (`police.js:105–106`). |
| B2. Fakes treated differently? | Yes, but only by being ignored. Real tokens become the starting policemen. Fakes count in nothing the police value; they matter only through the rules (Wretched movement, Jack's reveals). The Wretched are moved towards the real tokens (`police.js:130–154`). |
| B3. Used to steer Jack's murder or route? | No AI places fakes for that. They can only steer Jack through Wretched movement (any token blocks it) and through Strategic Jack's victim valuation, which counts unrevealed tokens as possibly real (`strategic-jack.js:277`). With the stations out of reach of the red circles, that valuation never changed: with fakes revealed by an oracle, 0 of 137 victim choices changed. In 40 games of Strategic Jack against v3, 36 of 483 Wretched at the murder were within one turn of any token, and all 36 were within one turn of a real one. |
| B4. Opportunity cost of real versus fake? | Not weighed by the original police or v2. v3's `containPatrols` (`police.js:107`) is the only trade-off: it makes a station's token real instead of a policeman's position when that closes at least 20% more of the night's containment threat. It did so on 2–10 of 165–264 later nights, depending on the Jack. |
| B5. Strategic use by v2 or v3? | v2 uses the original's fixed rule. v3 uses the real/fake choice as a positioning lever for containment, not as deception. |
| B6. Does Jack react sensibly? | His information use is correct, but shallow. Strategic Jack treats unrevealed tokens as possibly real. He reveals the token that threatens the most Wretched, but only after waiting, which he never does. The baseline waits about one night in two and reveals at random. No Jack infers fakes from public facts: that the fakes sit on the free stations, or from the Wretched's moves. |

## 4. C. How the two interact

**Each side decides blind.** Jack marks women before the patrols exist. The police choose their fakes before the marking is revealed. The only feedback is the wait cycle (phases 4–6): Jack waits, the police move the Wretched, Jack reveals one token. Only the baseline enters it.

| Question | Finding |
|---|---|
| Can Jack use fake Wretched to induce a poor deployment? | Not on this board. The women's positions carry no information, and 5 of 7 token positions are forced. The 2 free ones are stations, which reach no red circle. |
| Can the police use uncertainty about fakes to influence Jack? | Only through Jack's victim and waiting decisions. With the stations far from the red circles and Jacks that don't wait, it never did. |
| Does the wait cycle leak? | Yes, from the police. Their Wretched moves go towards the real tokens. On the baseline's wait nights against v3, Jack's own reveals narrow the 21 possible real/fake choices to 8.5. The Wretched moves narrow them further, to 3.7, and identify every fake on 44 of 122 nights. A Jack who read this could choose a victim away from the real patrols. No Jack does. |

**Verdict:** both mechanics are implemented correctly and satisfy the rules, but create no meaningful strategic choice between the current AIs.

## 5. Measurements

All on seeds 490001–490100, new to this study, with 100 games per row, paired by seed. The full tables are in [`research/deception-audit/results/summary.md`](../research/deception-audit/results/summary.md).

| Bound | What changed | Effect |
|---|---|---|
| **Jack knows every fake** (`jack-oracle`), Strategic and Jack AI v2 against v2 and v3 | Jack's view marks every token real or fake | No decision changed. Jack wins: 21, 24, 63, 66, identical game by game |
| **Jack infers fakes by the public rule** (`jack-infer`: the tokens off the previous positions are fake) | The same, with a legal inference | Identical to the oracle (the rule is right on 96–100% of nights) |
| **Police know which women are marked** (`police-oracle`), v3 against three Jacks | The five real tokens chosen to cover the most marked women | The choice of fakes changed on 1 night of 979; results identical |
| **Police choose fakes at random** (`police-random`), v3 | Same seven crossings, random designation | Baseline: police win 12 games only with random, 9 only without (p = 0.66). Strategic: 15 against 20 (p = 0.50). Jack AI v2: 24 against 18 (p = 0.44). No significant difference either way |

The bounds say what perfect information would be worth against these opponents, and it is nothing measurable. They do not say the mechanics are worthless against a person who waits, reveals and watches the Wretched.

## 6. Weaknesses and missed opportunities

1. **Predictable police fakes:** the same night-1 pair in every game, and on later nights always the free stations. Exploitable by any observant Jack; harmless against the current AIs.
2. **Leaking Wretched moves:** moving the Wretched towards the real tokens tells a watching Jack which tokens are real.
3. **Jack never waits** (Strategic and v2). Waiting earns up to 4 extra moves and reveals tokens. The cost is that the police move his victims. That trade is unexplored. It is the largest missed opportunity in the preparation phase, and it belongs to Jack, not the detectives.
4. **Marking ignores the police:** on nights 2–4 Jack knows 5 of the 7 token positions before marking, but doesn't use them. Low value while the stations sit far from the red circles.
5. **The marking leaks the hideout** (the 7-move rule). Using that would be modelling one programmed Jack, which this extension rules out.
6. **The stations are unverified.** If the printed board has more yellow-bordered crossings, night 1 becomes a real choice and this audit's "worth nothing" may not hold.

## 7. Recommended improvements, ranked

| # | Improvement | Side | Expected value | Cost | Recommendation |
|---:|---|---|---|---|---|
| R1 | Preparation hygiene: vary which tokens are fake, and move the Wretched without revealing the real tokens (for example by containment, or towards all tokens) | Police | ~0 against the current Jacks (`police-random` shows no effect); positive against an observant opponent | Low: an off-by-default option, about 30 lines | Only if v4's final validation shows a patient, observant Jack exploiting the leak. Evaluate separately from v4's core |
| R2 | A patient, observant Jack: waits when safe, infers fakes from public facts | Jack (research opponent) | Makes R1 measurable; tests v4 against a strategy it hasn't seen | Low–medium, research only | **Include** as a counter-strategy in v4's final validation |
| R3 | Check the yellow-bordered crossings against a printed board | Data | Potentially large: decides whether the mechanics matter at all | No code | Recommended to the maintainer, outside this extension |
| R4 | Jack marks women away from the known token positions | Jack | Low on this board | Low | Not in a detective extension |
| R5 | Police infer the hideout from the marking | Police | Only against Jacks with the 7-move habit | Low | Rejected: models a programmed opponent |

## 8. Decision for this extension

The deficiencies are real, but **not significant enough to include in Detective AI v4's core**: no improvement can be measured against the existing opponents. Part 5 is therefore conditional:

- v4's final validation includes the patient, observant Jack (R2).
- If it exploits the police's predictability, R1 is added as a separate, off-by-default option, measured on its own.
- Otherwise, Part 5 closes with this audit.

## 9. Reproducing

```
node research/deception-audit/audit.js <jack> <police> <variant> 100 490001   # jack: baseline | strategic | jack-v2
node research/deception-audit/summary.js                                       # results/summary.md
```

Police are `original`, `v2` or `v3`. Variants are `normal`, `jack-oracle`, `jack-infer`, `police-random` or `police-oracle`. Each run is cached in `results/`, and runs in about 20 s on 4 cores. The 23 runs above took about 9 minutes.
