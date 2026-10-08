// Plays whole games as the police (with seeded randomness, so failures can be replayed)
// and checks that the rules hold after every action.

const test = require('node:test');
const assert = require('node:assert');
const { startGame, playGame } = require('../helpers/game');

const endings = [
	/^Jack has been arrested at \d+\. The police win!$/,
	/^Jack has used his last move without reaching his hideout\. The police win!$/,
	/^Jack is trapped by the police and cannot move\. The police win!$/,
	/^Jack has killed five victims and escaped on all four nights\. Jack wins!$/
];

// Check every move Jack made was legal (walking ignores police here, they move after Jack)
function checkJacksRoute(window, night, index) {
	const { map, game, WC } = window;
	// Jack starts at his crime scene (both of them on the double event night)
	assert.strictEqual(night.murder.length, window.WC.rules.config.victims[index]);
	const route = Array.from(night.murder);
	let carriages = 0;
	let alleys = 0;
	for (const move of night.moves) {
		const from = route[route.length - 1];
		if (move.type === 'walk') {
			assert.ok(WC.board.walk(from, []).includes(move.mapid), `night ${index}: walk ${from} -> ${move.mapid}`);
		} else if (move.type === 'alley') {
			alleys++;
			assert.ok(map[from].alley.includes(move.mapid), `night ${index}: alley ${from} -> ${move.mapid}`);
		} else if (move.type === 'carriage') {
			carriages++;
			assert.ok(WC.board.walk(from, []).includes(move.via), `night ${index}: carriage ${from} -> ${move.via}`);
			assert.ok(WC.board.walk(move.via, []).includes(move.mapid), `night ${index}: carriage ${move.via} -> ${move.mapid}`);
			assert.notStrictEqual(move.mapid, from);
			route.push(move.via);
		} else {
			assert.fail(`unknown move type ${move.type}`);
		}
		route.push(move.mapid);
	}
	const finished = index < window.game.state.jack.length - 1 || /Jack wins/.test(window.$('.game-over').text());
	if (finished) {
		assert.strictEqual(route[route.length - 1], game.state.base, `night ${index}: Jack escaped to his hideout`);
		assert.strictEqual(night.moves[night.moves.length - 1].type, 'walk', `night ${index}: with a normal move`);
	}
	// Moves used: the spaces from the Time of the Crime token to Jack's pawn, never past 15
	const used = night.moves.reduce((sum, move) => sum + (move.type === 'carriage' ? 2 : 1), 0) + night.murder.length - 1;
	assert.strictEqual(night.trackPosition, night.murderMove[0] + used, `night ${index}: move track`);
	assert.ok(night.trackPosition <= window.WC.rules.config.trackLength);
	assert.deepStrictEqual(route, Array.from(night.route), `night ${index}: route matches the moves`);
	assert.strictEqual(night.carriages, window.WC.rules.config.carriages[index] - carriages);
	assert.strictEqual(night.alleys, window.WC.rules.config.alleys[index] - alleys);
	assert.ok(night.carriages >= 0 && night.alleys >= 0);
	return { carriages, alleys };
}

const totals = { alleys: 0, carriages: 0, clues: 0, endings: new Set() };

for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
	test(`full game with seed ${seed}`, () => {
		const window = startGame({ seed });
		const $ = window.$;
		const numbers = $('.location-number').length;
		const result = playGame(window, {
			seed,
			check: () => {
				assert.deepStrictEqual(window.errors, []);
				assert.ok(window.game.state.remainingMoves >= 0);
				assert.strictEqual($('.location-number').length, numbers, 'the map is drawn once');
				assert.strictEqual($('.token-murder').length, window.game.state.crimeScenes.length, 'every crime scene stays on the map');
				assert.ok(window.game.state.timeOfCrime >= 1 && window.game.state.timeOfCrime <= 5);
			}
		});
		assert.strictEqual(result, 'over', 'the game finishes');
		const message = $('.game-over').text();
		const ending = endings.findIndex((ending) => ending.test(message));
		assert.ok(ending !== -1, `unexpected ending "${message}"`);
		totals.endings.add(ending);
		window.game.state.jack.forEach((night, index) => {
			const used = checkJacksRoute(window, night, index);
			totals.alleys += used.alleys;
			totals.carriages += used.carriages;
		});
		totals.clues += window.game.state.police.reduce((sum, night) => sum + night.clue.length, 0);
	});
}

test('across all games Jack used alleys and carriages, and the police found clues', () => {
	assert.ok(totals.alleys > 0, 'alleys used');
	assert.ok(totals.carriages > 0, 'carriages used');
	assert.ok(totals.clues > 0, 'clues found');
	assert.ok(totals.endings.size >= 2, 'more than one kind of ending');
});
