// Why does the hideout belief give the true hideout less weight than a uniform guess over the candidates?
// For every night Jack escaped, compares the weight the deduction's end-of-night distribution gives his hideout
// with the average weight of the circles it keeps, by how much of a detour his route was
// (moves used minus walking distance from the crime scene to the hideout).
//   node research/detective-inference/hideout-weighting.js [games per Jack, default 300] [first seed, default 1]
const fs = require('fs');
const path = require('path');
const resultsDir = require('./results-dir');
const { WC, _, play, stepsIn } = require('./lib');

const games = Number(process.argv[2] || 300);
const from = Number(process.argv[3] || 1);
const lines = [];
const out = {};
for (const jack of ['baseline', 'strategic']) {
	const byDetour = {};
	for (let seed = from; seed < from + games; seed++) {
		const state = play({ jack, police: 'deductive', seed });
		state.police.forEach((n, i) => {
			const log = WC.rules.publicLog(state, i);
			if (!log.some((e) => e.type === 'escaped')) return;
			const end = WC.deduction.track(log, {});
			const scene = _.last(state.jack[i].murder);
			const detour = Math.min(4, stepsIn(log) - WC.board.distance(scene, state.base));
			const ratio = (end.current[state.base] || 0) * end.size; // 1 = as likely as a uniform guess
			const b = byDetour[detour] = byDetour[detour] || { nights: 0, ratio: 0, lower: 0 };
			b.nights++;
			b.ratio += ratio;
			if (ratio < 1) b.lower++;
		});
	}
	out[jack] = byDetour;
	lines.push(`${jack} Jack, ${games} games: weight on the true hideout relative to a uniform guess, by detour (moves beyond the shortest walk; 4 = 4 or more)`);
	for (const [detour, b] of Object.entries(byDetour)) {
		lines.push(`  detour ${detour}: ${b.nights} nights, mean ratio ${(b.ratio / b.nights).toFixed(2)}, below uniform in ${(100 * b.lower / b.nights).toFixed(0)}%`);
	}
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(resultsDir, 'hideout-weighting.txt'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(resultsDir, 'hideout-weighting.json'), JSON.stringify(out, null, 1));
