// Summarises research/deception-audit/results/*.json (written by audit.js) into results/summary.md.
//   node research/deception-audit/summary.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'results');
const load = (name) => {
	const file = path.join(dir, name);
	return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).games : null;
};
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '–');
function mcnemar(a, b) {
	const m = a + b;
	const k = Math.min(a, b);
	let c = 1;
	let p = 0;
	for (let i = 0; i <= k; i++) {
		p += c;
		c = c * (m - i) / (i + 1);
	}
	return Math.min(1, 2 * p / Math.pow(2, m));
}

const lines = ['# Fake Wretched and fake patrol audit: results', '', 'Seeds 490001–490100 (100 games per row, paired by seed). Written by `summary.js` from `audit.js`\'s files.', '',
	'## What happened in the preparation phase', '',
	'| Jack | Police | Variant | Jack wins | Nights | Women on every legal red circle | Nights Jack waited | Waits per night | Tokens revealed (fake) | Fakes = the free stations (nights 2–4) | Different night-1 fake pairs | Wait nights where the Wretched moves identify every fake | Designations Jack can\'t rule out on wait nights: after reveals → after moves (of 21) |',
	'|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|'];
for (const f of files) {
	const [jack, police, variant] = f.split('__');
	const games = load(f);
	const nights = games.flatMap((g) => g.nights);
	const waited = nights.filter((n) => n.waits > 0);
	const reveals = nights.flatMap((n) => n.reveals);
	const later = nights.filter((n) => n.fakesOnFreeStations !== null);
	const avg = (key) => waited.length ? (waited.reduce((s, n) => s + n.designations[key], 0) / waited.length).toFixed(1) : '–';
	lines.push(`| ${jack} | ${police} | ${variant} | ${games.filter((g) => g.result === 'jackWins').length} | ${nights.length} | ${pct(nights.filter((n) => n.filled).length, nights.length)} | ${waited.length} | ${(nights.reduce((s, n) => s + (n.waits || 0), 0) / nights.length).toFixed(2)} | ${reveals.length} (${reveals.filter((r) => r === 'fake').length}) | ${later.filter((n) => n.fakesOnFreeStations).length}/${later.length} | ${new Set(games.map((g) => g.nights[0].fakes.join())).size} | ${waited.length ? waited.filter((n) => n.designations.fakesKnownByMoves).length + '/' + waited.length : '–'} | ${avg('afterReveals')} → ${avg('afterMoves')} |`);
}
lines.push('', '## Paired comparisons with the unchanged AIs', '', '| Jack | Police | Variant | Nights with a different choice of fakes | Police win only with the variant | Only without | Exact McNemar p |', '|---|---|---|---:|---:|---:|---:|');
for (const f of files.filter((x) => !x.includes('__normal__'))) {
	const [jack, police, variant, seeds] = f.split('__');
	const base = load(`${jack}__${police}__normal__${seeds}`);
	const games = load(f);
	if (!base) continue;
	let diff = 0;
	let total = 0;
	let onlyVariant = 0;
	let onlyBase = 0;
	games.forEach((g, i) => {
		const b = base[i];
		g.nights.forEach((n, k) => {
			if (!b.nights[k]) return;
			total++;
			if (n.fakes.join() !== b.nights[k].fakes.join()) diff++;
		});
		const pv = g.result !== 'jackWins';
		const pb = b.result !== 'jackWins';
		if (pv && !pb) onlyVariant++;
		if (pb && !pv) onlyBase++;
	});
	lines.push(`| ${jack} | ${police} | ${variant} | ${diff}/${total} | ${onlyVariant} | ${onlyBase} | ${mcnemar(onlyVariant, onlyBase).toFixed(2)} |`);
}
fs.writeFileSync(path.join(dir, 'summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
