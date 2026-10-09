// What Detective AI v3 costs: the time of each police decision (one call of the police AI's turn), on one thread,
// Detective AI v2 against v3, over the same seeded games, against Strategic Jack and a short-return Jack.
//   node research/detective-v3/benchmark.js [games, default 20] [first seed, default 800401]
const fs = require('fs');
const path = require('path');
const lib = require('../detective-inference/lib');
const { WC } = lib;
const configs = require('./configs');
const jacks = require('./jacks');

const games = Number(process.argv[2] || 20);
const from = Number(process.argv[3] || 800401);
lib.registerJack('short-return', (random) => jacks['short-return'](random));
const names = { 2: 'placing patrols', 5: 'moving a Wretched', 10: 'moving the policemen', 11: 'a search or arrest' };
const stats = (v) => {
	const s = v.slice().sort((a, b) => a - b);
	const at = (q) => (s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0);
	return `${String(s.length).padStart(5)} decisions, mean ${(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)).toFixed(2)}, p95 ${at(0.95).toFixed(2)}, p99 ${at(0.99).toFixed(2)}, max ${(s[s.length - 1] || 0).toFixed(1)}`;
};
const lines = [`Police decision times (ms), seeds ${from}-${from + games - 1}, one thread`];
const started = Date.now();
for (const jack of ['strategic', 'short-return']) {
	for (const police of ['v2', 'v3']) {
		const times = { 2: [], 5: [], 10: [], 11: [] };
		const original = WC.createPolice;
		WC.createPolice = function () {
			const ai = original.apply(this, arguments);
			const turn = ai.turn;
			ai.turn = function (game, view, random) {
				const t = process.hrtime.bigint();
				turn.call(this, game, view, random);
				if (times[view.phase]) times[view.phase].push(Number(process.hrtime.bigint() - t) / 1e6);
			};
			return ai;
		};
		try {
			for (let seed = from; seed < from + games; seed++) lib.play({ jack, police: 'deductive', seed, policeOptions: configs[police] });
		} finally {
			WC.createPolice = original;
		}
		lines.push(`  ${police} against ${jack} Jack:`);
		for (const phase of [10, 11, 2, 5]) lines.push(`    ${names[phase].padEnd(22)} ${stats(times[phase])}`);
	}
}
lines.push(`  ${((Date.now() - started) / 1000).toFixed(0)} s in all`);
console.log(lines.join('\n'));
fs.writeFileSync(path.join(__dirname, 'results', 'benchmark.txt'), lines.join('\n') + '\n');
