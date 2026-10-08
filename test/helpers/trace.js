// Records what happens in a seeded game, so a refactor can prove it plays exactly the same game.
// This is the only test code that knows where the game keeps its state.

const crypto = require('crypto');
const { startGame, policeAction, seededRandom } = require('./game');

function gameState(window) {
	if (window.game.state) { // After the refactor: one state object
		return window.game.state;
	}
	const config = window.game.config; // Before: game.config plus the jack and police arrays
	return Object.assign({}, config, { phase: config.state, jack: window.jack, police: window.police });
}

const list = (array) => Array.from(array || []);

function snapshot(window) {
	const state = gameState(window);
	return {
		base: state.base,
		over: state.over,
		timeOfCrime: state.timeOfCrime,
		remainingMoves: state.remainingMoves,
		crimeScenes: list(state.crimeScenes),
		womenMarked: list(state.womenMarked),
		womenUnmarked: list(state.womenUnmarked),
		jack: list(state.jack).map((night) => ({
			route: list(night.route),
			moves: list(night.moves).map((move) => [move.type, move.mapid, move.via === undefined ? null : move.via]),
			murder: list(night.murder),
			murderMove: list(night.murderMove),
			trackPosition: night.trackPosition,
			carriages: night.carriages,
			alleys: night.alleys
		})),
		police: list(state.police).map((night) => ({
			start: list(night.start),
			fake: list(night.fake),
			revealed: list(night.revealed),
			now: list(night.now),
			route: list(night.route).map(list),
			clue: list(night.clue)
		}))
	};
}

// What the player sees after each action
function screen(window) {
	const $ = window.$;
	return [
		$('.phase-title').text(),
		$('.phase-progress').text(),
		$('.move-tracker p span').map(function () { return this.className; }).get().join('|'),
		$('.jack-log').text(),
		$('.event-log .event').length
	];
}

function traceGame(seed) {
	const window = startGame({ seed });
	const random = seededRandom(seed + 1000);
	const steps = crypto.createHash('sha256');
	let actions = 0;
	for (; actions < 5000; actions++) {
		const action = policeAction(window, random);
		const state = gameState(window);
		steps.update(JSON.stringify([action, state.phase, state.timeOfCrime, state.remainingMoves, screen(window)]));
		if (action === 'over' || action === 'stuck') break;
	}
	const final = snapshot(window);
	return {
		seed,
		actions,
		ending: window.$('.game-over').text(),
		errors: window.errors.length,
		steps: steps.digest('hex'),
		final: crypto.createHash('sha256').update(JSON.stringify(final)).digest('hex'),
		log: Array.from(window.$('.event-log .event').map(function () { return window.$(this).attr('data-night') + ': ' + window.$(this).text(); }).get()).reverse(),
		jack: final.jack.map((night) => night.moves.map((move) => move[0][0]).join('') + ' ' + night.route.join(',')),
		snapshot: final
	};
}

module.exports = { gameState, snapshot, traceGame };
