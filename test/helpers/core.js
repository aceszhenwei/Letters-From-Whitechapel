// Loads the game's core (map, board, rules, engine, Jack's AI) into a bare JavaScript context:
// no page, no jQuery. If a core module touched the page, it would fail here.
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { seededRandom } = require('./game');

const root = path.join(__dirname, '..', '..');
const scripts = [
	'js/vendor/underscore-min.js',
	'js/data/map.js',
	'js/data/content.js',
	'js/core/random.js',
	'js/core/board.js',
	'js/core/rules.js',
	'js/core/engine.js',
	'js/ai/jack.js'
];

function loadCore(options = {}) {
	const context = vm.createContext({ console });
	if (options.seed !== undefined) {
		vm.runInContext('Math', context).random = seededRandom(options.seed);
	}
	for (const script of scripts) {
		vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context, { filename: script });
	}
	return context; // context.WC, context.map, context._
}

// A game state with one night set up by hand: Jack at `from`, policemen on the crossings in `police`
function nightState(WC, { base, from, police = [], remaining = 10, carriages = 3, alleys = 2, timeOfCrime = 1, crimeScenes = [] }) {
	const state = WC.engine.createState();
	state.base = base;
	state.remainingMoves = remaining;
	state.timeOfCrime = timeOfCrime;
	state.crimeScenes = crimeScenes.slice();
	state.jack.push({ route: [from], moves: [], murder: [from], murderMove: [5], trackPosition: WC.rules.config.trackLength - remaining, carriages, alleys });
	state.police.push({ fake: [], start: police.slice(), revealed: [], route: police.map((id) => [id]), now: police.slice(), search: [], arrest: [], clue: [] });
	return state;
}

// Crossings joined directly to a place
function crossingsAround(WC, mapid) {
	return WC.board.neighbours(mapid).filter((id) => !WC.board.isNumbered(id));
}

module.exports = { loadCore, nightState, crossingsAround };
