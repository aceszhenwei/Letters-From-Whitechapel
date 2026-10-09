// Plays a Jack policy against a police configuration over a range of seeds, on every core, and stores each game's
// record (record.js). Results are kept per game in results/games/<jack>__<police>.jsonl with a fingerprint of every
// file the games depend on: an interrupted run resumes where it stopped, and a stored game is reused only while the
// fingerprint is unchanged (change the code, a policy or a configuration and its games are played again).
//   node research/jack-v2/run.js <jack> <police> <games> <first seed> [--no-decisions]
// Prints a one-line summary and the wall-clock time. Seed ranges: docs/jack-ai-v2.md, "Seeds".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const { recordGame } = require('./record');
	for (const seed of workerData.seeds) parentPort.postMessage(recordGame({ jack: workerData.jack, police: workerData.police, seed, decisions: workerData.decisions }));
	parentPort.postMessage(null);
	return;
}

const root = path.join(__dirname, '..', '..');
// The core every game uses (as loaded by tools/sim/run-game.js), the research harness, and the police configurations
const coreFiles = ['js/vendor/underscore-min.js', 'js/data/map.js', 'js/data/content.js', 'js/core/random.js', 'js/core/board.js',
	'js/core/rules.js', 'js/core/engine.js', 'js/core/deduction.js', 'js/ai/jack.js', 'js/ai/strategic-jack.js', 'js/ai/containment.js', 'js/ai/police.js',
	'tools/sim/run-game.js', 'research/detective-inference/lib.js', 'research/detective-v2/configs.js',
	'research/jack-v2/record.js', 'research/jack-v2/policies.js'];

function fingerprint(jack, police) {
	const policies = require('./policies');
	const hash = crypto.createHash('sha256');
	for (const file of coreFiles.concat(policies.files(jack))) {
		const full = path.join(root, file);
		hash.update(file + '\0' + (fs.existsSync(full) ? fs.readFileSync(full) : '') + '\0');
	}
	hash.update(JSON.stringify(require('../detective-v2/configs')[police] || null));
	return hash.digest('hex').slice(0, 16);
}

const gamesDir = path.join(process.env.JACK_V2_RESULTS ? path.resolve(process.env.JACK_V2_RESULTS) : path.join(__dirname, 'results'), 'games');

// Every stored game for this matchup and fingerprint, by seed
function stored(jack, police, print) {
	const file = path.join(gamesDir, `${jack}__${police}.jsonl`);
	const games = new Map();
	if (!fs.existsSync(file)) return { file, games };
	for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
		if (!line) continue;
		const g = JSON.parse(line);
		if (g.fingerprint === print) games.set(g.seed, g);
	}
	return { file, games };
}

function run({ jack, police, games, from, decisions = true, workers = require('os').cpus().length, quiet = false }) {
	fs.mkdirSync(gamesDir, { recursive: true });
	const print = fingerprint(jack, police);
	const { file, games: have } = stored(jack, police, print);
	const seeds = Array.from({ length: games }, (x, i) => from + i);
	const todo = seeds.filter((s) => !have.has(s) || (decisions && !have.get(s).decisions));
	const started = Date.now();
	if (!todo.length) return Promise.resolve({ games: seeds.map((s) => have.get(s)), played: 0, seconds: 0 });
	const out = fs.openSync(file, 'a');
	let done = 0;
	return Promise.all(Array.from({ length: Math.min(workers, todo.length) }, (x, w) => new Promise((resolve, reject) => {
		const worker = new Worker(__filename, { workerData: { seeds: todo.filter((s, i) => i % workers === w), jack, police, decisions } });
		worker.on('message', (g) => {
			if (g === null) return resolve();
			g.fingerprint = print;
			fs.writeSync(out, JSON.stringify(g) + '\n'); // Written as each game ends, so an interrupted run loses nothing
			have.set(g.seed, g);
			if (!quiet && ++done % 50 === 0) process.stderr.write(`  ${jack} vs ${police}: ${done}/${todo.length}\n`);
		});
		worker.on('error', reject);
	}))).then(() => {
		fs.closeSync(out);
		return { games: seeds.map((s) => have.get(s)), played: todo.length, seconds: (Date.now() - started) / 1000 };
	});
}

module.exports = { run, fingerprint };

if (require.main === module) {
	const [jack, police, games, from] = process.argv.slice(2);
	if (!jack || !police) {
		console.error('Usage: node research/jack-v2/run.js <jack> <police> <games> <first seed> [--no-decisions]');
		process.exit(1);
	}
	run({ jack, police, games: Number(games || 50), from: Number(from || 410001), decisions: !process.argv.includes('--no-decisions') }).then(({ games: all, played, seconds }) => {
		const wins = all.filter((g) => g.result === 'jackWins').length;
		console.log(`${jack} vs ${police}, seeds ${from}-${Number(from) + all.length - 1}: Jack wins ${wins}/${all.length}; played ${played} new games in ${seconds.toFixed(0)} s`);
	});
}
