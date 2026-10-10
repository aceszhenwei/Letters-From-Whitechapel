#!/bin/sh
# Stage D of the Detective AI v3 study (docs/detective-study.md): the two legal last-night changes that did not lose in
# the exploration (doubled blocking weight; the gentler hybrid decline), against v3, 100 paired games on new seeds
# 591001-591100, against the Jacks where v3 loses most. About 10 minutes on 4 cores.
cd "$(dirname "$0")/../.."
for jack in jack-v2 strategic jack-v2-waiting short-return; do
	for variant in v3 block2 gentle; do
		node research/detective-study/experiment.js $jack $variant 100 591001
	done
done
