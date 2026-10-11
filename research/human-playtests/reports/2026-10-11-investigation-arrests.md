# Investigation: why Detective AI v3 never arrested in the first two human games

- **Date:** 2026-10-11 · **Tier:** investigation ([docs/playtests.md](../../../docs/playtests.md#investigations-targeted)) · **Methodology version:** 1
- **Games:** `g91d4014f17ae09e6`, `ga36125530c4b4076` (2)
- **Cohort:** 1.0.0 · whitechapel-fff8e378d715 · human Jack vs Detective AI v3 (Normal), both games
- **Commissioned:** by hand, once, as a test of the research workflow. Normally an investigation follows a triage report; these two games had not reached a batch (5).
- **Reproduce:** `node research/human-playtests/reports/2026-10-11-investigation-arrests.js` (per game), `--json` (every decision), `--baseline` (the comparison below, about 1½ minutes).

## Question

The person playing Jack escaped on all four nights in both games. In the 235 clue decisions the detectives made, every one was **search**; none was **arrest**. Was an arrest available and passed over (a **defect candidate**), or was there never a sound one?

## Method

- **Replay to every clue decision.** Each record is replayed through the engine (`WC.record.replay`, stopping just before the decision).
- **What the AI believed.** At each stop, the Detective AI v3 configuration is given the detectives' view (`WC.rules.policeView`, which holds only public information) and asked for its belief about where Jack is.
- **Compared with the truth:** where Jack actually was, which circles that policeman could arrest at, and how the AI ranked Jack's real location.
- **v3's rule:** a policeman arrests at the most likely circle he can reach only if its belief is at least `arrestAt` = 0.2; otherwise he searches.
- **Baseline:** the same measurements on 40 synthetic games, v3 against the computer's Jack (Jack AI v2 and Strategic Jack, 20 seeds each, 611001–611020).
- **No changes:** no record and no AI was changed.

## Results

**1. The records are consistent with v3.** At all 235 decisions, v3's rule makes the choice the record shows (0 disagreements).
- Jack's real location always had a non-zero belief (0 of 235 decisions excluded him).
- Nothing points to a deduction error or to the AI using hidden information.

**2. No arrest ever reached the threshold.**
- **Highest belief at any arrestable circle:** 0.099 in the first game and 0.133 in the second, against 0.2.
- **Jack within reach of an arrest:** once in 235 decisions.
  - **When:** second game, night 2, after Jack's 5th move, at 189, next to policeman 5.
  - **What the AI thought:** it gave 189 a belief of 0.004, ranked 49th of 129 possible locations.
  - **Judgement:** no reasonable detective would arrest there.
- **A lower threshold would not have helped.** Even at 0.1, the four arrests it would have triggered (all in the second game) were at circles Jack was not on.

**3. The police were close; the belief was diffuse.**

| Measure (all clue decisions) | Human Jack (2 games) | Jack AI v2 (20 games) | Strategic Jack (20 games) |
|---|---|---|---|
| Decisions | 235 | 2,405 | 1,935 |
| Jack within arrest reach | 1 (0.4%) | 24 (1.0%) | 41 (2.1%) |
| An arrestable circle at belief ≥ 0.2 | 0 | 21 | 31 |
| Arrests attempted · games ending in an arrest | 0 · 0 | 25 · 3 | 32 · 8 |
| Walks from the nearest policeman to Jack (median) | 2 | 2 | 2 |
| Possible locations (median) | 67 | 43 | 36 |
| Jack's rank among them (median, as a share) | 0.64 | 0.53 | 0.59 |
| Jack in the AI's top 10 | 12% | 40% | 39% |

- **Same distance:** the detectives stood as close to the human Jack as to the computer's Jacks (median 2 walks).
- **Wider uncertainty:**
  - the AI's set of possible locations was about half as large again (67 against 36–43);
  - the real location sat in its top 10 a third as often (12% against about 40%).
- **The human's play:**
  - Jack used every coach on the first night of both games (3 of 3) and an alley on most nights;
  - his nights were long in the second game (6–10 moves);
  - the person used the same opening both times (the same five women on night 1, the same night-3 double event at 22 and 232).

## Conclusion

| Finding | Kind |
|---|---|
| v3 never arrested because no arrest was ever likely: Jack was within reach once, at a location the AI rightly thought improbable. This is v3 working as designed, not a missed arrest | **Defect candidate: not confirmed.** Closed |
| Against this player, v3's belief stayed much more diffuse than against the computer's Jacks (top-10 share 12% against about 40%), while the police were just as close | **Pattern to watch.** Two games, one player: not a confirmed strategic weakness |

## Proposals

- **No change to v3**, and in particular not to `arrestAt`: these games give no evidence for one.
- **Recheck the pattern in later batches** by running this script on the batch's Human Jack games. It would become a candidate strategic weakness if, across several players and batches, human Jacks keep v3's belief clearly more diffuse than the computer's Jacks, especially through early coach use. Testing that would then need a targeted simulation (for example, a scripted coach-heavy Jack against v3).

## Limitations

- **Two games, very likely by one person,** with a repeated opening. Players' experience isn't recorded.
- **The baseline is synthetic:** computer Jacks with fixed seeds, against Developer Mode's "hard" detectives, which is the same Detective AI v3.
  - It is only a reference for scale, not an estimate of human or AI strength.
  - Its games also confirm police moves and review nights, which doesn't affect the AI's decisions.
- **Measured at clue decisions only,** not during the detectives' movement.
- **Distance measure:** "walks from the nearest policeman" is measured from the circles next to each policeman's crossing.
