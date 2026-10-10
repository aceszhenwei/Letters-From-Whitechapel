#!/bin/sh
# Stage A of Study J3 (docs/jack-adaptive.md): development. Every Jack against the four primary detectives, 100 paired
# games on seeds 592001-592100. The pressure thresholds are set from these games. Results are reused when present.
cd "$(dirname "$0")/../.."
for police in original v2 v3 anti8; do
	for jack in strategic jack-v2 fixed-long mixed adaptive adaptive-up adaptive-down; do
		node research/jack-adaptive/experiment.js $jack $police 100 592001
	done
done
