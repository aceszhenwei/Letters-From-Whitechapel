// The Jacks of Study J3 (docs/jack-adaptive.md): Strategic Jack, Jack AI v2, and research candidates that choose how
// much to deceive, night by night. None is in the game; nothing here changes js/ai/.
//
// Every candidate is the unchanged Strategic Jack plus Jack AI v2's detour rule with a per-night MODE:
//   none   no detours (Strategic Jack's moves)
//   v2     Jack AI v2's detours: walk away from home while he has made at most 3 moves tonight and 6 would stay spare
//   long   the same rule, longer: while he has made at most 5 moves tonight (up to 6 detour steps)
// On the last night the mode is always none, as Jack AI v2 does. How a candidate picks the mode:
//   fixed-<mode>   the same mode every night (fixed-v2 plays Jack AI v2's games exactly: a test checks it)
//   mixed          a random mode each night, from its own random stream, ignoring the police (the control for
//                  unpredictability): none, v2 and long with probabilities `mix`
//   adaptive       night 1 v2; then by the PRESSURE the police showed on earlier nights (below): long when the police
//                  guarded his true hideout more than the other hideouts they could suspect, none when they didn't,
//                  v2 in between
//   adaptive-<x>   ablations and variants (see `variants`)
//
// Pressure (from Jack's view only: the public record of past nights and his own hideout). At every one of his past
// moves the record shows where the policemen stood. For a hideout h, guard(h) is the share of those moments when some
// policeman could step next to h on his next move (stood within two crossings of a crossing beside h). Pressure is
// guard(his hideout) minus the mean guard(h) over every hideout the police could still suspect (the deduction's exact
// candidate set). Positive: the police watch his true hideout more than its alternatives, so they are reading him.
const { WC, _, seeded, core } = require('../detective-inference/lib');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = 'js/ai/jack-v2.js';
if (!WC.createJackV2) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8'), core, { filename: file });

const modes = {
	none: null,
	v2: { detourMoves: 3, detourSpare: 6 },
	long: { detourMoves: 5, detourSpare: 6 }
};

// Pressure thresholds, set on the development seeds (report section 5) and frozen before selection
const defaults = { high: 0.15, low: 0.02, mix: { none: 1 / 3, v2: 1 / 3, long: 1 / 3 } };

function approachReach(h) {
	// Crossings from which a policeman can stand next to hideout h on his next move
	const beside = WC.board.neighbours(h).filter((c) => !WC.board.isNumbered(c));
	return new Set(_.flatten(beside.map((c) => [c].concat(WC.board.crossingsWithinTwo(c)))));
}
const reachCache = new Map();
function guardOf(h) {
	if (!reachCache.has(h)) reachCache.set(h, approachReach(h));
	return reachCache.get(h);
}

function pressure(view) {
	// guard(true hideout) - mean guard over the hideouts the police could still suspect; null with no past night
	const logs = view.pastLogs();
	const moments = _.flatten(logs.map((log) => log.filter((e) => e.type === 'move' && e.police && e.police.length).map((e) => e.police)), true);
	if (!moments.length) return null;
	const suspects = Object.keys(WC.deduction.hideouts(logs, WC.rules.hideoutChoices(), { weighting: 'uniform' })).map(Number);
	const guard = (h) => {
		const reach = guardOf(h);
		return moments.filter((police) => police.some((c) => reach.has(c))).length / moments.length;
	};
	const others = suspects.length ? suspects.map(guard) : [0];
	return guard(view.hideout) - others.reduce((a, b) => a + b, 0) / others.length;
}

function createModeJack(random, chooser, extra) {
	// Strategic Jack with Jack AI v2's detour rule, its extent chosen each night by chooser(view) -> mode name
	const strategic = WC.createStrategicJack(WC.board, WC.deduction, random, _);
	const debug = _.extend(strategic.debug, { nights: [] });
	let night = null;

	function detour(view, options) {
		// Jack AI v2's rule (js/ai/jack-v2.js), with the mode's numbers
		const movesSoFar = view.route.length - 1;
		const here = view.distanceToHideout(view.position);
		const spare = view.remainingMoves - here;
		if (movesSoFar > options.detourMoves || spare - 2 < options.detourSpare) return null;
		const away = _.filter(view.walks(), (mapid) => mapid != view.hideout && view.distanceToHideout(mapid) > here);
		return away.length > 0 ? { mapid: away[random.int(0, away.length)], type: 'walk' } : null;
	}

	function chooseMove(view) {
		if (!night || night.night !== view.night) {
			const last = view.night >= WC.rules.config.nights - 1;
			const started = Date.now();
			const decision = last ? { mode: 'none', pressure: null } : chooser(view);
			night = { night: view.night, mode: decision.mode, pressure: decision.pressure, detours: 0, ms: Date.now() - started };
			debug.nights.push(night);
		}
		const options = modes[night.mode];
		const move = options ? detour(view, options) : null;
		if (move) {
			night.detours++;
			return move;
		}
		return strategic.chooseMove(view);
	}

	return _.extend({}, strategic, { chooseMove, debug }, extra || {});
}

// Each policy: (seed) -> Jack. Every one uses the harness's Jack random stream (seed * 7919 + 1); a mixed choice draws
// from a stream of its own, so it changes nothing else
function jackRandom(seed) { return WC.random.create(seeded(seed * 7919 + 1)); }
function modeRandom(seed) { return seeded(seed * 7907 + 5); }

function adaptiveChooser({ high = defaults.high, low = defaults.low, up = 'long', down = 'none', neutral = 'v2', first = 'v2', shuffle = null } = {}) {
	return (view) => {
		const p = pressure(view);
		if (p === null) return { mode: first, pressure: null };
		const mode = p >= high ? up : p <= low ? down : neutral;
		return { mode: shuffle ? shuffle(mode) : mode, pressure: p };
	};
}

function mixedChooser(rand, mix = defaults.mix) {
	return (view) => {
		let r = rand();
		for (const [mode, weight] of Object.entries(mix)) {
			if ((r -= weight) < 0) return { mode, pressure: null };
		}
		return { mode: 'v2', pressure: null };
	};
}

const policies = {
	strategic: (seed) => WC.createStrategicJack(WC.board, WC.deduction, jackRandom(seed), _),
	'jack-v2': (seed) => WC.createJackV2(WC.board, WC.deduction, jackRandom(seed), _),
	'fixed-none': (seed) => createModeJack(jackRandom(seed), () => ({ mode: 'none', pressure: null })),
	'fixed-v2': (seed) => createModeJack(jackRandom(seed), () => ({ mode: 'v2', pressure: null })),
	'fixed-long': (seed) => createModeJack(jackRandom(seed), () => ({ mode: 'long', pressure: null })),
	mixed: (seed) => createModeJack(jackRandom(seed), mixedChooser(modeRandom(seed))),
	adaptive: (seed) => createModeJack(jackRandom(seed), adaptiveChooser()),
	// Variants explored on the development seeds
	'adaptive-up': (seed) => createModeJack(jackRandom(seed), adaptiveChooser({ down: 'v2' })), // Escalate only
	'adaptive-down': (seed) => createModeJack(jackRandom(seed), adaptiveChooser({ up: 'v2' })) // Relax only
};

// The matched control (ablation): the adaptive candidate's modes, chosen at random with the frequencies it used, so
// it deceives as much as the candidate on average but without reading the police. Set from the selection stage
function matchedMixed(mix) {
	return (seed) => createModeJack(jackRandom(seed), mixedChooser(modeRandom(seed), mix));
}

module.exports = { policies, modes, defaults, pressure, createModeJack, adaptiveChooser, mixedChooser, matchedMixed, jackRandom, modeRandom, files: [file, 'research/jack-adaptive/jacks.js'] };
