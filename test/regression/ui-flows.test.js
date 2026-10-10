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

test('choosing another policeman before moving the first puts the first back, so he can still move', () => {
	// Reported bug: click policeman A, then policeman B, move B; A had vanished and the turn could not finish
	const window = startGame({ seed: 4 });
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	const $ = window.$;
	const police = last(gameState(window).police);
	const tokens = $('.token-police.selectable');
	const a = tokens.eq(0).data('mapid');
	const b = tokens.eq(1).data('mapid');
	tokens.eq(0).click();
	$('.token-police.selectable').filter(function () { return $(this).data('mapid') === b; }).click();
	const stays = $('.token-move-police').filter(function () { return $(this).text() === 'Stay'; });
	assert.strictEqual(stays.length, 1, 'only the policeman chosen last shows his choices');
	assert.strictEqual(stays.data('mapid'), b);
	assert.strictEqual($('.token-police.selectable').filter(function () { return $(this).data('mapid') === a; }).length, 1, 'the first policeman is back on the board');
	// Move B somewhere else, then A can still be chosen and moved, and the turn goes on
	const to = $('.token-move-police').filter(function () { return $(this).text() !== 'Stay'; }).first();
	const destination = to.data('mapid');
	to.click();
	assert.strictEqual(police.now[police.route.findIndex((r) => r[0] === b)], destination);
	const first = $('.token-police.selectable').filter(function () { return $(this).data('mapid') === a; });
	assert.strictEqual(first.length, 1, 'the first policeman is still there after the other moved');
	first.click();
	$('.token-move-police').filter(function () { return $(this).text() === 'Stay'; }).click();
	assert.strictEqual($('.phase-progress').text(), 'Policemen moved: 2 of 5');
});

// Clues and suspicion with several policemen: one acts at a time, and each policeman's tokens are his own, so one
// policeman's search or arrest never removes another's (the reported softlock: a clue found by one policeman used to
// remove every search token, stranding a second policeman who had already chosen to search)
function twoSearchers(window) {
	const police = last(gameState(window).police);
	const can = police.search.map((list, i) => i).filter((i) => police.search[i].length > 0);
	assert.ok(can.length >= 2);
	return { police, a: can[0], b: can[1] };
}

test('one policeman acts at a time: the others wait, and a clue found never strands them', () => {
	const window = atClues(1);
	const $ = window.$;
	const { police, a, b } = twoSearchers(window);
	last(gameState(window).jack).route.unshift(police.search[a][0]); // A clue at the first policeman's first circle
	$('.token-search-adjacent-' + police.now[a]).click();
	assert.ok($('.token-search-adjacent-' + police.now[b]).hasClass('waiting'), 'the others\' choices wait');
	$('.token-search-adjacent-' + police.now[b]).click();
	assert.strictEqual(gameState(window).turn.choice[b], undefined, 'a second policeman can\'t start while the first acts');
	$('.token-search.for-police-' + a).filter(function () { return $(this).data('mapid') === police.search[a][0]; }).click();
	assert.ok(gameState(window).turn.done.includes(a), 'the clue ends his search');
	const next = $('.token-search-adjacent-' + police.now[b]);
	assert.strictEqual(next.length, 1);
	assert.ok(!next.hasClass('waiting'), 'the next policeman may act');
	next.click();
	assert.ok($('.token-search.for-police-' + b).length > 0, 'his circles are on the board');
	police.search[b].slice().forEach((id) => $('.token-search.for-police-' + b).filter(function () { return $(this).data('mapid') === id; }).click());
	assert.ok(gameState(window).turn.done.includes(b), 'and he finishes');
	assert.deepStrictEqual(window.errors, []);
});

test('policemen beside the same circle each keep their own token for it', () => {
	for (let seed = 1; seed < 20; seed++) {
		const window = startGame({ seed });
		const $ = window.$;
		const { rules, board } = window.WC;
		if (!advanceTo(window, 10, { seed })) continue;
		// Move two policemen next to the same circle; the others stay where they are
		const game = window.game;
		const now = Array.from(rules.policeNight(game.state).now);
		const reach = (i) => [now[i]].concat(Array.from(rules.policeDestinations(game.state, i)));
		let pair = null;
		for (let a = 0; a < now.length && !pair; a++) {
			for (let b = a + 1; b < now.length && !pair; b++) {
				for (const toA of reach(a)) {
					const toB = reach(b).find((to) => to !== toA && board.adjacentNumbers(to).some((id) => board.adjacentNumbers(toA).includes(id)));
					if (toB !== undefined) { pair = { a, b, toA, toB }; break; }
				}
			}
		}
		if (!pair) continue;
		now.forEach((crossing, i) => assert.ok(game.movePoliceman(i, i === pair.a ? pair.toA : i === pair.b ? pair.toB : crossing)));
		game.finishPoliceMoves();
		if (game.state.phase !== 11) continue;
		const police = last(game.state.police);
		const route = last(last(game.state.jack).route ? game.state.jack : []).route;
		const shared = police.search[pair.a].filter((id) => police.search[pair.b].includes(id) && !route.includes(id));
		if (!shared.length) continue;
		$('.token-search-adjacent-' + police.now[pair.a]).click();
		$('.token-search.for-police-' + pair.a).filter(function () { return $(this).data('mapid') === shared[0]; }).click();
		$('.state.clues-and-suspicion .search-rest').click(); // He finishes his search, if anything is left
		assert.ok(game.state.turn.done.includes(pair.a));
		$('.token-search-adjacent-' + police.now[pair.b]).click();
		assert.strictEqual($('.token-search.for-police-' + pair.b).filter(function () { return $(this).data('mapid') === shared[0]; }).length, 1,
			'the circle the first policeman searched is still the second\'s to search');
		assert.deepStrictEqual(window.errors, []);
		return;
	}
	assert.fail('no position with two policemen beside the same circle');
});

test('Search his remaining circles finishes the chosen policeman\'s search, in order, stopping at a clue', () => {
	const window = atClues(4);
	const $ = window.$;
	const { index, crossing, circles } = searcher(window, 3);
	const route = last(gameState(window).jack).route;
	circles.forEach((id) => { const at = route.indexOf(id); if (at !== -1) route.splice(at, 1); });
	route.unshift(circles[1]);
	const rest = $('.state.clues-and-suspicion .search-rest');
	assert.ok(rest.prop('hidden'), 'only once a policeman is searching');
	$('.token-search-adjacent-' + crossing).click();
	assert.ok(!rest.prop('hidden'));
	rest.click();
	assert.ok(gameState(window).turn.done.includes(index));
	assert.deepStrictEqual(Array.from(last(gameState(window).police).clue), [circles[1]], 'the first circle missed, the second had a clue');
	assert.ok(!last(gameState(window).police).log.some((e) => e.type === 'search' && e.mapid === circles[2]), 'the search stopped there');
	assert.strictEqual($('.token-search.for-police-' + index).length, 0);
});

test('Search with every policeman left: each who can search does; one who can only arrest is left to act', () => {
	const window = atClues(4);
	const $ = window.$;
	const police = last(gameState(window).police);
	const searchers = police.now.map((c, i) => i).filter((i) => police.search[i].length > 0);
	const arrestOnly = police.now.map((c, i) => i).filter((i) => police.search[i].length === 0 && police.arrest[i].length > 0);
	const everyone = $('.state.clues-and-suspicion .search-everyone');
	assert.ok(!everyone.prop('hidden'));
	everyone.click();
	if (arrestOnly.length) {
		assert.strictEqual(gameState(window).phase, 11, 'still waiting for the policeman who can only arrest');
		searchers.forEach((i) => assert.ok(gameState(window).turn.done.includes(i)));
		assert.ok(everyone.prop('hidden'), 'nobody left to search');
	} else {
		assert.notStrictEqual(gameState(window).phase, 11, 'every policeman acted, so the night went on');
	}
	assert.deepStrictEqual(window.errors, []);
});

// Zooming the board (js/ui/renderer.js, draw.fit): jsdom has no layout, so the board's width is set by hand
test('the board zooms in and out, and zoomed in it scrolls instead of shrinking', () => {
	const window = startGame({ seed: 3 });
	const $ = window.$;
	const realWidth = $.fn.width;
	$.fn.width = function () { return this.is('.board') ? 360 : realWidth.apply(this, arguments); }; // A phone
	try {
		window.WC.ui.draw.zoomFit();
		assert.ok(!$('.board').hasClass('zoomed'));
		assert.match($('.map').attr('style'), /scale\(0\.36\)/);
		assert.ok($('.zoom-out').prop('disabled') && !$('.zoom-in').prop('disabled'));
		$('.zoom-in').click();
		assert.ok($('.board').hasClass('zoomed'), 'larger than the space: the board scrolls');
		assert.match($('.map').attr('style'), /scale\(1\)/);
		assert.strictEqual($('.board-sizer').css('width'), '1000px');
		$('.zoom-in').click();
		$('.zoom-in').click();
		assert.match($('.map').attr('style'), /scale\(2\)/);
		assert.ok($('.zoom-in').prop('disabled'), 'the largest step');
		$('.zoom-fit').click();
		assert.ok(!$('.board').hasClass('zoomed'));
		assert.deepStrictEqual(window.errors, []);
	} finally {
		$.fn.width = realWidth;
	}
});

test('watching the computer police, the board can still be scrolled: only the map ignores clicks', () => {
	const css = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'css', 'style.css'), 'utf8');
	assert.match(css, /\.computer-police \.board \.map \{\s*pointer-events: none;/);
	assert.doesNotMatch(css, /\.computer-police \.board \{\s*pointer-events: none;/);
	// Destination rings are drawn above the Stay pill, so the pill never hides a destination
	const z = (selector) => Number(new RegExp(selector.replace(/[.[\]^"()]/g, '\\$&') + ' \\{[^}]*z-index: (\\d+)').exec(css)[1]);
	assert.ok(z('.map .token-move-police, .map .token-move-wretched') > z('.map .token-move-police[title^="Stay"]'));
});

test('in Clues and suspicion, tapping a policeman brings his Search and Arrest choices to the front', () => {
	const window = atClues(4);
	const $ = window.$;
	const police = last(gameState(window).police);
	const index = police.now.findIndex((c, i) => police.search[i].length > 0);
	$('.map .token-pawn.police-' + index).click();
	assert.ok($('.token-search-adjacent.for-police-' + index).hasClass('front'));
	assert.strictEqual($('.map .front').not('.for-police-' + index).length, 0);
});
