// Checks the game follows the rulebook (Letters from Whitechapel, revised edition).

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, placePolice, policeAction, setupNight, chooseHideout, numbered, crossingsAround, seededRandom } = require('../helpers/game');

const plain = (array) => Array.from(array).sort((a, b) => a - b);

test('Preparing the game: the hideout is never a red numbered circle', () => {
	const window = loadGame({ seed: 1 });
	const red = window.map.key('murder');
	for (let i = 0; i < 2000; i++) {
		chooseHideout(window);
		assert.ok(!red.includes(window.game.state.base));
	}
});

test('Hell 1: Jack gets 3/2/2/1 coaches and 2/2/1/1 alleys over the four nights', () => {
	const window = loadGame({ seed: 1 });
	chooseHideout(window);
	const tokens = [];
	for (let night = 0; night < 4; night++) {
		window.game.enter(0);
		tokens.push([window._.last(window.game.state.jack).carriages, window._.last(window.game.state.jack).alleys]);
	}
	assert.deepStrictEqual(tokens, [[3, 2], [2, 2], [2, 1], [1, 1]]);
});

test('Hell 2: 8 women (5 marked), then 7 (4), 6 (3) and 4 (1), never on a crime scene', () => {
	const window = loadGame({ seed: 2 });
	const { game } = window;
	chooseHideout(window);
	const expected = [[8, 5], [7, 4], [6, 3], [4, 1]];
	const murders = [1, 1, 2, 1];
	for (let night = 0; night < 4; night++) {
		game.enter(0);
		const women = game.state.womenMarked.concat(game.state.womenUnmarked);
		assert.deepStrictEqual([women.length, game.state.womenMarked.length], expected[night], `night ${night + 1}`);
		assert.strictEqual(new Set(women).size, women.length, 'one woman per circle');
		for (const id of women) {
			assert.ok(window.map[id].murder, 'on a red numbered circle');
			assert.ok(!game.state.crimeScenes.includes(id), 'not on a crime scene');
		}
		for (let i = 0; i < murders[night]; i++) {
			game.state.crimeScenes.push(game.state.womenMarked[i]); // Jack kills here
		}
	}
});

test('Hell 3: from the second night, patrols go where the policemen ended, plus two other yellow crossings', () => {
	const window = loadGame({ seed: 3 });
	const { game, $ } = window;
	chooseHideout(window);
	game.enter(0);
	const ended = [39, 26, 132, 241, 344]; // Where the policemen ended the first night
	window.game.state.police[0].now = ended.slice();
	$('.token').remove();
	game.enter(0);
	assert.deepStrictEqual(plain($('.token-police.marked.required').map(function () { return $(this).data('mapid'); }).get()), plain(ended));
	const others = $('.token-police.marked').not('.required');
	assert.strictEqual(others.length, window.map.key('station').length, 'every yellow crossing without a policeman');
	others.slice(0, 3).each(function () { $(this).next().click(); }); // Try three fake tokens away from the policemen
	assert.strictEqual(window._.last(window.game.state.police).fake.length, 2, 'only two tokens can go away from the policemen');
	$('.token-police.marked.required').each(function () { $(this).click(); });
	assert.deepStrictEqual(plain(window._.last(window.game.state.police).start), plain(ended));
	assert.notStrictEqual(game.state.phase, 2, 'the patrols are placed');
});

test('Hell 4-5: if Jack kills at once, the crime is at I and he has 15 moves', () => {
	const window = loadGame({ seed: 4 });
	chooseHideout(window);
	window.game.enter(0);
	window.Math.random = () => 0.1; // Jack kills
	placePolice(window);
	const night = window._.last(window.game.state.jack);
	assert.strictEqual(night.murder.length, 1);
	assert.strictEqual(window.game.state.timeOfCrime, 1);
	assert.deepStrictEqual(Array.from(night.murderMove), [5], 'Jack\'s pawn starts on I');
	assert.strictEqual(window.WC.rules.config.trackLength - night.murderMove[0], 15, 'so he has 15 moves');
	assert.strictEqual(window.game.state.remainingMoves, window.WC.rules.config.trackLength - night.trackPosition);
	assert.ok(window.game.state.crimeScenes.includes(night.murder[0]));
});

test('Hell 5-7: waiting moves the Time of the Crime token, the Wretched move, Jack reveals a patrol; on V he must kill', () => {
	const window = loadGame({ seed: 5 });
	const { game } = window;
	chooseHideout(window);
	game.enter(0);
	window.Math.random = () => 0.9; // Jack waits whenever he can
	placePolice(window);
	assert.strictEqual(game.state.phase, 5, 'Suspense grows');
	assert.strictEqual(game.state.timeOfCrime, 2);
	assert.strictEqual(window._.last(window.game.state.police).revealed.length, 0, 'patrols are revealed after the Wretched move');
	const random = seededRandom(5);
	for (let i = 0; i < 500 && window._.last(window.game.state.jack).murder.length === 0; i++) {
		policeAction(window, random);
	}
	const night = window._.last(window.game.state.jack);
	assert.strictEqual(game.state.timeOfCrime, 5, 'Jack waited until V');
	assert.strictEqual(night.murder.length, 1, 'then he had to kill');
	const revealed = window._.last(window.game.state.police).revealed;
	assert.strictEqual(revealed.length, 4, 'one patrol revealed for each wait');
	assert.strictEqual(new Set(revealed).size, 4, 'never the same patrol twice');
	assert.deepStrictEqual(Array.from(night.murderMove), [1], 'Jack\'s pawn starts on V');
	assert.strictEqual(window.WC.rules.config.trackLength - night.murderMove[0], 19, 'so he has 19 moves: IV to I and 1 to 15');
	assert.strictEqual(game.state.remainingMoves, window.WC.rules.config.trackLength - night.trackPosition);
});

test('Hell 6: a Wretched can\'t pass a patrol, end next to one, or end on a Wretched or a crime scene', () => {
	const window = loadGame();
	const { game, map } = window;
	for (const wretched of numbered(window)) {
		const patrol = crossingsAround(window, wretched)[0];
		if (patrol === undefined) continue;
		setupNight(window, { base: 3, from: 3, police: [patrol] });
		const neighbours = window.WC.board.walk(wretched, []);
		game.state.womenMarked = [wretched, neighbours[0]];
		game.state.crimeScenes = [neighbours[neighbours.length - 1]];
		const moves = window.WC.rules.wretchedMoves(window.game.state, wretched);
		for (const id of moves) {
			assert.ok(window.WC.board.walk(wretched, [patrol]).includes(id), 'doesn\'t pass the patrol');
			assert.ok(!window.WC.rules.arrestable(patrol).includes(id), 'doesn\'t end next to the patrol');
			assert.ok(map[id].number);
		}
		assert.ok(!moves.includes(neighbours[0]), 'not onto another Wretched');
		assert.ok(!moves.includes(neighbours[neighbours.length - 1]), 'not onto a crime scene');
	}
});

test('Hell 6: a Wretched with no legal move stays where it is', () => {
	const window = loadGame({ seed: 6 });
	const { game } = window;
	const wretched = numbered(window)[40];
	setupNight(window, { base: 3, from: 3, police: [crossingsAround(window, 3)[0]] });
	window._.last(window.game.state.jack).murder = [];
	window._.last(window.game.state.jack).route = [];
	game.state.womenMarked = [wretched];
	game.state.crimeScenes = window.WC.board.walk(wretched, []); // Every neighbour is a crime scene
	game.state.timeOfCrime = 1;
	window.Math.random = () => 0.1; // Jack kills next
	game.enter(5);
	assert.strictEqual(game.state.timeOfCrime, 2);
	assert.strictEqual(window._.last(window.game.state.police).revealed.length, 1, 'play went on to Ready to kill');
	assert.deepStrictEqual(Array.from(window._.last(window.game.state.jack).murder), [wretched], 'and Jack killed the Wretched that stayed');
});

test('Hell 8 and the double event: on the third night Jack kills two and the police move first', () => {
	const window = loadGame({ seed: 8 });
	const { game } = window;
	chooseHideout(window);
	for (let night = 0; night < 3; night++) {
		window.$('.token').remove();
		game.enter(0);
	}
	assert.strictEqual(game.state.womenMarked.length, 3);
	game.state.timeOfCrime = 2;
	window._.last(window.game.state.police).start = [39, 26, 132, 241, 344];
	game.murder(window.WC.jackAI.chooseVictims(window.WC.rules.jackView(window.game.state)));
	const night = window._.last(window.game.state.jack);
	assert.strictEqual(night.murder.length, 2);
	assert.deepStrictEqual(Array.from(night.route), Array.from(night.murder), 'both are on Jack\'s sheet');
	assert.deepStrictEqual(Array.from(night.murderMove), [4, 5], 'in the spaces of II and the one to its right');
	assert.strictEqual(night.trackPosition, 5);
	assert.strictEqual(game.state.remainingMoves, 15);
	game.enter(8);
	assert.strictEqual(game.state.phase, 10, 'Hunting starts with the police moving');
});

test('Hunting 1: Jack escapes by walking onto his hideout, ending the night', () => {
	const window = loadGame({ seed: 9 });
	const base = numbered(window)[30];
	const from = window.window.WC.board.walk(base, [])[0];
	setupNight(window, { base, from, remaining: 5 });
	window.game.ai = Object.assign({}, window.WC.jackAI, { chooseMove: () => ({ mapid: base, type: 'walk' }) });
	window.game.enter(9);
	assert.strictEqual(window.game.state.jack.length, 2, 'the next night began');
	assert.strictEqual(window.game.state.over, false);
});

test('Hunting 1: Jack can\'t declare his escape after a special movement onto his hideout', () => {
	const window = loadGame({ seed: 9 });
	const base = numbered(window).find((id) => window.map[id].alley.length > 0 && !window.map[id].murder);
	const from = window.map[base].alley[0];
	setupNight(window, { base, from, remaining: 5, police: [crossingsAround(window, 3)[0]] });
	window.game.ai = Object.assign({}, window.WC.jackAI, { chooseMove: () => ({ mapid: base, type: 'alley', moves: 1 }) });
	window.game.enter(9);
	assert.strictEqual(window.game.state.jack.length, 1, 'the night goes on');
	assert.strictEqual(window.game.state.phase, 10);
});

test('Hunting 1: Jack escapes on his last move if it reaches his hideout', () => {
	const window = loadGame({ seed: 9 });
	const base = numbered(window)[30];
	setupNight(window, { base, from: window.window.WC.board.walk(base, [])[0], remaining: 1 });
	window.game.ai = Object.assign({}, window.WC.jackAI, { chooseMove: () => ({ mapid: base, type: 'walk' }) });
	window.game.enter(9);
	assert.strictEqual(window.game.state.over, false);
	assert.strictEqual(window.game.state.jack.length, 2);
});

test('Hunting 1: Jack loses if police block every street and he has no special movement', () => {
	const window = loadGame();
	const from = numbered(window).find((id) => crossingsAround(window, id).length === window.map[id].adjacent.length);
	setupNight(window, { base: 3, from, police: crossingsAround(window, from), carriages: 0, alleys: 0 });
	window.game.enter(9);
	assert.match(window.$('.game-over').text(), /trapped/);
});

test('Hunting 2: a policeman moves up to two crossings, never onto another policeman', () => {
	const window = loadGame();
	const { game } = window;
	const police = [26, 132, 241, 344, 39];
	for (const crossing of police) {
		const steps = window.WC.board.crossingsWithinTwo(crossing);
		assert.ok(steps.every((id) => !window.map[id].number));
		assert.ok(window.WC.board.crossingSteps(crossing).every((id) => steps.includes(id)));
	}
	setupNight(window, { base: 3, from: 3, police });
	game.enter(10);
	window.$('.token-police').eq(0).click();
	const targets = window.$('.token-move-police').map(function () { return window.$(this).data('mapid'); }).get();
	const moving = window._.last(window.game.state.police).now[0];
	assert.ok(targets.every((id) => id === moving || !police.includes(id)));
});

test('Hunting 3: each policeman takes one action, and only arrests when he has nothing left to search', () => {
	const window = loadGame({ seed: 10 });
	const { game, $ } = window;
	const crossings = [26, 132, 241, 344, 39];
	const jackAt = numbered(window).find((id) => !crossings.some((c) => window.WC.rules.arrestable(c).includes(id)));
	setupNight(window, { base: numbered(window)[0], from: jackAt, police: crossings, remaining: 10 });
	window._.last(window.game.state.police).clue = window.WC.rules.arrestable(crossings[0]); // Everything next to the first policeman is searched
	game.enter(11);
	assert.strictEqual($('.token-search-adjacent-' + crossings[0]).length, 0);
	assert.strictEqual($('.token-arrest-adjacent-' + crossings[0]).length, 1);
	for (const crossing of crossings) {
		assert.strictEqual(game.state.phase, 11);
		$('.token-arrest-adjacent-' + crossing).click();
		$('.token-arrest').eq(0).click();
	}
	assert.notStrictEqual(game.state.phase, 11, 'the phase ends after all five policemen act');
	assert.strictEqual(game.state.over, false);
});

test('End of the hunting: clue markers are removed, crime scenes stay', () => {
	const window = loadGame({ seed: 11 });
	const base = numbered(window)[30];
	setupNight(window, { base, from: window.window.WC.board.walk(base, [])[0], remaining: 5 });
	window.game.state.crimeScenes = [window.map.key('murder')[0]];
	window.WC.ui.draw.crimeScene(window.game.state.crimeScenes[0]);
	window.WC.ui.draw.clue(numbered(window)[5]);
	window.game.ai = Object.assign({}, window.WC.jackAI, { chooseMove: () => ({ mapid: base, type: 'walk' }) });
	window.game.enter(9);
	assert.strictEqual(window.$('.token-clue').length, 0);
	assert.strictEqual(window.$('.token-murder').length, 1);
});
