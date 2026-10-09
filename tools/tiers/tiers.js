// The test tiers (docs/testing.md, "Test tiers"): what each runs, which files it depends on, and where it writes.
// A step whose `inputs` are unchanged since it last succeeded (same contents, same command) is skipped by
// tools/tiers/run-tier.js, unless it is marked `cache: false` or the run is forced.
//
// Seed ranges, kept apart so no experiment tunes on another's games:
//   1-5000         final evaluation (docs/jack-ai.md) and the detective study's main runs
//   300001-...     development (the medium tier uses these)
//   600001-600500  fresh-seed validation in the detective study
//   700001-700060  deduction soundness checks
//   800001-...     smoke tests
//   900001-...     calibration of the strategic Jack
//   410001-410100  Jack v2 study: screening; 420001-420200: controlled comparison and ablation
//   760001-761000  Jack v2 study: reserved for its independent validation (docs/jack-ai-v2.md)
const code = ['js', 'tools/sim', 'tools/simulate.js', 'package.json'];
const research = code.concat(['research/detective-inference/lib.js', 'research/detective-inference/results-dir.js', 'research/detective-inference/police-diagnostics.js',
	'research/detective-inference/soundness.js', 'research/detective-inference/summarise.js',
	'research/detective-inference/hideout-weighting.js', 'research/detective-inference/hideout-calibration.js',
	'research/detective-inference/scenarios.js', 'research/detective-inference/growth.js',
	'research/detective-inference/compare-maps.js', 'research/detective-inference/run-all.sh',
	'research/detective-inference/fixtures']);
const v2 = research.concat(['research/detective-v2/jacks.js', 'research/detective-v2/configs.js', 'research/detective-v2/evaluate.js',
	'research/detective-v2/compare.js', 'research/detective-v2/run-evaluation.sh']);
const jackV2 = v2.concat(['research/jack-v2']);
const detectiveV3 = jackV2.concat(['research/human-strategy', 'research/detective-v3']);
const medium = 'experiments/medium';
const diagnostics = (args) => `node research/detective-inference/police-diagnostics.js ${args}`;
const simulate = (jack, police, games, from, out) =>
	`node tools/simulate.js --jack ${jack} --police ${police} --games ${games} --from ${from} --out ${out}.json > ${out}.txt`;

module.exports = {
	fast: {
		description: 'Unit and regression tests, including the golden traces. Every change; CI runs it',
		steps: [{ name: 'npm-test', command: 'npm test', cache: false }]
	},
	smoke: {
		description: 'Small simulations: every Jack against every police, determinism, the research harness and the improved police. Any change to the AI, rules, engine, map or research scripts',
		steps: [{ name: 'smoke', command: 'node tools/tiers/smoke.js', cache: false }]
	},
	medium: {
		description: 'Medium-scale evaluations on development seeds: 500 games per Jack, the original against the improved police and Detective AI v2, a soundness sample. Algorithmic changes to the AIs, the police or the deduction',
		steps: [
			{ name: 'medium-strategic', command: simulate('strategic', 'deductive', 500, 300001, `${medium}/strategic-deductive`), inputs: code, outputs: [`${medium}/strategic-deductive.txt`] },
			{ name: 'medium-baseline', command: simulate('baseline', 'deductive', 500, 300001, `${medium}/baseline-deductive`), inputs: code, outputs: [`${medium}/baseline-deductive.txt`] },
			{
				name: 'medium-police',
				command: [
					'strategic deductive 300 300001', 'strategic deductive 300 300001 --blockWeight 1 --uniformHideouts',
					'baseline deductive 300 300001', 'baseline deductive 300 300001 --blockWeight 1 --uniformHideouts'
				].map(diagnostics).join(' && ') + ' && node research/detective-inference/summarise.js',
				env: { RESEARCH_RESULTS: `${medium}/research` }, inputs: research, outputs: [`${medium}/research/paired-comparisons.md`]
			},
			{
				name: 'medium-v2',
				command: ['strategic original', 'strategic v2', 'baseline original', 'baseline v2']
					.map((a) => `node research/detective-v2/evaluate.js ${a} 300 300001`).join(' && '),
				env: { RESEARCH_RESULTS: `${medium}/v2` }, inputs: v2, outputs: [`${medium}/v2/v2-baseline-v2-300001-300.txt`]
			},
			{
				// Jack AI v2 against its parts, 100 games each against Detective AI v2, on development seeds
				name: 'medium-jack-v2',
				command: `node research/jack-v2/summary.js v2 100 300001 strategic,detour,jack-v2 detour > ${medium}/jack-v2/summary.md`,
				env: { JACK_V2_RESULTS: `${medium}/jack-v2` }, inputs: jackV2, outputs: [`${medium}/jack-v2/summary.md`]
			},
			{
				// Detective AI v3 against v2, 30 games against a short-return Jack and Strategic Jack, on development seeds
				name: 'medium-detective-v3',
				command: ['short-return', 'strategic'].map((j) => ['v2', 'v3'].map((p) => `node research/detective-v3/experiment.js ${j} ${p} 30 300001`).join(' && ')).join(' && ') +
					` && (node research/detective-v3/summary.js short-return 30 300001 v2,v3 && node research/detective-v3/summary.js strategic 30 300001 v2,v3) > ${medium}/detective-v3.md`,
				inputs: detectiveV3, outputs: [`${medium}/detective-v3.md`]
			},
			{ name: 'medium-soundness', command: `node research/detective-inference/soundness.js 10 700001 > ${medium}/research/soundness.txt`, env: { RESEARCH_RESULTS: `${medium}/research` }, inputs: research, outputs: [`${medium}/research/soundness.txt`] }
		]
	},
	full: {
		description: 'Full research validation: the Detective AI v2 evaluation, the detective study (run-all.sh) and the Jack AI 5,000-game evaluations. Research milestones, and before publishing results',
		steps: [
			{ name: 'full-detective-v3', command: 'bash research/detective-v3/compare.sh && bash research/detective-v3/ablation.sh && bash research/detective-v3/confirm.sh', inputs: detectiveV3, outputs: ['research/detective-v3/results/confirmation.md'] },
			{ name: 'full-jack-v2', command: 'bash research/jack-v2/screen.sh && bash research/jack-v2/compare.sh && bash research/jack-v2/ablation.sh', inputs: jackV2, outputs: ['research/jack-v2/results/ablation.md'] },
			{ name: 'full-v2', command: 'bash research/detective-v2/run-evaluation.sh', inputs: v2, outputs: ['research/detective-v2/results/evaluation/comparison.md'] },
			{ name: 'full-research', command: 'bash research/detective-inference/run-all.sh "$WHITECHAPELR_CLONE"', inputs: research, outputs: ['research/detective-inference/results/paired-comparisons.md'] },
			...[['baseline', 'deductive'], ['strategic', 'deductive'], ['baseline', 'random'], ['strategic', 'random']].map(([jack, police]) => ({
				name: `full-${jack}-${police}`, command: simulate(jack, police, 5000, 1, `experiments/${jack}-${police}`), inputs: code, outputs: [`experiments/${jack}-${police}.txt`]
			}))
		]
	}
};
