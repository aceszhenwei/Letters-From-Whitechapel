// Exporting the game log in the page (js/ui/export.js): a human detective's game, played by clicking, saved as the
// police's record and the full record, and read back by the importer (tools/game-log/validate.js).
const test = require('node:test');
const assert = require('node:assert');
const { loadGame, policeAction, advanceTo, seededRandom } = require('../helpers/game');
const { validate } = require('../../tools/game-log/validate');

function setUp(seed) {
	const window = loadGame({ seed });
	const saved = [];
	const ui = window.WC.ui.exportLog(window.game, window.recorder, { save: (name, text) => saved.push({ name, text }) });
	window.game.start();
	return { window, $: window.$, saved, ui };
}

test('a finished game: the ending offers the log, and both records read back (the full one replays)', () => {
	const { window, $, saved } = setUp(3);
	assert.ok(!$('.export-open.topbar-button').prop('hidden'), 'the top bar offers it once the game has begun');
	// Play by clicking, with one move taken back on the way
	const random = seededRandom(1003);
	let undone = false;
	for (let i = 0; i < 5000 && !window.game.state.over; i++) {
		if (!undone && window.game.state.phase === 10 && window.game.state.turn.moved.length === 1 && !$('.undo-move').prop('disabled')) {
			$('.undo-move').click();
			undone = true;
			continue;
		}
		const action = policeAction(window, random);
		if (action === 'stuck') break;
	}
	assert.ok(window.game.state.over, 'the game ends');
	assert.ok(undone, 'a move was undone');
	assert.ok($('.ending').hasClass('open'));
	$('.ending .export-open').click();
	assert.ok($('.export-dialog').hasClass('open'));
	assert.ok(!$('.ending').hasClass('open'), 'the ending steps aside while the log is open');
	assert.match($('.export-status').text(), /The game is over/);
	assert.ok(!$('.export-full').prop('disabled'));
	assert.ok($('.export-end').prop('hidden'), 'nothing to end');

	$('.export-public').click();
	$('.export-full').click();
	assert.match(saved[0].name, /^whitechapel-game-\d{4}-\d{2}-\d{2}-public\.json$/);
	assert.match(saved[1].name, /^whitechapel-game-\d{4}-\d{2}-\d{2}-full\.json$/);
	const pub = validate(saved[0].text);
	const full = validate(saved[1].text);
	assert.strictEqual(pub.verdict, 'partial', pub.errors.join('\n'));
	assert.strictEqual(full.verdict, 'verified', full.errors.join('\n'));
	assert.strictEqual(full.record.game.players.police.type, 'human');
	assert.deepStrictEqual(full.record.interactions.map((x) => x.kind), ['undone'], 'the undone move is kept apart');
	assert.strictEqual(full.record.outcome.result, window.game.state.result.type);

	$('.export-close').click();
	assert.ok(!$('.export-dialog').hasClass('open'));
	assert.ok($('.ending').hasClass('open'), 'back to the ending');
});

test('a game in progress: only the police\'s record, until the player ends the game and confirms', () => {
	const { window, $, saved } = setUp(4);
	assert.ok(advanceTo(window, 10, { seed: 4 }));
	$('.export-open.topbar-button').click();
	assert.match($('.export-status').text(), /in progress/);
	assert.ok($('.export-full').prop('disabled'), 'no spoilers while the game is on');
	assert.match($('.export-full-note').text(), /once the game is over/);
	assert.ok(!$('.export-end').prop('hidden'));
	assert.ok($('.export-end-game').prop('disabled'), 'not until the player confirms');

	$('.export-label').val('tester 1');
	$('.export-public').click();
	const pub = JSON.parse(saved[0].text);
	assert.strictEqual(pub.disclosure, 'public');
	assert.deepStrictEqual(pub.feedback, { label: 'tester 1' });
	assert.doesNotMatch(saved[0].text, /"(base|hideout|marked|unmarked|via|route|position)":/);
	assert.strictEqual(validate(saved[0].text).verdict, 'partial');
	$('.export-full').click();
	assert.strictEqual(saved.length, 1, 'the disabled button saves nothing');

	$('.export-confirm').prop('checked', true).trigger('change');
	assert.ok(!$('.export-end-game').prop('disabled'));
	$('.export-end-game').click();
	assert.strictEqual(window.recorder.status(), 'abandoned');
	assert.ok($('body').hasClass('game-ended'), 'the board takes no more moves');
	assert.match($('.export-status').text(), /You ended the game.*hideout was/);
	assert.ok(!$('.export-full').prop('disabled'));
	assert.ok($('.export-end').prop('hidden'));
	$('.export-full').click();
	const full = validate(saved[1].text);
	assert.strictEqual(full.verdict, 'verified', full.errors.join('\n'));
	assert.strictEqual(full.status, 'abandoned');

	// Escape closes the dialog
	$('.export-dialog').trigger($.Event('keydown', { key: 'Escape' }));
	assert.ok(!$('.export-dialog').hasClass('open'));
	assert.deepStrictEqual(window.errors, []);
});
