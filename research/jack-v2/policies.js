// The Jack policies compared in the Jack v2 study (docs/jack-ai-v2.md), by name. Each is built with the same random
// stream as tools/sim/run-game.js and research/detective-inference/lib.js (seed * 7919 + 1), so the same seed gives
// the same game whichever harness plays it. The existing Jacks are used unchanged; candidates live in policies/.
const fs = require('fs');
const path = require('path');
const { WC, _, seeded } = require('../detective-inference/lib');
const { createDetourJack } = require('../detective-v2/jacks');

const candidates = {}; // name -> { file, create(random) }
for (const file of fs.readdirSync(path.join(__dirname, 'policies')).filter((f) => f.endsWith('.js'))) {
	const module = require(path.join(__dirname, 'policies', file));
	// A module may name other files its policies depend on (module.files), such as the game's own AI file
	const deps = [path.join('research/jack-v2/policies', file)].concat(module.files || []);
	for (const [name, create] of Object.entries(module.policies || {})) candidates[name] = { files: deps, create };
}

function create(name, seed) {
	const random = WC.random.create(seeded(seed * 7919 + 1));
	if (name === 'baseline') return WC.createJackAI(WC.board, random, _);
	if (name === 'detour') return createDetourJack(random);
	if (WC.strategicVariants[name]) return WC.createStrategicJack(WC.board, WC.deduction, random, _, WC.strategicVariants[name]);
	if (candidates[name]) return candidates[name].create(random);
	throw new Error('Unknown Jack policy: ' + name);
}

// The files a policy's games depend on beyond the core (for deciding whether a stored result can be reused)
function files(name) {
	if (name === 'detour') return ['research/detective-v2/jacks.js'];
	return candidates[name] ? candidates[name].files : [];
}

const names = () => ['baseline', 'detour'].concat(Object.keys(WC.strategicVariants), Object.keys(candidates));

module.exports = { create, files, names };
