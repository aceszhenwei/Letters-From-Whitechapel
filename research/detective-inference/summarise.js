// Paired comparisons of the police experiments (results/police-*.json from police-diagnostics.js): for two runs on
// the same seeds, the games only one police variant won, and McNemar's exact test.
//   node research/detective-inference/summarise.js
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'results');
const load = (name) => {
	const file = path.join(dir, `police-${name}.json`);
	return fs.existsSync(file) ? new Map(JSON.parse(fs.readFileSync(file)).map((g) => [g.seed, g.result === 'jackWins'])) : null;
};
const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
function mcnemar(a, b) {
	let onlyA = 0; let onlyB = 0; let n = 0; let winsA = 0; let winsB = 0;
	for (const [seed, wonA] of a) {
		if (!b.has(seed)) continue;
		n++; winsA += wonA; winsB += b.get(seed);
		if (wonA && !b.get(seed)) onlyA++;
		if (!wonA && b.get(seed)) onlyB++;
	}
	const d = onlyA + onlyB;
	let tail = 0;
	for (let k = 0; k <= Math.min(onlyA, onlyB); k++) tail += Math.exp(logChoose(d, k) - d * Math.log(2));
	return { n, winsA, winsB, onlyA, onlyB, p: Math.min(1, 2 * tail) };
}
const pairs = [
	['strategic-deductive', 'strategic-deductive-block1', 'strategic Jack: police blocking (weighted hideouts)'],
	['strategic-deductive', 'strategic-deductive-block1-uniform', 'strategic Jack: police blocking (uniform hideouts)'],
	['strategic-deductive-block1', 'strategic-deductive-block1-uniform', 'strategic Jack: uniform vs weighted hideouts, both blocking'],
	['strategic-deductive', 'strategic-deductive-uniform', 'strategic Jack: uniform hideouts without blocking'],
	['strategic-deductive', 'strategic-deductive-arrest0.1', 'strategic Jack: arrest threshold 0.1'],
	['strategic-deductive', 'strategic-deductive-arrest0.05', 'strategic Jack: arrest threshold 0.05'],
	['strategic-deductive', 'strategic-random', 'strategic Jack: random police instead of deductive'],
	['baseline-deductive', 'baseline-deductive-block1', 'baseline Jack: police blocking (weighted hideouts)'],
	['baseline-deductive', 'baseline-deductive-block1-uniform', 'baseline Jack: police blocking (uniform hideouts)'],
	['baseline-deductive', 'baseline-random', 'baseline Jack: random police instead of deductive']
];
const lines = ['| Comparison (Jack wins: first run → second) | Seeds | Jack wins | Only the first run\'s Jack won | Only the second\'s | McNemar exact p |', '|---|---|---:|---:|---:|---:|'];
for (const set of ['1-500', '600001-500']) {
	for (const [a, b, label] of pairs) {
		const A = load(`${a}-${set}`); const B = load(`${b}-${set}`);
		if (!A || !B) continue;
		const r = mcnemar(A, B);
		lines.push(`| ${label} | ${set.replace('-500', '')}, ${r.n} games | ${(100 * r.winsA / r.n).toFixed(1)}% → ${(100 * r.winsB / r.n).toFixed(1)}% | ${r.onlyA} | ${r.onlyB} | ${r.p < 1e-6 ? '< 10⁻⁶' : r.p.toPrecision(2)} |`);
	}
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(dir, 'paired-comparisons.md'), lines.join('\n') + '\n');
