#!/usr/bin/env node
// Looks inside a Jack strategy's games to find out why it loses (docs/jack-ai.md, "Weaknesses of the baseline").
//   node tools/sim/diagnose.js [--jack baseline] [--police deductive] [--games 600] [--from 100001]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const { loadCore, runGame } = require('./run-game');
	const core = loadCore();
	parentPort.postMessage(workerData.seeds.map((seed) => runGame(core, { jack: workerData.jack, police: workerData.police, seed })));
	return;
}

const argv = process.argv.slice(2);
const option = (name, value) => { const i = argv.indexOf('--' + name); return i === -1 ? value : argv[i + 1]; };
const jack = option('jack', 'baseline');
const police = option('police', 'deductive');
const games = Number(option('games', 600));
const from = Number(option('from', 100001));

const seeds = Array.from({ length: games }, (x, i) => from + i);
Promise.all([0, 1, 2, 3].map((w) => new Promise((resolve) => {
	const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % 4 === w), jack, police } });
	worker.on('message', resolve);
}))).then((parts) => {
	const all = parts.flat();
	const pct = (x) => (100 * x).toFixed(1) + '%';
	const mean = (v) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
	const decisions = all.flatMap((g) => g.decisions);
	const walks = decisions.filter((d) => d.type === 'walk');
	const nights = all.flatMap((g) => g.nightDetails.map((n, i) => Object.assign({ last: i === g.nightDetails.length - 1, result: g.result }, n)));
	const lostOnTime = nights.filter((n) => n.last && n.result === 'outOfMoves');
	const escaped = nights.filter((n) => n.escaped);
	console.log(`${jack} vs ${police} police, ${games} games from seed ${from}`);
	console.log('Walking moves:', walks.length,
		'| closer to the hideout', pct(mean(walks.map((d) => d.distance < d.before ? 1 : 0))),
		'| same distance', pct(mean(walks.map((d) => d.distance === d.before ? 1 : 0))),
		'| further away', pct(mean(walks.map((d) => d.distance > d.before ? 1 : 0))));
	console.log('Special moves:', decisions.length - walks.length,
		'| closer', pct(mean(decisions.filter((d) => d.type !== 'walk').map((d) => d.distance < d.before ? 1 : 0))));
	console.log('Nights lost on time:', lostOnTime.length,
		'| moves to spare at the murder', mean(lostOnTime.map((n) => n.movesAvailable - n.startDistance)).toFixed(1),
		'| distance left at the end', mean(lostOnTime.map((n) => n.finalDistance)).toFixed(1),
		'| had at least 5 to spare', pct(mean(lostOnTime.map((n) => n.movesAvailable - n.startDistance >= 5 ? 1 : 0))));
	console.log('Nights escaped:', escaped.length,
		'| moves used', mean(escaped.map((n) => n.moves)).toFixed(1), '| shortest', mean(escaped.map((n) => n.startDistance)).toFixed(1));
	const arrests = all.filter((g) => g.result === 'arrested');
	console.log('Arrests:', arrests.length, '| police certainty at the arrest', mean(arrests.map((g) => g.arrestCertainty || 0)).toFixed(2),
		'| moves onto circles in police reach', pct(mean(decisions.map((d) => d.chosenDanger ? 1 : 0))),
		'| of those, the police could pin him to', mean(decisions.filter((d) => d.chosenDanger).map((d) => d.candidates)).toFixed(1), 'circles');
	const slackBuckets = [[-99, 0], [1, 2], [3, 4], [5, 99]];
	slackBuckets.forEach(([lo, hi]) => {
		const subset = nights.filter((n) => n.movesAvailable !== undefined && n.movesAvailable - n.startDistance >= lo && n.movesAvailable - n.startDistance <= hi);
		console.log(`  nights with ${lo}..${hi} moves to spare at the murder: ${subset.length}, escaped ${pct(mean(subset.map((n) => n.escaped ? 1 : 0)))}`);
	});
	console.log('Time of the crime at the murder:', JSON.stringify(nights.reduce((c, n) => { c[n.timeOfCrime] = (c[n.timeOfCrime] || 0) + 1; return c; }, {})));
});
