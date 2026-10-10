// Paired comparison of each last-night variant with Detective AI v3 (docs/detective-study.md), from experiment.js's files.
//   node research/detective-study/summary.js <seed set, e.g. 590001-30> [jacks, comma-separated]
// Each cell: police wins with the variant against police wins with v3 out of the games, and in brackets the games only
// the variant won / only v3 won. Games are identical until the last night, so every difference comes from it.
const fs = require('fs');
const path = require('path');
const configs = require('./configs');
const jacks = require('./jacks');
const dir = path.join(__dirname, 'results');
const [set = '590001-30', jackList] = process.argv.slice(2);
const list = jackList ? jackList.split(',') : jacks.names;
const load = (jack, variant) => {
	const file = path.join(dir, `${jack}__${variant}__${set}.json`);
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).games : null;
};
const lines = [`Police wins on seeds ${set}: each variant against Detective AI v3 (games only the variant won / only v3 won).`, '',
	'| Variant | ' + list.join(' | ') + ' | All |', '|---|' + list.map(() => '---:').join('|') + '|---:|'];
const base = {};
list.forEach((j) => { base[j] = load(j, 'v3'); });
lines.push('| v3 (police wins) | ' + list.map((j) => base[j] ? `${base[j].filter((g) => g.result !== 'jackWins').length}/${base[j].length}` : '–').join(' | ') + ` | ${list.reduce((s, j) => s + (base[j] ? base[j].filter((g) => g.result !== 'jackWins').length : 0), 0)} |`);
for (const variant of Object.keys(configs.variants).filter((v) => v !== 'v3')) {
	let allOnly = 0;
	let allBase = 0;
	const cells = list.map((j) => {
		const games = load(j, variant);
		if (!games || !base[j]) return '–';
		let a = 0;
		let b = 0;
		games.forEach((g, i) => {
			const pv = g.result !== 'jackWins';
			const pb = base[j][i].result !== 'jackWins';
			if (pv && !pb) a++;
			if (pb && !pv) b++;
		});
		allOnly += a;
		allBase += b;
		return `${games.filter((g) => g.result !== 'jackWins').length} (${a}/${b})`;
	});
	if (cells.every((c) => c === '–')) continue; // Not run on this seed set
	lines.push(`| ${variant}${variant.startsWith('oracle') ? ' (ORACLE)' : ''} | ${cells.join(' | ')} | ${allOnly}/${allBase} |`);
}
const out = lines.join('\n') + '\n';
fs.writeFileSync(path.join(dir, `variants-${set}.md`), out);
console.log(out);
