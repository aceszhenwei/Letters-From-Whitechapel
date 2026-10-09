#!/bin/bash
# Phase 7 of the Jack v2 study (docs/jack-ai-v2.md, "Independent validation"): Jack AI v2 against the strategic Jack
# and Detour Jack on seeds 760001-761000, which nothing in the study was developed, tuned or selected on.
# NOT RUN AUTOMATICALLY: it waits for approval (about 40 minutes on 4 cores). Resumable: stored games are reused.
set -e
cd "$(dirname "$0")/../.."
out=research/jack-v2/results/validation.md
start=$(date +%s)
{
	for police in v2 original uniform+block; do
		node research/jack-v2/summary.js $police 1000 760001 strategic,detour,jack-v2 strategic
		echo
		node research/jack-v2/summary.js $police 1000 760001 detour,jack-v2 detour
		echo
	done
} > "$out"
echo "Wall clock: $(( $(date +%s) - start )) s" >> "$out"
cat "$out"
