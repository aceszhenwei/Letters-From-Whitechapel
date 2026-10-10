Last-night interception, Detective AI v3, seeds 590001-30. REFEREE'S knowledge used for the analysis only.

| Jack | Last nights | Police won | v3's move cut (nights won / lost) | Nights lost | Unavoidable | Inference | Decision | Unknown | Lost nights where Jack still had a coach or alley |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| baseline | 8 | 4 | 3 / 0 | 4 | 0 | 3 | 0 | 1 | 4 |
| strategic | 23 | 11 | 11 / 2 | 12 | 0 | 4 | 3 | 5 | 12 |
| jack-v2 | 28 | 5 | 4 / 1 | 23 | 0 | 6 | 0 | 17 | 23 |
| detour | 28 | 7 | 5 / 1 | 21 | 0 | 6 | 0 | 15 | 21 |
| jack-v2-waiting | 26 | 7 | 5 / 2 | 19 | 0 | 6 | 0 | 13 | 19 |
| short-return | 15 | 2 | 1 / 0 | 13 | 0 | 7 | 0 | 6 | 13 |
| short-return-all | 16 | 6 | 6 / 1 | 10 | 0 | 9 | 0 | 1 | 10 |

First possible cut in some lost nights:

```
{"jack":"baseline","seed":590004,"verdict":"inference","remaining":14,"homeRank":10,"homeBelief":0.028,"jackBelief":0.111,"candidates":58}
{"jack":"baseline","seed":590018,"verdict":"inference","remaining":13,"homeRank":23,"homeBelief":0.016,"jackBelief":0.023,"candidates":59}
{"jack":"baseline","seed":590027,"verdict":"inference","remaining":9,"homeRank":12,"homeBelief":0.052,"jackBelief":0.007,"candidates":20}
{"jack":"strategic","seed":590001,"verdict":"decision","remaining":14,"homeRank":2,"homeBelief":0.08,"jackBelief":0.2,"candidates":60}
{"jack":"strategic","seed":590006,"verdict":"decision","remaining":14,"homeRank":3,"homeBelief":0.139,"jackBelief":0.25,"candidates":5}
{"jack":"strategic","seed":590009,"verdict":"decision","remaining":14,"homeRank":2,"homeBelief":0.249,"jackBelief":0.25,"candidates":11}
```
