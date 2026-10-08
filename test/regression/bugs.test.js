// One test for each bug that has been fixed, so it can't come back unnoticed.

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, startGame, placePolice, advanceTo, setupNight, numbered, crossingsAround } = require('../helpers/game');

test('state 4 (Blood on the streets) has its own description', () => {
	const { state } = loadGame();
	assert.strictEqual(state[4].description, 'Jack chooses between killing or waiting');
	assert.strictEqual(state[5].description, 'The time of the crime token is moved, and each wreched pawn moves');
});

test('selectBase always picks a numbered position, including the first one', () => {
	const window = loadGame({ seed: 11 });
	const ids = numbered(window);
	const picked = new Set();
	for (let i = 0; i < 5000; i++) {
		window.game.selectBase();
		assert.ok(ids.includes(window.game.config.base), `base ${window.game.config.base} is not numbered`);
		picked.add(window.game.config.base);
	}
	assert.ok(picked.has(ids[0]), 'the first numbered position can be picked');
});

test('random choices stay inside their arrays even at the extremes of Math.random', () => {
	for (const extreme of [0, 0.5, 0.999999]) {
		const window = loadGame();
		window.Math.random = () => extreme;
		window.game.selectBase();
		window.game.nextState(0); // Picks the women
		const women = window.game.config.womenMarked.concat(window.game.config.womenUnmarked);
		assert.strictEqual(women.length, 8);
		assert.ok(women.every((id) => window.map[id] && window.map[id].murder), `women at ${women}`);
		window.game.murder();
		assert.ok(window.map[window._.last(window.jack).route[0]].murder, 'Jack murders at a murder spot');
		const from = window._.last(window.jack).route[0];
		const move = window.jack.walk(window.jack.oneStep(from), {});
		assert.ok(window.jack.oneStep(from).includes(move), 'Jack walks to an adjacent number');
	}
});

test('canMove checks the police: Jack is trapped when they block every street', () => {
	const window = loadGame();
	const from = numbered(window).find((id) => crossingsAround(window, id).length === window.map[id].adjacent.length);
	setupNight(window, { base: from, from, police: crossingsAround(window, from), carriages: 0, alleys: 0 });
	assert.strictEqual(window.jack.canMove(), false);
});

test('Jack walks home when his base is next to him after 6 moves', () => {
	const window = loadGame({ seed: 5 });
	const base = numbered(window)[20];
	const from = window.jack.oneStep(base)[0];
	setupNight(window, { base, from });
	window._.last(window.jack).route = [1, 2, 3, 4, 5, from];
	for (let i = 0; i < 50; i++) {
		assert.strictEqual(window.jack.walk(window.jack.oneStep(from), {}), base);
	}
});

test('Jack\'s first move avoids places the police could arrest him', () => {
	const window = loadGame({ seed: 9 });
	const from = numbered(window).find((id) => window.jack.oneStep(id).length >= 3);
	setupNight(window, { base: numbered(window)[0], from });
	const walks = window.jack.oneStep(from);
	const arrestable = {};
	walks.slice(1).forEach((id) => { arrestable[id] = 2; });
	for (let i = 0; i < 50; i++) {
		assert.strictEqual(window.jack.walk(walks, arrestable), walks[0]);
	}
});

test('bruteForceRoute doesn\'t crash when police box Jack in', () => {
	const window = loadGame();
	const from = numbered(window).find((id) => crossingsAround(window, id).length === window.map[id].adjacent.length);
	const base = numbered(window).find((id) => id !== from);
	setupNight(window, { base, from, police: crossingsAround(window, from) });
	assert.strictEqual(window.jack.bruteForceRoute(from, true).moves, Infinity);
	assert.strictEqual(window.jack.bruteForceRoute(base).moves, 0, 'Jack is already at his base');
});

test('Jack walks through crossing 0 in the corner of the map (number 1 to number 24)', () => {
	const window = loadGame();
	setupNight(window, { base: 3, from: 3 });
	assert.ok(window.jack.oneStep(3).includes(124));
	assert.ok(window.jack.oneStep(124).includes(3));
});

test('Blood on the streets writes its message to its own state', () => {
	const window = startGame({ seed: 2 });
	placePolice(window);
	assert.match(window.$('.state.blood-on-the-streets').text(), /Jack chooses between killing or waiting/);
});

test('Clues and suspicion shows the murder scene and labels search tokens by their own position', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 11, { seed: 4 }));
	const murder = window._.last(window._.last(window.jack).murder);
	assert.strictEqual(window.$('.token-murder-' + murder).length, 1);
	window.$('.token-search-adjacent').eq(0).click();
	const tokens = window.$('.token-search');
	assert.ok(tokens.length > 0);
	tokens.each(function () {
		assert.ok(window.$(this).hasClass('token-search-' + window.$(this).data('mapid')));
	});
});

test('finding a clue draws one clue token without redrawing the whole map', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 11, { seed: 4 }));
	const $ = window.$;
	const numbersBefore = $('.location-number').length;
	const placesBefore = $('.location').length;
	// Put a clue next to the first policeman, then search there
	const policeman = $('.token-search-adjacent').eq(0);
	const index = window._.indexOf(window._.last(window.police).now, policeman.data('mapid'));
	const target = window._.last(window.police).search[index][0];
	window._.last(window.jack).route.unshift(target);
	policeman.click();
	$('.token-search').filter(function () { return $(this).data('mapid') === target; }).click();
	assert.ok(window._.last(window.police).clue.includes(target));
	assert.strictEqual($('.token-clue').length, 1);
	assert.strictEqual($('.location-number').length, numbersBefore);
	assert.strictEqual($('.location').length, placesBefore);
	window.draw.map(); // Redrawing the map is safe too
	assert.strictEqual($('.location-number').length, numbersBefore);
	assert.strictEqual($('.token-clue').length, 1);
});

test('arresting Jack ends the game', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 11, { seed: 4 }));
	const jackAt = window._.last(window._.last(window.jack).route);
	window._.last(window.police).arrest[0] = [jackAt];
	window.$('.token-arrest-adjacent').filter(function () {
		return window._.indexOf(window._.last(window.police).now, window.$(this).data('mapid')) === 0;
	}).click();
	window.$('.token-arrest').click();
	assert.strictEqual(window.game.config.over, true);
	assert.match(window.$('.game-over').text(), /Jack has been arrested/);
	window.game.nextState(9); // Nothing happens after the game ends
	assert.strictEqual(window.game.config.state, 11);
});

test('Jack running out of moves ends the game', () => {
	const window = loadGame();
	const from = numbered(window)[10];
	setupNight(window, { base: numbered(window)[150], from, remaining: 0 });
	window.game.nextState(9);
	assert.strictEqual(window.game.config.over, true);
	assert.match(window.$('.game-over').text(), /ran out of moves/);
});

test('a new night (nextState(0)) starts fresh', () => {
	const window = startGame({ seed: 6 });
	assert.ok(advanceTo(window, 10, { seed: 6 }));
	window.game.config.remainingMoves = 3;
	window.$('.token').remove();
	window.game.nextState(0);
	assert.strictEqual(window.jack.length, 2);
	assert.strictEqual(window.police.length, 2);
	assert.strictEqual(window.game.config.state, 2, 'waiting for the police to be placed');
	assert.strictEqual(window.game.config.remainingMoves, window.game.config.startingMoves);
	assert.strictEqual(window.game.config.womenMarked.length, 4);
	assert.strictEqual(window.game.config.womenUnmarked.length, 4);
	assert.strictEqual(window.$('.move-tracker .murder').length, 0);
});
