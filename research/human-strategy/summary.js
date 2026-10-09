// Tables for docs/human-strategy-literature.md from the runs of experiment.js: each Jack against a police
// configuration on the same seeds, paired against a reference Jack (McNemar's exact test), with 95% intervals.
//   node research/human-strategy/summary.js <police> <games> <first seed> <jack,jack,...> <reference>
const fs = require('fs');
const path = require('path');
const { wilson } = require('../../tools/sim/summarise');
const { mcnemar } = require('../jack-v2/summary');

function load(jack, police, games, from) {
	return JSON.parse(fs.readFileSync(path.join(__dirname, 'results', `${jack}__${police}__${from}-${games}.json`)));
}
const pct = (x) => (100 * x).toFixed(1) + '%';
const p = (x) => (x < 0.001 ? x.toExponential(1) : x.toFixed(3));

function table(police, games, from, jacks, reference) {
	const ref = load(reference, police, games, from);
	const lines = [
		`Police "${police}", seeds ${from}-${from + games - 1}; paired against ${reference}`,
		'',
		'| Jack | Wins (95% CI) | vs ' + reference + ': only this / only ref (p) | Arrested | Out of moves | Trapped | Lost on night 1/2/3/4 | Night 4 won in one move | Moves per escaped night |',
		'|---|---:|---:|---:|---:|---:|---:|---:|---:|'
	];
	for (const jack of jacks) {
		const g = load(jack, police, games, from);
		const wins = g.filter((x) => x.result === 'jackWins').length;
		const ci = wilson(wins, g.length);
		const t = jack === reference ? '' : (({ onlyA, onlyB, p: q }) => `${onlyA} / ${onlyB} (${p(q)})`)(mcnemar(g, ref));
		const count = (r) => g.filter((x) => x.result === r).length;
		const lost = [1, 2, 3, 4].map((k) => g.filter((x) => x.result !== 'jackWins' && x.night === k).length).join('/');
		const oneMove = g.filter((x) => x.result === 'jackWins' && x.lastMoves === 1).length;
		const esc = g.flatMap((x) => x.nights.filter((nn) => nn.escaped).map((nn) => nn.used));
		lines.push(`| ${jack} | ${pct(wins / g.length)} (${pct(ci[0])}–${pct(ci[1])}) | ${t} | ${count('arrested')} | ${count('outOfMoves')} | ${count('trapped')} | ${lost} | ${oneMove} | ${(esc.reduce((a, b) => a + b, 0) / Math.max(1, esc.length)).toFixed(1)} |`);
	}
	return lines.join('\n');
}

module.exports = { table, load };
if (require.main === module) {
	const [police, games, from, jacks, reference] = process.argv.slice(2);
	console.log(table(police, Number(games), Number(from), jacks.split(','), reference));
}
