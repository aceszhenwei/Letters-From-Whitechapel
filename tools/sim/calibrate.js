#!/usr/bin/env node
// Measures, from many games, how Jack's situation after a move relates to what happens next. The strategic Jack's
// estimates (js/ai/strategic-jack.js) come from these tables. Calibration seeds are kept apart from evaluation seeds.
//   node tools/sim/calibrate.js [--jack baseline] [--games 1500] [--from 900001]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const { loadCore, runGame } = require('./run-game');
	const core = loadCore();
	parentPort.postMessage(workerData.seeds.flatMap((seed) =>
		runGame(core, { jack: workerData.jack, police: 'deductive', seed, features: true }).decisions
			.map((d) => Object.assign({}, d.features, { arrestedNext: d.arrestedNext, escapedNight: d.escapedNight }))));
	return;
}

const argv = process.argv.slice(2);
const option = (name, value) => { const i = argv.indexOf('--' + name); return i === -1 ? value : argv[i + 1]; };
const games = Number(option('games', 1500));
const from = Number(option('from', 900001));
const jack = option('jack', 'baseline');
const seeds = Array.from({ length: games }, (x, i) => from + i);
Promise.all([0, 1, 2, 3].map((w) => new Promise((resolve) => {
	const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % 4 === w), jack } });
	worker.on('message', resolve);
}))).then((parts) => {
	const rows = parts.flat();
	const rate = (subset, key) => subset.length ? (subset.filter((r) => r[key]).length / subset.length) : NaN;
	const show = (label, subset, key) => console.log(`  ${label.padEnd(34)} n=${String(subset.length).padStart(6)}  ${(100 * rate(subset, key)).toFixed(1)}%`);
	console.log(`${rows.length} moves by ${jack} Jack in ${games} games against the deductive police\n`);
	console.log('Arrested straight after the move, by police reach and how sure the police could be of his circle:');
	const beliefBuckets = [[0, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 0.35], [0.35, 0.5], [0.5, 1.01]];
	show('out of police reach', rows.filter((r) => r.threat === 0), 'arrestedNext');
	for (const [lo, hi] of beliefBuckets) {
		show(`in reach, police belief ${lo}-${Math.min(hi, 1)}`, rows.filter((r) => r.threat > 0 && r.belief >= lo && r.belief < hi), 'arrestedNext');
	}
	console.log('\nEscaped that night, by moves to spare after the move:');
	for (const [lo, hi] of [[-99, -1], [0, 0], [1, 1], [2, 2], [3, 3], [4, 5], [6, 8], [9, 99]]) {
		show(`spare ${lo}..${hi}`, rows.filter((r) => r.slack >= lo && r.slack <= hi), 'escapedNight');
	}
});
