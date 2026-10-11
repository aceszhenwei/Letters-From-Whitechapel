# Investigation: do early coaches make Detective AI v3 lose track of Jack?

- **Date:** 2026-10-11 · **Tier:** investigation ([docs/playtests.md](../../../docs/playtests.md#investigations-targeted)) · **Methodology version:** 1
- **Commissioned by:** the [batch-1 triage](2026-10-11-batch-1.md), recommendation 1.
- **Games:** all 7 human games (already analysed, so this report records no games), and 1,800 seeded games between computer players.
- **The pattern being tested:** v3's belief about where Jack is stayed diffuse against people. Jack was among v3's 10 likeliest circles at 15% of its clue decisions, against about 40% against the computer Jacks. In every human game, all three of night 1's coaches were spent at the start of the night.
- **Question:** Does spending all three coaches early on night 1 significantly reduce v3's ability to track Jack? Does it explain the gap between people and the computer Jacks?
- **Reproduce:** `node research/human-playtests/reports/2026-10-11-investigation-coaches.js`:
  - `run <jack> <habit> 300 612001` for each of the 6 arms (about 4 minutes each on 4 cores);
  - then `summary` and `humans`.
  - Saved outputs: `results/coaches-summary.json`, `results/coaches-humans.json`. The per-game files are regenerated.

## 1. Answer

**No: the human night-1 coach habit doesn't reduce v3's ability to track Jack, and it doesn't explain the human gap.**

**On night 1:**
- **It widens the set of circles Jack could be on,** by a median of 17 to 23 circles.
- **But v3 places him no worse within that set.**
  - **Jack AI v2:** he was in v3's top 10 at 38% of decisions, against 41% without the habit (−3.1 points, 95% CI −6.3 to +0.2).
  - **Strategic Jack:** 38% against 31% (+7.8 points, CI +4.3 to +11.5). That is easier for the police, not harder.
- **The police got closer.** Jack was within a policeman's arrest reach about 3.5 to 7 times as often, and losses on night 1 rose from 6 to 13 (Jack AI v2) and from 0 to 13 (Strategic Jack) in 300 games.

**On nights 2–4** the night-1 habit changes nothing measurable: the intervals run from −0.9 to +3.8 points for the two Jacks.

**People are tracked far worse than any arm.** Under the same habit, the computer Jacks were in v3's top 10 on 38% of night-1 decisions; people were on **5%**. On nights 2–4 it was 28–42% for the computer Jacks against **21%** for people. So the coaches are not the cause of the diffuse belief, and the cause remains unknown.

**Two side findings** (about computer Jacks, not people):
- **Coaching early on every night does make v3 track worse,** by 9 to 13 points in the top 10 on nights 2–4. It also hides the hideout about as well as the people did.
  - **Night-4 rank of the true hideout in v3's belief:** 15 with the habit, against 2 (Strategic Jack) and 9 (Jack AI v2) without it, and a median of 15 for the people.
- **The habit swings Strategic Jack's wins a lot:**
  - **Strategic Jack:** from 26% to 50% (night 1) and 53% (every night);
  - **Jack AI v2:** no significant change (night 1), and −11 points (every night, p = 0.004), because it replaces his own detours.
  - **Why:** these are gains and losses in hiding the hideout, not in hiding where Jack stands.

**Classification:**
- **The hypothesis "early coaches cause the diffuse belief" is not confirmed:** it is contradicted for night 1.
- **The diffuse-belief pattern stays a pattern to watch,** with its cause still open (section 6).
- **No defect** and no confirmed strategic weakness.
- **No AI change is proposed or made.**

## 2. What was already known

| Known | Source |
|---|---|
| v3's position deduction is sound and nearly complete. Its belief splits weight equally between Jack's possible moves | [Detective inference study](../../../docs/detective-inference-study.md) |
| "Coach on the first move" made Jack AI v2 *worse* against v2 (55% against 76%, p = 0.002). Against an exact deduction more possible positions buy little | [Human strategy literature, E3](../../../docs/human-strategy-literature.md) |
| Strategic Jack "gives his hideout away with direct routes". Jack AI v2's early detours hide it | [Jack AI v2](../../../docs/jack-ai-v2.md) |
| The human figures (15% top 10; 59–67 possible circles) and the synthetic baseline (40 games, seeds 611001–611020) | [Investigation: arrests](2026-10-11-investigation-arrests.md), [batch 1](2026-10-11-batch-1.md) |

**New here:**
- the habit is isolated in a controlled comparison against v3;
- night 1 and the later nights are measured separately;
- the human games are split by night.

## 3. Method

**The human habit, measured from the records** (`humans`):

| | Night 1 | Night 2 | Night 3 | Night 4 |
|---|---:|---:|---:|---:|
| Coaches allowed | 3 | 2 | 2 | 1 |
| Coaches used (mean, 7 games) | 3.00 | 2.00 | 1.43 | 0.83 |
| Alleys used (allowed 2, 2, 1, 1) | 1.43 | 1.00 | 0.57 | 0.17 |
| Moves (mean) | 7.6 | 6.1 | 4.4 | 4.5 |

- **Timing:** on night 1, the coaches were moves 1 and 2 in all 7 games, and the third came by move 5 (2.4 coaches in a row from the start, on average).
- **Direction:** of the 21 night-1 coaches, 12 ended nearer home, 5 as near and 4 one or two walks farther.

**The habit as a policy** (`habitJack`). The computer Jack's own play, except on the nights the habit applies:
- **The rule:** each move from the first is a coach while he has one.
- **Which coach:** a random legal one, from its own seeded stream, that ends at most one walk farther from home and leaves at least 2 moves more than the walk home needs.
- **Exceptions:** when no coach qualifies, or a walk reaches home, his own move is played.

**The arms.** Two Jacks (the difficulty levels Hard = Jack AI v2 and Normal = Strategic Jack), each with three habits:

| Habit | What changes |
|---|---|
| `none` | The Jack as the game plays it (control) |
| `night1` | The habit on night 1 only (the question) |
| `every` | The habit on every night (people coached early on later nights too) |

**The police:** Detective AI v3, as the page builds it (`WC.policeVariants.v3`). Games are played as `tools/game-log/make-examples.js` plays them and kept as full records.

**Measures:** the earlier investigation's script (`study` in `2026-10-11-investigation-arrests.js`, unchanged), at every clue decision, as for the people:
- the possible circles;
- Jack's rank in v3's belief, and whether he is in its top 10;
- the walks from the nearest policeman's reach;
- whether he was arrestable.
- **Hideout:** the rank of the true hideout in v3's belief at each night's start.

**Seeds and design:**
- **Seeds:** 300 per arm, 612001–612300, new and listed in [docs/testing.md](../../../docs/testing.md#seeds).
- **Pairing:** the same seed gives the same opening and the same random streams. A game differs from its control only from Jack's first coach.

**Analysis:**
- **The measure:** Jack in v3's top 10 at night-1 clue decisions was chosen as the main measure before any game was run. It is the measure of the human reports.
- **Intervals:** differences in tracking are 95% intervals from resampling whole games (2,000 resamples, seeded), so each game's decisions stay together.
- **Win rates:** paired by seed, with an exact sign test on the discordant games.

**Not done:**
- No pre-registration file; the thresholds are stated here.
- No held-out set: nothing is being adopted.

## 4. Results

### Night 1: the question

| Jack | Habit | Possible circles (median) | Jack in top 10 | Jack's rank share (median) | Walks from reach (median) | Arrestable decisions | Night-1 losses |
|---|---|---:|---:|---:|---:|---:|---:|
| Jack AI v2 | none | 36 | 41.4% | 0.50 | 2 | 72 of 8,730 | 6 |
| Jack AI v2 | night 1 | **53** | 38.3% | 0.35 | 1 | 311 of 10,704 | 13 |
| Strategic Jack | none | 30 | 30.5% | 0.80 | 2 | 21 of 4,795 | 0 |
| Strategic Jack | night 1 | **53** | 38.3% | 0.35 | 1 | 311 of 10,704 | 13 |
| **People (7 games)** | (their own) | **65** | **5.2%** | 0.66 | 2 | 0 of 230 | 0 |

**A note on the identical rows.** With the habit on night 1, both Jacks give identical night-1 numbers, and that is expected:
- Jack AI v2 differs from Strategic Jack only by detours, and only in a night's first three moves (`js/ai/jack-v2.js`, `detourMoves`).
- Three coaches take those moves, so on such a night the two play the same game.

| Night 1, habit against none | Difference in top 10 (95% CI) | Difference in possible circles (95% CI) |
|---|---:|---:|
| Jack AI v2 | −3.1 points (−6.3 to +0.2) | +17 (+12 to +22) |
| Strategic Jack | **+7.8 points (+4.3 to +11.5)** | +23 (+20 to +28) |

**Reading:**
- **More circles are possible,** but v3 ranks Jack at least as high among them: his median rank share falls from 0.50 and 0.80 to 0.35.
- **The police stand closer:** median 1 walk from his circle, not 2.
- **Why the coaches cost Jack here:** each costs two of the night's moves and lands him in the middle of the board at once, nearer the policemen.

### Nights 2–4, and the habit on every night

| Jack | Habit | Possible circles, nights 2–4 | Jack in top 10, nights 2–4 | Difference in top 10 from none (95% CI) | Night-4 hideout rank (median) | Night-4 hideout belief (median) |
|---|---|---:|---:|---:|---:|---:|
| Jack AI v2 | none | 50 | 40.8% | | 9 | 0.035 |
| Jack AI v2 | night 1 | 49 | 42.0% | +1.2 (−0.9 to +3.2) | 11 | 0.031 |
| Jack AI v2 | every | **84** | **28.1%** | **−12.8 (−14.7 to −10.8)** | 15 | 0.022 |
| Strategic Jack | none | 45 | 36.6% | | **2** | 0.140 |
| Strategic Jack | night 1 | 41 | 38.3% | +1.7 (−0.5 to +3.8) | 4 | 0.085 |
| Strategic Jack | every | **84** | **28.1%** | **−8.6 (−10.6 to −6.5)** | 15 | 0.022 |
| **People** | (their own) | 60 | **20.6%** | | **15** (6 games) | 0.036 |

The people's night-4 hideout ranks, game by game: 5, 10, 14, 16, 40 and 67 (the seventh game ended on night 3).

By night, for the people: 5%, 22%, 24%, 14%. For the control Jack AI v2: 41%, 50%, 40%, 33%.

### Outcomes (paired by seed, 300 games each)

| Jack | Habit | Jack wins | Wins only with the habit / only without | Difference | p |
|---|---|---:|---:|---:|---:|
| Jack AI v2 | none | 194 (64.7%) | | | |
| Jack AI v2 | night 1 | 204 (68.0%) | 69 / 59 | +3.3 points | 0.43 |
| Jack AI v2 | every | 160 (53.3%) | 50 / 84 | **−11.3 points** | **0.004** |
| Strategic Jack | none | 78 (26.0%) | | | |
| Strategic Jack | night 1 | 151 (50.3%) | 109 / 36 | **+24.3 points** | < 0.001 |
| Strategic Jack | every | 159 (53.0%) | 119 / 38 | **+27.0 points** | < 0.001 |

## 5. Interpretation

**What weakens v3 here is losing the hideout, not losing where Jack stands.**
- **Strategic Jack without the habit:** v3 ranks his true hideout 2nd by night 4 (median belief 0.14), so it can wait for him there. That is the known weakness of his direct routes.
- **Three coaches on night 1:** they make his night-1 route say little about where home is (night-4 rank 4).
- **Coaching early every night:** it buries the hideout (rank 15), as Jack AI v2's detours partly do.
- **Jack AI v2:** the habit only replaces his own detours, so it gains him nothing on night 1 and loses him 11 points when it replaces them every night. This agrees with the literature study's E3.

**Why the gap with people isn't explained:**
- **Night 1:** the habit leaves v3 tracking Jack *better* on night 1 (38% in the top 10), while the people sit at 5%. A night-1 coach habit can't be the cause of a figure it moves the other way.
- **Nights 2–4:** the people coached as often as the computer Jacks or a little more (2.0, 1.4 and 0.8 a night, against Jack AI v2's 1.5, 1.5 and 0.9). Yet they were tracked worse: 21% against 41%.
- **Only the every-night habit comes near them** (28%), and only by coaching more than the people did.

**Real uncertainty, or a weakness?**
- **Night 1:** v3 has no hideout information on night 1, and its deduction is sound. A diffuse belief there is uncertainty it can't avoid. It is not a weakness the coaches create.
- **The open question:** v3's *ranking* of the possible circles was badly wrong for people (5% in the top 10 with 65 circles possible). Its belief weights each possible move equally. If people choose routes that this assumption makes unlikely, v3's belief is miscalibrated for people.
- **Not shown:** this is a possible inference weakness, not a demonstrated one. It doesn't show that a better model exists, or that it would change a result.

## 6. Conclusions and proposals

**Conclusions:**
- **Not confirmed:** the coach habit doesn't cause v3's diffuse belief about where human Jacks stand.
- **Pattern to watch,** unchanged: v3 tracks human Jacks worse than computer ones, on every night (5% on night 1, 21% on nights 2–4, against 31–50%).
- **Also recorded, AI against AI:** early coaches every night hide a computer Jack's hideout from v3 about as well as people hide theirs (night-4 rank 15 for both).

**Proposals** (none applied; each would be its own assignment):
1. **A calibration check of v3's position belief on human records, offline.** At each clue decision, how much belief did v3's top 10 hold, against how often Jack was there? It needs no new games. A belief that is overconfident for people would point at the equal-split move model as the cause of the gap. This is the next step for this pattern, before any AI change.
2. **If calibration fails:**
   - estimate a human move model from the records (which kinds of move, towards or away from home or the police), and test it offline first;
   - with 7 games, this must wait for more games.
3. **For future Jack AI work** (not approved; noted only): Strategic Jack's direct routes cost him dearly against v3 (26% against 50% with three early coaches). Jack AI v2 already answers this with detours.
4. **Triage:** keep reporting the top-10 figure by night. Add the night-4 hideout rank, which this study shows separates hiding the hideout from hiding position.

## 7. Limitations

- **Seven human games,** probably from few players (repeated hideouts), all in one cohort. The human figures describe these games and are not estimates.
- **The habit is a policy, not a person.** Its coach destinations are random within limits. The people may choose them differently, for example away from the police; their coaches went nearer home more often than not (12 of 21).
- **Computer Jacks only** in the controlled arms. Nothing here measures v3 against people who use or avoid the habit.
- **The measures are taken at clue decisions only,** as in the earlier reports. Decisions are many per game and correlated, so the intervals resample whole games.
- **One police configuration** (v3), and no held-out seed set, because nothing is being adopted.
