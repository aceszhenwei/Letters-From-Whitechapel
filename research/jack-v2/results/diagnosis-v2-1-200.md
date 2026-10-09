# Diagnosis: strategic vs detour against police "v2", seeds 1-200

## Outcomes

| Jack | Wins | Arrested (night 1/2/3/4) | Out of moves (1/2/3/4) | Trapped |
|---|---:|---:|---:|---:|
| strategic | 30.5% | 63 (0/19/26/18) | 76 (0/5/31/40) | 0 |
| detour | 65.0% | 42 (3/6/18/15) | 26 (0/4/6/16) | 2 |

## Each night: survival, how predictable the hideout was, and how the police stood

Hideout candidates and belief: Detective AI v2's view (hybrid weights) at the start of the night. Entry guarded: share of police turns ending with a policeman on a crossing next to the hideout. Detour: moves used beyond the walking distance from the crime scene, on nights he escaped.

| Jack | Night | Reached | Survived | Hideout candidates (median) | v2 belief on true hideout (mean) | Rank 1 | Entry guarded | Slack at start (mean) | Detour when escaped (mean) | Coaches / alleys used (of held) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| strategic | 1 | 200 | 100.0% | 187 | 0.01 | 0.0% | 3.4% | 9.4 | 0.4 | 60.2% / 11.8% |
| strategic | 2 | 200 | 88.0% | 78 | 0.04 | 9.5% | 22.2% | 9.5 | 1.3 | 76.5% / 20.3% |
| strategic | 3 | 176 | 67.6% | 28 | 0.12 | 18.2% | 57.7% | 8.3 | 1.6 | 74.1% / 50.0% |
| strategic | 4 | 119 | 51.3% | 15 | 0.23 | 36.1% | 77.8% | 8.3 | 2.6 | 90.8% / 67.2% |
| detour | 1 | 200 | 98.5% | 187 | 0.01 | 0.0% | 3.2% | 9.4 | 3.2 | 69.5% / 13.0% |
| detour | 2 | 197 | 94.4% | 105 | 0.01 | 3.0% | 9.9% | 9.6 | 3.5 | 79.7% / 21.6% |
| detour | 3 | 186 | 86.6% | 63 | 0.04 | 5.4% | 20.3% | 8.5 | 2.6 | 74.7% / 39.2% |
| detour | 4 | 161 | 80.7% | 45 | 0.06 | 7.5% | 30.6% | 8.7 | 3.3 | 95.0% / 52.2% |

## Lost nights by main cause

**strategic** (139 lost games)

- arrest: next to home: 48 (e.g. seeds 3, 4, 6, 8, 9)
- out of moves: walled off, ended next to home (<= 2): 42 (e.g. seeds 1, 2, 14, 15, 26)
- out of moves: walled off, ended far from home: 34 (e.g. seeds 7, 10, 11, 29, 30)
- arrest: low police share: 11 (e.g. seeds 21, 28, 67, 100, 126)
- arrest: exposed (police share >= 0.275): 4 (e.g. seeds 54, 115, 140, 173)
- When walled-off nights lost their last open route: after 4.3 moves on average, of 14.6 available; unused coaches at the end 0.41, alleys 0.12

**detour** (70 lost games)

- arrest: low police share: 20 (e.g. seeds 8, 10, 27, 43, 45)
- arrest: next to home: 18 (e.g. seeds 3, 14, 26, 31, 55)
- out of moves: walled off, ended far from home: 15 (e.g. seeds 46, 51, 54, 58, 85)
- out of moves: walled off, ended next to home (<= 2): 11 (e.g. seeds 17, 22, 30, 36, 52)
- arrest: exposed (police share >= 0.275): 4 (e.g. seeds 20, 39, 78, 163)
- trapped: 2 (e.g. seeds 23, 128)
- When walled-off nights lost their last open route: after 5.1 moves on average, of 14.8 available; unused coaches at the end 0.58, alleys 0.15

## Arrest risk: Strategic Jack's measured table against what happened

Each of Jack's moves, by the arrest chance his table predicts (fitted against the original police), and how often the police arrested him straight after it.

| Jack | Predicted risk | Moves | Predicted (mean) | Arrested next |
|---|---|---:|---:|---:|
| strategic | 0–0.01 | 3037 | 0.008 | 0.0% |
| strategic | 0.01–0.05 | 1253 | 0.015 | 3.1% |
| strategic | 0.05–0.2 | 72 | 0.122 | 12.5% |
| strategic | 0.2–0.5 | 23 | 0.386 | 30.4% |
| strategic | 0.5–1 | 26 | 0.694 | 30.8% |
| detour | 0–0.01 | 4307 | 0.008 | 0.0% |
| detour | 0.01–0.05 | 1089 | 0.015 | 2.0% |
| detour | 0.05–0.2 | 82 | 0.104 | 6.1% |
| detour | 0.2–0.5 | 34 | 0.330 | 32.4% |
| detour | 0.5–1 | 17 | 0.694 | 23.5% |

## The night before the loss: did the hideout give itself away?

| Jack | Lost on night | Games | v2 belief on true hideout at the start | Hideout candidates (mean) |
|---|---:|---:|---:|---:|
| strategic | 2 | 24 lost / 176 survived | 0.05 / 0.03 | 52.7 / 78.3 |
| strategic | 3 | 57 lost / 119 survived | 0.18 / 0.09 | 24.5 / 34.9 |
| strategic | 4 | 58 lost / 61 survived | 0.35 / 0.13 | 13.8 / 25.0 |
| detour | 2 | 11 lost / 186 survived | 0.02 / 0.01 | 81.3 / 104.9 |
| detour | 3 | 25 lost / 161 survived | 0.11 / 0.03 | 38.4 / 67.8 |
| detour | 4 | 31 lost / 130 survived | 0.14 / 0.04 | 27.9 / 55.2 |

## Hideouts

**strategic**: 100 different hideouts over 200 games; with 3 or more games, the worst: 46 (0/3), 239 (0/3), 256 (0/3), 259 (0/5), 288 (0/3); the best: 253 (2/3), 281 (2/3), 373 (2/3), 108 (3/4), 277 (3/3)

**detour**: 100 different hideouts over 200 games; with 3 or more games, the worst: 401 (0/3), 259 (1/5), 306 (1/4), 64 (1/3), 256 (1/3); the best: 253 (3/3), 269 (3/3), 316 (3/3), 325 (3/3), 353 (3/3)

Decision times: strategic mean 19.62 ms, p99 84.30 ms, max 188.04 ms; detour mean 16.20 ms, p99 70.73 ms, max 136.98 ms
