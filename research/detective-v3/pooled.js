// Pooled comparison for the decision rule of compare.sh: police wins against each Jack family, every candidate against
// Detective AI v2, paired by (Jack, seed).
//   node research/detective-v3/pooled.js <first seed> <games> [police, default v3-patrols,v3-E10]
const { load } = require('./summary');
const { mcnemar } = require('../jack-v2/summary');
const [fromText, gamesText, list] = process.argv.slice(2);
const from = Number(fromText); const games = Number(gamesText);
const families = {
	ordinary: ['baseline', 'strategic', 'detour', 'jack-v2'],
	'short-return': ['short-return', 'short-return-all', 'bgg-51-night4', 'bgg-134'],
	// The family without the 134 scheme, which plays the same game every time and would dominate the pool
	'short-return without 134': ['short-return', 'short-return-all', 'bgg-51-night4']
};
const police = (list || 'v3-patrols,v3-E10,v3-N3a10,v3-N3-ending30').split(',');
const lines = ['Pooled police wins, paired by Jack and seed, against v2', '', '| Family | Police | Police wins | v2 | Difference (points) | Only this / only v2 (p) |', '|---|---|---:|---:|---:|---:|'];
for (const [family, jacks] of Object.entries(families)) {
	const pool = (p) => jacks.flatMap((j) => load(j, p, games, from).map((g) => ({ seed: j + ':' + g.seed, result: g.result === 'jackWins' ? 'lost' : 'jackWins' })));
	const ref = pool('v2');
	const refWins = ref.filter((g) => g.result === 'jackWins').length;
	for (const p of police) {
		const g = pool(p);
		const wins = g.filter((x) => x.result === 'jackWins').length;
		const t = mcnemar(g, ref);
		lines.push(`| ${family} | ${p} | ${(100 * wins / g.length).toFixed(1)}% | ${(100 * refWins / ref.length).toFixed(1)}% | ${(100 * (wins - refWins) / g.length).toFixed(1)} | ${t.onlyA} / ${t.onlyB} (${t.p < 0.001 ? t.p.toExponential(1) : t.p.toFixed(3)}) |`);
	}
}
console.log(lines.join('\n'));
