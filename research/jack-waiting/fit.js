// Fits the waiting policy's escape table (js/ai/jack-waiting.js) from the calibration games (calibrate.sh): for each
// base Jack, the share of nights he escaped, by moves to spare after the murder (moves left minus the walk home from
// the crime scene, 0 to 15 or more), by whether the crime scene was within one police turn of a patrol token he could
// think real, and by whether it was the last night. Every police counts equally (Jack doesn't know which he faces).
// Cells are smoothed towards their row's average (5 pseudo-nights) and made non-decreasing in spare moves, and the
// in-reach chance never exceeds the clear one.
//   node research/jack-waiting/fit.js <seed range, e.g. 540001-50>
const fs = require('fs');
const path = require('path');
const range = process.argv[2] || '540001-50';
const MAX = 15; // Spare moves counted up to 15 ("15 or more")
const dir = path.join(__dirname, 'results');
const polices = ['original', 'v2', 'v3'];
const bases = ['jack-v2', 'strategic'];
const out = {};
const report = [];
for (const base of bases) {
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(`__${range}.json`) && (f.startsWith(base + '__') || f.startsWith(base + '-wait')) && !f.includes('blind'));
	const cells = {}; // 'last:reach:spare' -> per police [escaped, nights]
	for (const f of files) {
		const police = f.split('__')[1];
		if (!polices.includes(police)) continue;
		for (const game of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).games) {
			game.nights.forEach((n, i) => {
				const key = [i === 3 ? 1 : 0, n.possibleReach ? 1 : 0, Math.max(0, Math.min(MAX, n.spare))].join(':');
				cells[key] = cells[key] || {};
				const c = (cells[key][police] = cells[key][police] || [0, 0]);
				c[0] += n.end === 'escaped' ? 1 : 0;
				c[1] += 1;
			});
		}
	}
	// Each police weighted equally: the average of the per-police rates where a police has nights in the cell
	const rate = (key) => {
		const per = polices.map((p) => (cells[key] || {})[p]).filter((c) => c && c[1] > 0);
		const nights = per.reduce((s, c) => s + c[1], 0);
		return { p: per.length ? per.reduce((s, c) => s + c[0] / c[1], 0) / per.length : null, nights };
	};
	const table = {};
	for (const last of [0, 1]) {
		for (const reach of [0, 1]) {
			const row = Array.from({ length: MAX + 1 }, (_, spare) => rate([last, reach, spare].join(':')));
			const known = row.filter((r) => r.p !== null);
			const mean = known.reduce((s, r) => s + r.p * r.nights, 0) / Math.max(1, known.reduce((s, r) => s + r.nights, 0));
			let values = row.map((r) => (r.p === null ? mean : (r.p * r.nights + mean * 5) / (r.nights + 5)));
			// Non-decreasing in spare moves (pool adjacent violators)
			let blocks = values.map((v, i) => ({ v, w: row[i].nights + 5, n: 1 }));
			for (let i = 0; i < blocks.length - 1;) {
				if (blocks[i].v > blocks[i + 1].v) {
					const a = blocks[i];
					const b = blocks[i + 1];
					blocks.splice(i, 2, { v: (a.v * a.w + b.v * b.w) / (a.w + b.w), w: a.w + b.w, n: a.n + b.n });
					i = Math.max(0, i - 1);
				} else {
					i++;
				}
			}
			values = blocks.flatMap((b) => Array(b.n).fill(b.v));
			table[(last ? 'last' : 'early') + (reach ? 'Reach' : 'Clear')] = values.map((v) => Math.round(v * 1000) / 1000);
			report.push(`${base} ${last ? 'last night' : 'nights 1-3'} ${reach ? 'in reach' : 'clear'}: ` + row.map((r, i) => `${i}:${r.nights ? (100 * r.p).toFixed(0) + '%/' + r.nights : '-'}`).join(' '));
		}
	}
	// A patrol within reach can't make escaping likelier: where the data say so (few nights, and most of them nights he
	// was made to wait), the in-reach chance is capped at the clear one
	for (const night of ['early', 'last']) {
		table[night + 'Reach'] = table[night + 'Reach'].map((p, i) => Math.min(p, table[night + 'Clear'][i]));
	}
	out[base] = table;
}
fs.writeFileSync(path.join(dir, 'escape-table.txt'), JSON.stringify(out, null, 1) + '\n');
console.log(report.join('\n'));
console.log(JSON.stringify(out));
