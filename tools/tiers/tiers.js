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
const code = ['js', 'tools/sim', 'tools/simulate.js', 'package.json'];
const research = code.concat(['research/detective-inference/lib.js', 'research/detective-inference/results-dir.js', 'research/detective-inference/police-diagnostics.js',
	'research/detective-inference/soundness.js', 'research/detective-inference/summarise.js',
	'research/detective-inference/hideout-weighting.js', 'research/detective-inference/hideout-calibration.js',
	'research/detective-inference/scenarios.js', 'research/detective-inference/growth.js',
	'research/detective-inference/compare-maps.js', 'research/detective-inference/run-all.sh',
	'research/detective-inference/fixtures']);
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
		description: 'Medium-scale evaluations on development seeds: 500 games per Jack, the original against the improved police, a soundness sample. Algorithmic changes to the AIs, the police or the deduction',
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
			{ name: 'medium-soundness', command: `node research/detective-inference/soundness.js 10 700001 > ${medium}/research/soundness.txt`, env: { RESEARCH_RESULTS: `${medium}/research` }, inputs: research, outputs: [`${medium}/research/soundness.txt`] }
		]
	},
	full: {
		description: 'Full research validation and the Jack AI evaluation: the detective study (run-all.sh) and the 5,000-game evaluations. Research milestones, and before publishing results',
		steps: [
			{ name: 'full-research', command: 'bash research/detective-inference/run-all.sh "$WHITECHAPELR_CLONE"', inputs: research, outputs: ['research/detective-inference/results/paired-comparisons.md'] },
			...[['baseline', 'deductive'], ['strategic', 'deductive'], ['baseline', 'random'], ['strategic', 'random']].map(([jack, police]) => ({
				name: `full-${jack}-${police}`, command: simulate(jack, police, 5000, 1, `experiments/${jack}-${police}`), inputs: code, outputs: [`experiments/${jack}-${police}.txt`]
			}))
		]
	}
};
