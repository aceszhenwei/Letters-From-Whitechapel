#!/bin/sh
# Stage B of Study J3 (docs/jack-adaptive.md): selection. The stage A candidates and references against the four
# primary detectives, 200 paired games on seeds 593001-593200. Results are reused when present.
cd "$(dirname "$0")/../.."
for police in original v2 v3 anti8; do
	for jack in strategic jack-v2 mixed adaptive adaptive-up safe-steer safe-skip; do
		node research/jack-adaptive/experiment.js $jack $police 200 593001
	done
done
