#!/bin/sh
# Stage C of the Detective AI v3 study (docs/detective-study.md): every opponent against v3 and each last-night variant,
# 30 paired games on seeds 590001-590030 (new). About 8 minutes on 4 cores; results are reused when present.
cd "$(dirname "$0")/../.."
for jack in baseline strategic jack-v2 detour jack-v2-waiting short-return short-return-all; do
	for variant in v3 coordinate cordon live block0 block2 uniform conservative oracle-hideout oracle-position oracle-both; do
		node research/detective-study/experiment.js $jack $variant 30 590001
	done
done
