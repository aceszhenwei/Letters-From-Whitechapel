#!/bin/sh
# Independent validation of strategic waiting (docs/jack-waiting.md, section 6), on seeds 560001-560300, which nothing
# in the study used before. Decided before running:
#   Primary (one test, alpha 0.05): Jack AI v2 with waiting wins more games than Jack AI v2 against Detective AI v3
#     (exact McNemar on paired seeds).
#   Secondary (reported, not tested for superiority): against v2 and the original police, its win rate is not lower by
#     more than 5 points (paired difference and its 95% interval); Strategic Jack with and without waiting against v3.
cd "$(dirname "$0")/../.."
for police in v3 v2 original; do
	for jack in jack-v2 jack-v2-waiting; do
		node research/jack-waiting/experiment.js $jack $police 300 560001
	done
done
for jack in strategic strategic-waiting; do
	node research/jack-waiting/experiment.js $jack v3 300 560001
done
node research/jack-waiting/summary.js 560001-300 > research/jack-waiting/results/validation.md
