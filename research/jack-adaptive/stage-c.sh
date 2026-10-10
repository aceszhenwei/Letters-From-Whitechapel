#!/bin/sh
# Stage C of Study J3 (docs/jack-adaptive.md): held out, confirmatory, run once after PREREGISTRATION.md part 2.
# 400 paired games on seeds 594001-594400 against the four primary and the two held-out detectives.
cd "$(dirname "$0")/../.."
for police in original v2 v3 anti8 uniform+block v3-anti6; do
	for jack in strategic jack-v2 mixed safe-skip; do
		node research/jack-adaptive/experiment.js $jack $police 400 594001
	done
	node research/jack-adaptive/experiment.js matched $police 400 594001 '{"skipRate":0.12}'
done
