#!/bin/sh
# Calibration games for the waiting policy's escape table (docs/jack-waiting.md): both Jacks, made to wait 0 to 4 times
# a night, against every police, on seeds 540001-540050 (kept apart from the study's other seeds). Then fits the table.
cd "$(dirname "$0")/../.."
for police in original v2 v3; do
	for jack in jack-v2 jack-v2-wait1 jack-v2-wait2 jack-v2-wait3 jack-v2-wait4 strategic strategic-wait1 strategic-wait2 strategic-wait3 strategic-wait4; do
		node research/jack-waiting/experiment.js $jack $police 50 540001
	done
done
[ -f research/jack-waiting/fit.js ] && node research/jack-waiting/fit.js 540001-50
