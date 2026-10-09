#!/bin/bash
# Ablation for docs/detective-ai-v3.md: Detective AI v3 without each of its components, 100 games per matchup on the
# comparison seeds 460001-460100, against two short-return and two ordinary Jacks (about 8 minutes on 4 cores).
set -e
cd "$(dirname "$0")/../.."
from=460001; games=100
police="v2 v3-patrols v3-N3a10 v3-no-coordination v3-no-patrols v3-no-neighbours v3-top-hideout v3-all-nights"
jacks="short-return bgg-51-night4 strategic jack-v2"
start=$(date +%s)
for jack in $jacks; do for p in $police; do
	[ -f "research/detective-v3/results/${jack}__${p}__${from}-${games}.json" ] || node research/detective-v3/experiment.js $jack $p $games $from
done; done
{
	for jack in $jacks; do node research/detective-v3/summary.js $jack $games $from ${police// /,}; echo; done
	echo "Wall clock: $(( $(date +%s) - start )) s"
} > research/detective-v3/results/ablation.md
cat research/detective-v3/results/ablation.md
