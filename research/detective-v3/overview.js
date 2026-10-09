// One table of Jack's win rate for every police configuration screened (results/screening-overview.md), with the
// pooled change in police wins against the short-return Jacks and the ordinary ones, against Detective AI v2.
//   node research/detective-v3/overview.js <first seed> <games> <police,...> <jack,...>
const fs = require('fs');
const path = require('path');
const { load } = require('./summary');
const [fromText, gamesText, polices, jacks] = process.argv.slice(2);
const from = Number(fromText); const games = Number(gamesText);
const list = jacks.split(',');
const short = list.filter((j) => j.startsWith('short') || j.startsWith('bgg'));
const ordinary = list.filter((j) => !short.includes(j));
const rate = (j, p) => load(j, p, games, from).filter((g) => g.result === 'jackWins').length / games;
const lines = [`Jack's win rate by police configuration, seeds ${from}-${from + games - 1}, ${games} games each`, '',
	'| Police | ' + list.join(' | ') + ' | Police wins vs v2: short-return | ordinary |', '|---|' + list.map(() => '---:').join('|') + '|---:|---:|'];
for (const p of polices.split(',')) {
	const d = (js) => (100 * js.reduce((s, j) => s + (rate(j, 'v2') - rate(j, p)), 0) / js.length);
	const sign = (x) => (x > 0 ? '+' : '') + x.toFixed(1);
	lines.push(`| ${p} | ` + list.map((j) => (100 * rate(j, p)).toFixed(0) + '%').join(' | ') + ` | ${p === 'v2' ? '' : sign(d(short))} | ${p === 'v2' ? '' : sign(d(ordinary))} |`);
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(__dirname, 'results', 'screening-overview.md'), lines.join('\n') + '\n');
