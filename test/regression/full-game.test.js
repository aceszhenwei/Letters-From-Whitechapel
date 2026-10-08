// Plays whole games as the police (with seeded randomness, so failures can be replayed)
// and checks that the rules hold after every action.

const test = require('node:test');
const assert = require('node:assert');
const { startGame, playGame } = require('../helpers/game');

const endings = [
	/^Jack has been arrested at \d+\. The police win!$/,
	/^Jack ran out of moves before reaching his base\. The police win!$/,
	/^Jack is trapped by the police and cannot move\. The police win!$/,
	/^Jack has escaped for 4 nights\. Jack wins!$/
];

// Check every move Jack made was legal (walking ignores police here, they move after Jack)
function checkJacksRoute(window, night, index) {
	const { map, jack, game } = window;
	const route = [night.route[0]];
	let carriages = 0;
	let alleys = 0;
	for (const move of night.moves) {
		const from = route[route.length - 1];
		if (move.type === 'walk') {
			assert.ok(jack.oneStep(from).includes(move.mapid), `night ${index}: walk ${from} -> ${move.mapid}`);
		} else if (move.type === 'alley') {
			alleys++;
			assert.ok(map[from].alley.includes(move.mapid), `night ${index}: alley ${from} -> ${move.mapid}`);
		} else if (move.type === 'carriage') {
			carriages++;
			assert.ok(jack.oneStep(from).includes(move.via), `night ${index}: carriage ${from} -> ${move.via}`);
			assert.ok(jack.oneStep(move.via).includes(move.mapid), `night ${index}: carriage ${move.via} -> ${move.mapid}`);
			assert.notStrictEqual(move.mapid, from);
			route.push(move.via);
		} else {
			assert.fail(`unknown move type ${move.type}`);
		}
		route.push(move.mapid);
	}
	assert.deepStrictEqual(route, Array.from(night.route), `night ${index}: route matches the moves`);
	assert.strictEqual(night.carriages, game.config.carriages[index] - carriages);
	assert.strictEqual(night.alleys, game.config.alleys[index] - alleys);
	assert.ok(night.carriages >= 0 && night.alleys >= 0);
	return { carriages, alleys };
}

const totals = { alleys: 0, carriages: 0, clues: 0, endings: new Set() };

for (const seed of [1, 2, 3, 4, 5, 6]) {
	test(`full game with seed ${seed}`, () => {
		const window = startGame({ seed });
		const $ = window.$;
		const numbers = $('.location-number').length;
		const result = playGame(window, {
			seed,
			check: () => {
				assert.deepStrictEqual(window.errors, []);
				assert.ok(window.game.config.remainingMoves >= 0);
				assert.strictEqual($('.location-number').length, numbers, 'the map is drawn once');
				assert.ok($('.token-murder').length <= 1, 'one crime scene token at a time');
			}
		});
		assert.strictEqual(result, 'over', 'the game finishes');
		const message = $('.game-over').text();
		const ending = endings.findIndex((ending) => ending.test(message));
		assert.ok(ending !== -1, `unexpected ending "${message}"`);
		totals.endings.add(ending);
		window.jack.forEach((night, index) => {
			const used = checkJacksRoute(window, night, index);
			totals.alleys += used.alleys;
			totals.carriages += used.carriages;
		});
		totals.clues += window.police.reduce((sum, night) => sum + night.clue.length, 0);
	});
}

test('across all games Jack used alleys and carriages, and the police found clues', () => {
	assert.ok(totals.alleys > 0, 'alleys used');
	assert.ok(totals.carriages > 0, 'carriages used');
	assert.ok(totals.clues > 0, 'clues found');
	assert.ok(totals.endings.size >= 2, 'more than one kind of ending');
});
