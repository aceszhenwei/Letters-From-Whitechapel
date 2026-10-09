// Summaries for the waiting-against-containment study (docs/waiting-containment.md), from experiment.js's files.
//   node research/waiting-containment/summary.js <police> <seed sets, comma-separated, e.g. 570001-50,580001-200>
// Paired comparisons (exact McNemar, and the paired difference with a 95% interval), and the last night's mechanics
// for each Jack: how often he waited, where he killed, and how the night ended.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'results');
const [police = 'v3', sets = '570001-50,580001-200', ...pairs] = process.argv.slice(2);
const load = (jack, pol = police) => sets.split(',').flatMap((s) => {
	const file = path.join(dir, `${jack}__${pol}__${s}.json`);
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).games : [];
});
function mcnemar(a, b) {
	const m = a + b;
	let c = 1;
	let p = 0;
	for (let i = 0; i <= Math.min(a, b); i++) { p += c; c = c * (m - i) / (i + 1); }
	return Math.min(1, 2 * p / Math.pow(2, m));
}
function compare(label, A, B) {
	// A: the comparison; B: the baseline. Police win = Jack loses
	if (!A.length || A.length !== B.length) return;
	let a = 0;
	let b = 0;
	const diffs = A.map((g, i) => {
		const wa = g.result === 'jackWins' ? 1 : 0;
		const wb = B[i].result === 'jackWins' ? 1 : 0;
		if (wa && !wb) a++;
		if (wb && !wa) b++;
		return wa - wb;
	});
	const n = diffs.length;
	const mean = diffs.reduce((s, x) => s + x, 0) / n;
	const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
	const half = 1.96 * sd / Math.sqrt(n);
	console.log(`| ${label} | ${n} | ${(100 * A.filter((g) => g.result === 'jackWins').length / n).toFixed(1)}% | ${(100 * B.filter((g) => g.result === 'jackWins').length / n).toFixed(1)}% | ${a} / ${b} | ${(100 * mean).toFixed(1)} (${(100 * (mean - half)).toFixed(1)} to ${(100 * (mean + half)).toFixed(1)}) | ${mcnemar(a, b).toFixed(3)} |`);
}
console.log(`Police: ${police}; seeds ${sets}\n`);
console.log('| Comparison (Jack wins) | Games | First | Second | Wins only first / only second | Difference, points (95% CI) | Exact McNemar p |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
const list = pairs.length ? pairs : ['jack-v2-waiting:jack-v2', 'jack-v2-waiting-last:jack-v2', 'jack-v2-waiting-early:jack-v2', 'jack-v2-waiting:jack-v2-waiting-early'];
for (const pair of list) {
	const [x, y] = pair.split(':');
	const [jx, px] = x.split('@');
	const [jy, py] = y.split('@');
	compare(`${x} vs ${y}`, load(jx, px), load(jy, py));
}
console.log('\n| Jack | Last nights | Waited | Killed off a red circle | One walk from home | ... and closed at night start | Model weight 1 / 0.5 / 0 | Escaped | Escaped on the first move |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const jack of ['jack-v2', 'jack-v2-waiting', 'jack-v2-waiting-last', 'jack-v2-waiting-early']) {
	const nights = load(jack).map((g) => g.nights[3]).filter(Boolean);
	if (!nights.length) continue;
	const c = (f) => nights.filter(f).length;
	const pct = (k) => (100 * k / nights.length).toFixed(0) + '%';
	console.log(`| ${jack} | ${nights.length} | ${pct(c((n) => n.waits > 0))} | ${pct(c((n) => !n.red))} | ${pct(c((n) => n.oneWalk))} | ${c((n) => n.closedAtStart)} of ${c((n) => n.oneWalk)} | ${c((n) => n.modelWeight === 1)} / ${c((n) => n.modelWeight > 0 && n.modelWeight < 1)} / ${c((n) => n.modelWeight === 0)} | ${pct(c((n) => n.end === 'escaped'))} | ${c((n) => n.firstMove)} |`);
}
