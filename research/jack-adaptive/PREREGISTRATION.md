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

### After stage A (written before stage B was run)

**Stage A findings** (`results/stage-a.md`, exploratory, 100 games per matchup):
- The pressure signal does not tell the detectives apart: its distribution is the same against all four (median about
  −0.05, 10th–90th percentile about −0.37 to +0.37), so the pressure-adaptive Jack chose almost the same extents
  everywhere (about 40 / 42 / 18% none / v2 / long). No choice of thresholds can make the extents depend on the
  detective when the signal doesn't, so the thresholds stay as written (0.15, 0.02).
- Relaxing deception on low pressure costs 11–14 points against v2 and v3: low pressure follows from the deception
  working, not from a weak detective.
- `long` barely differs from `v2`: the 6-move reserve binds first.
- A second family was added in stage A (adaptation within the night): each detour step chosen by where the policemen
  stand now, `safe-steer` (a circle out of their reach when one exists) and `safe-skip` (no detour step when every
  away step is in reach). Neither beat Jack AI v2 (−2.3 and −2.5 points).

**Candidates for stage B:** `adaptive`, `adaptive-up`, `safe-steer`, `safe-skip`, with `jack-v2`, `mixed` and
`strategic` as references.

**Selection rule:** the candidate with the highest primary metric against `jack-v2` on the stage B seeds; on a tie
within 1 point, the simpler (fewer rules). It goes to stage C whatever its stage B result, so the held-out stage tests
the best the study found rather than nothing.

**Matched control:** for a pressure-adaptive candidate, `matched` uses its stage B frequencies of none / v2 / long; for
a detour-step candidate, `matched` skips detour steps at random at its stage B skip rate (or, for `safe-steer`, which
never skips, chooses its detour steps at random as Jack AI v2 does, which is `jack-v2` itself).

### After stage B (written before stage C was run)

**Stage B results** (`results/stage-b.md`, exploratory, 200 games per matchup), primary metric against `jack-v2`:
`safe-skip` +1.5 (95% interval −1.8 to +4.8), `safe-steer` +0.9, `adaptive-up` −0.1, `adaptive` −3.4, `mixed` −5.3,
`strategic` −18.4.

**Selected candidate:** `safe-skip` (highest primary metric). It takes Jack AI v2's detours, but each detour step only
to a circle the policemen can't reach on their next turn; when every away step is in reach, that move is not a detour.

**Matched control:** `matched` = Jack AI v2 that skips each detour step at random with probability **0.12**, the share of
detour opportunities `safe-skip` skipped in stage B (346 of 2,883, nights 1–3). It deceives as much as the candidate
but ignores where the policemen stand. Command: `experiment.js matched <police> 400 594001 '{"skipRate":0.12}'`.

**Stage C** (seeds 594001–594400, 400 games per matchup), run once: `strategic`, `jack-v2`, `mixed`, `safe-skip`,
`matched` against all six detectives. Criteria as in part 1, with `matched` as the control for criterion 2. Criterion 4
(adaptation is real) is measured for this candidate as: its skips happen only when every away step is within the
policemen's reach (by construction), and its skip rate differs between detectives (chi-square, p < 0.01).
