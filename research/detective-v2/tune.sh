#!/usr/bin/env bash
# Tuning runs for Detective AI v2, on development seeds 300001-300300 only (never the evaluation seeds).
#   bash research/detective-v2/tune.sh           (first round: every part, on uniform and hybrid weights)
#   bash research/detective-v2/tune.sh round2    (second round: blocking weight, arrest threshold, cordon, on the hybrid)
set -e
cd "$(dirname "$0")/../.."
export RESEARCH_RESULTS=research/detective-v2/results/tuning
if [ "$1" != "round2" ]; then
for jack in strategic baseline detour; do
  for config in original uniform hybrid block uniform+block hybrid+block uniform+block+coordinate uniform+block+live \
                uniform+block+cordon uniform+block+coordinate+live+cordon uniform+block0.5 uniform+block2 \
                uniform+block+arrest0.15 uniform+block+arrest0.1; do
    node research/detective-v2/evaluate.js $jack $config 300 300001 > /dev/null
  done
done
echo done
fi
# Second round, on the hybrid (run after the first)
if [ "$1" = "round2" ]; then
  for jack in strategic baseline detour; do
    for config in hybrid+block0.5 hybrid+block2 hybrid+block+arrest0.15 hybrid+block+arrest0.1 hybrid+block+cordon; do
      node research/detective-v2/evaluate.js $jack $config 300 300001 > /dev/null
    done
  done
  echo done2
fi
