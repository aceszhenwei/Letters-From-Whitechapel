Pre-registered criteria, stage C (seeds 594001-400), candidate safe-skip.

1. vs jack-v2, primary metric: +4.1 points (95% +1.6 to +6.7); needs ≥ +5.0 and the interval above 0: NOT MET
2. vs matched, primary metric: +3.1 points (95% +0.4 to +5.8); needs > 0 with the interval above 0: MET
3. no regression against any detective (none more than 5 points below jack-v2, none significantly worse): MET. original +6.5 (31/5, p 0.000); v2 +2.8 (40/29, p 0.228); v3 +4.5 (43/25, p 0.038); anti8 +2.8 (39/28, p 0.222); uniform+block +2.5 (37/27, p 0.260); v3-anti6 +5.5 (45/23, p 0.010)
4. adaptation: skip rate by detective original 14.3%, v2 11.9%, v3 11.4%, anti8 11.1%, uniform+block 11.1%, v3-anti6 10.9%; chi-square 10.9 on 5 df, p 0.053: NOT MET
5. cost: mean decision 13.5 ms against jack-v2's 13.0 ms, max 125 ms: MET

Recommendation by the pre-registered rule: B (keep as experimental).
