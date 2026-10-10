// Playing Jack in the page (js/ui/setup.js, js/ui/jack-player.js, js/ui/autopolice.js): the role and difficulty
// choices, Jack's decisions through the board, the computer detectives' turns, whole games, and their records.
const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('../helpers/game');
const { setupJack, until, playJack, jackDecision } = require('../helpers/jack');
const { seededRandom } = require('../helpers/game');

const plain = (value) => JSON.parse(JSON.stringify(value));
const values = ($, name) => Array.from($('input[name=' + name + ']').map(function () { return this.value; }).get());

function setupPage({ seed = 6, search = '', saved = {} } = {}) {
	const window = loadGame({ seed });
	const store = Object.assign({}, saved);
	const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
	const setup = window.WC.ui.setup(window.game, { search, storage, policeDelay: 0, jackAnimate: false });
	return { window, setup, store };
}

/* Setup
   ----- */
test('the detectives are the default role, with Strategic Jack (Normal) as the opponent, as before', () => {
	const { window } = setupPage();
	const $ = window.$;
	assert.deepStrictEqual(values($, 'role'), ['detectives', 'jack']);
	assert.strictEqual($('input[name=role]:checked').val(), 'detectives');
	assert.deepStrictEqual(values($, 'difficulty'), ['normal', 'hard']);
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
	assert.strictEqual($('.difficulty-legend').text(), 'Jack\'s difficulty');
	$('.start-game').click();
	assert.ok(window.game.ai.options && window.game.ai.options.beam, 'Strategic Jack');
	assert.ok(!window.game.settings.humanJack);
	assert.ok(!$('body').hasClass('human-jack'));
	assert.strictEqual(window.game.state.phase, 2, 'the player places the patrols, as before');
	assert.strictEqual(window.WC.ui.role(), 'detectives');
});

test('playing Jack offers the detectives\' difficulties, Easy (Detective AI v2) and Normal (Detective AI v3, the default)', () => {
	const { window } = setupPage();
	const $ = window.$;
	$('input[name=role][value=jack]').prop('checked', true).trigger('change');
	assert.deepStrictEqual(values($, 'difficulty'), ['easy', 'normal']);
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
	assert.strictEqual($('.difficulty-legend').text(), 'The detectives\' difficulty');
	assert.ok(!$('.intro-jack').prop('hidden') && $('.intro-detectives').prop('hidden'));
	const WC = window.WC;
	const easy = WC.detectiveLevels.create(WC, 'easy');
	const normal = WC.detectiveLevels.create(WC, 'normal');
	for (const [key, value] of Object.entries(WC.policeVariants.v2)) assert.deepStrictEqual(easy.options[key], value, key);
	assert.strictEqual(easy.options.contain, 0, 'Easy is Detective AI v2: no containment');
	for (const [key, value] of Object.entries(WC.policeVariants.v3)) assert.deepStrictEqual(normal.options[key], value, key);
	assert.deepStrictEqual(plain(WC.detectiveLevels.levels.map((l) => [l.id, l.label, l.ai])), [['easy', 'Easy', 'Detective AI v2'], ['normal', 'Normal', 'Detective AI v3']]);
	assert.ok(!WC.detectiveLevels.level('hard'), 'no Hard detectives');
	// Back to the detectives: their own levels and default, not the Jack role's choice
	$('input[name=difficulty][value=easy]').prop('checked', true);
	$('input[name=role][value=detectives]').prop('checked', true).trigger('change');
	assert.deepStrictEqual(values($, 'difficulty'), ['normal', 'hard']);
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
	$('input[name=role][value=jack]').prop('checked', true).trigger('change');
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal', 'an unconfirmed choice is not kept either');
});

for (const [level, variant] of [['easy', 'v2'], ['normal', 'v3']]) {
	test(`starting as Jack with ${level} detectives: no Jack AI, the engine waits for the player, ${variant} hunts him`, () => {
		const { window, store } = setupPage();
		const $ = window.$;
		$('input[name=role][value=jack]').prop('checked', true).trigger('change');
		$('input[name=difficulty][value=' + level + ']').prop('checked', true);
		$('.start-game').click();
		const game = window.game;
		assert.strictEqual(game.ai, null);
		assert.ok(game.settings.humanJack && !game.settings.confirmPoliceMoves && !game.settings.reviewNights);
		assert.ok($('body').hasClass('human-jack') && !$('body').hasClass('computer-police'));
		assert.strictEqual($('.difficulty-badge').text(), 'Detectives: ' + (level === 'easy' ? 'Easy' : 'Normal'));
		assert.match($('.brand-subtitle').text(), /You are Jack the Ripper/);
		assert.strictEqual(game.jackTurn(), 'hideout');
		assert.strictEqual(window.WC.ui.role(), 'jack');
		assert.strictEqual(store['whitechapel.role'], 'jack');
		assert.strictEqual(store['whitechapel.detectives'], level);
		assert.strictEqual(store['whitechapel.difficulty'], undefined, 'Jack\'s difficulty is not touched');
		assert.deepStrictEqual(window.errors, []);
	});
}

test('each role keeps its own saved difficulty; the saved role pre-selects; the address fixes both', () => {
	let { window } = setupPage({ saved: { 'whitechapel.role': 'jack', 'whitechapel.detectives': 'easy', 'whitechapel.difficulty': 'hard' } });
	let $ = window.$;
	assert.strictEqual($('input[name=role]:checked').val(), 'jack');
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'easy');
	$('input[name=role][value=detectives]').prop('checked', true).trigger('change');
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'hard');
	({ window } = setupPage({ search: '?role=jack&detectives=easy' }));
	$ = window.$;
	assert.ok($('input[name=role]').prop('disabled') && $('input[name=difficulty]').prop('disabled'));
	$('.start-game').click();
	assert.strictEqual(window.game.settings.humanJack, true);
	assert.strictEqual($('.difficulty-badge').text(), 'Detectives: Easy');
	// Unknown levels or roles fall back to the defaults: no invalid combination can start
	({ window } = setupPage({ search: '?role=jack&detectives=hard&difficulty=hard' }));
	$ = window.$;
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
	$('.start-game').click();
	assert.strictEqual($('.difficulty-badge').text(), 'Detectives: Normal');
	({ window } = setupPage({ search: '?role=ripper' }));
	assert.strictEqual(window.$('input[name=role]:checked').val(), 'detectives');
});

test('Developer Mode: as Jack, the watch-the-police choice is hidden and ignored; as the detectives it stays', () => {
	const { window } = setupPage({ search: '?dev=1&police=hard' });
	const $ = window.$;
	assert.ok(!$('.police-choice').prop('hidden'));
	$('input[name=role][value=jack]').prop('checked', true).trigger('change');
	assert.ok($('.police-choice').prop('hidden'));
	assert.match($('.difficulty-option').last().text(), /Detective AI v3/, 'developers see which AI a level plays');
	$('.start-game').click();
	assert.strictEqual(window.game.settings.humanJack, true);
	assert.ok(!$('body').hasClass('computer-police'));
});

test('starting twice does nothing the second time', () => {
	const { window } = setupJack();
	const $ = window.$;
	let started = 0;
	window.game.on((type) => { if (type === 'started') started++; });
	$('.start-game').click();
	$('.start-game').click();
	assert.strictEqual(started, 1);
});

/* Jack's decisions through the board
   ---------------------------------- */
test('hideout: only legal circles can be picked, nothing happens until confirmed, and the hideout is never public', () => {
	const { window } = setupJack();
	const $ = window.$;
	const WC = window.WC;
	$('.start-game').click();
	const choices = $('.map .jv-hideout-choice');
	assert.strictEqual(choices.length, WC.rules.hideoutChoices().length);
	const ids = choices.map(function () { return $(this).data('mapid'); }).get();
	assert.ok(ids.every((id) => WC.rules.isLegalHideout(id)) && !ids.some((id) => WC.board.isRed(id)));
	assert.ok($('.state.jack-turn .jack-confirm').prop('disabled'));
	const before = JSON.stringify(window.game.state);
	choices.eq(3).click();
	$('.map .jv-hideout-choice').eq(8).click(); // A change of mind
	assert.strictEqual(JSON.stringify(window.game.state), before, 'picking changes nothing');
	assert.match($('.state.jack-turn .jack-status').text(), new RegExp('Your hideout: ' + WC.board.number(ids[8])));
	$('.state.jack-turn .jack-confirm').click();
	assert.strictEqual(window.game.state.base, ids[8]);
	assert.strictEqual($('.map .jv-hideout').data('mapid'), ids[8], 'shown to Jack');
	assert.strictEqual(window.game.jackTurn(), 'women');
	assert.ok(!window.WC.rules.policeView(window.game.state).hasOwnProperty('base'));
});

async function toMove(window) {
	// Hideout, women and a kill through the page, then wait for Jack's first move
	const $ = window.$;
	$('.start-game').click();
	$('.map .jv-hideout-choice').eq(40).click();
	$('.state.jack-turn .jack-confirm').click();
	for (let i = 0; i < 20 && $('.state.jack-turn .jack-confirm').prop('disabled'); i++) $('.map .jv-woman-choice.jv-empty').first().click();
	$('.state.jack-turn .jack-confirm').click();
	await until(() => window.game.jackTurn() === 'murder');
	$('.map .jv-victim-choice').first().click();
	$('.state.jack-turn .jack-confirm').click();
	await until(() => window.game.jackTurn() === 'move' || window.game.state.over);
}

test('women: tapping cycles marked, decoy and empty; Confirm only with the right numbers', async () => {
	const { window } = setupJack();
	const $ = window.$;
	$('.start-game').click();
	$('.map .jv-hideout-choice').eq(5).click();
	$('.state.jack-turn .jack-confirm').click();
	const need = window.WC.rules.womenTonight(window.game.state);
	const first = $('.map .jv-woman-choice').first().data('mapid');
	const tap = () => $('.map .jv-woman-choice').filter(function () { return $(this).data('mapid') === first; }).click();
	tap();
	assert.strictEqual($('.map .jv-woman-choice.jv-marked').length, 1);
	tap();
	assert.strictEqual($('.map .jv-woman-choice.jv-unmarked').length, 1);
	tap();
	assert.strictEqual($('.map .jv-woman-choice.jv-empty').length, $('.map .jv-woman-choice').length);
	for (let i = 0; i < need.women; i++) $('.map .jv-woman-choice.jv-empty').first().click();
	assert.strictEqual($('.map .jv-woman-choice.jv-marked').length, need.marked);
	assert.strictEqual($('.map .jv-woman-choice.jv-unmarked').length, need.women - need.marked);
	assert.ok(!$('.state.jack-turn .jack-confirm').prop('disabled'));
	$('.state.jack-turn .jack-clear').click();
	assert.ok($('.state.jack-turn .jack-confirm').prop('disabled'));
	assert.strictEqual(window.game.state.womenMarked.length, 0, 'nothing placed until confirmed');
	for (let i = 0; i < need.women; i++) $('.map .jv-woman-choice.jv-empty').first().click();
	$('.state.jack-turn .jack-confirm').click();
	assert.strictEqual(window.game.state.womenMarked.length, need.marked);
	assert.strictEqual(window.game.state.phase, 2);
	await until(() => window.game.jackTurn() === 'murder');
	assert.strictEqual($('.map .jv-patrol').length, 7, 'Jack sees seven patrol tokens, face down');
	assert.strictEqual($('.map .jv-patrol.revealed').length, 0);
});

test('moving: cancelling or changing the kind of move changes nothing; a confirmed move is made exactly once', async () => {
	const { window } = setupJack({ seed: 8 });
	const $ = window.$;
	await toMove(window);
	const game = window.game;
	assert.strictEqual(game.jackTurn(), 'move');
	const before = JSON.stringify(game.state);
	const dests = $('.map .jv-dest');
	assert.ok(dests.length > 0);
	dests.first().click();
	assert.ok(!$('.state.jack-turn .jack-confirm').prop('disabled'));
	$('.state.jack-turn .jack-cancel').click();
	assert.ok($('.state.jack-turn .jack-confirm').prop('disabled'));
	assert.strictEqual($('.map .jv-picked').length, 0);
	$('.state.jack-turn .jack-kind').not('[disabled]').last().click();
	$('.map .jv-dest').first().click();
	$('.state.jack-turn .jack-kind-walk').click();
	assert.strictEqual(JSON.stringify(game.state), before, 'nothing changes, no token is used');
	// Every destination drawn is legal, and only those
	const walks = $('.map .jv-dest').map(function () { return $(this).data('mapid'); }).get().sort();
	assert.deepStrictEqual(plain(walks), plain(Array.from(window.WC.rules.jackWalks(game.state, window.WC.rules.jackPosition(game.state))).sort()));
	let moves = 0;
	game.on((type, data) => { if (type === 'action' && data.type === 'move') moves++; });
	$('.map .jv-dest').first().click();
	const confirm = $('.state.jack-turn .jack-confirm');
	confirm.click();
	confirm.click(); // Rapid double tap on the same button
	$('.state.jack-turn .jack-confirm').click();
	assert.strictEqual(moves, 1);
	assert.deepStrictEqual(window.errors, []);
});

test('coaches and alleys: they show their own destinations, say why they are unavailable, and use their tokens', async () => {
	const { window } = setupJack({ seed: 12 });
	const $ = window.$;
	await toMove(window);
	const game = window.game;
	const R = window.WC.rules;
	const night = () => R.jackNight(game.state);
	// Coach: every legal stop and destination
	const coaches = night().carriages;
	$('.state.jack-turn .jack-kind-carriage').click();
	const dests = $('.map .jv-dest-carriage');
	assert.ok(dests.length > 0);
	dests.each(function () {
		const to = $(this).data('mapid');
		assert.ok(window.WC.board.walk(R.jackPosition(game.state), []).some((via) => R.isLegalJackMove(game.state, { type: 'carriage', via, mapid: to })));
	});
	const remaining = game.state.remainingMoves;
	// Pick a destination; choose a stop if asked
	dests.first().click();
	if ($('.map .jv-via').length) {
		assert.ok($('.state.jack-turn .jack-confirm').prop('disabled'), 'a coach with several stops needs one chosen');
		$('.map .jv-via').first().click();
	}
	$('.state.jack-turn .jack-confirm').click();
	assert.strictEqual(night().carriages, coaches - 1);
	assert.strictEqual(game.state.remainingMoves, remaining - 2);
	assert.strictEqual(night().moves[0].type, 'carriage');
	assert.strictEqual(night().route.length, 3, 'both stops on Jack\'s sheet');
	// Use up the alleys, then the alley button says why it is unavailable
	await until(() => game.jackTurn() === 'move' || game.state.over);
	while (!game.state.over && night().alleys > 0 && game.jackTurn() === 'move') {
		const alley = $('.state.jack-turn .jack-kind-alley');
		if (alley.prop('disabled')) break;
		alley.click();
		$('.map .jv-dest-alley').first().click();
		$('.state.jack-turn .jack-confirm').click();
		await until(() => game.jackTurn() === 'move' || game.state.over);
	}
	if (!game.state.over && night().alleys === 0) {
		assert.ok($('.state.jack-turn .jack-kind-alley').prop('disabled'));
		assert.match($('.state.jack-turn .jack-unavailable').text(), /No alleys left tonight/);
	}
	assert.deepStrictEqual(window.errors, []);
});

/* The detectives' turns
   --------------------- */
test('the detectives\' turns are shown in Jack\'s case log: their moves, searches and outcomes, never their reasoning', async () => {
	const { window } = setupJack({ seed: 3 });
	const $ = window.$;
	await toMove(window);
	await playJack(window, { seed: 3 });
	const log = $('.event-log .event').map(function () { return $(this).text(); }).get();
	assert.ok(log.some((line) => /^The (blue|yellow|brown|red|green) policeman (moves to|stays on) the crossing by /.test(line)));
	assert.ok(log.some((line) => /policeman searches .*(no clue|finds a clue)/.test(line)));
	assert.ok(log.some((line) => /^You (walk|take a coach|slip through)/.test(line)));
	assert.ok(!log.some((line) => /belief|probab|likel|%/i.test(line)), 'nothing from the detectives\' inference');
	assert.ok($('.ending').hasClass('open'));
	assert.ok($('.ending-summary li').length >= 4);
	assert.deepStrictEqual(window.errors, []);
});

test('Skip and animations change only the pace: the same seeds play the same game', async () => {
	const games = [];
	for (const animate of [false, true]) {
		const { window } = setupJack({ seed: 4, animate, search: '?role=jack&detectives=easy' });
		const $ = window.$;
		$('.start-game').click();
		const actions = [];
		window.game.on((type, data) => { if (type === 'action') actions.push(plain(data)); });
		let skips = 0;
		await playJack(window, { seed: 4, check: () => {
			// Hurry every detectives' turn as soon as it begins
			if (animate && !window.game.jackTurn() && $('.state.jack-watch .skip-animations').length) { $('.state.jack-watch .skip-animations').click(); skips++; }
		} });
		if (animate) assert.ok(skips > 0);
		games.push({ actions, result: plain(window.game.state.result) });
		assert.deepStrictEqual(window.errors, []);
	}
	assert.deepStrictEqual(games[1], games[0]);
});

test('the detectives never act twice, overlap, or go on after the game ends', async () => {
	const { window } = setupJack({ seed: 9, search: '?role=jack&detectives=normal' });
	const $ = window.$;
	const WC = window.WC;
	// Watch every call the page makes to the detectives' AI
	let running = 0;
	let overlap = false;
	let calls = 0;
	let afterEnd = 0;
	const level = WC.detectiveLevels.level('normal');
	const make = level.create;
	level.create = (wc) => {
		const ai = make(wc);
		const turn = ai.turn;
		ai.turn = function () {
			if (running) overlap = true;
			if (window.game.state.over) afterEnd++;
			running++;
			calls++;
			try { return turn.apply(this, arguments); } finally { running--; }
		};
		return ai;
	};
	$('.start-game').click();
	await playJack(window, { seed: 9 });
	const game = window.game;
	assert.ok(game.state.over);
	const end = JSON.stringify(game.state);
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.strictEqual(JSON.stringify(game.state), end, 'nothing happens after the end');
	assert.ok(calls > 10);
	assert.ok(!overlap, 'no step starts while another runs');
	assert.strictEqual(afterEnd, 0);
	// Each police action the engine accepted was taken once: no duplicate policeman move in one Hunting the monster
	assert.deepStrictEqual(window.errors, []);
});

/* Whole games and their records
   ----------------------------- */
for (const [level, seed] of [['easy', 21], ['normal', 22]]) {
	test(`a whole game as Jack against ${level} detectives: legal to the end, recorded, exported and replayed`, async () => {
		const { window } = setupJack({ seed, search: '?role=jack&detectives=' + level });
		const $ = window.$;
		$('.start-game').click();
		const decisions = await playJack(window, { seed });
		const game = window.game;
		assert.ok(game.state.over);
		assert.ok(['jackWins', 'arrested', 'outOfMoves', 'trapped'].includes(game.state.result.type));
		assert.ok(decisions.includes('move'));
		assert.deepStrictEqual(window.errors, []);
	});
}

test('a Human Jack game\'s record: who played, the seed, every decision; it validates and replays exactly', async () => {
	const window = loadGame({ seed: 31 });
	const store = {};
	const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
	const recorder = window.WC.record.attach(window.game);
	window.WC.ui.setup(window.game, { search: '?role=jack&detectives=normal', storage, policeDelay: 0, seed: 1234, jackAnimate: false, recorder });
	const $ = window.$;
	$('.start-game').click();
	// While playing: the detectives' public record holds no hideout or route
	jackDecision(window, seededRandom(1));
	await until(() => window.game.jackTurn() === 'women');
	const early = recorder.exportPublic('police');
	assert.deepStrictEqual(plain(early.actions[0].args), {}, 'the hideout is hidden');
	await playJack(window, { seed: 31 });
	const full = recorder.exportFull();
	assert.deepStrictEqual(plain(full.game.players), { jack: { type: 'human' }, police: { type: 'ai', level: 'normal', ai: 'Detective AI v3' } });
	assert.strictEqual(full.game.randomness.seed, 1234);
	assert.strictEqual(full.game.randomness.source, 'seeded');
	const replay = window.WC.record.replay(full);
	assert.ok(replay.ok, replay.problems.join('\n'));
	assert.strictEqual(replay.game.state.result.type, window.game.state.result.type);
	const validate = require('../../tools/game-log/validate');
	for (const record of [full, recorder.exportPublic('police'), recorder.exportPublic('jack')]) {
		const result = validate.validate(window.WC.record.stringify(record));
		assert.deepStrictEqual(result.errors, [], record.disclosure + ' ' + record.role);
	}
	// The police's public record never names Jack's moves' destinations
	const publicPolice = recorder.exportPublic('police');
	assert.ok(publicPolice.actions.filter((a) => a.type === 'move').every((a) => a.args.mapid === undefined));
});

test('the same seed for the detectives replays their decisions exactly against the same Jack', async () => {
	const runs = [];
	for (let i = 0; i < 2; i++) {
		const { window } = setupJack({ seed: 40, policeSeed: 555, search: '?role=jack&detectives=normal' });
		window.$('.start-game').click();
		const actions = [];
		window.game.on((type, data) => { if (type === 'action') actions.push(plain(data)); });
		await playJack(window, { seed: 40 });
		runs.push(actions);
	}
	assert.deepStrictEqual(runs[1], runs[0]);
});
