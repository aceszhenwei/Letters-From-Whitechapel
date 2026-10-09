// Jack policies for the strategic-waiting study (docs/jack-waiting.md), by name. Diagnostic variants only: they fix how
// often Jack waits, to measure what waiting is worth before any policy decides it.
//   <base>-wait<k>         <base> (jack-v2 or strategic), but waits k times every night when the rules allow it
//                          (k = 1 to 4: the Time of the Crime then reaches k + 1), and otherwise decides as <base>
//   <base>-wait<k>-blind   the same, but every decision sees the patrol tokens as if none had been revealed, so the
//                          extra moves are measured without the information the reveals give
// And the policy itself (js/ai/jack-waiting.js), on either base, with its calibrated table:
//   <base>-waiting         waits when waiting is worth more than killing now
//   <base>-waiting-noinfo  the same, ignoring what the next reveal may show when deciding
//   <base>-waiting-blind   the policy, with every decision seeing the tokens as if none had been revealed
// Every variant uses only Jack's view.
const { WC, _ } = require('../detective-inference/lib');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { core } = require('../detective-inference/lib');
const policies = require('../jack-v2/policies');

// The research core (tools/sim/run-game.js) doesn't load the policy's file, so it is loaded into the same context here
const file = 'js/ai/jack-waiting.js';
if (!WC.createWaitingJack) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8'), core, { filename: file });

// The tokens as Jack saw them before any reveal tonight: revealed ones shown as unrevealed again, and revealed fakes
// (removed from the board) put back
function blindView(view, memory) {
	return Object.assign({}, view, {
		patrols() {
			const now = view.patrols();
			if (memory.night !== view.night) {
				memory.night = view.night;
				memory.tokens = _.pluck(now, 'mapid');
			}
			memory.tokens = _.union(memory.tokens, _.pluck(now, 'mapid'));
			return memory.tokens.map((mapid) => ({ mapid, revealed: false, real: undefined }));
		}
	});
}

function waiting(base, k, blind) {
	const memory = {};
	const see = (view) => (blind ? blindView(view, memory) : view);
	const wrapped = Object.assign({}, base, {
		wantsToWait(view) {
			return view.timeOfCrime - 1 < k;
		}
	});
	['chooseVictims', 'choosePatrolToReveal', 'chooseMove', 'placeWomen'].forEach((name) => {
		wrapped[name] = function (view, extra) { return base[name](see(view), extra); };
	});
	return wrapped;
}

function create(name, seed) {
	const policy = /^(jack-v2|strategic)-waiting(-noinfo|-blind)?$/.exec(name);
	if (policy) {
		const jack = WC.createWaitingJack(WC.board, policies.create(policy[1], seed), _, { table: policy[1], info: policy[2] !== '-noinfo' });
		if (policy[2] !== '-blind') return jack;
		const memory = {};
		const blind = Object.assign({}, jack);
		['wantsToWait', 'chooseVictims', 'choosePatrolToReveal', 'chooseMove', 'placeWomen'].forEach((n) => {
			blind[n] = function (view, extra) { return jack[n](blindView(view, memory), extra); };
		});
		return blind;
	}
	const match = /^(jack-v2|strategic)-wait(\d)(-blind)?$/.exec(name);
	if (match) return waiting(policies.create(match[1], seed), Number(match[2]), !!match[3]);
	return policies.create(name, seed);
}

module.exports = { create, blindView, waiting, files: [file] };
