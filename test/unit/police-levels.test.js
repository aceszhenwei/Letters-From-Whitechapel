// Who leads the detectives (js/ai/police-levels.js, js/ui/autopolice.js, js/ui/setup.js): the player by default,
// or a computer police the player watches. The choice is independent of Jack's difficulty, and changes nothing else.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('../helpers/core');
const { loadGame } = require('../helpers/game');

test('the player leads the detectives by default; Easy is the original police and Normal is Detective AI v2', () => {
	const { WC, _ } = loadCore({ seed: 1 });
	assert.strictEqual(WC.policeLevels.resolve({}).id, 'you');
	assert.strictEqual(WC.policeLevels.create(WC, 'you'), null);
	const easy = WC.policeLevels.create(WC, 'easy');
	assert.deepStrictEqual(Object.assign({}, easy.options), Object.assign({}, WC.createPolice(WC.board, WC.rules, WC.deduction, _).options));
	const normal = WC.policeLevels.create(WC, 'normal');
	for (const [key, value] of Object.entries(WC.policeVariants.v2)) assert.deepStrictEqual(normal.options[key], value, key);
	const hard = WC.policeLevels.create(WC, 'hard');
	for (const [key, value] of Object.entries(WC.policeVariants.v3)) assert.deepStrictEqual(hard.options[key], value, key);
	assert.ok(hard.options.contain > 0 && hard.options.containPatrols, 'Hard is Detective AI v3: containment on');
});

test('where the police choice comes from: address, then dialog, then saved, then the player', () => {
	const { WC } = loadCore({ seed: 1 });
	const r = (s) => { const x = WC.policeLevels.resolve(s); return [x.id, x.source]; };
	assert.deepStrictEqual(r({ saved: 'easy' }), ['easy', 'saved']);
	assert.deepStrictEqual(r({ saved: 'easy', chosen: 'normal' }), ['normal', 'chosen']);
	assert.deepStrictEqual(r({ search: '?police=you', chosen: 'normal' }), ['you', 'address']);
	assert.deepStrictEqual(r({ search: '?police=nightmare' }), ['you', 'default']);
	assert.deepStrictEqual(r({ search: '?police=hard' }), ['hard', 'address']);
});

function setupPage({ seed = 6, search = '', saved = {} } = {}) {
	const window = loadGame({ seed });
	const store = Object.assign({}, saved);
	const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
	const setup = window.WC.ui.setup(window.game, { search, storage, policeDelay: 0 });
	return { window, setup, store };
}

const until = (check, ms = 120000) => new Promise((resolve, reject) => {
	const started = Date.now();
	const poll = () => {
		if (check()) return resolve();
		if (Date.now() - started > ms) return reject(new Error('timed out'));
		setTimeout(poll, 20);
	};
	poll();
});

test('the dialog offers both choices; by default the player leads, and the board takes clicks', () => {
	const { window } = setupPage();
	const $ = window.$;
	assert.deepStrictEqual(Array.from($('input[name=police]').map(function () { return this.value; }).get()), ['you', 'easy', 'normal', 'hard']);
	assert.strictEqual($('input[name=police]:checked').val(), 'you');
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'easy');
	$('.start-game').click();
	assert.ok(!$('body').hasClass('computer-police'));
	assert.strictEqual($('.difficulty-badge').text(), 'Jack: Easy');
	assert.strictEqual(window.game.state.phase, 2, 'waiting for the player to place the patrols');
});

for (const level of ['easy', 'normal', 'hard']) {
	test(`with ${level} computer police, the police play a whole game by themselves, with Jack at his own difficulty`, async () => {
		const { window, store } = setupPage({ seed: 7 });
		const $ = window.$;
		$('input[name=police][value=' + level + ']').prop('checked', true);
		$('input[name=difficulty][value=normal]').prop('checked', true);
		$('.start-game').click();
		assert.ok($('body').hasClass('computer-police'), 'the board takes no clicks');
		assert.match($('.brand-subtitle').text(), /watching the police/);
		assert.match($('.difficulty-badge').text(), new RegExp(`Jack: Normal · ${level[0].toUpperCase() + level.slice(1)} police`));
		assert.ok(window.game.ai.options && window.game.ai.options.beam, 'Jack is still the strategic AI');
		await until(() => window.game.state.over);
		assert.ok(['jackWins', 'arrested', 'outOfMoves', 'trapped'].includes(window.game.state.result.type));
		assert.strictEqual(store['whitechapel.police'], level);
		assert.deepStrictEqual(window.errors, []);
	});
}

test('the address fixes the police choice and isn\'t saved', () => {
	const { window, store } = setupPage({ search: '?police=normal', saved: { 'whitechapel.police': 'you' } });
	const $ = window.$;
	assert.strictEqual($('input[name=police]:checked').val(), 'normal');
	assert.ok($('input[name=police]').toArray().every((input) => input.disabled));
	assert.ok(!$('input[name=difficulty]').toArray().some((input) => input.disabled), 'Jack\'s choice is unaffected');
	assert.strictEqual(store['whitechapel.police'], 'you');
});
