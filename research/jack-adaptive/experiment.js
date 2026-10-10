// Seeded games for Study J3 (docs/jack-adaptive.md): a Jack (jacks.js) against a detective (police.js), on every core.
//   node research/jack-adaptive/experiment.js <jack> <police> <games> <first seed>
// The random streams are the other harnesses' (Jack: seed * 7919 + 1, police: seed * 104729 + 2), so jack-v2 against v2
// plays the Jack v2 study's games exactly. Records, per game, as the referee (for analysis only: no player sees it):
// the result, and per night the deception mode and pressure the candidate saw, its detour moves, moves used against
// the walking distance, how much of Detective AI v2's hideout belief was on the true hideout at the start of the night,
// how often a policeman stood next to the hideout, and whether the policemen ever walled it off. Decision times too.
// Writes results/<jack>__<police>__<first seed>-<games>.json (reused while the code it depends on is unchanged).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const root = path.join(__dirname, '..', '..');
const dependsOn = ['js/core/engine.js', 'js/core/rules.js', 'js/core/deduction.js', 'js/ai/strategic-jack.js', 'js/ai/jack-v2.js',
	'js/ai/police.js', 'js/ai/containment.js', 'research/jack-adaptive/jacks.js', 'research/jack-adaptive/police.js', 'research/jack-adaptive/experiment.js'];

function fingerprint(extra) {
	const hash = crypto.createHash('sha256');
	for (const f of dependsOn) hash.update(f + '\0' + fs.readFileSync(path.join(root, f)) + '\0');
	hash.update(JSON.stringify(extra || null));
	return hash.digest('hex').slice(0, 16);
}

if (!isMainThread) {
	const { WC, _, seeded } = require('../detective-inference/lib');
	const jacks = require('./jacks');
	const police = require('./police');
	const { blockedDistance, entries } = require('../jack-v2/record');
	const hybrid = { weighting: 'hybrid', w: 0.9, rho: 0.5 };

	function play(seed) {
		const make = workerData.mix ? jacks.matchedMixed(workerData.mix) : jacks.policies[workerData.jack];
		const ai = make(seed);
		const nights = [];
		let current = null;
		const times = [];
		const timed = Object.assign({}, ai, {
			chooseMove(view) {
				if (!current || current.night !== view.night) {
					const homes = WC.deduction.hideouts(view.pastLogs(), WC.rules.hideoutChoices(), hybrid);
					current = {
						night: view.night, available: view.remainingMoves, startDistance: WC.board.distance(view.position, view.hideout),
						used: 0, belief: homes[view.hideout] || 0, walledOff: false, guarded: 0, policeTurns: 0
					};
					nights.push(current);
				}
				const t = process.hrtime.bigint();
				const move = ai.chooseMove(view);
				times.push(Number(process.hrtime.bigint() - t) / 1e6);
				if (blockedDistance(view.position, view.hideout, view.policeNow()) > view.remainingMoves) current.walledOff = true;
				current.used += move.type === 'carriage' ? 2 : 1;
				return move;
			}
		});
		const policeAI = police.create(workerData.police);
		const policeRandom = seeded(seed * 104729 + 2);
		const game = WC.engine.create({ ai: timed });
		game.start();
		const homeEntries = entries(game.state.base);
		for (let actions = 0; !game.state.over && actions < 20000; actions++) {
			const state = game.state;
			const view = WC.rules.policeView(state);
			if (current && state.phase === 11 && !(state.turn.done && state.turn.done.length)) {
				current.policeTurns++;
				if (WC.rules.policeNight(state).now.some((c) => homeEntries.includes(c))) current.guarded++;
			}
			policeAI.turn(game, view, policeRandom);
		}
		const final = game.state;
		const modes = (ai.debug && ai.debug.nights) || [];
		nights.forEach((n, i) => {
			const m = modes.find((x) => x.night === n.night);
			n.mode = m ? m.mode : null;
			n.pressure = m ? m.pressure : null;
			n.detours = m ? m.detours : null;
			n.skipped = m ? m.skipped : null;
			n.escaped = i < nights.length - 1 || final.result.type === 'jackWins';
			n.outcome = n.escaped ? 'escaped' : final.result.type;
			n.detour = n.escaped ? n.used - n.startDistance : null;
			n.guarded = n.policeTurns ? n.guarded / n.policeTurns : 0;
			delete n.policeTurns;
		});
		const sorted = times.slice().sort((a, b) => a - b);
		return {
			seed, result: final.result.type, night: final.jack.length, hideout: final.base, nights,
			ms: { decisions: times.length, mean: times.reduce((a, b) => a + b, 0) / (times.length || 1), p99: sorted[Math.floor(sorted.length * 0.99)] || 0, max: sorted[sorted.length - 1] || 0 }
		};
	}
	parentPort.postMessage(workerData.seeds.map(play));
	return;
}

function run({ jack, police, games, from, mix = null, workers = require('os').cpus().length }) {
	const dir = path.join(__dirname, 'results');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${jack}__${police}__${from}-${games}.json`);
	const print = fingerprint(mix);
	if (fs.existsSync(file)) {
		const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
		if (stored.fingerprint === print) return Promise.resolve(stored);
	}
	const seeds = Array.from({ length: games }, (x, i) => from + i);
	const chunks = Array.from({ length: Math.min(workers, seeds.length) }, (x, w) => seeds.filter((s, i) => i % workers === w));
	const started = Date.now();
	return Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
		const worker = new Worker(__filename, { workerData: { jack, police, seeds: chunk, mix } });
		worker.on('message', resolve);
		worker.on('error', reject);
	}))).then((parts) => {
		const out = { jack, police, from, games, mix, fingerprint: print, seconds: Math.round((Date.now() - started) / 1000),
			results: [].concat(...parts).sort((a, b) => a.seed - b.seed) };
		fs.writeFileSync(file, JSON.stringify(out));
		return out;
	});
}

if (require.main === module) {
	const [jack, police, games, from, mixJson] = process.argv.slice(2);
	run({ jack, police, games: Number(games), from: Number(from), mix: mixJson ? JSON.parse(mixJson) : null }).then((r) => {
		const wins = r.results.filter((g) => g.result === 'jackWins').length;
		console.log(JSON.stringify({ jack, police, games: r.results.length, jackWins: wins, rate: +(wins / r.results.length).toFixed(3), seconds: r.seconds }));
	});
}

module.exports = { run, fingerprint };
