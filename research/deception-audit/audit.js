// The fake Wretched (unmarked women) and fake patrol audit (docs/deception-audit.md): what the preparation phase's
// hidden choices are worth, measured by the referee, without changing any AI.
//
//   node research/deception-audit/audit.js <jack> <police> <variant> <games> <first seed>
//
// Jacks: baseline, strategic, jack-v2. Police: original, v2, v3 (WC.policeVariants). Variants:
//   normal          the AIs as they are
//   jack-oracle     Jack is told which patrol tokens are fake (an upper bound on what the fakes hide from him)
//   jack-infer      Jack assumes the tokens on the crossings where policemen ended the night before are the real ones
//                   (legal: public information and the police's own placement rule), and the others fake
//   police-random   the police keep their seven token crossings but choose at random which five are real
//   police-oracle   the police know which women are marked when choosing which tokens are real (an upper bound on
//                   what the fake Wretched hide from them)
// Measured per night: whether women filled every legal red circle, which tokens were fake and whether that followed
// the public rule, how often Jack waited and what he revealed, and how much the police's Wretched moves told Jack
// about which tokens are real (how many real/fake designations stay consistent with what he saw).
// Writes results/<jack>__<police>__<variant>__<first seed>-<games>.json (reused if present) and prints one JSON line.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function combinations(list, k) {
	if (k === 0) return [[]];
	if (list.length < k) return [];
	const [first, ...rest] = list;
	return combinations(rest, k - 1).map((c) => [first].concat(c)).concat(combinations(rest, k));
}

if (!isMainThread) {
	const lib = require('../detective-inference/lib');
	const { WC, _, seeded } = lib;
	const policies = require('../jack-v2/policies');
	const { rules, board } = WC;
	const { variant } = workerData;

	// Jack's view, altered only for the jack-* variants
	const jackView = rules.jackView;
	rules.jackView = function (state, options) {
		const view = jackView.call(this, state, options);
		if (variant !== 'jack-oracle' && variant !== 'jack-infer') return view;
		return Object.assign({}, view, {
			patrols() {
				const night = rules.policeNight(state);
				const required = rules.patrolPositions(state).required;
				return view.patrols().map((p) => {
					if (p.revealed) return p;
					const real = variant === 'jack-oracle' ? !_.contains(night.fake, p.mapid) : (required.length === 0 || _.contains(required, p.mapid));
					return { mapid: p.mapid, revealed: true, real };
				});
			}
		});
	};

	const near = (circle, real) => _.min(_.map(real, (crossing) => _.min(_.map(board.adjacentNumbers(crossing), (id) => board.distance(circle, id)))));
	const reachOf = (crossing) => _.uniq(_.flatten(board.crossingsWithinTwo(crossing).concat([crossing]).map((c) => board.adjacentNumbers(c))));

	function play(seed) {
		const ai = policies.create(workerData.jack, seed);
		const police = WC.createPolice(board, rules, WC.deduction, _, WC.policeVariants[workerData.police]);
		const policeRandom = seeded(seed * 104729 + 2);
		const designRandom = seeded(seed * 15485863 + 3);
		const game = WC.engine.create({ ai });
		const nights = [];
		const current = () => nights[game.state.police.length - 1];
		// Wretched moves: what Jack sees, and the designations of the tokens it is consistent with
		const moveWretched = game.moveWretched;
		game.moveWretched = function (from, to) {
			const night = rules.policeNight(game.state);
			current().moves.push({ legal: rules.wretchedMoves(game.state, from), to, tokens: rules.patrolTokens(game.state), revealed: night.revealed.slice(), real: night.start.slice() });
			return moveWretched.call(this, from, to);
		};
		game.on((event, data) => {
			if (event === 'patrolRevealed') current().reveals.push(data.fake ? 'fake' : 'real');
		});
		game.start();
		for (let actions = 0; !game.state.over && actions < 20000; actions++) {
			const state = game.state;
			const view = rules.policeView(state);
			if (view.phase === 2 && !current()) {
				const positions = rules.patrolPositions(state);
				nights.push({
					women: state.womenMarked.length + state.womenUnmarked.length, targets: rules.targetCircles(state).length,
					marked: state.womenMarked.slice(), required: positions.required.slice(), moves: [], reveals: []
				});
			}
			if (view.phase === 2 && (variant === 'police-random' || variant === 'police-oracle')) {
				// The police's own seven crossings, then a different choice of which five are real
				const placed = [];
				police.turn({ togglePatrol: (c, kind) => placed.push({ c, kind }) }, view, policeRandom);
				const spots = _.pluck(placed, 'c');
				let real;
				if (variant === 'police-random') {
					real = _.sortBy(spots.map((c) => ({ c, r: designRandom() })), 'r').slice(0, rules.config.police).map((o) => o.c);
				} else {
					real = [];
					const covered = new Set();
					const preferred = _.pluck(placed.filter((p) => p.kind === 'real'), 'c');
					while (real.length < rules.config.police) {
						const best = _.max(_.difference(spots, real), (c) => reachOf(c).filter((w) => _.contains(state.womenMarked, w) && !covered.has(w)).length * 10 + (_.contains(preferred, c) ? 1 : 0));
						real.push(best);
						reachOf(best).forEach((w) => covered.add(w));
					}
				}
				spots.forEach((c) => game.togglePatrol(c, _.contains(real, c) ? 'real' : 'fake'));
			} else {
				police.turn(game, view, policeRandom);
			}
		}
		const state = game.state;
		const summary = nights.map((n, i) => {
			const police = state.police[i];
			const jack = state.jack[i];
			const free = _.difference(_.union(police.start, police.fake), n.required);
			// Designations Jack can't rule out: by his reveals, and then also by the police's Wretched moves (their rule:
			// each moves to the legal circle nearest a real token, the first such in the list)
			const tokens = _.union(police.start, police.fake);
			const all = combinations(tokens, rules.config.police);
			const byReveals = all.filter((d) => police.revealed.every((m) => _.contains(d, m) === _.contains(police.start, m)));
			const byMoves = byReveals.filter((d) => n.moves.every((m) => m.legal.length === 0 || _.min(m.legal, (c) => near(c, d)) === m.to));
			const fakesKnown = (list) => list.length > 0 && list.every((d) => _.isEqual(_.difference(tokens, d).sort(), _.difference(tokens, list[0]).sort()));
			return {
				filled: n.women === n.targets,
				fakes: police.fake.slice().sort((a, b) => a - b),
				fakesOnFreeStations: i > 0 ? _.isEqual(free.sort(), police.fake.slice().sort()) : null,
				waits: jack.murderMove.length > 0 ? 5 - jack.murderMove[0] : null, // Killing on I (space 5) means he never waited
				reveals: n.reveals,
				wretchedMoves: n.moves.length,
				designations: { all: all.length, afterReveals: byReveals.length, afterMoves: byMoves.length, fakesKnownByMoves: fakesKnown(byMoves) && !fakesKnown(byReveals) }
			};
		});
		return { seed, result: state.result ? state.result.type : 'unfinished', nights: summary };
	}

	parentPort.postMessage(workerData.seeds.map(play));
} else {
	const [jack, police, variant, games, first] = process.argv.slice(2);
	const seeds = Array.from({ length: Number(games) }, (_, i) => Number(first) + i);
	const dir = path.join(__dirname, 'results');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${jack}__${police}__${variant}__${first}-${games}.json`);
	const report = (all) => {
		const wins = all.filter((g) => g.result === 'jackWins').length;
		console.log(JSON.stringify({ jack, police, variant, games: all.length, jackWins: wins }));
	};
	if (fs.existsSync(file)) {
		report(JSON.parse(fs.readFileSync(file, 'utf8')).games);
	} else {
		const workers = Math.min(require('os').cpus().length, seeds.length);
		const chunks = Array.from({ length: workers }, (_, w) => seeds.filter((s, i) => i % workers === w));
		Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
			const worker = new Worker(__filename, { workerData: { jack, police, variant, seeds: chunk } });
			worker.on('message', resolve);
			worker.on('error', reject);
		}))).then((parts) => {
			const all = _sort([].concat(...parts));
			fs.writeFileSync(file, JSON.stringify({ jack, police, variant, seeds: [seeds[0], seeds[seeds.length - 1]], games: all }));
			report(all);
		});
	}
	function _sort(list) { return list.sort((a, b) => a.seed - b.seed); }
}
