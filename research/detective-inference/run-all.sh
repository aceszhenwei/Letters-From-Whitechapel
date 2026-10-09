#!/usr/bin/env bash
# Re-runs every experiment of the detective-inference study into results/ (deterministic: fixed seeds throughout).
#   bash research/detective-inference/run-all.sh [path to a whitechapelR clone]
# Without a clone, the whitechapelR columns of scenarios.js and growth.js are skipped. About an hour on 4 cores.
set -e
cd "$(dirname "$0")/../.."
R=research/detective-inference
CLONE="$1"
node $R/compare-maps.js > $R/results/map-comparison.txt

# Police: original, each part of the improvement, the blocking weight, arrest thresholds, random police
for jack in strategic baseline; do
  for args in "" "--uniformHideouts" "--blockWeight 1" "--blockWeight 1 --uniformHideouts" \
              "--blockWeight 0.5 --uniformHideouts" "--blockWeight 2 --uniformHideouts" "--arrestAt 0.1" "--arrestAt 0.05"; do
    node $R/police-diagnostics.js $jack deductive 500 1 $args > /dev/null
  done
  node $R/police-diagnostics.js $jack random 500 1 > /dev/null
  # Fresh seeds, never used while developing: the original, the improvement and its two halves, and random police
  for args in "" "--uniformHideouts" "--blockWeight 1" "--blockWeight 1 --uniformHideouts"; do
    node $R/police-diagnostics.js $jack deductive 500 600001 $args > /dev/null
  done
  node $R/police-diagnostics.js $jack random 500 600001 > /dev/null
done
cat $R/results/police-*-500.txt > $R/results/police-diagnostics.txt
node $R/summarise.js > /dev/null

# Inference
node $R/hideout-weighting.js 300 > /dev/null
node $R/hideout-calibration.js 300 > /dev/null
node $R/soundness.js 60 > $R/results/soundness.txt
node $R/scenarios.js $CLONE > /dev/null
if [ -n "$CLONE" ]; then node $R/growth.js "$CLONE" 8 > $R/results/growth.txt; fi
echo done
