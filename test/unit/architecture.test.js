// The boundaries between modules (see docs/architecture.md), checked so they don't wear away.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8')
	.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // Code only, not comments

test('the core (board, rules, engine) never touches the page', () => {
	for (const file of ['js/core/board.js', 'js/core/rules.js', 'js/core/engine.js', 'js/core/random.js', 'js/core/deduction.js']) {
		assert.ok(!/\$\(|jQuery|document\.|window\./.test(read(file)), file);
	}
});

// The game state's fields, and its nightly records' fields (see js/core/engine.js)
const stateFields = ['phase', 'base', 'over', 'result', 'timeOfCrime', 'remainingMoves', 'womenMarked', 'womenUnmarked',
	'crimeScenes', 'jack', 'police', 'turn', 'route', 'moves', 'murder', 'murderMove', 'trackPosition', 'carriages', 'alleys',
	'start', 'fake', 'revealed', 'now', 'search', 'arrest', 'clue'].join('|');
const assigns = new RegExp('\\.(' + stateFields + ')(\\[[^\\]]*\\])?\\s*(=[^=]|\\+\\+|--|\\+=|-=)');
const changesList = new RegExp('\\.(' + stateFields + ')\\.(push|splice|pop|shift|unshift)\\(');

test('the board knows nothing about a game', () => {
	assert.ok(!/state|WC\.rules|WC\.engine/.test(read('js/core/board.js')));
});

test('only the engine changes the game state', () => {
	for (const file of ['js/core/rules.js', 'js/core/deduction.js', 'js/ai/jack.js', 'js/ai/strategic-jack.js', 'js/ai/jack-v2.js', 'js/ai/police.js', 'js/ai/difficulty.js', 'js/ui/renderer.js', 'js/ui/setup.js']) {
		const code = read(file);
		assert.ok(!assigns.test(code), file + ': ' + (code.match(assigns) || [])[0]);
		assert.ok(!changesList.test(code), file + ': ' + (code.match(changesList) || [])[0]);
	}
	assert.ok(assigns.test(read('js/core/engine.js')), 'the engine does');
});

test('the interface never uses Jack\'s AI', () => {
	assert.ok(!/WC\.jackAI|chooseMove/.test(read('js/ui/renderer.js')));
});

test('only the engine runs Jack\'s AI', () => {
	for (const file of ['js/core/rules.js', 'js/core/board.js', 'js/ui/renderer.js']) {
		assert.ok(!/jackAI|\.ai\./.test(read(file)), file);
	}
	assert.ok(/game\.ai\.chooseMove/.test(read('js/core/engine.js')));
});
