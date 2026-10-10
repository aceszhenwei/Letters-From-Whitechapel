// Tables for Study J3 (docs/jack-adaptive.md) from experiment.js's files: no game is played here.
//   node research/jack-adaptive/summary.js <first seed>-<games> <jacks, comma-separated> <police, comma-separated> [reference jack]
// For each detective: each Jack's win rate (Wilson 95% interval), how its games ended, and the paired difference from
// the reference Jack on the same seeds (points, 95% interval, McNemar's exact p). Then the mean over the detectives
// listed (each seed's mean difference over them: mean and 95% interval), and what the Jacks did: deception modes chosen
// on nights 1-3, the pressure they saw, detour moves, Detective AI v2's belief in the true hideout at the start of
// nights 2-4, how often the hideout was walled off, and decision times.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'results');

function load(jack, police, set) {
	const file = path.join(dir, `${jack}__${police}__${set}.json`);
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).results : null;
}

function wilson(k, n) {
	if (!n) return [NaN, NaN];
	const z = 1.96;
	const p = k / n;
	const d = 1 + z * z / n;
	const c = (p + z * z / (2 * n)) / d;
	const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
	return [c - h, c + h];
}

const logChoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
function mcnemarP(b, c) {
	const n = b + c;
	let tail = 0;
	for (let k = 0; k <= Math.min(b, c); k++) tail += Math.exp(logChoose(n, k) - n * Math.log(2));
	return Math.min(1, 2 * tail);
}

function paired(a, ref) {
	// Points difference a - ref over shared seeds, its 95% interval, and McNemar's exact test
	const won = new Map(ref.map((g) => [g.seed, g.result === 'jackWins']));
	let b = 0; let c = 0; let n = 0;
	for (const g of a) {
		if (!won.has(g.seed)) continue;
		n++;
		const x = g.result === 'jackWins'; const y = won.get(g.seed);
		if (x && !y) b++;
		if (!x && y) c++;
	}
	const diff = (b - c) / n;
	const se = Math.sqrt(Math.max(0, (b + c) / n - diff * diff) / n);
	return { n, b, c, diff, lo: diff - 1.96 * se, hi: diff + 1.96 * se, p: mcnemarP(b, c) };
}

const pct = (x, d = 1) => (isNaN(x) ? '-' : (100 * x).toFixed(d));
const pts = (x) => (isNaN(x) ? '-' : (x >= 0 ? '+' : '−') + Math.abs(100 * x).toFixed(1));
const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);

function table(set, jacks, police, reference) {
	const lines = [];
	const data = {};
	for (const p of police) for (const j of jacks) data[j + '|' + p] = load(j, p, set);
	lines.push(`Seeds ${set}. Jack's win rate (Wilson 95%), how his losses ended, and the paired difference from ${reference}.`, '');
	lines.push('| Detective | Jack | Wins | 95% interval | Arrested | Out of moves | Trapped | vs ' + reference + ' (points, 95% interval) | Only this / only ref | p |');
	lines.push('|---|---|---:|---|---:|---:|---:|---|---|---:|');
	for (const p of police) {
		for (const j of jacks) {
			const g = data[j + '|' + p];
			if (!g) continue;
			const n = g.length;
			const k = g.filter((x) => x.result === 'jackWins').length;
			const [lo, hi] = wilson(k, n);
			const count = (t) => g.filter((x) => x.result === t).length;
			const ref = data[reference + '|' + p];
			const d = ref && j !== reference ? paired(g, ref) : null;
			lines.push(`| ${p} | ${j} | ${pct(k / n)}% | ${pct(lo)}–${pct(hi)} | ${count('arrested')} | ${count('outOfMoves')} | ${count('trapped')} | ` +
				(d ? `${pts(d.diff)} (${pts(d.lo)} to ${pts(d.hi)}) | ${d.b} / ${d.c} | ${d.p < 0.001 ? '<0.001' : d.p.toFixed(3)} |` : '| | |'));
		}
	}
	// The mean over the detectives: per seed, the mean of (jack win - reference win) over the detectives
	lines.push('', `Mean over ${police.join(', ')} (equal weights), paired by seed:`, '');
	lines.push('| Jack | Mean win rate | vs ' + reference + ' (points) | 95% interval |', '|---|---:|---:|---|');
	for (const j of jacks) {
		const rows = police.map((p) => data[j + '|' + p]);
		const refs = police.map((p) => data[reference + '|' + p]);
		if (rows.some((r) => !r) || refs.some((r) => !r)) continue;
		const seeds = rows[0].map((g) => g.seed);
		const per = seeds.map((s, i) => mean(rows.map((r, k) => (r[i].result === 'jackWins' ? 1 : 0) - (refs[k][i].result === 'jackWins' ? 1 : 0))));
		const rate = mean(rows.map((r) => mean(r.map((g) => (g.result === 'jackWins' ? 1 : 0)))));
		const m = mean(per);
		const sd = Math.sqrt(mean(per.map((x) => (x - m) ** 2)) * per.length / (per.length - 1));
		const half = 1.96 * sd / Math.sqrt(per.length);
		lines.push(`| ${j} | ${pct(rate)}% | ${j === reference ? '' : pts(m)} | ${j === reference ? '' : pts(m - half) + ' to ' + pts(m + half)} |`);
	}
	// Behaviour
	lines.push('', 'What the Jacks did (nights 1-3 unless stated):', '');
	lines.push('| Detective | Jack | Modes none / v2 / long | Pressure, mean (nights 2-3) | Detour moves a night | v2 belief in true hideout, nights 2-4 | Hideout walled off (nights) | Decision ms, mean / max |');
	lines.push('|---|---|---|---:|---:|---:|---:|---|');
	for (const p of police) {
		for (const j of jacks) {
			const g = data[j + '|' + p];
			if (!g) continue;
			const early = g.flatMap((x) => x.nights.filter((n) => n.night < 3));
			const modes = early.filter((n) => n.mode);
			const share = (m) => (modes.length ? pct(modes.filter((n) => n.mode === m).length / modes.length, 0) : '-');
			const pressures = early.filter((n) => n.pressure !== null && n.pressure !== undefined).map((n) => n.pressure);
			const detours = early.filter((n) => n.escaped).map((n) => n.detour);
			const belief = g.flatMap((x) => x.nights.filter((n) => n.night > 0).map((n) => n.belief));
			const all = g.flatMap((x) => x.nights);
			lines.push(`| ${p} | ${j} | ${modes.length ? share('none') + ' / ' + share('v2') + ' / ' + share('long') : '-'} | ${pressures.length ? mean(pressures).toFixed(3) : '-'} | ` +
				`${mean(detours).toFixed(2)} | ${pct(mean(belief))}% | ${pct(all.filter((n) => n.walledOff).length / all.length)}% | ${mean(g.map((x) => x.ms.mean)).toFixed(1)} / ${Math.max(...g.map((x) => x.ms.max)).toFixed(0)} |`);
		}
	}
	return lines.join('\n') + '\n';
}

if (require.main === module) {
	const [set, jackList, policeList, reference = 'jack-v2'] = process.argv.slice(2);
	process.stdout.write(table(set, jackList.split(','), policeList.split(','), reference));
}

module.exports = { table, paired, wilson, mcnemarP, load };
