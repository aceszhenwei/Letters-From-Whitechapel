// Investigation 2026-10-11, coaches (docs/playtests.md#investigations-targeted; the report is
// 2026-10-11-investigation-coaches.md). Every human Jack so far spent all three of night 1's coaches at the start of
// the night, and Detective AI v3's belief about where he was stayed diffuse. Does spending them that way cause it?
//
// A controlled experiment between computer players: the same computer Jack, with and without the human habit, against
// Detective AI v3, on the same seeds. Each game is played to its end as the page would play it, kept as a full record,
// and measured with the earlier investigation's script (2026-10-11-investigation-arrests.js, `study`, unchanged), so
// the numbers are the ones the human reports use.
//   node research/human-playtests/reports/2026-10-11-investigation-coaches.js run <jack> <habit> <games> <first seed>
//   node research/human-playtests/reports/2026-10-11-investigation-coaches.js summary [--json]
//   node research/human-playtests/reports/2026-10-11-investigation-coaches.js humans [--json]
// Jacks: 'hard' (Jack AI v2) and 'normal' (Strategic Jack), the difficulty levels. Habits:
//   none       the computer Jack as it plays
//   night1     on night 1, a coach on every move from the first while he has one (the human habit)
//   every      the same on every night (the humans coached early on later nights too)
// A forced coach is a random legal one (its own seeded stream) that ends at most one walk farther from home than he
// stands, and leaves at least 2 moves more than the walk home needs; when none qualifies, or a walk reaches home, the
// computer Jack plays. The humans' 21 night-1 coaches: 12 ended closer to home, 5 as far, 4 farther (one or two walks).
// Results: one JSON file per run in results/coaches/. Read-only for the game: it changes no AI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { loadWithAI } = require('../../../tools/game-log/core');
const { seeded } = require('../../../tools/game-log/make-examples');

const resultsDir = path.join(__dirname, 'results', 'coaches');
const records = path.join(__dirname, '..', 'records');

function habitJack(WC, base, habit, random) {
	// The computer Jack, except that on the chosen nights his first moves are coaches while he has one
	if (habit === 'none') return base;
	let night = null;
	let streak = false; // Every move tonight so far was a coach
	return Object.assign({}, base, {
		chooseMove(view) {
			if (view.night !== night) {
				night = view.night;
				streak = true;
			}
			const applies = habit === 'every' || (habit === 'night1' && view.night === 0);
			if (applies && streak && view.tokens.carriages > 0 && !view.walks().includes(view.hideout)) {
				const here = view.distanceToHideout(view.position);
				const options = view.specialMoves().filter((o) => o.type === 'carriage' &&
					view.distanceToHideout(o.mapid) <= here + 1 && view.remainingMoves - 2 - view.distanceToHideout(o.mapid) >= 2);
				if (options.length) {
					const pick = options[Math.floor(random() * options.length)];
					return { mapid: pick.mapid, type: 'carriage', via: pick.via };
				}
			}
			streak = false;
			return base.chooseMove(view);
		}
	});
}

function playOne(jack, habit, seed) {
	// As tools/game-log/make-examples.js plays a game, with Detective AI v3 and the Jack given the habit
	const context = loadWithAI(seeded(seed));
	const { WC } = context;
	const base = WC.difficulty.create(WC, jack);
	const ai = habitJack(WC, base, habit, seeded(seed * 7919 + 3));
	const game = WC.engine.create({ ai, confirmPoliceMoves: true, reviewNights: true });
	const recorder = WC.record.attach(game, {
		gameId: `coaches-${jack}-${habit}-${seed}`,
		players: { jack: { type: 'ai', level: jack, ai: WC.difficulty.level(jack).ai }, police: { type: 'ai', level: 'hard', ai: 'Detective AI v3' } },
		randomness: { source: 'seeded', seed }
	});
	const police = WC.createPolice(WC.board, WC.rules, WC.deduction, context._, WC.policeVariants.v3);
	const random = seeded(seed + 1);
	game.start();
	for (let i = 0; i < 5000 && !game.state.over; i++) {
		const state = game.state;
		if (state.phase === 12) game.beginNextNight();
		else if (state.phase === 10 && state.turn.moved.length === WC.rules.policeNight(state).now.length) game.finishPoliceMoves();
		else police.turn(game, WC.rules.policeView(state), random);
	}
	return recorder.exportFull({ date: '2026-10-11' });
}

function measure(full) {
	// Per game: how each night went, and v3's belief at each clue decision (the human reports' measures)
	const { study } = require('./2026-10-11-investigation-arrests');
	const s = study(full.game.id, full);
	const ctx = loadWithAI(() => 0.5);
	const W = ctx.WC;
	const police = W.createPolice(W.board, W.rules, W.deduction, ctx._, W.policeVariants.v3);
	const hideout = full.actions.find((a) => a.type === 'hideout').args.mapid;
	const nights = full.nights.map((n, i) => {
		const moves = n.jack.moves || [];
		// v3's hideout belief when the night began (its first action), as the batch-1 triage measured it
		let rank = null;
		let belief = null;
		let candidates = null;
		if (i > 0) {
			const start = full.actions.findIndex((a) => a.night === i);
			const homes = police.belief(W.rules.policeView(W.record.replay(full, { upto: start }).game.state), false).hideouts;
			const ranked = Object.keys(homes).sort((a, b) => homes[b] - homes[a]);
			rank = ranked.indexOf(String(hideout)) + 1;
			belief = +(homes[hideout] || 0).toFixed(3);
			candidates = ranked.length;
		}
		return {
			night: i + 1,
			moves: moves.length,
			coaches: moves.filter((m) => m.type === 'carriage').length,
			coachesFirst: moves.findIndex((m) => m.type !== 'carriage') === -1 ? moves.length : moves.findIndex((m) => m.type !== 'carriage'),
			alleys: moves.filter((m) => m.type === 'alley').length,
			escaped: !!n.police.escaped,
			hideoutRank: rank, hideoutBelief: belief, hideoutCandidates: candidates
		};
	});
	return {
		seed: full.game.randomness ? full.game.randomness.seed : null,
		result: full.outcome.winner, ending: full.outcome.result, night: full.outcome.night,
		nights,
		decisions: s.decisions.map((d) => [d.night, d.possible, d.rankOfJack, d.reach, d.jackArrestable ? 1 : 0, d.chose === 'arrest' ? 1 : 0])
	};
}

if (!isMainThread) {
	const out = workerData.seeds.map((seed) => Object.assign(measure(playOne(workerData.jack, workerData.habit, seed)), { seed }));
	parentPort.postMessage(out);
	return;
}

function run(jack, habit, games, from) {
	const workers = Math.min(os.cpus().length, games);
	const seeds = Array.from({ length: games }, (x, i) => from + i);
	const started = Date.now();
	return Promise.all(Array.from({ length: workers }, (x, w) => new Promise((resolve, reject) => {
		const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % workers === w), jack, habit } });
		worker.on('message', resolve);
		worker.on('error', reject);
	}))).then((parts) => {
		const all = parts.flat().sort((a, b) => a.seed - b.seed);
		fs.mkdirSync(resultsDir, { recursive: true });
		fs.writeFileSync(path.join(resultsDir, `${jack}__${habit}__${from}-${games}.json`), JSON.stringify(all));
		return { jack, habit, from, games: all.length, jackWins: all.filter((g) => g.result === 'jack').length, seconds: Math.round((Date.now() - started) / 1000) };
	});
}

/* Statistics */
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function tracking(decisions) {
	// The human reports' measures over a set of clue decisions ([night, possible, rank, walks, arrestable, arrested])
	return {
		decisions: decisions.length,
		medianPossible: median(decisions.map((d) => d[1])),
		jackInTopTen: decisions.length ? decisions.filter((d) => d[2] > 0 && d[2] <= 10).length / decisions.length : null,
		medianRankShare: median(decisions.map((d) => d[2] / d[1])),
		medianWalks: median(decisions.map((d) => d[3])),
		jackArrestable: decisions.filter((d) => d[4]).length
	};
}

function bootstrapDiff(a, b, stat, reps = 2000) {
	// Difference stat(a) - stat(b) between two sets of games, with a 95% interval by resampling games (each game's
	// decisions stay together, so the interval allows for games differing from one another). Seeded, so it repeats
	const random = seeded(20261011);
	const pick = (xs) => Array.from({ length: xs.length }, () => xs[Math.floor(random() * xs.length)]);
	const diffs = [];
	for (let r = 0; r < reps; r++) diffs.push(stat(pick(a)) - stat(pick(b)));
	diffs.sort((x, y) => x - y);
	return { diff: stat(a) - stat(b), low: diffs[Math.floor(reps * 0.025)], high: diffs[Math.floor(reps * 0.975)] };
}

function signTest(wonA, wonB) {
	// Paired games (same seed): two-sided exact binomial test on the games only one of the two won
	const n = wonA + wonB;
	const k = Math.min(wonA, wonB);
	let p = 0;
	const choose = (n2, k2) => { let c = 1; for (let i = 1; i <= k2; i++) c = c * (n2 - k2 + i) / i; return c; };
	for (let i = 0; i <= k; i++) p += choose(n, i) / Math.pow(2, n);
	return Math.min(1, 2 * p);
}

function load(jack, habit) {
	if (!fs.existsSync(resultsDir)) return [];
	return fs.readdirSync(resultsDir).filter((f) => f.startsWith(`${jack}__${habit}__`)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8')))
		.sort((a, b) => a.seed - b.seed);
}

function summary() {
	const out = [];
	for (const jack of ['hard', 'normal']) {
		const arms = {};
		for (const habit of ['none', 'night1', 'every']) arms[habit] = load(jack, habit);
		if (!arms.none.length) continue;
		const nightDecisions = (games, n) => games.map((g) => g.decisions.filter((d) => d[0] === n));
		const laterDecisions = (games) => games.map((g) => g.decisions.filter((d) => d[0] > 1));
		const describe = (games) => ({
			games: games.length,
			jackWins: games.filter((g) => g.result === 'jack').length,
			night1Coaches: mean(games.map((g) => g.nights[0].coaches)),
			night1CoachesFirst: mean(games.map((g) => g.nights[0].coachesFirst)),
			night1Moves: mean(games.map((g) => g.nights[0].moves)),
			movesPerNight: [0, 1, 2, 3].map((n) => mean(games.filter((g) => g.nights[n]).map((g) => g.nights[n].moves))),
			night1Lost: games.filter((g) => g.night === 1 && g.result !== 'jack').length,
			coachesPerNight: [0, 1, 2, 3].map((n) => mean(games.filter((g) => g.nights[n]).map((g) => g.nights[n].coaches))),
			alleysPerNight: [0, 1, 2, 3].map((n) => mean(games.filter((g) => g.nights[n]).map((g) => g.nights[n].alleys))),
			byNight: [1, 2, 3, 4].map((n) => { const t = tracking([].concat(...nightDecisions(games, n))); return { night: n, medianPossible: t.medianPossible, jackInTopTen: t.jackInTopTen }; }),
			night1: tracking([].concat(...nightDecisions(games, 1))),
			later: tracking([].concat(...laterDecisions(games))),
			all: tracking([].concat(...games.map((g) => g.decisions))),
			night2HideoutRank: median(games.filter((g) => g.nights[1]).map((g) => g.nights[1].hideoutRank)),
			night4HideoutRank: median(games.filter((g) => g.nights[3]).map((g) => g.nights[3].hideoutRank)),
			night4HideoutBelief: median(games.filter((g) => g.nights[3]).map((g) => g.nights[3].hideoutBelief))
		});
		const row = { jack, arms: {} };
		for (const habit of Object.keys(arms)) if (arms[habit].length) row.arms[habit] = describe(arms[habit]);
		const topTen = (n) => (games) => {
			const d = [].concat(...games.map((g) => g.decisions.filter((x) => (n === 'later' ? x[0] > 1 : n === 'all' || x[0] === n))));
			return d.length ? d.filter((x) => x[2] > 0 && x[2] <= 10).length / d.length : 0;
		};
		const possible = (n) => (games) => median([].concat(...games.map((g) => g.decisions.filter((x) => (n === 'later' ? x[0] > 1 : n === 'all' || x[0] === n)).map((x) => x[1]))));
		row.comparisons = {};
		for (const habit of ['night1', 'every']) {
			const a = arms[habit];
			const b = arms.none;
			if (!a.length) continue;
			const bySeed = new Map(b.map((g) => [g.seed, g]));
			const paired = a.filter((g) => bySeed.has(g.seed));
			const onlyA = paired.filter((g) => g.result === 'jack' && bySeed.get(g.seed).result !== 'jack').length;
			const onlyB = paired.filter((g) => g.result !== 'jack' && bySeed.get(g.seed).result === 'jack').length;
			row.comparisons[habit + ' vs none'] = {
				night1TopTen: bootstrapDiff(a, b, topTen(1)),
				laterTopTen: bootstrapDiff(a, b, topTen('later')),
				allTopTen: bootstrapDiff(a, b, topTen('all')),
				night1Possible: bootstrapDiff(a, b, possible(1)),
				laterPossible: bootstrapDiff(a, b, possible('later')),
				jackWins: { diff: (a.filter((g) => g.result === 'jack').length - b.filter((g) => g.result === 'jack').length) / paired.length, onlyHabit: onlyA, onlyNone: onlyB, p: signTest(onlyA, onlyB) }
			};
		}
		out.push(row);
	}
	return out;
}

function humans() {
	// The same measures on every human game in the collection, by night, with the coaches each night used
	const { study } = require('./2026-10-11-investigation-arrests');
	const ids = fs.readdirSync(records).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
	const games = ids.map((id) => {
		const full = require(path.join(records, id + '.json'));
		return {
			id, result: full.outcome.winner,
			nights: full.nights.map((n) => {
				const moves = n.jack.moves || [];
				const first = moves.findIndex((m) => m.type !== 'carriage');
				return { coaches: moves.filter((m) => m.type === 'carriage').length, alleys: moves.filter((m) => m.type === 'alley').length, coachesFirst: first === -1 ? moves.length : first, moves: moves.length, pattern: moves.map((m) => m.type[0]).join('') };
			}),
			decisions: study(id, full).decisions.map((d) => [d.night, d.possible, d.rankOfJack, d.reach, d.jackArrestable ? 1 : 0, d.chose === 'arrest' ? 1 : 0])
		};
	});
	const byNight = [1, 2, 3, 4].map((n) => Object.assign({ night: n }, tracking([].concat(...games.map((g) => g.decisions.filter((d) => d[0] === n))))));
	return {
		games: games.map((g) => ({ id: g.id, result: g.result, nights: g.nights.map((n) => n.pattern) })),
		night1Coaches: mean(games.map((g) => g.nights[0].coaches)),
		night1CoachesFirst: mean(games.map((g) => g.nights[0].coachesFirst)),
		coachesPerNight: [0, 1, 2, 3].map((n) => mean(games.filter((g) => g.nights[n]).map((g) => g.nights[n].coaches))),
		alleysPerNight: [0, 1, 2, 3].map((n) => mean(games.filter((g) => g.nights[n]).map((g) => g.nights[n].alleys))),
		movesPerNight: [0, 1, 2, 3].map((n) => mean(games.filter((g) => g.nights[n]).map((g) => g.nights[n].moves))),
		byNight,
		later: tracking([].concat(...games.map((g) => g.decisions.filter((d) => d[0] > 1)))),
		all: tracking([].concat(...games.map((g) => g.decisions)))
	};
}

module.exports = { habitJack, playOne, measure, summary, humans, tracking };

if (require.main === module) {
	const [command, ...rest] = process.argv.slice(2);
	const print = (x) => console.log(JSON.stringify(x, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(3) : v), process.argv.includes('--json') ? 1 : 1));
	if (command === 'run') {
		const [jack, habit, games, from] = rest;
		run(jack, habit, Number(games), Number(from)).then(print);
	} else if (command === 'summary') {
		print(summary());
	} else if (command === 'humans') {
		print(humans());
	} else {
		console.error('Usage: run <jack> <habit> <games> <first seed> | summary | humans');
		process.exitCode = 1;
	}
}
