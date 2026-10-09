// A compact comparison of Jack policies from stored games (run.js): outcomes, and the diagnostic measures of the
// Jack v2 study, with paired comparisons against a reference policy on the same seeds.
//   node research/jack-v2/summary.js <police> <games> <first seed> <jack,jack,...> [reference, default strategic]
const { run } = require('./run');
const { wilson } = require('../../tools/sim/summarise');

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const fmt = (x, d = 2) => (isNaN(x) ? '-' : x.toFixed(d));
const pct = (x) => (isNaN(x) ? '-' : (100 * x).toFixed(1) + '%');
const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };

// McNemar's exact test on paired wins: games only a won, only b won, and the two-sided p
function mcnemar(a, b) {
	const won = new Map(b.map((g) => [g.seed, g.result === 'jackWins']));
	let onlyA = 0; let onlyB = 0;
	for (const g of a) {
		if (!won.has(g.seed)) continue;
		const wa = g.result === 'jackWins'; const wb = won.get(g.seed);
		if (wa && !wb) onlyA++;
		if (!wa && wb) onlyB++;
	}
	let tail = 0;
	for (let k = 0; k <= Math.min(onlyA, onlyB); k++) tail += Math.exp(logChoose(onlyA + onlyB, k) - (onlyA + onlyB) * Math.log(2));
	return { onlyA, onlyB, p: Math.min(1, 2 * tail) };
}

function measures(games) {
	const n = games.length;
	const wins = games.filter((g) => g.result === 'jackWins').length;
	const nights = (k) => games.flatMap((g) => g.nights.filter((x) => x.night === k));
	const early = games.flatMap((g) => g.nights.filter((x) => x.night < 3 && x.escaped));
	const decisions = games.flatMap((g) => g.decisions || []);
	const ms = decisions.map((d) => d.ms).sort((a, b) => a - b);
	const lost = games.filter((g) => g.result !== 'jackWins').map((g) => g.nights[g.nights.length - 1]);
	return {
		n, wins, ci: wilson(wins, n),
		arrested: games.filter((g) => g.result === 'arrested').length,
		outOfMoves: games.filter((g) => g.result === 'outOfMoves').length,
		trapped: games.filter((g) => g.result === 'trapped').length,
		lostByNight: [0, 1, 2, 3].map((k) => games.filter((g) => g.result !== 'jackWins' && g.night === k + 1).length),
		detour: mean(early.map((x) => x.detour)), // Nights 1-3 he escaped: moves beyond the direct way home
		belief4: mean(nights(3).map((x) => x.hideoutBelief)), // v2's belief on the true hideout at the start of night 4
		candidates4: mean(nights(3).map((x) => x.hideoutCandidates)),
		guarded: mean(nights(2).concat(nights(3)).map((x) => x.entryGuarded)), // Nights 3-4
		walledOff: lost.filter((x) => x.outcome === 'outOfMoves' && x.minBlockedSlack !== null && x.minBlockedSlack < 0).length,
		movesPerNight: mean(games.flatMap((g) => g.nights.filter((x) => x.escaped).map((x) => x.used))),
		coaches: mean(games.flatMap((g) => g.nights.map((x) => x.carriages))),
		alleys: mean(games.flatMap((g) => g.nights.map((x) => x.alleys))),
		msMean: mean(ms), msMax: ms[ms.length - 1] || 0, msP99: ms[Math.floor(0.99 * ms.length)] || 0
	};
}

async function summarise(police, games, from, jacks, reference = 'strategic') {
	const data = {};
	for (const jack of jacks.concat(jacks.includes(reference) ? [] : [reference])) data[jack] = (await run({ jack, police, games, from, quiet: true })).games;
	const lines = [
		`Police "${police}", seeds ${from}-${from + games - 1}, ${games} games each; paired against ${reference}`,
		'',
		'| Jack | Wins (95% CI) | vs ' + reference + ': only this / only ref (p) | Arrested | Out of moves (walled off) | Lost on night 1/2/3/4 | Detour, nights 1-3 | v2 belief on hideout, night 4 | Hideout candidates, night 4 | Entry guarded, nights 3-4 | Moves per escape | Coaches / alleys per night | Decision ms: mean / p99 / max |',
		'|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
	];
	for (const jack of jacks) {
		const s = measures(data[jack]);
		const t = jack === reference ? '' : (({ onlyA, onlyB, p }) => `${onlyA} / ${onlyB} (${p < 0.001 ? p.toExponential(1) : p.toFixed(3)})`)(mcnemar(data[jack], data[reference]));
		lines.push(`| ${jack} | ${pct(s.wins / s.n)} (${pct(s.ci[0])}–${pct(s.ci[1])}) | ${t} | ${s.arrested} | ${s.outOfMoves} (${s.walledOff}) | ${s.lostByNight.join('/')} | ${fmt(s.detour, 1)} | ${fmt(s.belief4)} | ${fmt(s.candidates4, 0)} | ${pct(s.guarded)} | ${fmt(s.movesPerNight, 1)} | ${fmt(s.coaches)} / ${fmt(s.alleys)} | ${fmt(s.msMean, 0)} / ${fmt(s.msP99, 0)} / ${fmt(s.msMax, 0)} |`);
	}
	return lines.join('\n');
}

module.exports = { summarise, measures, mcnemar };

if (require.main === module) {
	const [police, games, from, jacks, reference] = process.argv.slice(2);
	summarise(police, Number(games), Number(from), jacks.split(','), reference).then((text) => console.log(text));
}
