// Tables for docs/detective-ai-v2.md from the final evaluation (results/evaluation/v2-*.json): for each Jack and seed
// set, every police configuration against the original police (paired by seed, McNemar's exact test), with 95%
// intervals and the strategic outcomes; then v2 against each of its parts.
//   node research/detective-v2/compare.js
const fs = require('fs');
const path = require('path');
const resultsDir = require('../detective-inference/results-dir');
const { wilson } = require('../../tools/sim/summarise');

const dir = resultsDir;
const files = fs.readdirSync(dir).filter((f) => /^v2-.*\.json$/.test(f));
const runs = {};
for (const f of files) {
	const m = /^v2-(strategic|baseline|detour)-(.+)-(\d+)-(\d+)\.json$/.exec(f);
	if (!m) continue;
	const [, jack, config, from] = m;
	runs[`${jack}|${config}|${from}`] = JSON.parse(fs.readFileSync(path.join(dir, f)));
}
const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
function mcnemar(a, b) {
	const wonB = new Map(b.map((g) => [g.seed, g.result === 'jackWins']));
	let onlyA = 0; let onlyB = 0;
	for (const g of a) {
		if (!wonB.has(g.seed)) continue;
		const wa = g.result === 'jackWins'; const wb = wonB.get(g.seed);
		if (wa && !wb) onlyA++;
		if (!wa && wb) onlyB++;
	}
	let tail = 0;
	for (let k = 0; k <= Math.min(onlyA, onlyB); k++) tail += Math.exp(logChoose(onlyA + onlyB, k) - (onlyA + onlyB) * Math.log(2));
	return { onlyA, onlyB, p: Math.min(1, 2 * tail) };
}
const pct = (x) => (100 * x).toFixed(1) + '%';
const p = (x) => x < 1e-6 ? '< 10⁻⁶' : x.toPrecision(2);
const mean = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
// 'hybrid+block' is Detective AI v2 as shipped (WC.policeVariants.v2); the candidate with arrests at 15% was rejected
const configs = ['original', 'uniform', 'hybrid', 'block', 'uniform+block', 'hybrid+block', 'hybrid+block+coordinate', 'v2-candidate+arrest0.15'];
const final = 'hybrid+block';
const lines = [];
for (const from of ['1', '650001']) {
	for (const jack of ['strategic', 'baseline', 'detour']) {
		const original = runs[`${jack}|original|${from}`];
		if (!original) continue;
		lines.push(`### ${jack} Jack, seeds ${from}-${Number(from) + original.length - 1}`, '');
		lines.push('| Police | Jack wins (95% CI) | vs original: p | Police win by arrest | Jack out of moves (policeman next to his hideout) | Police wins on night 1/2/3/4 | Clues a game | Arrest attempts a game (successful) | Hideout weight guarded / turns guarding the true hideout |');
		lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
		for (const config of configs) {
			const run = runs[`${jack}|${config}|${from}`];
			if (!run) continue;
			const n = run.length;
			const wins = run.filter((g) => g.result === 'jackWins').length;
			const ci = wilson(wins, n);
			const test = config === 'original' ? '' : p(mcnemar(original, run).p);
			const arrests = run.filter((g) => g.result === 'arrested').length;
			const out = run.filter((g) => g.result === 'outOfMoves').length;
			const blocked = run.filter((g) => g.blockedAtHome).length;
			const nights = [1, 2, 3, 4].map((k) => run.filter((g) => g.result !== 'jackWins' && g.night === k).length).join('/');
			const attempts = run.reduce((s, g) => s + g.arrests, 0);
			const guarded = run.filter((g) => g.guarded !== null);
			lines.push(`| ${config === final ? '**hybrid+block = v2**' : config} | ${pct(wins / n)} (${pct(ci[0])}–${pct(ci[1])}) | ${test} | ${arrests} | ${out} (${blocked}) | ${nights} | ${mean(run.map((g) => g.clues)).toFixed(1)} | ${(attempts / n).toFixed(2)} (${pct(arrests / Math.max(1, attempts))}) | ${pct(mean(guarded.map((g) => g.guarded)))} / ${pct(mean(guarded.map((g) => g.guardedTrue)))} |`);
		}
		const v2 = runs[`${jack}|${final}|${from}`];
		if (v2) {
			lines.push('', `v2 against each part (paired): ` + configs.filter((c) => c !== final && runs[`${jack}|${c}|${from}`]).map((c) => {
				const r = mcnemar(runs[`${jack}|${c}|${from}`], v2);
				return `${c} ${r.onlyA}:${r.onlyB} (p ${p(r.p)})`;
			}).join('; '));
		}
		lines.push('');
	}
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(dir, 'comparison.md'), lines.join('\n') + '\n');
