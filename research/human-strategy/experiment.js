// Small paired experiments for docs/human-strategy-literature.md: a Jack policy (research/human-strategy/policies.js,
// or any name research/jack-v2/policies.js knows) against a police configuration, on seeded games, on every core.
// Games are recorded by research/jack-v2/record.js (the referee's view, for measurement only).
//   node research/human-strategy/experiment.js <jack> <police> <games> <first seed>
// Police: the configurations of research/detective-v2/configs.js, plus 'v2-detour-aware' and 'v2-wretched-away' below.
// Prints one JSON line per run and writes results/<jack>__<police>__<first seed>-<games>.json.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Detective AI v2, except that it expects Jack to take a detour of about `target` moves each night, as Jack AI v2's
// early detours do (3.2 moves on average, docs/jack-ai-v2.md): a possible hideout is likelier the closer the night's
// detour to it is to `target`, instead of the closer to 0. Everything it uses is public: the move counts and crime
// scenes. It models a detective who has learnt the opponent's habit; it is not a proposed police AI.
function detourAwareDeduction(WC, _, target) {
	const base = WC.deduction;
	return Object.assign({}, base, {
		hideouts(pastLogs, choices, options) {
			options = options || {};
			if (options.weighting !== 'hybrid') return base.hideouts(pastLogs, choices, options);
			const weights = {};
			choices.forEach((h) => { weights[h] = 1; });
			for (const log of pastLogs) {
				if (!_.findWhere(log, { type: 'escaped' })) continue;
				const end = base.track(log);
				if (!end) continue;
				const night = base.readLog(log);
				const moves = night.steps.length;
				for (const h of Object.keys(weights)) {
					if (!(end.current[h] > 0)) { weights[h] = 0; continue; }
					const shortest = _.min(night.scenes.map((s) => WC.board.distance(s, Number(h))));
					const detour = Math.max(0, moves - shortest);
					weights[h] *= (1 - options.w) + options.w * Math.pow(options.rho, Math.abs(detour - target));
				}
			}
			const sum = _.reduce(weights, (t, w) => t + w, 0);
			const result = {};
			_.each(weights, (w, h) => { if (w > 0) result[h] = w / sum; });
			return _.size(result) ? result : base.hideouts(pastLogs, choices, options);
		}
	});
}

if (!isMainThread) {
	const { WC, _, seeded } = require('../detective-inference/lib');
	const configs = require('../detective-v2/configs');
	const policies = require('../jack-v2/policies');
	const local = require('./policies');
	// Jack: the study's own policies first, then the Jack v2 study's
	const create = policies.create;
	policies.create = (name, seed) => (local[name] ? local[name](WC.random.create(seeded(seed * 7919 + 1))) : create(name, seed));
	// Police: two extra configurations of Detective AI v2, each changing one thing
	configs['v2-detour-aware'] = Object.assign({}, configs.v2, { detourTarget: 3 });
	configs['v2-wretched-away'] = Object.assign({}, configs.v2, { wretchedAway: true });
	const createPolice = WC.createPolice;
	WC.createPolice = function (board, rules, deduction, u, options) {
		if (options && options.detourTarget !== undefined) deduction = detourAwareDeduction(WC, _, options.detourTarget);
		const ai = createPolice.call(this, board, rules, deduction, u, options);
		if (options && options.wretchedAway) {
			// Pas L's counter: move each Wretched as far as possible from the hideouts the police think likely (the
			// same weights v2 blocks with), instead of towards the patrols. On the first night every hideout counts
			const turn = ai.turn;
			ai.turn = function (game, view, random) {
				if (view.phase !== 5) return turn.call(this, game, view, random);
				const homes = deduction.hideouts(view.pastLogs(), rules.hideoutChoices(), { weighting: options.hideoutWeighting, w: options.hideoutW, rho: options.hideoutRho });
				const from = view.wretched[view.turn.pending[0]];
				const moves = view.wretchedMoves(from);
				if (!moves.length) return game.keepWretched(from);
				const far = (c) => _.reduce(homes, (sum, p, h) => sum + p * Math.min(6, board.distance(c, Number(h))), 0);
				return game.moveWretched(from, _.max(moves, far));
			};
		}
		return ai;
	};
	const { recordGame } = require('../jack-v2/record');
	const games = workerData.seeds.map((seed) => {
		const g = recordGame({ jack: workerData.jack, police: workerData.police, seed });
		const last = g.nights[g.nights.length - 1];
		return {
			seed, result: g.result, night: g.night, hideout: WC.board.number(g.hideout),
			nights: g.nights.map((x) => ({ used: x.used, start: x.startDistance, escaped: x.escaped, carriages: x.carriages, belief: Number(x.hideoutBelief.toFixed(4)), guarded: Number(x.entryGuarded.toFixed(3)) })),
			lastMoves: last ? last.used : 0,
			ms: Math.max(0, ...g.decisions.map((d) => d.ms))
		};
	});
	parentPort.postMessage(games);
	return;
}

function run(jack, police, games, from) {
	const workers = require('os').cpus().length;
	const seeds = Array.from({ length: games }, (x, i) => from + i);
	const started = Date.now();
	return Promise.all(Array.from({ length: Math.min(workers, games) }, (x, w) => new Promise((resolve, reject) => {
		const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % workers === w), jack, police } });
		worker.on('message', resolve);
		worker.on('error', reject);
	}))).then((parts) => {
		const all = parts.flat().sort((a, b) => a.seed - b.seed);
		const dir = path.join(__dirname, 'results');
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, `${jack}__${police}__${from}-${games}.json`), JSON.stringify(all));
		return { games: all, seconds: (Date.now() - started) / 1000 };
	});
}

module.exports = { run, detourAwareDeduction };

if (require.main === module) {
	const [jack, police, games, from] = process.argv.slice(2);
	run(jack, police, Number(games), Number(from)).then(({ games: all, seconds }) => {
		const wins = all.filter((g) => g.result === 'jackWins').length;
		console.log(JSON.stringify({ jack, police, from: Number(from), games: all.length, wins, seconds: Math.round(seconds) }));
	});
}
