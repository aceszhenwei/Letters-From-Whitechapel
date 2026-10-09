#!/bin/bash
# Screening for docs/detective-ai-v3.md: candidates against the Jack portfolio, 30 games each on development seeds
# 450001-450030 (about 5 minutes on 4 cores). Runs whose results file exists are not replayed: delete
# results/*__450001-30.json after changing code. Writes results/screening.md.
set -e
cd "$(dirname "$0")/../.."
from=450001; games=30
police="v2 v3-patrols v3-A+patrols v3-B+patrols v3-C+patrols v3-B3+patrols v3-C3+patrols v3-D v3-D10 v3-D-night3 v3-E v3-E10 v3-N3 v3-N3x10 v3-N3-ending10 v3-N3-ending30 v3-N3a3 v3-N3a10 v3-N3a30"
jacks="short-return short-return-all bgg-51-night4 jack-v2 strategic detour"
start=$(date +%s)
for jack in $jacks; do for p in $police; do
	[ -f "research/detective-v3/results/${jack}__${p}__${from}-${games}.json" ] || node research/detective-v3/experiment.js $jack $p $games $from
done; done
{
	for jack in $jacks; do node research/detective-v3/summary.js $jack $games $from ${police// /,}; echo; done
	echo "Wall clock: $(( $(date +%s) - start )) s"
} > research/detective-v3/results/screening.md
cat research/detective-v3/results/screening.md
