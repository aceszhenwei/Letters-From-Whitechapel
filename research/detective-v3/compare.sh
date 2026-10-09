#!/bin/bash
# Controlled comparison for docs/detective-ai-v3.md: Detective AI v2 against the two advanced candidates, 100 games per
# matchup on fresh seeds 460001-460100, against the whole Jack portfolio (about 5 minutes on 4 cores).
# Decision rule, fixed before running: promote a candidate only if it raises the police's wins against the short-return
# family (short-return, short-return-all, bgg-51-night4, bgg-134; pooled, paired by seed) and lowers them against the
# ordinary family (baseline, strategic, detour, jack-v2; pooled) by no more than 3 points.
set -e
cd "$(dirname "$0")/../.."
from=460001; games=100
police="v2 v3-patrols v3-E10 v3-N3a10 v3-N3-ending30"
jacks="baseline strategic detour jack-v2 short-return short-return-all bgg-51-night4 bgg-134"
start=$(date +%s)
for jack in $jacks; do for p in $police; do
	[ -f "research/detective-v3/results/${jack}__${p}__${from}-${games}.json" ] || node research/detective-v3/experiment.js $jack $p $games $from
done; done
{
	for jack in $jacks; do node research/detective-v3/summary.js $jack $games $from ${police// /,}; echo; done
	node research/detective-v3/pooled.js $from $games
	echo "Wall clock: $(( $(date +%s) - start )) s"
} > research/detective-v3/results/comparison.md
cat research/detective-v3/results/comparison.md
