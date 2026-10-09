// Seeded games for the strategic-waiting study (docs/jack-waiting.md): a Jack (research/jack-waiting/jacks.js, or any
// research/jack-v2/policies.js name) against a police (original, v2 or v3: WC.policeVariants), on every core.
//   node research/jack-waiting/experiment.js <jack> <police> <games> <first seed>
// Measured per night by the referee: how often Jack waited, where he killed (a red circle or a circle a Wretched was
// moved to), how far that was from home, the moves he had, what he revealed, and how the night ended. Writes
// results/<jack>__<police>__<first seed>-<games>.json and reuses it if present; prints one JSON line.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const lib = require('../detective-inference/lib');
	const { WC, _, seeded } = lib;
	const jacks = require('./jacks');
	const { rules, board } = WC;

	function play(seed) {
		const ai = jacks.create(workerData.jack, seed);
		const police = WC.createPolice(board, rules, WC.deduction, _, WC.policeVariants[workerData.police]);
		const policeRandom = seeded(seed * 104729 + 2);
		const game = WC.engine.create({ ai });
		const reveals = [];
		game.on((event, data) => {
			if (event === 'patrolRevealed') (reveals[game.state.police.length - 1] = reveals[game.state.police.length - 1] || []).push(data.fake ? 'fake' : 'real');
		});
		game.start();
		for (let actions = 0; !game.state.over && actions < 20000; actions++) {
			police.turn(game, rules.policeView(game.state), policeRandom);
		}
		const state = game.state;
		const nights = state.jack.map((night, i) => {
			if (night.murder.length === 0) return null;
			const scene = night.murder[night.murder.length - 1];
			const escaped = !!_.findWhere(state.police[i].log || [], { type: 'escaped' });
			// At the murder: was the scene within one police turn of a token Jack could think real (any token not revealed
			// fake), and of a real one?
			const p = state.police[i];
			const possible = _.difference(_.union(p.start, p.fake), _.intersection(p.revealed, p.fake));
			const reach = (tokens) => _.contains(_.flatten(_.union(tokens, _.flatten(tokens.map((c) => board.crossingsWithinTwo(c)))).map((c) => board.adjacentNumbers(c))), scene);
			return {
				waits: 5 - night.murderMove[0], // Killing on I (move-track space 5) means he never waited
				moves: rules.config.trackLength - night.murderMove[night.murderMove.length - 1], // Moves he had after the murder
				used: night.route.length - 1,
				scene,
				red: _.contains(board.redCircles(), scene),
				home: board.distance(scene, state.base),
				spare: rules.config.trackLength - night.murderMove[night.murderMove.length - 1] - board.distance(scene, state.base),
				possibleReach: reach(possible),
				realReach: reach(p.start),
				exits: board.walk(scene, []).length,
				reveals: reveals[i] || [],
				end: escaped ? 'escaped' : (state.result ? state.result.type : 'unfinished')
			};
		}).filter(Boolean);
		return { seed, result: state.result ? state.result.type : 'unfinished', nights, detours: ai.debug ? ai.debug.detours || 0 : 0 };
	}

	parentPort.postMessage(workerData.seeds.map(play));
} else {
	const [jack, police, games, first] = process.argv.slice(2);
	const seeds = Array.from({ length: Number(games) }, (_, i) => Number(first) + i);
	const dir = path.join(__dirname, 'results');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${jack}__${police}__${first}-${games}.json`);
	const report = (all) => console.log(JSON.stringify({ jack, police, games: all.length, jackWins: all.filter((g) => g.result === 'jackWins').length }));
	if (fs.existsSync(file)) {
		report(JSON.parse(fs.readFileSync(file, 'utf8')).games);
	} else {
		const workers = Math.min(require('os').cpus().length, seeds.length);
		const chunks = Array.from({ length: workers }, (_, w) => seeds.filter((s, i) => i % workers === w));
		Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
			const worker = new Worker(__filename, { workerData: { jack, police, seeds: chunk } });
			worker.on('message', resolve);
			worker.on('error', reject);
		}))).then((parts) => {
			const all = [].concat(...parts).sort((a, b) => a.seed - b.seed);
			fs.writeFileSync(file, JSON.stringify({ jack, police, seeds: [seeds[0], seeds[seeds.length - 1]], games: all }));
			report(all);
		});
	}
}
