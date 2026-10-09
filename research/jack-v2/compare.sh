#!/bin/bash
# Phase 4 of the Jack v2 study (docs/jack-ai-v2.md): the controlled comparison on development seeds 420001-420200.
# Decision rules were fixed before this ran (docs/jack-ai-v2.md, "Controlled comparison"). Stored games are reused
# while their code is unchanged (run.js), so rerunning this is cheap.
set -e
cd "$(dirname "$0")/../.."
out=research/jack-v2/results/comparison.md
start=$(date +%s)
{
	node research/jack-v2/summary.js v2 200 420001 strategic,detour,cand-early-notlast,cand-early+blocked,cand-early-notlast+blocked detour
	echo
	node research/jack-v2/summary.js original 200 420001 strategic,detour,cand-early-notlast,cand-early-notlast+blocked detour
	echo
	node research/jack-v2/summary.js uniform+block 200 420001 strategic,detour,cand-early-notlast,cand-early-notlast+blocked detour
} > "$out"
echo "Wall clock: $(( $(date +%s) - start )) s" >> "$out"
cat "$out"
