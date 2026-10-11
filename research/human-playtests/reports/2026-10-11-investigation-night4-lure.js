// Investigation 2026-10-11, the night-4 escape: the targeted simulation (2026-10-11-investigation-night4.md, section 5).
// In g6b7af2a30b071ae6 the person's last night was a lure: his Wretched stood two walks from home, he waited, and
// Detective AI v3 moved her next to his hideout (its rule moves a Wretched towards the real patrols, and its patrols
// stood by the likely hideouts). Does that cost v3 games against a Jack who plays the lure on purpose, and does the
// containWretched option (js/ai/police.js; left out of v3, docs/waiting-containment.md) stop it?
//   node research/human-playtests/reports/2026-10-11-investigation-night4-lure.js run <jack> <police> <games> <first seed>
//   node research/human-playtests/reports/2026-10-11-investigation-night4-lure.js summary <first seed>-<games>[,...] [--json]
// Jacks (only Jack's view is used; the hideout and lure circle are his own random choices):
//   lure       Jack AI v2, except: his hideout is two walks from a red circle (the lure) that has a circle next to it one
//              walk from home; he keeps the lure free of Wretched on nights 1-3; on night 4 he marks it, waits while his
//              Wretched is not one walk from home and the Time of the Crime allows, then kills and walks home when he can
//   lure-now   the same Jack and hideout, but on night 4 he kills at once (no waiting): the control for the wait
// Police: 'v3' (Detective AI v3) and 'v3-wretched' (v3 with containWretched), as research/waiting-containment/configs.js.
// Measured by the referee (never seen by the players): the result, and on the last night the waits, the crime scene's
// walks from home, whether the police's Wretched moves brought the victim nearer home, and first-move escapes.
// Results: results/lure/<jack>__<police>__<first seed>-<games>.json. Read-only for the game: it changes no AI.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const resultsDir = path.join(__dirname, 'results', 'lure');

function lureJack(lib, random, wait) {
	const { WC, _ } = lib;
	const { helpers } = require('../../human-strategy/policies');
	const board = WC.board;
	const lastNight = WC.rules.config.nights - 1;
	const red = board.redCircles();
	const lures = (h) => red.filter((r) => board.distance(r, h) === 2 && board.walk(r, []).some((n) => board.walk(n, []).includes(h)));
	let base = null;
	let lure = null;
	return {
		chooseHideout(choices) {
			const good = choices.filter((h) => lures(h).length > 0);
			const home = good[random.int(0, good.length)];
			base = helpers.withHideout(home, random);
			base.chooseHideout(choices);
			const options = lures(home);
			lure = options[random.int(0, options.length)];
			return home;
		},
		placeWomen(view) {
			if (view.night === lastNight) return helpers.placeWomen(base, view, view.targets.includes(lure) ? [lure] : [], []);
			return helpers.placeWomen(base, view, [], [lure]);
		},
		target(view) {
			// The Wretched nearest home
			return _.min(view.wretched, (w) => board.distance(w, view.hideout));
		},
		wantsToWait(view) {
			if (view.night !== lastNight) return base.wantsToWait(view);
			if (!wait) return false;
			const t = this.target(view);
			return !board.walk(t, []).includes(view.hideout) && view.timeOfCrime < 5;
		},
		chooseVictims(view) {
			if (view.night !== lastNight) return base.chooseVictims(view);
			const t = this.target(view);
			return _.without(view.wretched, t).slice(0, view.victims - 1).concat([t]);
		},
		choosePatrolToReveal(view, hidden) { return base.choosePatrolToReveal(view, hidden); },
		chooseMove(view) {
			return view.night === lastNight ? helpers.walkHomeOr(base, view) : base.chooseMove(view);
		}
	};
}

if (!isMainThread) {
	const lib = require('../../detective-inference/lib');
	const { WC, play, registerJack } = lib;
	const configs = require('../../waiting-containment/configs');
	registerJack('__lure', (random) => lureJack(lib, random, workerData.jack === 'lure')); // play() seeds it per game
	const out = workerData.seeds.map((seed) => {
		// The last night, by the referee
		let last = null;
		const onPolice = (state) => {
			if (state.police.length !== WC.rules.config.nights) return;
			if (!last) last = { women: state.womenMarked.slice(), moved: [] };
		};
		const final = play({ jack: '__lure', police: 'deductive', seed, policeOptions: configs[workerData.police], onPolice });
		const home = final.base;
		const night = final.jack[WC.rules.config.nights - 1];
		const result = { seed, result: final.result.type, night: final.jack.length, home: WC.board.number(home) };
		if (night && night.murder.length) {
			const scene = night.murder[night.murder.length - 1];
			const p = final.police[WC.rules.config.nights - 1];
			result.last = {
				waits: final.timeOfCrime - 1,
				lureWalks: last ? Math.min(...last.women.map((w) => WC.board.distance(w, home))) : null,
				sceneWalks: WC.board.distance(scene, home),
				oneWalkOpen: WC.board.walk(scene, p.start).includes(home),
				moves: night.route.length - night.murder.length,
				escaped: final.result.type === 'jackWins'
			};
		}
		return result;
	});
	parentPort.postMessage(out);
	return;
}

function run(jack, police, games, from) {
	const workers = Math.min(os.cpus().length, games);
	const seeds = Array.from({ length: games }, (x, i) => from + i);
	const started = Date.now();
	return Promise.all(Array.from({ length: workers }, (x, w) => new Promise((resolve, reject) => {
		const worker = new Worker(__filename, { workerData: { seeds: seeds.filter((s, i) => i % workers === w), jack, police } });
		worker.on('message', resolve);
		worker.on('error', reject);
	}))).then((parts) => {
		const all = parts.flat().sort((a, b) => a.seed - b.seed);
		fs.mkdirSync(resultsDir, { recursive: true });
		fs.writeFileSync(path.join(resultsDir, `${jack}__${police}__${from}-${games}.json`), JSON.stringify(all));
		return { jack, police, from, games: all.length, jackWins: all.filter((g) => g.result === 'jackWins').length, seconds: Math.round((Date.now() - started) / 1000) };
	});
}

function signTest(a, b) {
	const n = a + b;
	const k = Math.min(a, b);
	const choose = (n2, k2) => { let c = 1; for (let i = 1; i <= k2; i++) c = c * (n2 - k2 + i) / i; return c; };
	let p = 0;
	for (let i = 0; i <= k; i++) p += choose(n, i) / Math.pow(2, n);
	return Math.min(1, 2 * p);
}

function load(jack, police, sets) {
	return [].concat(...sets.map((set) => {
		const file = path.join(resultsDir, `${jack}__${police}__${set}.json`);
		return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
	}));
}

function summary(sets) {
	const describe = (games) => {
		const lasts = games.filter((g) => g.last).map((g) => g.last);
		return {
			games: games.length,
			jackWins: games.filter((g) => g.result === 'jackWins').length,
			lastNights: lasts.length,
			waited: lasts.filter((l) => l.waits > 0).length,
			sceneOneWalk: lasts.filter((l) => l.sceneWalks === 1).length,
			sceneOneWalkOpen: lasts.filter((l) => l.oneWalkOpen).length,
			firstMoveEscapes: lasts.filter((l) => l.escaped && l.moves === 1).length,
			lastNightEscapes: lasts.filter((l) => l.escaped).length
		};
	};
	const out = {};
	for (const jack of ['lure', 'lure-now']) {
		const v3 = load(jack, 'v3', sets);
		const lever = load(jack, 'v3-wretched', sets);
		if (!v3.length) continue;
		const row = { v3: describe(v3) };
		if (lever.length) {
			row['v3-wretched'] = describe(lever);
			const bySeed = new Map(v3.map((g) => [g.seed, g]));
			const paired = lever.filter((g) => bySeed.has(g.seed));
			const onlyLever = paired.filter((g) => g.result === 'jackWins' && bySeed.get(g.seed).result !== 'jackWins').length;
			const onlyV3 = paired.filter((g) => g.result !== 'jackWins' && bySeed.get(g.seed).result === 'jackWins').length;
			const n = paired.length;
			const diff = (onlyLever - onlyV3) / n;
			// Paired difference in Jack's win rate (lever minus v3), with a normal-approximation 95% interval
			const se = Math.sqrt((onlyLever + onlyV3) / n - diff * diff) / Math.sqrt(n);
			row.comparison = { paired: n, onlyWithLever: onlyLever, onlyWithV3: onlyV3, diff: +(100 * diff).toFixed(1), low: +(100 * (diff - 1.96 * se)).toFixed(1), high: +(100 * (diff + 1.96 * se)).toFixed(1), p: +signTest(onlyLever, onlyV3).toFixed(4) };
		}
		out[jack] = row;
	}
	return out;
}

module.exports = { lureJack, summary };

if (require.main === module) {
	const [command, ...rest] = process.argv.slice(2);
	if (command === 'run') {
		const [jack, police, games, from] = rest;
		run(jack, police, Number(games), Number(from)).then((r) => console.log(JSON.stringify(r)));
	} else if (command === 'summary') {
		console.log(JSON.stringify(summary(rest[0].split(',')), null, 1));
	} else {
		console.error('Usage: run <jack> <police> <games> <first seed> | summary <first seed>-<games>[,...]');
		process.exitCode = 1;
	}
}
