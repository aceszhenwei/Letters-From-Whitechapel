#!/bin/bash
# The experiments of docs/human-strategy-literature.md, on seeds 440001-440100 (100 games per matchup; about 8
# minutes on 4 cores). Writes results/experiments.md.
set -e
cd "$(dirname "$0")/../.."
from=440001
games=100
start=$(date +%s)
# A run whose results file exists is not played again (delete results/*.json after changing code)
run() { [ -f "research/human-strategy/results/$1__$2__$from-$games.json" ] || node research/human-strategy/experiment.js "$1" "$2" $games $from; }
# E1, E2: the forum's kill-next-to-home schemes and their hideouts alone, against the original police and v2;
# E3: a coach on the first move
for police in original v2; do
	for jack in jack-v2 jack-v2@51 bgg-51 jack-v2@134 bgg-134 coach-first; do run $jack $police; done
done
# E1b: only the scheme's last night (after E1 showed every loss of bgg-51 on night 3)
for police in original v2; do run bgg-51-night4 $police; done
# E2b: the forum's counter to the 134 scheme (move the Wretched away from likely hideouts)
for jack in jack-v2@134 bgg-134 jack-v2; do run $jack v2-wretched-away; done
# E4: detectives who expect Jack AI v2's detours
for jack in strategic detour jack-v2; do run $jack v2-detour-aware; done
run strategic v2
run detour v2
out=research/human-strategy/results/experiments.md
{
	for police in original v2; do
		node research/human-strategy/summary.js $police $games $from jack-v2,jack-v2@51,bgg-51,bgg-51-night4,jack-v2@134,bgg-134,coach-first jack-v2
		echo
		node research/human-strategy/summary.js $police $games $from jack-v2@51,bgg-51,bgg-51-night4 jack-v2@51
		echo
	done
	node research/human-strategy/summary.js v2-wretched-away $games $from jack-v2,jack-v2@134,bgg-134 jack-v2
	echo
	node research/human-strategy/summary.js v2 $games $from strategic,detour,jack-v2 jack-v2
	echo
	node research/human-strategy/summary.js v2-detour-aware $games $from strategic,detour,jack-v2 jack-v2
	echo
	echo "Wall clock: $(( $(date +%s) - start )) s"
} > "$out"
cat "$out"
