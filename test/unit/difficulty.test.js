// Jack's difficulty (js/ai/difficulty.js, js/ui/setup.js): players choose Normal (the strategic AI, the default) or Hard
// (Jack AI v2); Developer Mode (?dev=1) adds Easy (the baseline AI) and the experimental levels. The choice changes only
// which AI the engine asks, never the rules, the police's side or what Jack may know.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadCore } = require('../helpers/core');
const { loadGame, playGame } = require('../helpers/game');
const { playHeadless } = require('../helpers/headless');

const decisions = ['chooseHideout', 'placeWomen', 'wantsToWait', 'chooseVictims', 'choosePatrolToReveal', 'chooseMove'];

test('Easy is the baseline AI, the very object the game has always used', () => {
	const { WC } = loadCore({ seed: 1 });
	assert.strictEqual(WC.difficulty.create(WC, 'easy'), WC.jackAI);
});

test('Normal is the strategic AI, with all its parts', () => {
	const { WC } = loadCore({ seed: 1 });
	const ai = WC.difficulty.create(WC, 'normal');
	assert.notStrictEqual(ai, WC.jackAI);
	assert.deepStrictEqual(Object.assign({}, ai.options), Object.assign({}, WC.strategicVariants.strategic, { beam: 6 }));
	for (const name of decisions) assert.strictEqual(typeof ai[name], 'function', name);
});

test('Hard is Jack AI v2: the strategic AI with its detours, not on the last night', () => {
	const { WC } = loadCore({ seed: 1 });
	const ai = WC.difficulty.create(WC, 'hard');
	assert.notStrictEqual(ai, WC.jackAI);
	assert.deepStrictEqual(Object.assign({}, ai.options), { detourMoves: 3, detourSpare: 6, detourLastNight: false });
	for (const name of decisions) assert.strictEqual(typeof ai[name], 'function', name);
});

test('the default is Normal, and where a choice comes from follows the documented order', () => {
	const { WC } = loadCore({ seed: 1 });
	const r = (sources) => { const x = WC.difficulty.resolve(sources); return [x.id, x.source]; };
	assert.deepStrictEqual(r({}), ['normal', 'default']);
	assert.deepStrictEqual(r({ saved: 'hard' }), ['hard', 'saved']);
	assert.deepStrictEqual(r({ saved: 'hard', chosen: 'normal' }), ['normal', 'chosen']);
	assert.deepStrictEqual(r({ search: '?difficulty=normal', chosen: 'hard', saved: 'hard' }), ['normal', 'address']);
	assert.deepStrictEqual(r({ search: '?jack=strategic' }), ['normal', 'address']); // The old development switch
	assert.deepStrictEqual(r({ search: '?jack=baseline', saved: 'normal' }), ['easy', 'address']);
	assert.deepStrictEqual(r({ search: '?difficulty=nightmare', saved: 'nonsense' }), ['normal', 'default']); // Unknown levels are ignored
	assert.ok(WC.difficulty.create(WC, 'nightmare').options.beam, 'an unknown level plays the default, Normal');
	assert.deepStrictEqual(r({ search: '?difficulty=hard' }), ['hard', 'address']);
	// Developer-only levels: from the address always (research and tests), from the dialog or a saved choice only in
	// Developer Mode, so a developer's choice never carries into an ordinary game
	assert.deepStrictEqual(r({ search: '?difficulty=easy' }), ['easy', 'address']);
	assert.deepStrictEqual(r({ search: '?difficulty=hard-waiting' }), ['hard-waiting', 'address']);
	assert.deepStrictEqual(r({ saved: 'easy' }), ['normal', 'default']);
	assert.deepStrictEqual(r({ chosen: 'easy', saved: 'hard' }), ['hard', 'saved']);
	assert.deepStrictEqual(r({ saved: 'easy', dev: true }), ['easy', 'saved']);
	assert.deepStrictEqual(r({ chosen: 'hard-waiting', dev: true }), ['hard-waiting', 'chosen']);
});

test('players are offered Normal and Hard; Developer Mode offers every level', () => {
	const { WC } = loadCore({ seed: 1 });
	assert.deepStrictEqual(Array.from(WC.difficulty.offered(false), (l) => l.id), ['normal', 'hard']);
	assert.deepStrictEqual(Array.from(WC.difficulty.offered(true), (l) => l.id), ['easy', 'normal', 'hard', 'hard-waiting']);
	assert.strictEqual(WC.difficulty.defaultLevel, 'normal');
});

test('Hard, waiting (Developer Mode) is Jack AI v2 with the strategic waiting policy', () => {
	const { WC } = loadCore({ seed: 1 });
	const ai = WC.difficulty.create(WC, 'hard-waiting');
	assert.deepStrictEqual(Object.assign({}, ai.options), { detourMoves: 3, detourSpare: 6, detourLastNight: false });
	assert.ok(ai.debug && 'waiting' in ai.debug, 'the waiting policy decides whether to wait');
	for (const name of decisions) assert.strictEqual(typeof ai[name], 'function', name);
});

test('the page starts with Easy until a difficulty is applied, so recorded games are unchanged', () => {
	const window = loadGame({ seed: 3 });
	assert.strictEqual(window.game.ai, window.WC.jackAI);
});

test('the difficulty module only chooses an AI: it never touches the rules, the engine or the page', () => {
	const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'ai', 'difficulty.js'), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	assert.ok(!/\$\(|document|window|WC\.rules|WC\.engine|state/.test(source));
	const { WC } = loadCore({ seed: 1 });
	const before = JSON.stringify(WC.rules.config);
	WC.difficulty.create(WC, 'normal');
	WC.difficulty.create(WC, 'easy');
	assert.strictEqual(JSON.stringify(WC.rules.config), before);
});

// A whole headless game at a difficulty, with every decision watched: the view it reads and the move it makes
function watchedGame(level, seed) {
	const { WC } = loadCore({ seed });
	const ai = WC.difficulty.create(WC, level);
	const used = new Set();
	const calls = {};
	let illegal = 0;
	const allowed = new Set();
	const watched = {};
	for (const name of decisions) {
		watched[name] = function (view, ...rest) {
			calls[name] = (calls[name] || 0) + 1;
			if (view && typeof view === 'object' && !Array.isArray(view) && 'hideout' in view) {
				Object.keys(view).forEach((key) => allowed.add(key));
				view = new Proxy(view, { get: (target, key) => { used.add(key); return target[key]; } });
			}
			const answer = ai[name].call(ai, view, ...rest);
			if (name === 'chooseMove') {
				const legal = view.walks().includes(answer.mapid) && answer.type === 'walk' ||
					view.specialMoves().some((o) => o.mapid === answer.mapid && o.type === answer.type);
				if (!legal) illegal++;
			}
			return answer;
		};
	}
	const game = WC.engine.create({ ai: watched });
	playHeadless(WC, game, { seed }); // Starts the game
	return { WC, game, used, allowed, calls, illegal, ai };
}

for (const level of ['easy', 'normal', 'hard', 'hard-waiting']) {
	test(`${level}: a whole game with legal moves, reading only Jack's view`, () => {
		for (const seed of [11, 12]) {
			const { game, used, allowed, calls, illegal } = watchedGame(level, seed);
			assert.ok(game.state.over, 'the game ends');
			assert.strictEqual(illegal, 0);
			assert.ok(calls.chooseMove > 0 && calls.chooseHideout === 1);
			assert.ok([...used].every((key) => allowed.has(key)), `${level} read ${[...used].filter((k) => !allowed.has(k))}`);
			assert.ok(!used.has('state'));
		}
	});
}

test('the difficulty changes Jack only: the rules and the police\'s view are the same at both levels', () => {
	const easy = watchedGame('easy', 21);
	const normal = watchedGame('normal', 21);
	assert.strictEqual(JSON.stringify(easy.WC.rules.config), JSON.stringify(normal.WC.rules.config));
	// The police view offers the same questions, and hides the same things, whoever plays Jack
	const keys = (w) => Object.keys(w.WC.rules.policeView(w.game.state)).sort();
	assert.deepStrictEqual(keys(easy), keys(normal));
	for (const w of [easy, normal]) {
		const view = w.WC.rules.policeView(w.game.state);
		assert.ok(!('route' in view) && !('hideout' in view) && !('base' in view));
	}
});

/* The setup dialog in the page */
function setupPage({ seed = 5, search = '', saved = null, store: given } = {}) {
	const window = loadGame({ seed });
	const store = given || {};
	if (saved) store['whitechapel.difficulty'] = saved;
	const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
	const setup = window.WC.ui.setup(window.game, { search, storage });
	return { window, setup, store };
}

test('the setup dialog offers Normal and Hard by name only, pre-selects Normal, and the player leads the detectives', () => {
	const { window, store } = setupPage();
	const $ = window.$;
	assert.deepStrictEqual(Array.from($('input[name=difficulty]').map(function () { return this.value; }).get()), ['normal', 'hard']);
	assert.deepStrictEqual(Array.from($('.difficulty-options .difficulty-label').map(function () { return $(this).text(); }).get()), ['Normal', 'Hard']);
	assert.strictEqual($('.difficulty-options .difficulty-description').length, 0, 'no description of how Jack plays');
	assert.doesNotMatch($('.intro').text(), /Strategic|Baseline|Jack AI|Deceptive|detour|Detective AI|Developer/);
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
	assert.ok($('.police-choice').prop('hidden'), 'who leads the detectives is not asked');
	assert.ok($('.difficulty-badge').prop('hidden'), 'no badge before the game starts');
	$('.start-game').click();
	assert.ok(window.game.ai.options && window.game.ai.options.beam && !('detourMoves' in window.game.ai.options), 'the strategic AI plays');
	assert.ok(!$('body').hasClass('computer-police'), 'the player leads the detectives');
	assert.strictEqual(window.game.state.phase, 2, 'waiting for the player to place the patrols');
	assert.strictEqual($('.difficulty-badge').text(), 'Jack: Normal');
	assert.strictEqual($('.difficulty-badge').prop('hidden'), false);
	assert.strictEqual(store['whitechapel.difficulty'], 'normal', 'remembered for next time');
});

test('Hard plays Jack AI v2, and is remembered for the next game', () => {
	const { window, store } = setupPage();
	const $ = window.$;
	$('input[name=difficulty][value=hard]').prop('checked', true);
	$('.start-game').click();
	assert.strictEqual(window.game.ai.options.detourMoves, 3, 'Jack AI v2 plays');
	assert.strictEqual($('.difficulty-badge').text(), 'Jack: Hard');
	const again = setupPage({ store });
	assert.strictEqual(again.window.$('input[name=difficulty]:checked').val(), 'hard', 'a new game starts at Hard');
});

test('a choice saved in Developer Mode, or from before, never carries into an ordinary game', () => {
	for (const store of [{ 'whitechapel.difficulty': 'easy' }, { 'whitechapel.dev.difficulty': 'easy', 'whitechapel.dev.police': 'hard', 'whitechapel.police': 'hard' }]) {
		const { window } = setupPage({ store });
		const $ = window.$;
		assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
		$('.start-game').click();
		assert.ok(window.game.ai.options && window.game.ai.options.beam, 'Normal');
		assert.ok(!$('body').hasClass('computer-police'), 'the player leads the detectives');
	}
});

test('Developer Mode offers every level with its AI, Baseline Jack included, and remembers its own choice', () => {
	const { window, store } = setupPage({ search: '?dev=1', store: { 'whitechapel.difficulty': 'hard' } });
	const $ = window.$;
	assert.ok($('body').hasClass('developer-mode'));
	assert.deepStrictEqual(Array.from($('input[name=difficulty]').map(function () { return this.value; }).get()), ['easy', 'normal', 'hard', 'hard-waiting']);
	assert.match($('.difficulty-options').text(), /Baseline Jack/);
	assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal', 'the ordinary game\'s choice is not used');
	assert.ok(!$('.police-choice').prop('hidden'));
	$('input[name=difficulty][value=easy]').prop('checked', true);
	$('.start-game').click();
	assert.strictEqual(window.game.ai, window.WC.jackAI);
	assert.strictEqual($('.difficulty-badge').text(), 'Jack: Easy');
	assert.strictEqual(store['whitechapel.dev.difficulty'], 'easy');
	assert.strictEqual(store['whitechapel.difficulty'], 'hard', 'the ordinary game\'s choice is unchanged');
});

test('an address choosing a developer-only level still works, without showing it', () => {
	const { window } = setupPage({ search: '?difficulty=easy' });
	const $ = window.$;
	assert.deepStrictEqual(Array.from($('input[name=difficulty]').map(function () { return this.value; }).get()), ['normal', 'hard']);
	assert.strictEqual($('input[name=difficulty]:checked').length, 0);
	assert.match($('.difficulty-note').text(), /address/);
	$('.start-game').click();
	assert.strictEqual(window.game.ai, window.WC.jackAI, 'Baseline Jack plays');
});

test('the address overrides the dialog and the saved choice, and says so', () => {
	for (const search of ['?difficulty=normal', '?jack=strategic']) {
		const { window, store } = setupPage({ search, saved: 'hard' });
		const $ = window.$;
		assert.strictEqual($('input[name=difficulty]:checked').val(), 'normal');
		assert.ok($('input[name=difficulty]').toArray().every((input) => input.disabled), 'the choice is fixed');
		assert.match($('.difficulty-note').text(), /address/);
		$('.start-game').click();
		assert.ok(window.game.ai.options, 'the strategic AI plays');
		assert.strictEqual(store['whitechapel.difficulty'], 'hard', 'an address override is not saved');
	}
});

test('the chosen level plays the whole game in the page', () => {
	const { window } = setupPage({ seed: 8 });
	const $ = window.$;
	const WC = window.WC;
	let strategicMoves = 0;
	const create = WC.createStrategicJack;
	WC.createStrategicJack = function () { // Count the moves the strategic AI makes
		const ai = create.apply(this, arguments);
		const choose = ai.chooseMove;
		ai.chooseMove = function (view) { strategicMoves++; return choose(view); };
		return ai;
	};
	$('.start-game').click(); // Normal, the default
	const ai = window.game.ai;
	const result = playGame(window, { seed: 8, maxActions: 3000 });
	assert.strictEqual(result, 'over');
	assert.strictEqual(window.game.ai, ai, 'the same AI to the end');
	const jackMoves = window.game.state.jack.reduce((n, night) => n + night.moves.length, 0);
	assert.ok(jackMoves > 0);
	assert.strictEqual(strategicMoves, jackMoves, 'every move was the strategic AI\'s');
	assert.deepStrictEqual(window.errors, []);
});

