// The pre-registered criteria of Study J3 (PREREGISTRATION.md), applied to the held-out stage C. No game is played.
//   node research/jack-adaptive/criteria.js [set, default 594001-400] [candidate, default safe-skip]
const { load, paired } = require('./summary');
const police = require('./police');

const [set = '594001-400', candidate = 'safe-skip'] = process.argv.slice(2);
const all = police.primary.concat(police.heldOut);
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

function primaryMetric(a, b) {
	// Per seed, the mean over the primary detectives of (a won) - (b won); mean and 95% interval
	const rows = police.primary.map((p) => load(a, p, set));
	const refs = police.primary.map((p) => load(b, p, set));
	const per = rows[0].map((g, i) => mean(rows.map((r, k) => (r[i].result === 'jackWins') - (refs[k][i].result === 'jackWins'))));
	const m = mean(per);
	const sd = Math.sqrt(per.reduce((s, x) => s + (x - m) ** 2, 0) / (per.length - 1));
	const half = 1.96 * sd / Math.sqrt(per.length);
	return { mean: m, lo: m - half, hi: m + half };
}

function chiSquare(table) {
	// Rows: detectives; columns: [skipped, detoured]. Returns statistic, degrees of freedom and p (Wilson-Hilferty)
	const total = table.reduce((s, r) => s + r[0] + r[1], 0);
	const cols = [0, 1].map((c) => table.reduce((s, r) => s + r[c], 0));
	let x2 = 0;
	for (const r of table) {
		const n = r[0] + r[1];
		for (const c of [0, 1]) {
			const e = n * cols[c] / total;
			if (e > 0) x2 += (r[c] - e) ** 2 / e;
		}
	}
	const df = table.length - 1;
	const z = (Math.pow(x2 / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
	const p = 0.5 * erfc(z / Math.SQRT2);
	return { x2, df, p };
}
function erfc(x) {
	// Numerical Recipes' complementary error function
	const t = 1 / (1 + 0.5 * Math.abs(x));
	const r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
		t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
	return x >= 0 ? r : 2 - r;
}

const lines = [`Pre-registered criteria, stage C (seeds ${set}), candidate ${candidate}.`, ''];
const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(100 * x).toFixed(1);
const vsV2 = primaryMetric(candidate, 'jack-v2');
const vsMatched = primaryMetric(candidate, 'matched');
const c1 = vsV2.mean >= 0.05 && vsV2.lo > 0;
const c2 = vsMatched.mean > 0 && vsMatched.lo > 0;
lines.push(`1. vs jack-v2, primary metric: ${f(vsV2.mean)} points (95% ${f(vsV2.lo)} to ${f(vsV2.hi)}); needs ≥ +5.0 and the interval above 0: ${c1 ? 'MET' : 'NOT MET'}`);
lines.push(`2. vs matched, primary metric: ${f(vsMatched.mean)} points (95% ${f(vsMatched.lo)} to ${f(vsMatched.hi)}); needs > 0 with the interval above 0: ${c2 ? 'MET' : 'NOT MET'}`);
let c3 = true;
const per = [];
for (const p of all) {
	const d = paired(load(candidate, p, set), load('jack-v2', p, set));
	if (d.diff < -0.05 || (d.diff < 0 && d.p < 0.05)) c3 = false;
	per.push(`${p} ${f(d.diff)} (${d.b}/${d.c}, p ${d.p.toFixed(3)})`);
}
lines.push(`3. no regression against any detective (none more than 5 points below jack-v2, none significantly worse): ${c3 ? 'MET' : 'NOT MET'}. ${per.join('; ')}`);
const table = all.map((p) => {
	let skipped = 0; let detoured = 0;
	for (const g of load(candidate, p, set)) for (const n of g.nights) if (n.night < 3) { skipped += n.skipped || 0; detoured += n.detours || 0; }
	return [skipped, detoured];
});
const chi = chiSquare(table);
const c4 = chi.p < 0.01;
lines.push(`4. adaptation: skip rate by detective ${all.map((p, i) => `${p} ${(100 * table[i][0] / (table[i][0] + table[i][1])).toFixed(1)}%`).join(', ')}; chi-square ${chi.x2.toFixed(1)} on ${chi.df} df, p ${chi.p < 0.001 ? '<0.001' : chi.p.toFixed(3)}: ${c4 ? 'MET' : 'NOT MET'}`);
const ms = (j) => all.map((p) => load(j, p, set)).flat();
const cand = ms(candidate); const ref = ms('jack-v2');
const meanMs = mean(cand.map((g) => g.ms.mean)); const refMs = mean(ref.map((g) => g.ms.mean));
const maxMs = Math.max(...cand.map((g) => g.ms.max));
const c5 = meanMs <= 1.5 * refMs && maxMs < 1000;
lines.push(`5. cost: mean decision ${meanMs.toFixed(1)} ms against jack-v2's ${refMs.toFixed(1)} ms, max ${maxMs.toFixed(0)} ms: ${c5 ? 'MET' : 'NOT MET'}`);
const decision = c1 && c2 && c3 && c4 && c5 ? 'A (adopt)' : vsV2.mean > 0 ? 'B (keep as experimental)' : 'C (reject)';
lines.push('', `Recommendation by the pre-registered rule: ${decision}.`);
console.log(lines.join('\n'));
