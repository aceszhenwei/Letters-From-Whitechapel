#!/usr/bin/env node
// Plays many seeded games between a Jack strategy and a police AI, in parallel, and reports the results.
//   node tools/simulate.js --jack baseline --police deductive --games 2000 [--from 1] [--out results.json]
// The same --from/--games give the same seeds, so strategies can be compared on identical games.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const fs = require('fs');

if (!isMainThread) {
	const { loadCore, runGame } = require('./sim/run-game');
	const core = loadCore();
	const games = [];
	for (const seed of workerData.seeds) {
		games.push(runGame(core, { jack: workerData.jack, police: workerData.police, seed }));
	}
	parentPort.postMessage(games);
	return;
}

function args() {
	const options = { jack: 'baseline', police: 'deductive', games: 1000, from: 1, workers: os.cpus().length, out: null, quiet: false };
	const argv = process.argv.slice(2);
	for (let i = 0; i < argv.length; i += 2) {
		const key = argv[i].replace(/^--/, '');
		options[key] = ['games', 'from', 'workers'].includes(key) ? Number(argv[i + 1]) : argv[i + 1];
	}
	return options;
}

function run(options) {
	const seeds = Array.from({ length: options.games }, (x, i) => options.from + i);
	const chunks = Array.from({ length: options.workers }, (x, w) => seeds.filter((s, i) => i % options.workers === w));
	return Promise.all(chunks.filter((c) => c.length).map((chunk) => new Promise((resolve, reject) => {
		const worker = new Worker(__filename, { workerData: { seeds: chunk, jack: options.jack, police: options.police } });
		worker.on('message', resolve);
		worker.on('error', reject);
	}))).then((parts) => parts.flat().sort((a, b) => a.seed - b.seed));
}

module.exports = { run };

if (require.main === module) {
	const options = args();
	const started = Date.now();
	run(options).then((games) => {
		const { summarise, format } = require('./sim/summarise');
		const summary = summarise(games);
		summary.seconds = (Date.now() - started) / 1000;
		if (options.out) {
			// The summary, and one line per game for paired comparisons between strategies on the same seeds
			const compact = games.map((g) => [g.seed, g.result, g.nights, g.nightDetails.filter((n) => n.escaped).length]);
			fs.writeFileSync(options.out, JSON.stringify({ options, summary, games: compact }));
		}
		console.log(format(summary, `${options.jack} vs ${options.police} police, seeds ${options.from}-${options.from + options.games - 1}`));
	});
}
