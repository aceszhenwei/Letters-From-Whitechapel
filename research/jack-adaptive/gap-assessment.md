# Study J3: research-gap assessment

Written before any game of the study. Sources: the reports linked from [the documentation index](../../docs/README.md#research-reports).

## What is established

| Finding | Evidence | Source |
|---|---|---|
| Hiding the hideout is what beats Detective AI v2: early detours take Strategic Jack from 32% to 68–70.5% | 200 paired games, p < 10⁻¹¹ | [Jack AI v2 §5](../../docs/jack-ai-v2.md#5-controlled-comparison) |
| Early detours cost a little against police that don't read route directness (−1.5 to −2 points against the original police and uniform blocking, not significant) | 200 games each | [Jack AI v2 §7, §10](../../docs/jack-ai-v2.md#10-limitations-and-future-work) |
| Not detouring on the last night is worth +2.5 against v2, +4 and +5 against the others | 13, 8 and 18 discordant games | [Jack AI v2 §5](../../docs/jack-ai-v2.md#5-controlled-comparison) |
| Against Detective AI v3, Jack AI v2 wins about 65–74%; v3's one demonstrated weakness is hideout inference | 100–200 games per study | [Detective AI v3](../../docs/detective-ai-v3.md), [Detective coordination and inference](../../docs/detective-study.md) |
| Hideout belief from route directness is about as good as any fixed weighting; learning a Jack's style from earlier nights did not help the police | 561 nights, log loss | [Detective coordination and inference §5](../../docs/detective-study.md#5-hideout-inference) |

## What was tried and rejected

| Mechanism | Result | Source |
|---|---|---|
| A planned waypoint detour (a different shape of deception) | As well hidden as early detours, but lost more nights to time | [Jack AI v2 §4](../../docs/jack-ai-v2.md#4-screening-the-prototypes) |
| Random choice among nearly-best moves (unpredictability) | No gain (28% against 34%) | Same |
| Estimating the way home around the policemen (containment awareness) | No gain against v2, −5.5 against the original police | [Jack AI v2 §5](../../docs/jack-ai-v2.md#5-controlled-comparison) |
| Strategic waiting | Small and uncertain gain (0.0 to +8 points across sets), kept as an option | [Strategic waiting](../../docs/jack-waiting.md), [Waiting against containment](../../docs/waiting-containment.md) |

## What is open

1. **Jack AI v2 was never validated on unseen seeds** ([§9](../../docs/jack-ai-v2.md#9-independent-validation-proposed-not-run)). Its gain over Detour Jack rests on 13 discordant games. Run here, unchanged, as its own pre-registered plan.
2. **Jack AI v2's deception is fixed in shape and extent.** The v2 report names the risk: police that expect "Jack starts by walking away" could recover what it hides. No such police were ever built, so the risk is unmeasured.
3. **Its deception is spent against every detective,** including those that don't read directness, where it costs a little. Whether Jack can tell, from what he sees, which kind of detective he faces has not been tested.
4. **Adaptation has never been separated from unpredictability.** The only unpredictability test (random near-best moves) changed move choice, not deception.

## Why this experiment

- It tests the one open mechanism the earlier work points to (deception chosen in response to the police), without repeating what was rejected: the shapes of deception are Jack AI v2's own rule at different extents, not a new waypoint planner, and no containment model or randomised move choice is added.
- It adds the missing opponent (police that model Jack AI v2's habit), built legally from the public record, so that a fixed policy's weakness can be measured instead of assumed.
- It includes the controls needed to attribute any gain: a random mix of the same extents, and the candidate's own extents at random with its frequencies.
- It runs Jack AI v2's outstanding validation, so the reference it is compared with is itself validated or its limits are known.
