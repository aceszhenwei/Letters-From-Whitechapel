// Paired comparisons of the police experiments (results/police-*.json from police-diagnostics.js): every police
// variant against the original deductive police on the same seeds, for each Jack, with McNemar's exact test (only
// seeds where one side's Jack won and the other's lost count). Writes results/paired-comparisons.md.
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

// Police variants: [file infix, description]. The improved police is blocking with uniform hideout weights
const variants = [
	['deductive-uniform', 'uniform hideout weights only'],
	['deductive-block1', 'blocking only (current weights)'],
	['deductive-block1-uniform', '**improved: blocking + uniform weights**'],
	['deductive-block0.5-uniform', 'improved, half the blocking weight'],
	['deductive-block2-uniform', 'improved, twice the blocking weight'],
	['deductive-arrest0.1', 'arrest threshold 0.1 instead of 0.2'],
	['deductive-arrest0.05', 'arrest threshold 0.05'],
	['random', 'random police']
];
const pct = (x) => (100 * x).toFixed(1) + '%';
const p = (x) => x < 1e-6 ? '< 10⁻⁶' : x.toPrecision(2);
const lines = ['| Jack | Seeds | Police (against the original deductive police) | Jack wins: original → variant | Only the original\'s Jack won | Only the variant\'s Jack won | McNemar exact p |', '|---|---|---|---:|---:|---:|---:|'];
for (const jack of ['strategic', 'baseline']) {
	for (const set of ['1-500', '600001-500']) {
		const original = load(`${jack}-deductive-${set}`);
		if (!original) continue;
		for (const [infix, label] of variants) {
			const variant = load(`${jack}-${infix}-${set}`);
			if (!variant) continue;
			const r = mcnemar(original, variant);
			lines.push(`| ${jack} | ${set.split('-')[0]}… (${r.n}) | ${label} | ${pct(r.winsA / r.n)} → ${pct(r.winsB / r.n)} | ${r.onlyA} | ${r.onlyB} | ${p(r.p)} |`);
		}
	}
}
// The two halves of the improvement against each other
lines.push('', '| Jack | Seeds | Comparison | Jack wins | Only the first\'s Jack won | Only the second\'s | McNemar exact p |', '|---|---|---|---:|---:|---:|---:|');
for (const jack of ['strategic', 'baseline']) {
	for (const set of ['1-500', '600001-500']) {
		const a = load(`${jack}-deductive-block1-${set}`); const b = load(`${jack}-deductive-block1-uniform-${set}`);
		if (!a || !b) continue;
		const r = mcnemar(a, b);
		lines.push(`| ${jack} | ${set.split('-')[0]}… (${r.n}) | blocking with current weights → with uniform weights | ${pct(r.winsA / r.n)} → ${pct(r.winsB / r.n)} | ${r.onlyA} | ${r.onlyB} | ${p(r.p)} |`);
	}
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(dir, 'paired-comparisons.md'), lines.join('\n') + '\n');
