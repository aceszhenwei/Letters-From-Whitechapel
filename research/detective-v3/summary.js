// Tables for docs/detective-ai-v3.md from experiment.js runs: each police configuration against one Jack on the same
// seeds, paired against a reference police (McNemar's exact test on the police's wins), with the study's measures.
//   node research/detective-v3/summary.js <jack> <games> <first seed> <police,police,...> [reference, default v2]
const fs = require('fs');
const path = require('path');
const { wilson } = require('../../tools/sim/summarise');
const { mcnemar } = require('../jack-v2/summary');

const load = (jack, police, games, from) => JSON.parse(fs.readFileSync(path.join(__dirname, 'results', `${jack}__${police}__${from}-${games}.json`)));
const pct = (x) => (isNaN(x) ? '-' : (100 * x).toFixed(1) + '%');
const p = (x) => (x < 0.001 ? x.toExponential(1) : x.toFixed(3));
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

function measures(g) {
	const nights = g.flatMap((x) => x.nights);
	const oneWalk = nights.filter((n) => n.oneWalk);
	return {
		jackWins: g.filter((x) => x.result === 'jackWins').length,
		arrested: g.filter((x) => x.result === 'arrested').length,
		outOfMoves: g.filter((x) => x.result === 'outOfMoves').length,
		trapped: g.filter((x) => x.result === 'trapped').length,
		lostByNight: [1, 2, 3, 4].map((k) => g.filter((x) => x.result !== 'jackWins' && x.night === k).length).join('/'),
		oneMove: nights.filter((n) => n.escaped && n.used === 1).length, // Nights Jack ended on his first move
		oneWalk: oneWalk.length, // Nights whose murder was one walk from the hideout
		closed: oneWalk.filter((n) => !n.open).length, // ... and a policeman closed that walk when the night began
		clues: mean(g.map((x) => x.nights.reduce((s, n) => s + n.clues, 0))),
		ms: mean(g.map((x) => x.policeMs.mean)), worst: Math.max(...g.map((x) => x.policeMs.worst))
	};
}

function table(jack, games, from, polices, reference = 'v2') {
	const ref = load(jack, reference, games, from);
	const lines = [
		`${jack} Jack, seeds ${from}-${from + games - 1}; police paired against ${reference}`,
		'',
		'| Police | Jack wins (95% CI) | Police wins only this / only ' + reference + ' (p) | Arrested | Out of moves | Lost on night 1/2/3/4 | Nights ended on move 1 | Murders one walk from home (walk closed at night start) | Clues a game | Police ms: mean / worst |',
		'|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
	];
	for (const police of polices) {
		const g = load(jack, police, games, from);
		const m = measures(g);
		const ci = wilson(m.jackWins, g.length);
		// Police wins paired: a police "wins" a game when Jack doesn't
		const flip = (games2) => games2.map((x) => ({ seed: x.seed, result: x.result === 'jackWins' ? 'lost' : 'jackWins' }));
		const t = police === reference ? '' : (({ onlyA, onlyB, p: q }) => `${onlyA} / ${onlyB} (${p(q)})`)(mcnemar(flip(g), flip(ref)));
		lines.push(`| ${police} | ${pct(m.jackWins / g.length)} (${pct(ci[0])}–${pct(ci[1])}) | ${t} | ${m.arrested} | ${m.outOfMoves} | ${m.lostByNight} | ${m.oneMove} | ${m.oneWalk} (${m.closed}) | ${m.clues.toFixed(2)} | ${m.ms.toFixed(1)} / ${m.worst.toFixed(0)} |`);
	}
	return lines.join('\n');
}

module.exports = { table, load, measures };
if (require.main === module) {
	const [jack, games, from, polices, reference] = process.argv.slice(2);
	console.log(table(jack, Number(games), Number(from), polices.split(','), reference));
}
