# Study J3: pre-registration

Written before any game of the study was played (2026-10-10). Part 2 (thresholds, the selected candidate, the matched
control's frequencies) is filled in after the development and selection stages and **before** the held-out stage.
Nothing in part 1 changes after that. The report is [docs/jack-adaptive.md](../../docs/jack-adaptive.md).

## Part 1 (fixed now)

**Question.** Does choosing how much to deceive from the police's observed behaviour (adaptive deception) beat Jack AI
v2's fixed early detours, and does any gain come from the adaptation itself rather than from unpredictability?

**Jacks.** All are the unchanged Strategic Jack plus Jack AI v2's detour rule with a per-night extent (none, v2, long;
`jacks.js`); on the last night, none.
1. `strategic`: Strategic Jack (no deception)
2. `jack-v2`: Jack AI v2 (fixed early detours)
3. `mixed`: a random extent each night, ignoring the police (none / v2 / long, 1/3 each)
4. the adaptive candidate: an extent each night from the police's pressure on earlier nights (selected in stage B)
5. `matched`: the ablation: the adaptive candidate's extents at random, with the frequencies it used in stage B
   (as much deception on average, no reading of the police)

**Detectives.** Primary (development, selection and the primary metric): `original`, `v2` (Detective AI v2), `v3`
(Detective AI v3), `anti8` (built for this study: Detective AI v2 that forgives up to 8 moves of detour a night, a legal
model of Jack AI v2's habit). Held out, played only in stage C: `uniform+block`, `v3-anti6` (Detective AI v3 that
forgives 6 moves). Not one of them is tuned against a candidate.

**Seeds** (unused by any earlier study; [Testing](../../docs/testing.md#seeds)):
- A, development: 592001–592100 (100 games per matchup). Thresholds are set here.
- B, selection: 593001–593200 (200 games per matchup). The candidate is chosen here.
- C, held out: 594001–594400 (400 games per matchup). Confirmatory: run once, after part 2 is written.

**Primary metric.** The mean, over the four primary detectives with equal weights, of the paired per-seed difference in
Jack's win (candidate − reference), in points, with a 95% interval (normal, over the 400 seeds).

**Success criteria (stage C)**, all required for recommendation A:
1. Candidate − `jack-v2` ≥ +5.0 points on the primary metric, with the 95% interval above 0.
2. Candidate − `matched` > 0 on the primary metric with the 95% interval above 0 (adaptation, not unpredictability).
3. No regression: against no detective, primary or held out, is the candidate more than 5 points below `jack-v2`
   (point estimate), and no McNemar test against `jack-v2` shows it significantly worse (p < 0.05).
4. Adaptation is real: the candidate's mix of extents differs between detectives (chi-square on nights 2–3, p < 0.01).
5. Cost: the candidate's mean decision time is within 1.5× `jack-v2`'s and its maximum under 1 s.

Recommendation B (keep as experimental) if 1 holds against at least one detective without a significant regression
elsewhere, or the primary metric is positive but below 5 points, or 2 fails. C (reject) if the primary metric is not
positive. Exploratory results (stages A and B) are reported as such.

**Not in this study.** Strategic waiting (an independent variable with its own unresolved history) is off in every Jack.
Production difficulty levels are unchanged.

**Jack AI v2's independent validation.** Run as its own pre-registered plan (docs/jack-ai-v2.md §9,
`research/jack-v2/validate.sh`, seeds 760001–761000), unchanged.

## Part 2 (after stages A and B, before stage C)

*To be filled in.*
