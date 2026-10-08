// Police interactions through the board, written before the module refactor to pin down their behaviour.
const test = require('node:test');
const assert = require('node:assert');
const { startGame, advanceTo } = require('../helpers/game');
const { gameState } = require('../helpers/trace');

const last = (array) => array[array.length - 1];

function atClues(seed) {
	const window = startGame({ seed });
	assert.ok(advanceTo(window, 11, { seed }));
	return window;
}

// A policeman with at least two circles to search, and the circles he can search
function searcher(window, count = 2) {
	const police = last(gameState(window).police);
	const index = police.search.findIndex((list) => list && list.length >= count);
	assert.notStrictEqual(index, -1);
	return { index, crossing: police.now[index], circles: Array.from(police.search[index]) };
}

test('a search that misses, then finds a clue, says so', () => {
	const window = atClues(4);
	const $ = window.$;
	const { crossing, circles } = searcher(window);
	const route = last(gameState(window).jack).route;
	circles.forEach((id) => { const at = route.indexOf(id); if (at !== -1) route.splice(at, 1); });
	route.unshift(circles[1]); // Jack passed the second circle, not the first
	$('.token-search-adjacent-' + crossing).click();
	assert.strictEqual($('.token-arrest-adjacent-' + crossing).length, 0, 'searching rules out arresting');
	const target = (id) => $('.token-search').filter(function () { return $(this).data('mapid') === id; });
	target(circles[0]).click();
	assert.strictEqual($('.phase-progress').text(), 'No clue at ' + window.map[circles[0]].number + '. Search another circle.');
	assert.strictEqual(target(circles[0]).length, 0);
	target(circles[1]).click();
	assert.strictEqual($('.token-search').length, 0);
	assert.strictEqual($('.token-clue-' + circles[1]).length, 1);
	assert.strictEqual($('.event-log .event').first().text(),
		'No clue at ' + window.map[circles[0]].number + ', then a clue found at ' + window.map[circles[1]].number + '! Jack has been there tonight.');
	assert.match($('.phase-progress').text(), /^Policemen acted: \d of 5$/);
});

test('a search that finds nothing lists every circle searched', () => {
	const window = atClues(4);
	const $ = window.$;
	const { crossing, circles } = searcher(window, 1);
	const route = last(gameState(window).jack).route;
	circles.forEach((id) => { const at = route.indexOf(id); if (at !== -1) route.splice(at, 1); });
	$('.token-search-adjacent-' + crossing).click();
	const before = $('.event-log .event').length;
	circles.forEach((id) => $('.token-search').filter(function () { return $(this).data('mapid') === id; }).click());
	assert.strictEqual($('.event-log .event').length, before + 1, 'one entry for the whole search');
	assert.strictEqual($('.event-log .event').first().text(), 'No clue at ' + circles.map((id) => window.map[id].number).join(', ') + '.');
});

test('a failed arrest is logged and uses up the policeman\'s action', () => {
	const window = atClues(4);
	const $ = window.$;
	const police = last(gameState(window).police);
	const jackAt = last(last(gameState(window).jack).route);
	const index = police.arrest.findIndex((list) => list.some((id) => id !== jackAt));
	const crossing = police.now[index];
	const circle = police.arrest[index].find((id) => id !== jackAt);
	$('.token-arrest-adjacent-' + crossing).click();
	assert.strictEqual($('.token-search-adjacent-' + crossing).length, 0);
	$('.token-arrest').filter(function () { return $(this).data('mapid') === circle; }).click();
	assert.strictEqual($('.event-log .event').first().text(), 'Arrest at ' + window.map[circle].number + ': Jack is not there.');
	assert.strictEqual($('.token-arrest').length, 0);
	assert.strictEqual(gameState(window).over, false);
});

test('a crossing\'s patrol can be switched between real and fake', () => {
	const window = startGame({ seed: 2 });
	const $ = window.$;
	const real = $('.token-police.marked').eq(0);
	const fake = real.next();
	const crossing = real.data('mapid');
	const police = () => last(gameState(window).police);
	real.click();
	assert.ok(real.hasClass('selected'));
	assert.deepStrictEqual(Array.from(police().start), [crossing]);
	fake.click();
	assert.ok(fake.hasClass('selected') && !real.hasClass('selected'));
	assert.deepStrictEqual(Array.from(police().start), []);
	assert.deepStrictEqual(Array.from(police().fake), [crossing]);
	assert.strictEqual($('.phase-progress').text(), 'Real 0 of 5 · Fake 1 of 2');
	fake.click();
	assert.deepStrictEqual(Array.from(police().fake), [], 'clicking again takes it back');
});

test('a policeman can be moved only to free crossings within two, or stay', () => {
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	const $ = window.$;
	const police = last(gameState(window).police);
	const crossing = $('.token-police.selectable').eq(0).data('mapid');
	const index = police.now.indexOf(crossing);
	$('.token-police.selectable').eq(0).click();
	const targets = $('.token-move-police').map(function () { return $(this).data('mapid'); }).get();
	const others = police.now.filter((id, i) => i !== index);
	assert.ok(targets.includes(crossing), 'Stay');
	assert.ok(targets.every((id) => !others.includes(id)), 'never onto another policeman');
	$('.token-move-police').filter(function () { return $(this).text() === 'Stay'; }).click();
	assert.deepStrictEqual(Array.from(police.route[index]), [crossing, crossing], 'staying is recorded as a move');
	assert.strictEqual($('.phase-progress').text(), 'Policemen moved: 1 of 5');
});
