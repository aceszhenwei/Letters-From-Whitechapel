// Plays one seeded game without a page and measures how Jack played. The harness may look at the whole
// state (it is the referee, not a player); Jack's AI and the police AI only get their own views.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const scripts = [
	'js/vendor/underscore-min.js', 'js/data/map.js', 'js/data/content.js', 'js/core/random.js', 'js/core/board.js',
	'js/core/rules.js', 'js/core/engine.js', 'js/core/deduction.js', 'js/ai/jack.js', 'js/ai/strategic-jack.js', 'js/ai/police.js'
];

function seeded(seed) { // mulberry32
	return function () {
		seed |= 0;
		seed = (seed + 0x6D2B79F5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function loadCore() {
	const context = vm.createContext({ console });
	vm.runInContext('Math', context).random = seeded(12345); // Nothing should use it: every player has its own stream
	for (const script of scripts) {
		const file = path.join(root, script);
		if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: script });
	}
	return context;
}

// Jack strategies: name -> (WC, random, _) => AI. Variants of the strategic Jack switch its parts on and off
function makeJack(core, name, random) {
	const { WC, _ } = core;
	if (name === 'baseline') return WC.createJackAI(WC.board, WC.random.create(random), _);
	const variants = WC.strategicVariants || {};
	if (!variants[name]) throw new Error('Unknown Jack strategy: ' + name);
	return WC.createStrategicJack(WC.board, WC.deduction, WC.random.create(random), _, variants[name]);
}

function makePolice(core, name) {
	const { WC, _ } = core;
	if (name === 'random') return WC.randomPolice;
	if (name === 'deductive') return WC.createPolice(WC.board, WC.rules, WC.deduction, _);
	throw new Error('Unknown police: ' + name);
}

// What the referee can measure about a move at the moment Jack makes it (for calibrating Jack's models)
function decisionFeatures(core, state, move, threats) {
	const { WC } = core;
	const log = WC.rules.publicLog(state, state.police.length - 1);
	const after = log.concat([{ type: 'move', move: move.type, police: WC.rules.policeNight(state).now.slice() }]);
	const known = WC.deduction.track(after, {});
	const cost = WC.rules.moveCost(move);
	return {
		threat: threats[move.mapid] || 0,
		belief: known ? (known.current[move.mapid] || 0) : 0,
		size: known ? known.size : 0,
		slack: state.remainingMoves - cost - WC.board.distance(move.mapid, state.base),
		remaining: state.remainingMoves - cost,
		tokens: WC.rules.jackNight(state).carriages + WC.rules.jackNight(state).alleys
	};
}

function runGame(core, { jack, police, seed, maxActions = 20000, features = false }) {
	const { WC, _ } = core;
	const jackRandom = seeded(seed * 7919 + 1);
	const policeRandom = seeded(seed * 104729 + 2); // Depends only on the seed: every Jack faces the same police dice
	const ai = makeJack(core, jack, jackRandom);
	const policeAI = makePolice(core, police);
	const decisions = []; // Jack's moves, measured
	let timing = 0;
	let decisionStart = 0;
	const timedAI = Object.assign({}, ai, {
		chooseMove(view) {
			decisionStart = process.hrtime.bigint();
			const move = ai.chooseMove(view);
			timing = Number(process.hrtime.bigint() - decisionStart) / 1e6;
			return move;
		}
	});
	const game = WC.engine.create({ ai: timedAI });
	const state = game.state;
	const nights = [];

	game.on((type, data) => {
		if (type === 'nightStarted') nights.push({ escaped: false, moves: 0, carriages: 0, alleys: 0 });
		if (type === 'murder') {
			const night = _.last(nights);
			const start = _.last(data.scenes);
			night.startDistance = WC.board.distance(start, state.base);
			night.timeOfCrime = state.timeOfCrime;
			night.movesAvailable = state.remainingMoves;
		}
		if (type === 'jackMoved') {
			const night = _.last(nights);
			const jackNight = WC.rules.jackNight(state);
			const from = jackNight.route[jackNight.route.length - (data.move.type === 'carriage' ? 3 : 2)];
			night.moves += WC.rules.moveCost(data.move);
			if (data.move.type === 'carriage') night.carriages++;
			if (data.move.type === 'alley') night.alleys++;
			decisions.push(Object.assign(pending, {
				night: nights.length,
				type: data.move.type,
				ms: timing,
				distance: WC.board.distance(data.move.mapid, state.base),
				slack: state.remainingMoves - WC.board.distance(data.move.mapid, state.base), // Moves to spare
				// What the police can work out about where Jack is now (from public information only)
				candidates: WC.deduction.track(WC.rules.publicLog(state, state.police.length - 1), {}).size
			}));
		}
		if (type === 'jackEscaped') _.last(nights).escaped = true;
	});

	// Measure the danger Jack faced just before each move: the referee sees the whole state
	let pending = null;
	const originalChoose = timedAI.chooseMove;
	timedAI.chooseMove = function (view) {
		const threats = WC.rules.policeThreats(state);
		const walks = WC.rules.jackWalks(state, WC.rules.jackPosition(state));
		const specials = WC.rules.jackSpecialMoves(state, WC.rules.jackPosition(state));
		const options = walks.concat(specials.map((option) => option.mapid));
		const move = originalChoose.call(this, view);
		pending = {
			features: features ? decisionFeatures(core, state, move, threats) : undefined,
			before: WC.board.distance(WC.rules.jackPosition(state), state.base),
			options: options.length,
			forcedDanger: options.length > 0 && options.every((mapid) => threats[mapid] > 0),
			chosenDanger: (threats[move.mapid] || 0) > 0
		};
		return move;
	};

	game.start();
	let actions = 0;
	while (!state.over && actions++ < maxActions) {
		const phase = state.phase;
		policeAI.turn(game, WC.rules.policeView(state), policeRandom);
		if (!state.over && state.phase === phase && [2, 5, 10, 11].indexOf(phase) === -1) break; // Should not happen
	}
	// Labels for calibration: was Jack arrested straight after this move, and did he escape that night?
	decisions.forEach((d, i) => {
		const night = nights[d.night - 1];
		d.escapedNight = night ? night.escaped : false;
		d.arrestedNext = state.over && state.result.type === 'arrested' && i === decisions.length - 1;
	});
	if (state.over && state.result.type === 'arrested') {
		// How sure the police were, from public information, when they arrested him
		const known = WC.deduction.track(WC.rules.publicLog(state, state.police.length - 1), {});
		var arrestCertainty = known ? (known.current[state.result.mapid] || 0) : 0;
	}
	if (nights.length) {
		const last = _.last(nights);
		last.finalDistance = WC.board.distance(WC.rules.jackPosition(state), state.base);
	}
	const hideoutKnowledge = _.size(WC.deduction.hideouts(
		state.police.map((night, index) => WC.rules.publicLog(state, index)).filter((log) => _.findWhere(log, { type: 'escaped' })),
		WC.rules.hideoutChoices()
	));
	return {
		seed, jack, police,
		result: state.over ? state.result.type : 'unfinished',
		nights: nights.length,
		endMove: state.jack.length ? _.last(state.jack).moves.length : 0,
		nightDetails: nights,
		decisions,
		arrestCertainty,
		hideoutCandidates: hideoutKnowledge
	};
}

module.exports = { loadCore, runGame, seeded };
