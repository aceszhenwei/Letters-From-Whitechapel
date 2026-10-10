// Loads the game's core (map, rules, engine, record, deduction) into a bare JavaScript context, without a page or any
// AI, for reading game records offline. Records are data: nothing in them is ever run.
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const scripts = [
	'js/vendor/underscore-min.js',
	'js/data/map.js',
	'js/core/random.js',
	'js/core/board.js',
	'js/core/rules.js',
	'js/core/engine.js',
	'js/core/record.js',
	'js/core/deduction.js'
];
// The AIs, only for making example records (make-examples.js)
const ai = ['js/ai/jack.js', 'js/ai/strategic-jack.js', 'js/ai/jack-v2.js', 'js/ai/jack-waiting.js', 'js/ai/difficulty.js',
	'js/ai/police-levels.js', 'js/ai/containment.js', 'js/ai/police.js'];

function load(list, random) {
	const context = vm.createContext({ console });
	if (random) vm.runInContext('Math', context).random = random;
	for (const script of list) {
		vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context, { filename: script });
	}
	return context; // context.WC, context._
}

let cached = null;
function loadCore() {
	if (!cached) cached = load(scripts);
	return cached;
}

function loadWithAI(random) {
	// A fresh context with the AIs, whose Math.random is `random`
	return load(scripts.concat(ai), random);
}

module.exports = { loadCore, loadWithAI };
