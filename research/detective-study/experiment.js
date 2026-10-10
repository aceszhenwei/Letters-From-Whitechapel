// Seeded games for the Detective AI v3 study (docs/detective-study.md): a Jack (jacks.js) against Detective AI v3 or a
// last-night variant (configs.js), on every core.
//   node research/detective-study/experiment.js <jack> <variant> <games> <first seed>
// Records, per game: the result and the night it was decided, each night's public record and Jack's true hideout (for
// scoring the hideout belief offline: calibration.js), and, for each of the police's moves on the last night, what the
// referee knows (Jack's circle, moves and tokens left), where the policemen stood before and after, and what the police
// believed (the weight on Jack's true circle and true hideout, the hideout's rank), for every variant. The referee's knowledge is only
// recorded for analysis; the police never see it, except in the variants labelled ORACLE.
// Writes results/<jack>__<variant>__<first seed>-<games>.json (reused if present) and prints one JSON line.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const lib = require('../detective-inference/lib');
	const { WC, _, seeded } = lib;
	const jacks = require('./jacks');
	const configs = require('./configs');
	const { rules, board } = WC;
	const lastNight = rules.config.nights - 1;

	function play(seed) {
		const ai = jacks.create(workerData.jack, seed);
		const variant = configs.variants[workerData.variant] || {};
		const referee = { home: null, position: null };
		// ORACLE deductions: only for the variants that say so
		const oracle = Object.assign({}, WC.deduction, {
			hideouts(pastLogs, choices, options) {
				return variant.oracle === 'hideout' || variant.oracle === 'both' ? _.object([referee.home], [1]) : WC.deduction.hideouts(pastLogs, choices, options);
			},
			track(log, options) {
				const result = WC.deduction.track(log, options);
				if (result && (variant.oracle === 'position' || variant.oracle === 'both') && referee.position !== null) {
					result.current = _.object([referee.position], [1]);
				}
				return result;
			}
		});
		const base = WC.createPolice(board, rules, WC.deduction, _, configs.v3);
		const last = workerData.variant === 'v3' ? base :
			WC.createPolice(board, rules, variant.oracle ? oracle : WC.deduction, _, Object.assign({}, configs.v3, _.omit(variant, 'oracle')));
		const policeRandom = seeded(seed * 104729 + 2);
		const game = WC.engine.create({ ai });
		const turns = [];
		game.start();
		referee.home = game.state.base;
		for (let actions = 0; !game.state.over && actions < 20000; actions++) {
			const state = game.state;
			const view = rules.policeView(state);
			const police = view.night === lastNight ? last : base;
			const jackNight = rules.jackNight(state);
			referee.position = jackNight && jackNight.route.length ? _.last(jackNight.route) : null;
			if (view.phase === 10 && view.night === lastNight && view.turn.moved.length === 0) {
				const known = police.belief(view, false);
				const homes = known.hideouts;
				const ranked = _.sortBy(Object.keys(homes), (h) => -homes[h]);
				turns.push({
					position: referee.position,
					remaining: state.remainingMoves,
					tokens: { carriages: jackNight.carriages, alleys: jackNight.alleys },
					before: view.police.now.slice(),
					jackBelief: known.jack ? (known.jack.current[referee.position] || 0) : null,
					jackCircles: known.jack ? _.size(known.jack.current) : null,
					homeBelief: homes[referee.home] || 0,
					homeRank: ranked.indexOf(String(referee.home)) + 1,
					homeCandidates: ranked.length
				});
			}
			police.turn(game, view, policeRandom);
			if (view.phase === 10 && view.night === lastNight && turns.length && !turns[turns.length - 1].after && game.state.phase !== 10) {
				turns[turns.length - 1].after = rules.policeNight(game.state).now.slice();
			}
		}
		const state = game.state;
		const nights = state.jack.map((night, i) => !!_.findWhere(state.police[i].log || [], { type: 'escaped' }));
		return {
			seed,
			result: state.result ? state.result.type : 'unfinished',
			decided: state.jack.length, // The night the game ended on
			escaped: nights,
			home: state.base,
			logs: workerData.variant === 'v3' ? state.police.map((n, i) => rules.publicLog(state, i)) : undefined,
			lastTurns: turns
		};
	}

	parentPort.postMessage(workerData.seeds.map(play));
} else {
	const [jack, variant, games, first] = process.argv.slice(2);
	const seeds = Array.from({ length: Number(games) }, (_, i) => Number(first) + i);
	const dir = path.join(__dirname, 'results');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${jack}__${variant}__${first}-${games}.json`);
	const report = (all) => console.log(JSON.stringify({ jack, variant, games: all.length, jackWins: all.filter((g) => g.result === 'jackWins').length }));
	if (fs.existsSync(file)) {
		report(JSON.parse(fs.readFileSync(file, 'utf8')).games);
	} else {
		const workers = Math.min(require('os').cpus().length, seeds.length);
		const chunks = Array.from({ length: workers }, (_, w) => seeds.filter((s, i) => i % workers === w));
		Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
			const worker = new Worker(__filename, { workerData: { jack, variant, seeds: chunk } });
			worker.on('message', resolve);
			worker.on('error', reject);
		}))).then((parts) => {
			const all = [].concat(...parts).sort((a, b) => a.seed - b.seed);
			fs.writeFileSync(file, JSON.stringify({ jack, variant, seeds: [seeds[0], seeds[seeds.length - 1]], games: all }));
			report(all);
		});
	}
}
