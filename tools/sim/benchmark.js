// How much work the strategic Jack does per move, and what its pruning saves.
// Plays the same seeded games (strategic Jack against the deductive police) with the normal beam (the 6 most promising
// first moves looked at two moves deep) and with no pruning (every first move looked at), on one thread, and reports
// decision times, moves valued and belief projections, and how often the two choose differently.
//
//   node tools/sim/benchmark.js [games] [first seed]
const { loadCore, seeded } = require('./run-game');

const games = Number(process.argv[2] || 100);
const from = Number(process.argv[3] || 1);

function play(core, seed, options) {
	const { WC, _ } = core;
	const ai = WC.createStrategicJack(WC.board, WC.deduction, WC.random.create(seeded(seed * 7919 + 1)), _, options);
	const police = WC.createPolice(WC.board, WC.rules, WC.deduction, _);
	const policeRandom = seeded(seed * 104729 + 2);
	const decisions = [];
	const game = WC.engine.create({
		ai: Object.assign({}, ai, {
			chooseMove(view) {
				const start = process.hrtime.bigint();
				const move = ai.chooseMove(view);
				decisions.push({
					ms: Number(process.hrtime.bigint() - start) / 1e6,
					valued: ai.debug.valued,
					projections: ai.debug.projections,
					candidates: ai.debug.policeCandidates,
					move: move.type + ':' + move.mapid
				});
				return move;
			}
		})
	});
	game.start();
	for (let actions = 0; !game.state.over && actions < 20000; actions++) {
		police.turn(game, WC.rules.policeView(game.state), policeRandom);
	}
	return decisions;
}

function stats(values) {
	const sorted = values.slice().sort((a, b) => a - b);
	const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	return { mean, median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
}

function report(title, decisions) {
	const line = (name, s, digits) => `  ${name.padEnd(28)} mean ${s.mean.toFixed(digits)}, median ${s.median.toFixed(digits)}, p95 ${s.p95.toFixed(digits)}, max ${s.max.toFixed(digits)}`;
	console.log(`${title}: ${decisions.length} decisions`);
	console.log(line('decision time (ms)', stats(decisions.map((d) => d.ms)), 1));
	console.log(line('moves valued', stats(decisions.map((d) => d.valued)), 0));
	console.log(line('belief projections', stats(decisions.map((d) => d.projections)), 0));
	console.log(line('police candidate circles', stats(decisions.map((d) => d.candidates)), 0));
}

const core = loadCore();
const beam = [];
const full = [];
let different = 0;
let compared = 0;
for (let seed = from; seed < from + games; seed++) {
	const a = play(core, seed, {});
	const b = play(core, seed, { beam: Infinity });
	beam.push(...a);
	full.push(...b);
	// The games part ways at the first different choice: compare up to there
	for (let i = 0; i < Math.min(a.length, b.length); i++) {
		compared++;
		if (a[i].move !== b[i].move) {
			different++;
			break;
		}
	}
}
console.log(`strategic Jack against the deductive police, seeds ${from}-${from + games - 1}`);
report('beam of 6 (as played)', beam);
report('no pruning', full);
console.log(`  same choice as without pruning in ${compared - different} of ${compared} decisions compared (${(100 * (compared - different) / compared).toFixed(1)}%)`);
