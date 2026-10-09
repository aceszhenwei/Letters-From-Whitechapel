#!/bin/bash
# Phase 3 of the Jack v2 study (docs/jack-ai-v2.md): screening the candidate mechanisms (policies/candidates.js)
# against Detective AI v2 on development seeds 410001-410100. Stored games are reused while the code is unchanged.
set -e
cd "$(dirname "$0")/../.."
out=research/jack-v2/results/screening.md
start=$(date +%s)
{
	node research/jack-v2/summary.js v2 100 410001 strategic,detour,cand-waypoint,cand-waypoint-away,cand-waypoint-away-all,cand-blocked,cand-stochastic strategic
	echo
	node research/jack-v2/summary.js v2 100 410001 detour,cand-early-notlast,cand-early+blocked,cand-waypoint detour
} > "$out"
echo "Wall clock: $(( $(date +%s) - start )) s" >> "$out"
cat "$out"
