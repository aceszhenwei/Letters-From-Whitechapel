// The detective's quality-of-life features in the page: the women and Wretched on the board, undoing a policeman's
// move by clicking, and reviewing a night that is over (js/ui/renderer.js, js/ui/review.js).
const test = require('node:test');
const assert = require('node:assert');
const { startGame, advanceTo, policeAction, seededRandom } = require('../helpers/game');

test('the women stand out on the board, all alike, without hiding their circles\' numbers', () => {
	const window = startGame({ seed: 4 });
	const $ = window.$;
	const state = window.game.state;
	const women = $('.map .token-woman');
	assert.strictEqual(women.length, state.womenMarked.length + state.womenUnmarked.length, 'every woman is on the board');
	// Face down: nothing tells marked from unmarked
	const looks = new Set(women.map(function () { return this.className.replace(/token-woman-\d+/, ''); }).get());
	assert.strictEqual(looks.size, 1);
	women.each(function () { assert.doesNotMatch($(this).attr('title'), /\bis marked|unmarked\b/i); });
	assert.ok(women.toArray().every((w) => w.textContent === ''), 'a ring, not a label over the number');
	// The highlight fades everything else back, and can be turned off
	const button = $('button.highlight-pieces');
	assert.ok(!button.prop('hidden'));
	button.click();
	assert.ok($('.board').hasClass('highlighting'));
	assert.strictEqual(button.attr('aria-pressed'), 'true');
	button.click();
	assert.ok(!$('.board').hasClass('highlighting'));
	assert.strictEqual($('.map').length, 1, 'the board is still there');
});

test('the Wretched are shown from the victims\' choice until the alarm, and the selected one is marked', () => {
	for (const seed of [4, 6, 9, 12]) {
		const window = startGame({ seed });
		const $ = window.$;
		if (!advanceTo(window, 5, { seed })) continue; // Jack didn't wait in this game
		const state = window.game.state;
		assert.strictEqual($('.map .token-wretched').length, state.womenMarked.length);
		assert.strictEqual($('.map .token-woman').length, 0, 'the unmarked women have gone');
		const first = $('.map .token-wretched.selectable').eq(0);
		first.click();
		assert.ok(first.hasClass('selected'));
		assert.strictEqual($('.map .token-wretched.selected').length, 1);
		return;
	}
	assert.fail('no game reached Suspense grows');
});

test('undo by clicking: the chosen policeman is marked, his move can be taken back, and Done waits for everyone', () => {
	const window = startGame({ seed: 4 });
	const $ = window.$;
	const game = window.game;
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	const undo = $('.undo-move');
	const done = $('.finish-moves');
	assert.ok(undo.prop('disabled'), 'nothing to undo yet');
	assert.ok(done.prop('disabled'));
	const before = Array.from(window.WC.rules.policeNight(game.state).now);
	$('.map .token-police.selectable').eq(0).click();
	assert.strictEqual($('.map .token-police.selected').length, 1, 'the chosen policeman is marked');
	assert.ok($('.map .token-move-police.for-police-0').length > 0, 'his crossings are ringed in his colour');
	$('.map .token-move-police.for-police-0').eq(0).click();
	assert.notStrictEqual(window.WC.rules.policeNight(game.state).now[0], before[0]);
	assert.ok(!undo.prop('disabled'));
	undo.click();
	assert.deepStrictEqual(Array.from(window.WC.rules.policeNight(game.state).now), before);
	assert.ok(undo.prop('disabled'));
	assert.strictEqual($('.map .token-police.selectable').length, before.length, 'he can be chosen again');
	// Everyone stays: Done is then the only way on
	for (let i = 0; i < before.length; i++) {
		$('.map .token-police.selectable').eq(0).click();
		$('.map .token-move-police').filter(function () { return /^Stay/.test($(this).attr('title')); }).click();
	}
	assert.strictEqual(game.state.phase, 10);
	assert.ok(!done.prop('disabled'));
	done.click();
	assert.strictEqual(game.state.phase, 11);
});

test('after Jack escapes, the board stays for review, with the night\'s log, until the player begins the next night', () => {
	const window = startGame({ seed: 4 });
	const $ = window.$;
	const game = window.game;
	assert.ok(advanceTo(window, 12, { seed: 4 }), 'the first night ends in a review');
	assert.strictEqual(game.state.jack.length, 1);
	assert.strictEqual($('.phase-title').text(), 'The night is over');
	assert.ok($('.board').hasClass('reviewing'));
	assert.strictEqual($('.map .review-police').length, 5, 'the policemen where they ended');
	assert.ok($('.map .review-crime').length >= 1, 'the crime scene');
	const lines = $('.review-log li').map(function () { return $(this).text(); }).get();
	assert.match(lines[0], /^Body found at \d+/);
	assert.match(lines[lines.length - 1], /reached his hideout/);
	assert.ok(lines.some((l) => /^Moves? \d+/.test(l)), 'the move numbers');
	// The log is written from the night's public record alone (whose contents police-undo.test.js checks), so it can't
	// name Jack's hideout or route
	const record = window.WC.rules.nightRecord(game.state, 0);
	assert.deepStrictEqual(lines, window.WC.ui.review.lines(record).map((l) => l.text));
	// Distances from the crime scene: a click shows them, another hides them
	$('.map .review-crime').not('.review-earlier').eq(0).click();
	assert.ok($('.map .review-distance').length > 0);
	$('.map .review-crime').not('.review-earlier').eq(0).click();
	assert.strictEqual($('.map .review-distance').length, 0);
	// Nothing in the review changed the game
	const snapshot = JSON.stringify(game.state);
	$('.review-night').eq(0).click();
	$('.review-night').eq(0).click();
	assert.strictEqual(JSON.stringify(game.state), snapshot);
	// Begin the next night
	$('.state.the-night-is-over .begin-next-night').click();
	assert.strictEqual(game.state.jack.length, 2);
	assert.ok(!$('.board').hasClass('reviewing'));
	assert.strictEqual($('.map .review').length, 0);
});

test('an earlier night can be looked at during a later one, read-only, and the board comes back', () => {
	const window = startGame({ seed: 4 });
	const $ = window.$;
	const game = window.game;
	assert.ok(advanceTo(window, 12, { seed: 4 }));
	$('.state.the-night-is-over .begin-next-night').click();
	assert.strictEqual(game.state.phase, 2);
	const live = $('.map .token').length;
	const snapshot = JSON.stringify(game.state);
	$('.review-night').eq(0).click();
	assert.ok($('.board').hasClass('reviewing'));
	assert.match($('.review-body h3').text(), /^First night/);
	assert.ok($('.map .review-crime').length >= 1);
	assert.strictEqual(JSON.stringify(game.state), snapshot, 'looking back changes nothing');
	$('.close-review').click();
	assert.ok(!$('.board').hasClass('reviewing'));
	assert.strictEqual($('.map .token').length, live, 'the current night\'s pieces are back');
});

test('whole games in the page: every night ends in a review, and the last ends the game', () => {
	for (const seed of [4, 13]) {
		const window = startGame({ seed });
		const random = seededRandom(seed + 1000);
		const reviewed = [];
		window.game.on((type, data) => { if (type === 'nightOver') reviewed.push(data.night); });
		let action;
		for (let i = 0; i < 6000; i++) {
			action = policeAction(window, random);
			if (action === 'over' || action === 'stuck') break;
		}
		assert.strictEqual(action, 'over', `seed ${seed}`);
		assert.deepStrictEqual(reviewed, Array.from({ length: window.game.state.jack.length - 1 }, (_, i) => i));
		assert.deepStrictEqual(window.errors, []);
		// The case can be reviewed from the ending dialog
		window.$('.review-case').click();
		assert.ok(!window.$('.ending').hasClass('open'));
		assert.strictEqual(window.$('.review-night').length, window.game.state.jack.length);
	}
});
