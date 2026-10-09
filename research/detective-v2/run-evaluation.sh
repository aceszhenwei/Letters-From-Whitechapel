#!/usr/bin/env bash
# The final evaluation of Detective AI v2 (docs/detective-ai-v2.md): each part of v2 switched on in turn, against
# three Jacks, on the evaluation seeds 1-500 and on fresh seeds 650001-650500 that nothing was tuned on.
#   bash research/detective-v2/run-evaluation.sh      (about 50 minutes on 4 cores)
set -e
cd "$(dirname "$0")/../.."
export RESEARCH_RESULTS=research/detective-v2/results/evaluation
for from in 1 650001; do
  for jack in strategic baseline detour; do
    for config in original uniform hybrid block uniform+block hybrid+block hybrid+block+coordinate v2; do
      node research/detective-v2/evaluate.js $jack $config 500 $from > /dev/null
    done
  done
done
node research/detective-v2/compare.js
echo done
