// Shared helpers for the detective-inference study (docs/detective-inference-study.md).
// - play(): a seeded game, returning the final state (the referee's view: hidden route and hideout included)
// - publicPrefixes(): cuts a night's public record after each entry, with Jack's true circle at that point
// - enumerate(): an exhaustive, independent reference for where Jack could be, by listing every legal route
//   that fits a public record. Written from the rules (js/core/rules.js), not from js/core/deduction.js, so the
//   two can be checked against each other.
const { loadCore, seeded } = require('../../tools/sim/run-game');

const core = loadCore();
const { WC, _ } = core;

function makeJack(name, seed) {
	const random = WC.random.create(seeded(seed * 7919 + 1));
	if (name === 'baseline') return WC.createJackAI(WC.board, random, _);
	return WC.createStrategicJack(WC.board, WC.deduction, random, _, WC.strategicVariants[name]);
}

// The deduction with whitechapelR's hideout inference: every hideout no night rules out is equally likely
// (whitechapelR's end_round keeps a set, not probabilities). Used only to test the police with it
const uniformHideouts = Object.assign({}, WC.deduction, {
	hideouts(pastLogs, choices) {
		const weighted = WC.deduction.hideouts(pastLogs, choices);
		const keys = Object.keys(weighted);
		return _.object(keys, keys.map(() => 1 / keys.length));
	}
});

function makePolice(name, options = {}) {
	if (name === 'random') return WC.randomPolice;
	const settings = _.omit(options, 'uniformHideouts');
	return WC.createPolice(WC.board, WC.rules, options.uniformHideouts ? uniformHideouts : WC.deduction, _, settings);
}

// Plays one game with the same random streams as tools/sim/run-game.js. onPolice(state, view) is called before
// every police action, with the referee's state (for measurements only: the police AI never sees it)
function play({ jack = 'strategic', police = 'deductive', seed, policeOptions, onPolice }) {
	const ai = makeJack(jack, seed);
	const policeAI = makePolice(police, policeOptions);
	const policeRandom = seeded(seed * 104729 + 2);
	const game = WC.engine.create({ ai });
	game.start();
	for (let actions = 0; !game.state.over && actions < 20000; actions++) {
		const view = WC.rules.policeView(game.state);
		if (onPolice) onPolice(game.state, view);
		policeAI.turn(game, view, policeRandom);
	}
	return game.state;
}

// Jack's true circle after `steps` steps of tonight's record (a coach counts two steps, as in the deduction)
function trueCircle(jackNight, steps) {
	return jackNight.route[steps + jackNight.murder.length - 1];
}

function stepsIn(log) {
	return log.reduce((n, e) => n + (e.type === 'move' ? (e.move === 'carriage' ? 2 : 1) : 0), 0);
}

// Every prefix of each night's public record that ends after a Jack move or a police observation
function publicPrefixes(state) {
	const result = [];
	state.police.forEach((night, index) => {
		const log = WC.rules.publicLog(state, index);
		const jackNight = state.jack[index];
		if (!jackNight || !log.length) return;
		for (let end = 1; end <= log.length; end++) {
			const prefix = log.slice(0, end);
			if (!prefix.some((e) => e.type === 'crime')) continue;
			const steps = stepsIn(prefix);
			result.push({ night: index, prefix, steps, truth: trueCircle(jackNight, steps), route: jackNight.route.slice(0, steps + jackNight.murder.length) });
		}
	});
	return result;
}

// Exhaustive reference: every route that fits the record. Returns { circles: { mapid: routes ending there }, routes }.
// Observations are applied at the step they were made: a search finding nothing at step k means the route hadn't
// passed that circle by step k; a clue means it had; a failed arrest at step k means Jack wasn't there at k.
// It stops (returns null) above `limit` routes, so it is only for short records.
function enumerate(log, limit = 2e6) {
	const crime = log.find((e) => e.type === 'crime');
	const checks = []; // { at: step, test(route) }
	const steps = [];
	let k = 0;
	for (const entry of log) {
		if (entry.type === 'move') {
			steps.push(entry);
			k += entry.move === 'carriage' ? 2 : 1;
		} else if (entry.type === 'search') {
			const at = k;
			checks.push({ at, test: (route) => route.slice(0, at + 1).includes(entry.mapid) === entry.clue });
		} else if (entry.type === 'arrest') {
			const at = k;
			checks.push({ at, test: (route) => route[at] !== entry.mapid });
		}
	}
	const circles = {};
	let routes = 0;
	let aborted = false;
	const extend = (route, i) => {
		if (aborted) return;
		if (!checks.every((c) => route.length - 1 !== c.at || c.test(route))) return; // Checks due now
		if (i === steps.length) {
			if (!checks.every((c) => c.test(route))) return;
			const end = route[route.length - 1];
			circles[end] = (circles[end] || 0) + 1;
			if (++routes > limit) aborted = true;
			return;
		}
		const from = route[route.length - 1];
		const step = steps[i];
		if (step.move === 'walk') {
			for (const to of WC.board.walk(from, step.police)) extend(route.concat([to]), i + 1);
		} else if (step.move === 'alley') {
			for (const to of WC.board.alleys(from)) extend(route.concat([to]), i + 1);
		} else {
			for (const via of WC.board.walk(from, [])) {
				const middle = route.concat([via]);
				if (!checks.every((c) => middle.length - 1 !== c.at || c.test(middle))) continue;
				for (const to of WC.board.walk(via, [])) if (to !== from) extend(middle.concat([to]), i + 1);
			}
		}
	};
	for (const scene of crime.scenes) extend([scene], 0);
	return aborted ? null : { circles, routes };
}

// What the police knew at the end of a prefix, for the deduction's time and hideout pruning (as js/ai/police.js uses it)
function policeContext(state, item) {
	const jackNight = state.jack[item.night];
	const remaining = WC.rules.config.trackLength - _.last(jackNight.murderMove) - item.steps;
	const past = state.police.slice(0, item.night).map((n, i) => WC.rules.publicLog(state, i));
	const hideouts = WC.deduction.hideouts(past, WC.rules.hideoutChoices());
	const alleysUsed = item.prefix.filter((e) => e.type === 'move' && e.move === 'alley').length;
	return { remaining, hideouts: Object.keys(hideouts).map(Number), alleysLeft: WC.rules.config.alleys[item.night] - alleysUsed };
}

module.exports = { policeContext,  core, WC, _, play, publicPrefixes, enumerate, stepsIn, trueCircle, seeded };
