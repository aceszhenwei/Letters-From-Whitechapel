const test = require('node:test');
const assert = require('node:assert');
const { startGame, advanceTo, loadGame, setupNight, numbered } = require('../helpers/game');

test('board pieces are positioned in pixels (the page is not in quirks mode)', () => {
	const window = startGame({ seed: 1 });
	const circle = window.$('.location-number').get(0);
	assert.match(circle.style.left, /px$/);
	assert.match(circle.style.top, /px$/);
	assert.strictEqual(window.document.compatMode, 'CSS1Compat');
});

test('circle numbers are shown and every piece says what it is', () => {
	const window = startGame({ seed: 1 });
	const $ = window.$;
	const id = numbered(window)[0];
	const circle = $('.location-number').filter(function () { return $(this).data('mapid') === id; });
	assert.strictEqual(circle.text(), String(window.map[id].number));
	assert.strictEqual(circle.attr('title'), window.map[id].number + ' (number ' + window.map[id].number + ')');
	assert.ok($('.token-police.marked').attr('title').startsWith('Real ('));
});

test('streets are drawn from the map data as one path', () => {
	const window = startGame({ seed: 1 });
	const path = window.$('.map .streets path').attr('d');
	assert.strictEqual((path.match(/M/g) || []).length, 592);
});

test('phase instructions are replaced, not stacked, as rounds repeat', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	assert.ok(advanceTo(window, 11, { seed: 4 }));
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	assert.strictEqual(window.$('.state.hunting-the-monster p').length, 1);
	assert.strictEqual(window.$('.state.clues-and-suspicion p').length, 1);
	assert.match(window.$('.phase-progress').text(), /Policemen moved: 0 of 5/);
});

test('the phase card shows the current phase and night', () => {
	const window = startGame({ seed: 4 });
	const $ = window.$;
	assert.strictEqual($('.phase-title').text(), 'Patrolling the streets');
	assert.strictEqual($('.phase-part').text(), 'Hell');
	assert.strictEqual($('.phase-step.current').text(), 'Patrolling the streets');
	assert.strictEqual($('.phase-step').length, 13);
	assert.strictEqual($('.night-name').text(), 'First night of four');
	assert.strictEqual($('.night-date').text(), '31 August 1888');
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	assert.strictEqual($('.phase-part').text(), 'Hunting');
	assert.strictEqual($('.phase-step.current').length, 1);
});

test('the case log records what the police learn, newest first', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	const entries = window.$('.event-log .event').map(function () { return window.$(this).text(); }).get();
	assert.match(entries[entries.length - 1], /^First night, 31 August 1888/);
	assert.ok(entries.some((text) => /A body is found at \d+/.test(text)));
	assert.match(entries[0], /^Jack (moves|takes a coach|slips through an alley)/);
	assert.strictEqual(window.$('.event-log .event').first().attr('data-night'), 'Night 1');
});

test('Jack\'s status shows tokens, moves left and victims', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	const stats = {};
	window.$('.jack-log .stat').each(function () {
		stats[window.$(this).find('dt').text()] = window.$(this).find('dd').text();
	});
	assert.strictEqual(stats['Victims'], '1 of 5');
	assert.strictEqual(stats['Moves left'], String(window.game.state.remainingMoves));
	assert.ok('Coaches left' in stats && 'Alleys left' in stats);
});

test('the game-over dialog opens with the result', () => {
	const window = loadGame();
	const from = numbered(window)[10];
	setupNight(window, { base: numbered(window)[150], from, remaining: 1 });
	window.game.enter(9);
	assert.ok(window.$('.ending').hasClass('open'));
	assert.match(window.$('.ending .game-over').text(), /The police win!/);
	assert.match(window.$('.event-log .event').first().text(), /The police win!/);
});
