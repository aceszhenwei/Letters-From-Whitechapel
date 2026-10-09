// Jacks for the waiting-against-containment study (docs/waiting-containment.md). Diagnostic only: they split Jack AI v2
// with strategic waiting (js/ai/jack-waiting.js) by night, so one night's effect can be measured with every other
// night played exactly as before.
//   jack-v2                 Jack AI v2 (never waits)
//   jack-v2-waiting         Jack AI v2 with strategic waiting on every night (PR #17)
//   jack-v2-waiting-last    strategic waiting on the last night only: nights 1-3 are jack-v2's, move for move
//   jack-v2-waiting-early   strategic waiting on nights 1-3 only: up to the last night's murder it plays exactly as
//                           jack-v2-waiting, then kills at once
//   short-return, short-return-all, bgg-134, bgg-51-night4   the short-return Jacks of the Detective AI v3 study
//                           (research/detective-v3/jacks.js, research/human-strategy/policies.js): the Jacks v3's
//                           containment was built against
//   <short-return Jack>-waiting  the same with strategic waiting added (their own schemes otherwise unchanged)
// Waiting decisions draw no random numbers, so each variant's games match its counterpart's until they differ.
const { WC, _, seeded } = require('../detective-inference/lib');
const shortReturn = Object.assign({}, require('../human-strategy/policies'), require('../detective-v3/jacks'));
require('../jack-waiting/jacks'); // Loads js/ai/jack-waiting.js into the research core
const policies = require('../jack-v2/policies');

const lastNight = WC.rules.config.nights - 1;

function create(name, seed) {
	const scheme = /^(short-return|short-return-all|bgg-134|bgg-51-night4)(-waiting)?$/.exec(name);
	if (scheme) {
		const jack = shortReturn[scheme[1]](WC.random.create(seeded(seed * 7919 + 1)));
		return scheme[2] ? WC.createWaitingJack(WC.board, jack, _, { table: 'jack-v2' }) : jack;
	}
	const base = policies.create('jack-v2', seed);
	if (name === 'jack-v2') return base;
	const waiting = WC.createWaitingJack(WC.board, base, _, { table: 'jack-v2' });
	if (name === 'jack-v2-waiting') return waiting;
	const nights = name === 'jack-v2-waiting-last' ? [lastNight] : name === 'jack-v2-waiting-early' ? [0, 1, 2] : null;
	if (!nights) throw new Error('Unknown Jack: ' + name);
	return Object.assign({}, waiting, {
		wantsToWait(view) {
			return _.contains(nights, view.night) ? waiting.wantsToWait(view) : base.wantsToWait(view);
		}
	});
}

module.exports = { create };
