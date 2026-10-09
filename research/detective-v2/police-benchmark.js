// What Detective AI v2 costs: the time of each police decision (one call of the police AI's turn), the original
// police against v2, over the same seeded games against the strategic Jack, on one thread.
//   node research/detective-v2/police-benchmark.js [games, default 30] [first seed, default 800101]
const fs = require('fs');
const path = require('path');
const resultsDir = require('../detective-inference/results-dir');
const { WC, play } = require('../detective-inference/lib');


const games = Number(process.argv[2] || 30);
const from = Number(process.argv[3] || 800101);

function measure(options) {
	const times = { 2: [], 5: [], 10: [], 11: [] };
	for (let seed = from; seed < from + games; seed++) {
		// play() builds its own police from options; time ours by wrapping its turn
		const original = WC.createPolice;
		WC.createPolice = function () {
			const ai = original.apply(this, arguments);
			const turn = ai.turn;
			ai.turn = function (game, view, random) {
				const t = process.hrtime.bigint();
				turn.call(this, game, view, random);
				const phase = view.phase;
				if (times[phase]) times[phase].push(Number(process.hrtime.bigint() - t) / 1e6);
			};
			return ai;
		};
		try { play({ jack: 'strategic', police: 'deductive', seed, policeOptions: options }); } finally { WC.createPolice = original; }
	}
	return times;
}

const stats = (v) => {
	const s = v.slice().sort((a, b) => a - b);
	return { n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), p95: s[Math.floor(0.95 * s.length)] || 0, max: s[s.length - 1] || 0 };
};
const names = { 10: 'moving the policemen', 11: 'a search or arrest', 2: 'placing patrols', 5: 'moving the Wretched' };
const lines = [`Police decision times (ms), strategic Jack, seeds ${from}-${from + games - 1}, one thread`];
for (const [label, options] of [['original', WC.policeVariants.original], ['v2', WC.policeVariants.v2]]) {
	const times = measure(options);
	lines.push(`  ${label}:`);
	for (const phase of [10, 11, 2, 5]) {
		const s = stats(times[phase]);
		lines.push(`    ${names[phase].padEnd(22)} ${String(s.n).padStart(5)} decisions, mean ${s.mean.toFixed(2)}, p95 ${s.p95.toFixed(2)}, max ${s.max.toFixed(1)}`);
	}
}
console.log(lines.join('\n'));
fs.writeFileSync(path.join(resultsDir, 'police-benchmark.txt'), lines.join('\n') + '\n');
