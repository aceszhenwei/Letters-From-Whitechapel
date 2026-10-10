// Opponents for the Detective AI v3 study (docs/detective-study.md), by name. All existing strategies; none is new.
//   baseline, strategic, jack-v2, detour        the game's Jacks and the Detective AI v2 study's detour Jack
//   jack-v2-waiting                             Jack AI v2 with strategic waiting (js/ai/jack-waiting.js)
//   short-return, short-return-all              the Detective AI v3 study's short-return Jacks
//   jack-v2-all-nights                          HELD OUT: Jack AI v2 detouring on the last night too. No hypothesis is
//                                               tuned on it; it is played only in the final check
const { WC, _, seeded } = require('../detective-inference/lib');
require('../jack-waiting/jacks'); // Loads js/ai/jack-waiting.js into the research core
const policies = require('../jack-v2/policies');
const shortReturn = require('../detective-v3/jacks');

const names = ['baseline', 'strategic', 'jack-v2', 'detour', 'jack-v2-waiting', 'short-return', 'short-return-all'];
const heldOut = ['jack-v2-all-nights'];

function create(name, seed) {
	if (shortReturn[name]) return shortReturn[name](WC.random.create(seeded(seed * 7919 + 1)));
	if (name === 'jack-v2-waiting') return WC.createWaitingJack(WC.board, policies.create('jack-v2', seed), _, { table: 'jack-v2' });
	return policies.create(name, seed);
}

module.exports = { create, names, heldOut };
