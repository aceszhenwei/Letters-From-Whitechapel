// Checks the game follows the rulebook (Letters from Whitechapel, revised edition).

const test = require('node:test');
const assert = require('node:assert');
const { loadGame, placePolice, policeAction, setupNight, numbered, crossingsAround, seededRandom } = require('../helpers/game');

const plain = (array) => Array.from(array).sort((a, b) => a - b);

test('Preparing the game: the hideout is never a red numbered circle', () => {
	const window = loadGame({ seed: 1 });
	const red = window.map.key('murder');
	for (let i = 0; i < 2000; i++) {
		window.game.selectBase();
		assert.ok(!red.includes(window.game.config.base));
	}
});

test('Hell 1: Jack gets 3/2/2/1 coaches and 2/2/1/1 alleys over the four nights', () => {
	const window = loadGame({ seed: 1 });
	window.game.selectBase();
	const tokens = [];
	for (let night = 0; night < 4; night++) {
		window.game.nextState(0);
		tokens.push([window._.last(window.jack).carriages, window._.last(window.jack).alleys]);
	}
	assert.deepStrictEqual(tokens, [[3, 2], [2, 2], [2, 1], [1, 1]]);
});

test('Hell 2: 8 women (5 marked), then 7 (4), 6 (3) and 4 (1), never on a crime scene', () => {
	const window = loadGame({ seed: 2 });
	const { game } = window;
	game.selectBase();
	const expected = [[8, 5], [7, 4], [6, 3], [4, 1]];
	const murders = [1, 1, 2, 1];
	for (let night = 0; night < 4; night++) {
		game.nextState(0);
		const women = game.config.womenMarked.concat(game.config.womenUnmarked);
		assert.deepStrictEqual([women.length, game.config.womenMarked.length], expected[night], `night ${night + 1}`);
		assert.strictEqual(new Set(women).size, women.length, 'one woman per circle');
		for (const id of women) {
			assert.ok(window.map[id].murder, 'on a red numbered circle');
			assert.ok(!game.config.crimeScenes.includes(id), 'not on a crime scene');
		}
		for (let i = 0; i < murders[night]; i++) {
			game.config.crimeScenes.push(game.config.womenMarked[i]); // Jack kills here
		}
	}
});

test('Hell 3: from the second night, patrols go where the policemen ended, plus two other yellow crossings', () => {
	const window = loadGame({ seed: 3 });
	const { game, $ } = window;
	game.selectBase();
	game.nextState(0);
	const ended = [39, 26, 132, 241, 344]; // Where the policemen ended the first night
	window.police[0].now = ended.slice();
	$('.token').remove();
	game.nextState(0);
	assert.deepStrictEqual(plain($('.token-police.marked.required').map(function () { return $(this).data('mapid'); }).get()), plain(ended));
	const others = $('.token-police.marked').not('.required');
	assert.strictEqual(others.length, window.map.key('station').length, 'every yellow crossing without a policeman');
	others.slice(0, 3).each(function () { $(this).next().click(); }); // Try three fake tokens away from the policemen
	assert.strictEqual(window._.last(window.police).fake.length, 2, 'only two tokens can go away from the policemen');
	$('.token-police.marked.required').each(function () { $(this).click(); });
	assert.deepStrictEqual(plain(window._.last(window.police).start), plain(ended));
	assert.notStrictEqual(game.config.state, 2, 'the patrols are placed');
});

test('Hell 4-5: if Jack kills at once, the crime is at I and he has 15 moves', () => {
	const window = loadGame({ seed: 4 });
	window.game.selectBase();
	window.game.nextState(0);
	window.Math.random = () => 0.1; // Jack kills
	placePolice(window);
	const night = window._.last(window.jack);
	assert.strictEqual(night.murder.length, 1);
	assert.strictEqual(window.game.config.timeOfCrime, 1);
	assert.deepStrictEqual(Array.from(night.murderMove), [5], 'Jack\'s pawn starts on I');
	assert.strictEqual(window.game.config.totalMoves - night.murderMove[0], 15, 'so he has 15 moves');
	assert.strictEqual(window.game.config.remainingMoves, window.game.config.totalMoves - night.trackPosition);
	assert.ok(window.game.config.crimeScenes.includes(night.murder[0]));
});

test('Hell 5-7: waiting moves the Time of the Crime token, the Wretched move, Jack reveals a patrol; on V he must kill', () => {
	const window = loadGame({ seed: 5 });
	const { game } = window;
	game.selectBase();
	game.nextState(0);
	window.Math.random = () => 0.9; // Jack waits whenever he can
	placePolice(window);
	assert.strictEqual(game.config.state, 5, 'Suspense grows');
	assert.strictEqual(game.config.timeOfCrime, 2);
	assert.strictEqual(window._.last(window.police).revealed.length, 0, 'patrols are revealed after the Wretched move');
	const random = seededRandom(5);
	for (let i = 0; i < 500 && window._.last(window.jack).murder.length === 0; i++) {
		policeAction(window, random);
	}
	const night = window._.last(window.jack);
	assert.strictEqual(game.config.timeOfCrime, 5, 'Jack waited until V');
	assert.strictEqual(night.murder.length, 1, 'then he had to kill');
	const revealed = window._.last(window.police).revealed;
	assert.strictEqual(revealed.length, 4, 'one patrol revealed for each wait');
	assert.strictEqual(new Set(revealed).size, 4, 'never the same patrol twice');
	assert.deepStrictEqual(Array.from(night.murderMove), [1], 'Jack\'s pawn starts on V');
	assert.strictEqual(game.config.totalMoves - night.murderMove[0], 19, 'so he has 19 moves: IV to I and 1 to 15');
	assert.strictEqual(game.config.remainingMoves, game.config.totalMoves - night.trackPosition);
});

test('Hell 6: a Wretched can\'t pass a patrol, end next to one, or end on a Wretched or a crime scene', () => {
	const window = loadGame();
	const { game, map } = window;
	for (const wretched of numbered(window)) {
		const patrol = crossingsAround(window, wretched)[0];
		if (patrol === undefined) continue;
		setupNight(window, { base: 3, from: 3, police: [patrol] });
		const neighbours = game.walk(wretched, []);
		game.config.womenMarked = [wretched, neighbours[0]];
		game.config.crimeScenes = [neighbours[neighbours.length - 1]];
		const moves = game.wretchedMoves(wretched);
		for (const id of moves) {
			assert.ok(game.walk(wretched, [patrol]).includes(id), 'doesn\'t pass the patrol');
			assert.ok(!game.arrestable(patrol).includes(id), 'doesn\'t end next to the patrol');
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
	window._.last(window.jack).murder = [];
	window._.last(window.jack).route = [];
	game.config.womenMarked = [wretched];
	game.config.crimeScenes = game.walk(wretched, []); // Every neighbour is a crime scene
	game.config.timeOfCrime = 1;
	window.Math.random = () => 0.1; // Jack kills next
	game.nextState(5);
	assert.strictEqual(game.config.timeOfCrime, 2);
	assert.strictEqual(window._.last(window.police).revealed.length, 1, 'play went on to Ready to kill');
	assert.deepStrictEqual(Array.from(window._.last(window.jack).murder), [wretched], 'and Jack killed the Wretched that stayed');
});

test('Hell 8 and the double event: on the third night Jack kills two and the police move first', () => {
	const window = loadGame({ seed: 8 });
	const { game } = window;
	game.selectBase();
	for (let night = 0; night < 3; night++) {
		window.$('.token').remove();
		game.nextState(0);
	}
	assert.strictEqual(game.config.womenMarked.length, 3);
	game.config.timeOfCrime = 2;
	window._.last(window.police).start = [39, 26, 132, 241, 344];
	game.murder();
	const night = window._.last(window.jack);
	assert.strictEqual(night.murder.length, 2);
	assert.deepStrictEqual(Array.from(night.route), Array.from(night.murder), 'both are on Jack\'s sheet');
	assert.deepStrictEqual(Array.from(night.murderMove), [4, 5], 'in the spaces of II and the one to its right');
	assert.strictEqual(night.trackPosition, 5);
	assert.strictEqual(game.config.remainingMoves, 15);
	game.nextState(8);
	assert.strictEqual(game.config.state, 10, 'Hunting starts with the police moving');
});

test('Hunting 1: Jack escapes by walking onto his hideout, ending the night', () => {
	const window = loadGame({ seed: 9 });
	const base = numbered(window)[30];
	const from = window.game.walk(base, [])[0];
	setupNight(window, { base, from, remaining: 5 });
	window.jack.move = () => ({ mapid: base, type: 'walk' });
	window.game.nextState(9);
	assert.strictEqual(window.jack.length, 2, 'the next night began');
	assert.strictEqual(window.game.config.over, false);
});

test('Hunting 1: Jack can\'t declare his escape after a special movement onto his hideout', () => {
	const window = loadGame({ seed: 9 });
	const base = numbered(window).find((id) => window.map[id].alley.length > 0 && !window.map[id].murder);
	const from = window.map[base].alley[0];
	setupNight(window, { base, from, remaining: 5, police: [crossingsAround(window, 3)[0]] });
	window.jack.move = () => ({ mapid: base, type: 'alley', moves: 1 });
	window.game.nextState(9);
	assert.strictEqual(window.jack.length, 1, 'the night goes on');
	assert.strictEqual(window.game.config.state, 10);
});

test('Hunting 1: Jack escapes on his last move if it reaches his hideout', () => {
	const window = loadGame({ seed: 9 });
	const base = numbered(window)[30];
	setupNight(window, { base, from: window.game.walk(base, [])[0], remaining: 1 });
	window.jack.move = () => ({ mapid: base, type: 'walk' });
	window.game.nextState(9);
	assert.strictEqual(window.game.config.over, false);
	assert.strictEqual(window.jack.length, 2);
});

test('Hunting 1: Jack loses if police block every street and he has no special movement', () => {
	const window = loadGame();
	const from = numbered(window).find((id) => crossingsAround(window, id).length === window.map[id].adjacent.length);
	setupNight(window, { base: 3, from, police: crossingsAround(window, from), carriages: 0, alleys: 0 });
	window.game.nextState(9);
	assert.match(window.$('.game-over').text(), /trapped/);
});

test('Hunting 2: a policeman moves up to two crossings, never onto another policeman', () => {
	const window = loadGame();
	const { game } = window;
	const police = [26, 132, 241, 344, 39];
	for (const crossing of police) {
		const steps = game.twoSteps(crossing);
		assert.ok(steps.every((id) => !window.map[id].number));
		assert.ok(game.oneStep(crossing).every((id) => steps.includes(id)));
	}
	setupNight(window, { base: 3, from: 3, police });
	game.nextState(10);
	window.$('.token-police').eq(0).click();
	const targets = window.$('.token-move-police').map(function () { return window.$(this).data('mapid'); }).get();
	const moving = window._.last(window.police).now[0];
	assert.ok(targets.every((id) => id === moving || !police.includes(id)));
});

test('Hunting 3: each policeman takes one action, and only arrests when he has nothing left to search', () => {
	const window = loadGame({ seed: 10 });
	const { game, $ } = window;
	const crossings = [26, 132, 241, 344, 39];
	const jackAt = numbered(window).find((id) => !crossings.some((c) => game.arrestable(c).includes(id)));
	setupNight(window, { base: numbered(window)[0], from: jackAt, police: crossings, remaining: 10 });
	window._.last(window.police).clue = game.arrestable(crossings[0]); // Everything next to the first policeman is searched
	game.nextState(11);
	assert.strictEqual($('.token-search-adjacent-' + crossings[0]).length, 0);
	assert.strictEqual($('.token-arrest-adjacent-' + crossings[0]).length, 1);
	for (const crossing of crossings) {
		assert.strictEqual(game.config.state, 11);
		$('.token-arrest-adjacent-' + crossing).click();
		$('.token-arrest').eq(0).click();
	}
	assert.notStrictEqual(game.config.state, 11, 'the phase ends after all five policemen act');
	assert.strictEqual(game.config.over, false);
});

test('End of the hunting: clue markers are removed, crime scenes stay', () => {
	const window = loadGame({ seed: 11 });
	const base = numbered(window)[30];
	setupNight(window, { base, from: window.game.walk(base, [])[0], remaining: 5 });
	window.game.config.crimeScenes = [window.map.key('murder')[0]];
	window.draw.crimeScene(window.game.config.crimeScenes[0]);
	window.draw.clue(numbered(window)[5]);
	window.jack.move = () => ({ mapid: base, type: 'walk' });
	window.game.nextState(9);
	assert.strictEqual(window.$('.token-clue').length, 0);
	assert.strictEqual(window.$('.token-murder').length, 1);
});
