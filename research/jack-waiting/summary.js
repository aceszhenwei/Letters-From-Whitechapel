// Summarises research/jack-waiting/results/*.json (experiment.js) into results/summary.md.
//   node research/jack-waiting/summary.js [seed range, e.g. 530001-50]
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'results');
const filter = process.argv[2];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && (!filter || f.includes(filter))).sort();
const mean = (list, f) => (list.length ? (list.reduce((s, x) => s + f(x), 0) / list.length) : NaN);
const lines = ['| Jack | Police | Seeds | Jack wins | Waits per night | Killed off a red circle | Moves after the murder | Kill site to hideout (walks) | Nights escaped | Arrested | Out of moves | Trapped | Detour moves per game | Reveals (fake) |', '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
for (const f of files) {
	const [jack, police, seeds] = f.replace('.json', '').split('__');
	const games = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).games;
	const nights = games.flatMap((g) => g.nights);
	const ends = (type) => games.filter((g) => g.result === type).length;
	const reveals = nights.flatMap((n) => n.reveals);
	lines.push(`| ${jack} | ${police} | ${seeds} | ${ends('jackWins')}/${games.length} | ${mean(nights, (n) => n.waits).toFixed(2)} | ${(100 * mean(nights, (n) => (n.red ? 0 : 1))).toFixed(0)}% | ${mean(nights, (n) => n.moves).toFixed(1)} | ${mean(nights, (n) => n.home).toFixed(1)} | ${nights.filter((n) => n.end === 'escaped').length}/${nights.length} | ${ends('arrested')} | ${ends('outOfMoves')} | ${ends('trapped')} | ${mean(games, (g) => g.detours).toFixed(1)} | ${reveals.length} (${reveals.filter((r) => r === 'fake').length}) |`);
}
console.log(lines.join('\n'));

// Paired comparisons: each Jack with the waiting policy (or a forced number of waits) against the same Jack without it
function mcnemar(a, b) {
	const m = a + b;
	let c = 1;
	let p = 0;
	for (let i = 0; i <= Math.min(a, b); i++) {
		p += c;
		c = c * (m - i) / (i + 1);
	}
	return Math.min(1, 2 * p / Math.pow(2, m));
}
function wilson(k, n) {
	const z = 1.96;
	const p = k / n;
	const d = 1 + z * z / n;
	const c = p + z * z / (2 * n);
	const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
	return [(c - r) / d, (c + r) / d].map((x) => (100 * x).toFixed(1)).join('–');
}
const paired = ['', '| Jack | Police | Seeds | Without | With | Wins only with | Only without | Exact McNemar p | Win rate with (95% CI) |', '|---|---|---|---:|---:|---:|---:|---:|---|'];
for (const f of files) {
	const [jack, police, seeds] = f.replace('.json', '').split('__');
	const m = /^(jack-v2|strategic)-(waiting.*|wait\d.*)$/.exec(jack);
	if (!m) continue;
	const baseFile = path.join(dir, `${m[1]}__${police}__${seeds}.json`);
	if (!fs.existsSync(baseFile)) continue;
	const A = JSON.parse(fs.readFileSync(baseFile, 'utf8')).games;
	const W = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).games;
	let onlyWith = 0;
	let onlyWithout = 0;
	W.forEach((g, i) => {
		const w = g.result === 'jackWins';
		const a = A[i].result === 'jackWins';
		if (w && !a) onlyWith++;
		if (a && !w) onlyWithout++;
	});
	const wins = W.filter((g) => g.result === 'jackWins').length;
	paired.push(`| ${jack} | ${police} | ${seeds} | ${A.filter((g) => g.result === 'jackWins').length}/${A.length} | ${wins}/${W.length} | ${onlyWith} | ${onlyWithout} | ${mcnemar(onlyWith, onlyWithout).toFixed(3)} | ${wilson(wins, W.length)}% |`);
}
console.log(paired.join('\n'));
