#!/bin/bash
# Confirmation for docs/detective-ai-v3.md: Detective AI v3 as selected (chosen on seeds
# 460001-460100) against Detective AI v2, on fresh seeds 470001-470100, the whole Jack portfolio; the uncoordinated
# variant on the short-return Jacks and Strategic Jack (about 8 minutes on 4 cores).
set -e
cd "$(dirname "$0")/../.."
from=470001; games=100
jacks="baseline strategic detour jack-v2 short-return short-return-all bgg-51-night4 bgg-134"
start=$(date +%s)
run() { [ -f "research/detective-v3/results/$1__$2__${from}-${games}.json" ] || node research/detective-v3/experiment.js $1 $2 $games $from; }
for jack in $jacks; do run $jack v2; run $jack v3; done
for jack in short-return short-return-all bgg-51-night4 strategic; do run $jack v3-uncoordinated; done
{
	for jack in $jacks; do
		case $jack in short-return|short-return-all|bgg-51-night4|strategic) list=v2,v3,v3-uncoordinated ;; *) list=v2,v3 ;; esac
		node research/detective-v3/summary.js $jack $games $from $list; echo
	done
	node research/detective-v3/pooled.js $from $games v3
	echo "Wall clock: $(( $(date +%s) - start )) s"
} > research/detective-v3/results/confirmation.md
cat research/detective-v3/results/confirmation.md
