// Seeded games for the Detective AI v3 study (docs/detective-ai-v3.md): a Jack policy against a police configuration
// (research/detective-v3/configs.js), on every core, with the measures this study needs, taken by the referee:
// per night, whether the murder was one walk from the hideout and whether a policeman closed that walk when the night
// began, one-move escapes, clues and arrests. Jacks: any name of research/jack-v2/policies.js or
// research/human-strategy/policies.js.
//   node research/detective-v3/experiment.js <jack> <police> <games> <first seed>
// Writes results/<jack>__<police>__<first seed>-<games>.json; prints one JSON line.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const lib = require('../detective-inference/lib');
	const { WC, _, seeded } = lib;
	const policies = require('../jack-v2/policies');
	const local = Object.assign({}, require('../human-strategy/policies'), require('./jacks'));
	const configs = require('./configs');
	// Diagnostic oracle: the police's hideout belief is the true hideout (set by the referee before each police action)
	// (from night `oracle`, counting from 1; before that the police's own belief)
	let trueHideout = null;
	let night = 0;
	const oracleFrom = (from, base) => Object.assign({}, base, {
		hideouts(pastLogs, choices, options) { return night >= from ? _.object([trueHideout], [1]) : base.hideouts(pastLogs, choices, options); }
	});
	const createPolice = WC.createPolice;
	WC.createPolice = function (board, rules, deduction, u, options) {
		return createPolice.call(this, board, rules, options && options.oracle ? oracleFrom(options.oracle, deduction) : deduction, u, options);
	};
	lib.registerJack('__experiment', (random) => (local[workerData.jack] ? local[workerData.jack](random) : null));
	const games = workerData.seeds.map((seed) => {
		const jack = local[workerData.jack] ? '__experiment' : workerData.jack;
		if (!local[workerData.jack] && !WC.strategicVariants[jack] && jack !== 'baseline') {
			lib.registerJack('__experiment', () => policies.create(workerData.jack, seed));
		}
		const t = { worst: 0, total: 0, turns: 0 };
		const onPolice = (state) => { trueHideout = state.base; night = state.police.length; };
		// Time each police decision
		const create = WC.createPolice;
		WC.createPolice = function () {
			const ai = create.apply(this, arguments);
			const turn = ai.turn;
			ai.turn = function (game, view, random) {
				const s = process.hrtime.bigint();
				turn.call(this, game, view, random);
				const ms = Number(process.hrtime.bigint() - s) / 1e6;
				t.worst = Math.max(t.worst, ms); t.total += ms; t.turns++;
			};
			return ai;
		};
		let state;
		try {
			state = lib.play({ jack: local[workerData.jack] ? '__experiment' : (WC.strategicVariants[jack] || jack === 'baseline' ? jack : '__experiment'), police: 'deductive', seed, policeOptions: configs[workerData.police], onPolice });
		} finally {
			WC.createPolice = create;
		}
		const home = state.base;
		const nights = state.jack.map((night, i) => {
			const police = state.police[i];
			const start = police.route.map((r) => r[0]); // Where the policemen stood when the night began
			const scene = night.murder[night.murder.length - 1];
			const oneWalk = scene !== undefined && WC.board.walk(scene, []).includes(home);
			const open = oneWalk && WC.board.walk(scene, start).includes(home);
			const log = WC.rules.publicLog(state, i);
			const escaped = i < state.jack.length - 1 || state.result.type === 'jackWins';
			return {
				used: night.moves.reduce((n, m) => n + (m.type === 'carriage' ? 2 : 1), 0),
				start: scene === undefined ? null : WC.board.distance(scene, home),
				escaped, oneWalk, open,
				clues: log.filter((e) => e.type === 'search' && e.clue).length,
				arrests: log.filter((e) => e.type === 'arrest').length
			};
		});
		return {
			seed, result: state.result.type, night: state.jack.length, hideout: WC.board.number(home),
			nights, policeMs: { mean: t.total / Math.max(1, t.turns), worst: t.worst }
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

module.exports = { run };

if (require.main === module) {
	const [jack, police, games, from] = process.argv.slice(2);
	run(jack, police, Number(games), Number(from)).then(({ games: all, seconds }) => {
		const wins = all.filter((g) => g.result === 'jackWins').length;
		console.log(JSON.stringify({ jack, police, from: Number(from), games: all.length, wins, seconds: Math.round(seconds) }));
	});
}
