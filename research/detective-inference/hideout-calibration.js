// Are the police's hideout probabilities calibrated? At the start of each night from the second on, the deduction gives
// every possible hideout a probability (js/core/deduction.js, hideouts). For two weightings, the current one (as if
// Jack wandered at random) and a uniform one over the same candidates (as whitechapelR keeps them), this reports:
//   - a reliability table: of the candidates given probability in each band, how often was it the true hideout;
//   - the mean log score of the true hideout (higher is better) and its mean probability and rank.
// Uniform weights are calibrated by construction (the candidate set always holds the true hideout, so a night with
// n candidates gives each 1/n), which makes them the yardstick.
// Games are seeded and played as in tools/simulate.js (deductive police).
//   node research/detective-inference/hideout-calibration.js [games per Jack, default 300] [first seed, default 1]
const fs = require('fs');
const path = require('path');
const resultsDir = require('./results-dir');
const { WC, play } = require('./lib');

const games = Number(process.argv[2] || 300);
const from = Number(process.argv[3] || 1);
const bands = [0, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0001];
const choices = WC.rules.hideoutChoices();

function evaluate(jack) {
	const weightings = { current: [], uniform: [] }; // { p, truth } for every candidate, every night
	const scores = { current: [], uniform: [] }; // { logP, p, rank, candidates, night }
	for (let seed = from; seed < from + games; seed++) {
		const state = play({ jack, police: 'deductive', seed });
		const logs = state.police.map((n, i) => WC.rules.publicLog(state, i));
		for (let night = 1; night < state.jack.length; night++) {
			const weighted = WC.deduction.hideouts(logs.slice(0, night), choices);
			const keys = Object.keys(weighted);
			const uniform = Object.fromEntries(keys.map((k) => [k, 1 / keys.length]));
			for (const [name, belief] of [['current', weighted], ['uniform', uniform]]) {
				const truth = belief[state.base] || 0;
				for (const k of keys) weightings[name].push({ p: belief[k], truth: Number(k) === state.base });
				scores[name].push({
					logP: Math.log(Math.max(truth, 1e-12)), p: truth, night: night + 1, candidates: keys.length,
					rank: 1 + keys.filter((k) => belief[k] > truth).length + (keys.filter((k) => belief[k] === truth).length - 1) / 2 // Ties share the middle rank
				});
			}
		}
	}
	return { weightings, scores };
}

const mean = (v) => v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
const lines = [];
const out = {};
for (const jack of ['baseline', 'strategic']) {
	const { weightings, scores } = evaluate(jack);
	out[jack] = {};
	lines.push(`${jack} Jack, ${games} games from seed ${from} (deductive police), start of nights 2-4: ${scores.current.length} hideout beliefs`);
	for (const name of ['current', 'uniform']) {
		const s = scores[name];
		const table = [];
		for (let b = 0; b < bands.length - 1; b++) {
			const inBand = weightings[name].filter((c) => c.p >= bands[b] && c.p < bands[b + 1]);
			if (!inBand.length) continue;
			table.push({ band: `${bands[b]}-${Math.min(1, bands[b + 1])}`, candidates: inBand.length, meanP: mean(inBand.map((c) => c.p)), truthRate: inBand.filter((c) => c.truth).length / inBand.length });
		}
		out[jack][name] = { logScore: mean(s.map((x) => x.logP)), meanP: mean(s.map((x) => x.p)), rank: mean(s.map((x) => x.rank)), candidates: mean(s.map((x) => x.candidates)), table };
		lines.push(`  ${name} weights: log score ${out[jack][name].logScore.toFixed(2)}, mean P(true hideout) ${out[jack][name].meanP.toFixed(3)}, mean rank ${out[jack][name].rank.toFixed(1)} of ${out[jack][name].candidates.toFixed(1)}`);
		lines.push('    probability band: candidates, mean probability given -> how often it was the hideout');
		for (const row of table) lines.push(`    ${row.band.padEnd(12)} ${String(row.candidates).padStart(6)}  ${row.meanP.toFixed(3)} -> ${row.truthRate.toFixed(3)}`);
	}
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(resultsDir, 'hideout-calibration.txt'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(resultsDir, 'hideout-calibration.json'), JSON.stringify(out, null, 1));
