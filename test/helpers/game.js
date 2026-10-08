// Loads the game into a simulated browser (jsdom) so it can be tested without a real browser.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..', '..');
const scripts = [
	'js/jquery-1.11.0.min.js',
	'js/underscore-min.js',
	'js/map.js',
	'js/content.js',
	'js/script.js'
];

// Small seeded random number generator (mulberry32) so games can be replayed exactly
function seededRandom(seed) {
	return function () {
		seed |= 0;
		seed = (seed + 0x6D2B79F5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function loadGame(options = {}) {
	const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
	const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
	const window = dom.window;
	const errors = [];
	window.addEventListener('error', (event) => errors.push(event.error || event.message));
	window.console.log = () => {}; // The game logs a lot to the console
	if (options.seed !== undefined) {
		window.Math.random = seededRandom(options.seed);
	}
	window.WHITECHAPEL_NO_AUTOSTART = true;
	for (const script of scripts) {
		window.eval(fs.readFileSync(path.join(root, script), 'utf8'));
	}
	window.errors = errors;
	if (options.base !== undefined) {
		window.game.config.base = options.base;
	}
	return window;
}

// Start a game and stop when the police need to be placed
function startGame(options = {}) {
	const window = loadGame(options);
	if (options.base !== undefined) {
		window.game.selectBase = () => {};
	}
	window.game.start();
	return window;
}

// Choose the police start positions. Tokens marked "required" (where policemen ended last night) are used first:
// five real ones, then two fake ones on other crossings
function placePolice(window) {
	const $ = window.$;
	const board = $('.map');
	const q = (selector) => board.find(selector); // Only look on the board, it is much faster in jsdom
	const marked = q('.token-police.marked');
	const required = marked.filter('.required');
	const real = required.length > 0 ? required : marked.slice(0, 5);
	const others = marked.not(real);
	real.each(function () { $(this).click(); });
	others.slice(0, 2).each(function () { $(this).next().click(); });
}

// Play one player action as the police, returns a short description of what happened
function policeAction(window, random) {
	const $ = window.$;
	const board = $('.map');
	const q = (selector) => board.find(selector);
	const game = window.game;
	if (game.config.over) return 'over';
	const pick = (elements) => elements.eq(Math.floor(random() * elements.length));
	switch (game.config.state) {
		case 2:
			placePolice(window);
			return 'place police';
		case 5:
			if (q('.token-move-wretched').length) { pick(q('.token-move-wretched')).click(); return 'move wretched'; }
			if (q('.token-wretched.selectable').length) { q('.token-wretched.selectable').eq(0).click(); return 'select wretched'; }
			return 'stuck';
		case 10:
			if (q('.token-move-police').length) { pick(q('.token-move-police')).click(); return 'move police'; }
			if (q('.token-police.selectable').length) { q('.token-police.selectable').eq(0).click(); return 'select police'; }
			return 'stuck';
		case 11:
			if (q('.token-arrest').length) { pick(q('.token-arrest')).click(); return 'arrest'; }
			if (q('.token-search').length) { pick(q('.token-search')).click(); return 'search'; }
			if (q('.token-search-adjacent').length && (random() >= 0.2 || !q('.token-arrest-adjacent').length)) {
				q('.token-search-adjacent').eq(0).click();
				return 'choose search';
			}
			if (q('.token-arrest-adjacent').length) {
				q('.token-arrest-adjacent').eq(0).click();
				return 'choose arrest';
			}
			return 'stuck';
		default:
			return 'stuck';
	}
}

// Play a whole game as the police, calling check(window) after every action
function playGame(window, options = {}) {
	const random = seededRandom(options.seed !== undefined ? options.seed + 1000 : 1);
	const maxActions = options.maxActions || 5000;
	for (let i = 0; i < maxActions; i++) {
		const action = policeAction(window, random);
		if (options.check) options.check(window, action);
		if (action === 'over' || action === 'stuck') return action;
	}
	return 'too long';
}

// Play as the police until the game reaches a state (and it is the police's turn there)
function advanceTo(window, state, options = {}) {
	const random = seededRandom(options.seed || 1);
	for (let i = 0; i < 2000; i++) {
		if (window.game.config.state === state) return true;
		const action = policeAction(window, random);
		if (action === 'over' || action === 'stuck') return false;
	}
	return false;
}

// Set up a night by hand: Jack standing at `from`, policemen on the crossings in `police`
function setupNight(window, { base, from, police = [], remaining = 10, carriages = 3, alleys = 2 }) {
	window.game.config.base = base;
	window.game.config.remainingMoves = remaining;
	const trackPosition = window.game.config.totalMoves - remaining;
	window.jack.push({ route: [from], moves: [], murder: [from], murderMove: [5], trackPosition, carriages, alleys });
	window.police.push({
		fake: [], start: police.slice(), revealed: [], route: police.map((id) => [id]), now: police.slice(),
		search: [], arrest: [], clue: []
	});
}

// Map ids of the numbered positions, and the crossings next to a position
function numbered(window) {
	return window.map.key('number');
}
function crossingsAround(window, mapid) {
	return window.map[mapid].adjacent.filter((id) => !window.map[id].number);
}

module.exports = {
	loadGame, startGame, placePolice, policeAction, playGame, advanceTo, setupNight, numbered, crossingsAround, seededRandom
};
