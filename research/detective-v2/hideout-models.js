// Which way of weighting the possible hideouts should the police use? Compares the deduction's three weightings
// (js/core/deduction.js, hideouts: walk, uniform, hybrid) at the start of each night from the second on.
//   - The hybrid's two parameters (w, rho) are fitted on calibration seeds, pooled over three Jacks (baseline,
//     strategic, and the diagnostic detour Jack), so the fit can't favour one Jack's habits.
//   - Every model is then scored on held-out seeds, per Jack, per night, and by how many moves Jack had to spare on
//     the nights the police learnt from: log score of the true hideout (a proper scoring rule; higher is better),
//     its probability and rank, and calibration of the most confident candidates.
//   node research/detective-v2/hideout-models.js [fit games per Jack, default 150] [test games per Jack, default 300]
const fs = require('fs');
const path = require('path');
require('./jacks');
const resultsDir = require('../detective-inference/results-dir');
const { WC, play } = require('../detective-inference/lib');

const fitGames = Number(process.argv[2] || 150);
const testGames = Number(process.argv[3] || 300);
const jacks = ['baseline', 'strategic', 'detour'];
const choices = WC.rules.hideoutChoices();

// Every night-start belief situation: the escaped nights before it, the true hideout, and the spare moves
function situations(jack, from, games) {
	const out = [];
	for (let seed = from; seed < from + games; seed++) {
		const state = play({ jack, police: 'deductive', seed });
		const logs = state.police.map((n, i) => WC.rules.publicLog(state, i));
		const spare = logs.map((log, i) => {
			const crime = log.find((e) => e.type === 'crime');
			const moves = WC.rules.config.trackLength - (state.jack[i] ? state.jack[i].murderMove.slice(-1)[0] : 0);
			return crime ? moves - Math.min(...crime.scenes.map((s) => WC.board.distance(s, state.base))) : 0;
		});
		for (let night = 1; night < state.jack.length; night++) {
			const past = logs.slice(0, night).filter((log) => log.some((e) => e.type === 'escaped'));
			if (!past.length) continue;
			out.push({ jack, seed, night: night + 1, past, truth: state.base, spare: Math.min(...spare.slice(0, night)) });
		}
	}
	return out;
}

function score(list, options) {
	let logScore = 0; let p = 0; let rank = 0; let n = 0; const top = { given: 0, hit: 0, count: 0 };
	for (const s of list) {
		const belief = WC.deduction.hideouts(s.past, choices, options);
		const truth = belief[s.truth] || 0;
		const values = Object.values(belief);
		logScore += Math.log(Math.max(truth, 1e-12));
		p += truth;
		rank += 1 + values.filter((x) => x > truth).length + (values.filter((x) => x === truth).length - 1) / 2;
		n++;
		for (const [k, v] of Object.entries(belief)) {
			if (v >= 0.2) { top.count++; top.given += v; if (Number(k) === s.truth) top.hit++; }
		}
	}
	return { n, logScore: logScore / n, p: p / n, rank: rank / n, top: top.count ? { given: top.given / top.count, hit: top.hit / top.count, count: top.count } : null };
}

// Fit the hybrid on calibration seeds, pooled over the Jacks
const fit = jacks.flatMap((jack) => situations(jack, 900001, fitGames));
let best = null;
const grid = [];
for (const w of [0.25, 0.5, 0.75, 0.9]) {
	for (const rho of [0.3, 0.5, 0.7, 0.85]) {
		const perJack = jacks.map((jack) => score(fit.filter((s) => s.jack === jack), { weighting: 'hybrid', w, rho }).logScore);
		const pooled = perJack.reduce((a, b) => a + b, 0) / jacks.length; // Each Jack counts equally
		grid.push({ w, rho, pooled, worst: Math.min(...perJack) });
		if (!best || pooled > best.pooled) best = { w, rho, pooled };
	}
}
const uniformFit = jacks.map((jack) => score(fit.filter((s) => s.jack === jack), { weighting: 'uniform' }).logScore).reduce((a, b) => a + b, 0) / jacks.length;

const models = [['walk (current)', { weighting: 'walk' }], ['uniform', { weighting: 'uniform' }], [`hybrid (w ${best.w}, rho ${best.rho})`, { weighting: 'hybrid', w: best.w, rho: best.rho }]];
const test = jacks.flatMap((jack) => situations(jack, 1, testGames));
const lines = [`Hybrid fitted on seeds 900001-${900000 + fitGames} (${fit.length} beliefs, three Jacks weighted equally): best w ${best.w}, rho ${best.rho}, mean log score ${best.pooled.toFixed(3)} (uniform ${uniformFit.toFixed(3)})`, ''];
lines.push(`Held-out seeds 1-${testGames}: log score (higher is better) / P(true hideout) / mean rank / of candidates given 20% or more: how often the hideout`);
const rows = [];
const group = (label, filter) => {
	const subset = test.filter(filter);
	if (!subset.length) return;
	const cells = models.map(([name, options]) => {
		const r = score(subset, options);
		rows.push({ group: label, model: name, ...r });
		return `${r.logScore.toFixed(2)} / ${r.p.toFixed(3)} / ${r.rank.toFixed(1)} / ${r.top ? `${(100 * r.top.hit).toFixed(0)}% of ${r.top.count} (given ${(100 * r.top.given).toFixed(0)}%)` : '-'}`;
	});
	lines.push(`| ${label} (${subset.length}) | ${cells.join(' | ')} |`);
};
lines.push(`| Situation | ${models.map(([n]) => n).join(' | ')} |`, '|---|---|---|---|');
for (const jack of jacks) group(`${jack} Jack`, (s) => s.jack === jack);
for (const night of [2, 3, 4]) group(`night ${night}, all Jacks`, (s) => s.night === night);
group('few spare moves (under 6), all Jacks', (s) => s.spare < 6);
group('6-8 spare moves, all Jacks', (s) => s.spare >= 6 && s.spare <= 8);
group('9 or more spare moves, all Jacks', (s) => s.spare >= 9);
group('all', () => true);
console.log(lines.join('\n'));
fs.writeFileSync(path.join(resultsDir, 'hideout-models.txt'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(resultsDir, 'hideout-models.json'), JSON.stringify({ best, grid, rows }, null, 1));
