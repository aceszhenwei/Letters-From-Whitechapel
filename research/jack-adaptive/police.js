// The detectives Study J3 plays against (docs/jack-adaptive.md). Every one is WC.createPolice (js/ai/police.js) with
// an existing configuration, except the detour-aware police, which are built for this study to challenge Jack AI v2's
// fixed habit. They see only the police view; nothing here reads the game state or Jack's AI.
//
// Detour-aware police ('anti-D'): Detective AI v2's hybrid hideout weighting assumes Jack's route home is direct, so
// each move beyond the shortest walk counts against a hideout. Jack AI v2 spends up to D moves of every night but the
// last walking away first. These police expect that: on each past night, up to D extra moves are forgiven before the
// detour counts, so a route that went away and came back points at its hideout again. Only the public record is used
// (the scenes, the number of moves, which nights Jack escaped), and the same weights w = 0.9, rho = 0.5.
const { WC, _ } = require('../detective-inference/lib');

const hybrid = { hideoutWeighting: 'hybrid', hideoutW: 0.9, hideoutRho: 0.5 };

function detourAware(discount) {
	// The deduction, with hybrid weights that forgive the first `discount` moves of detour on each night
	return Object.assign({}, WC.deduction, {
		hideouts(pastLogs, choices, options) {
			if (!options || options.weighting !== 'hybrid') return WC.deduction.hideouts(pastLogs, choices, options);
			const weights = {};
			const possible = WC.deduction.hideouts(pastLogs, choices, { weighting: 'uniform' }); // The exact set
			Object.keys(possible).forEach((h) => { weights[h] = 1; });
			for (const log of pastLogs) {
				if (!_.findWhere(log, { type: 'escaped' })) continue;
				const night = WC.deduction.readLog(log);
				const moves = night.steps.length;
				for (const h of Object.keys(weights)) {
					const shortest = _.min(night.scenes.map((s) => WC.board.distance(s, Number(h))));
					const detour = Math.max(0, moves - shortest - discount);
					weights[h] *= (1 - options.w) + options.w * Math.pow(options.rho, detour);
				}
			}
			const sum = _.reduce(weights, (t, w) => t + w, 0);
			return _.mapObject(weights, (w) => w / sum);
		}
	});
}

// name -> { options for WC.createPolice, deduction (default WC.deduction), heldOut: only played in the final stage }
const configs = {
	original: { options: {} },
	v2: { options: WC.policeVariants.v2 },
	v3: { options: WC.policeVariants.v3 },
	'anti8': { options: WC.policeVariants.v2, deduction: detourAware(8) },
	// Held out: never used to develop or select a policy (section 3 of the report)
	'uniform+block': { options: { hideoutWeighting: 'uniform', blockWeight: 1 }, heldOut: true },
	'v3-anti6': { options: WC.policeVariants.v3, deduction: detourAware(6), heldOut: true }
};

function create(name) {
	const config = configs[name];
	if (!config) throw new Error('Unknown police: ' + name);
	return WC.createPolice(WC.board, WC.rules, config.deduction || WC.deduction, _, config.options);
}

const primary = ['original', 'v2', 'v3', 'anti8'];
const heldOut = Object.keys(configs).filter((n) => configs[n].heldOut);

module.exports = { configs, create, detourAware, primary, heldOut };
