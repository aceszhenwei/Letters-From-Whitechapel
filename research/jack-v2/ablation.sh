#!/bin/bash
# Phase 6 of the Jack v2 study (docs/jack-ai-v2.md): Jack AI v2 (js/ai/jack-v2.js) against its parts on the
# comparison seeds 420001-420200: the strategic Jack (no detours) and Detour Jack (detours on every night, the last
# included), against Detective AI v2, the original police and the uniform-blocking police. Stored games are reused
# while the code is unchanged (run.js).
set -e
cd "$(dirname "$0")/../.."
out=research/jack-v2/results/ablation.md
start=$(date +%s)
{
	for police in v2 original uniform+block; do
		node research/jack-v2/summary.js $police 200 420001 strategic,detour,jack-v2 detour
		echo
	done
} > "$out"
echo "Wall clock: $(( $(date +%s) - start )) s" >> "$out"
cat "$out"
