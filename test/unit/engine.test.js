// The engine on its own: no page, no jQuery. The police are played through the engine's actions.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('../helpers/core');
const { playHeadless, policeTurn } = require('../helpers/headless');
const { seededRandom } = require('../helpers/game');

function newGame(seed, makeAI) {
	const core = loadCore({ seed });
	const game = core.WC.engine.create({ ai: makeAI ? makeAI(core.WC) : core.WC.jackAI });
	const events = [];
	game.on((type, data) => events.push(type));
	return { WC: core.WC, game, events };
}

const snapshot = (state) => JSON.stringify(state);

test('the engine plays whole games without a page', () => {
	const results = new Set();
	for (let seed = 1; seed <= 20; seed++) {
		const { WC, game } = newGame(seed);
		const outcome = playHeadless(WC, game, {
			seed,
			check: (game) => {
				assert.ok(game.state.remainingMoves >= 0);
				assert.ok(game.state.timeOfCrime >= 1 && game.state.timeOfCrime <= 5);
			}
		});
		assert.strictEqual(outcome, 'over', `seed ${seed}`);
		const result = game.state.result.type;
		assert.ok(['arrested', 'trapped', 'outOfMoves', 'jackWins'].includes(result));
		results.add(result);
		game.state.jack.forEach((night, index) => {
			assert.strictEqual(night.murder.length, WC.rules.config.victims[index], 'victims each night');
		});
		if (result === 'jackWins') {
			assert.strictEqual(game.state.crimeScenes.length, 5);
		}
	}
	assert.ok(results.size >= 2, 'more than one kind of ending');
});

test('illegal police actions are refused and change nothing', () => {
	const { WC, game } = newGame(3);
	game.start();
	assert.strictEqual(game.state.phase, 2);
	const before = snapshot(game.state);
	const notAPatrolPosition = WC.board.numbered()[0];
	assert.strictEqual(game.togglePatrol(notAPatrolPosition, 'real'), false);
	assert.strictEqual(game.movePoliceman(0, 26), false, 'not in this phase');
	assert.strictEqual(game.search(0, 3), false);
	assert.strictEqual(game.arrest(0, 3), false);
	assert.strictEqual(game.moveWretched(3, 4), false);
	assert.strictEqual(snapshot(game.state), before);

	// Play on until the police move, then try illegal moves
	const random = seededRandom(9);
	while (game.state.phase !== 10 && !game.state.over) policeTurn(WC, game, random);
	const now = WC.rules.policeNight(game.state).now;
	const far = WC.board.numbered().find(() => true);
	const notReachable = Array.from({ length: WC.board.size }, (x, i) => i)
		.find((id) => !WC.board.isNumbered(id) && !WC.rules.canMovePoliceman(game.state, 0, id));
	const atPhase10 = snapshot(game.state);
	assert.strictEqual(game.movePoliceman(0, notReachable), false, 'more than two crossings away');
	assert.strictEqual(game.movePoliceman(0, far), false, 'not a crossing');
	if (now.length > 1) {
		assert.strictEqual(game.movePoliceman(0, now[1]), false, 'onto another policeman');
	}
	assert.strictEqual(snapshot(game.state), atPhase10);
	assert.strictEqual(game.movePoliceman(0, now[0]), true, 'staying is allowed');
	assert.strictEqual(game.movePoliceman(0, now[0]), false, 'but only once');
});

test('a policeman searches or arrests, not both', () => {
	const { WC, game } = newGame(4);
	game.start();
	const random = seededRandom(4);
	while (game.state.phase !== 11 && !game.state.over) policeTurn(WC, game, random);
	const police = WC.rules.policeNight(game.state);
	const index = police.now.findIndex((id, i) => police.search[i].length > 0 && police.arrest[i].length > 0);
	assert.notStrictEqual(index, -1);
	assert.strictEqual(game.search(index, police.search[index][0]), false, 'must choose first');
	assert.strictEqual(game.chooseAction(index, 'search'), true);
	assert.strictEqual(game.chooseAction(index, 'arrest'), false, 'the choice is final');
	assert.strictEqual(game.arrest(index, police.arrest[index][0]), false);
	assert.notStrictEqual(game.search(index, police.search[index][0]), false);
});

test('the engine checks every decision of Jack\'s AI against the rules', () => {
	const cheat = (WC) => Object.assign({}, WC.jackAI, {
		chooseMove: (view) => ({ mapid: view.hideout, type: 'walk' }) // Straight home, wherever he is
	});
	const { WC, game } = newGame(2, cheat);
	game.start();
	const random = seededRandom(2);
	assert.throws(() => {
		while (!game.state.over) policeTurn(WC, game, random);
	}, /Jack's AI broke the rules: move/);

	const badHideout = (WC) => Object.assign({}, WC.jackAI, { chooseHideout: () => WC.board.redCircles()[0] });
	assert.throws(() => newGame(2, badHideout).game.start(), /hideout/);
});

test('another AI can replace Jack\'s strategy without touching anything else', () => {
	// The simplest legal Jack: always the first option he is offered
	const simple = (WC) => ({
		chooseHideout: (choices) => choices[0],
		placeWomen: (view) => ({
			marked: view.targets.slice(0, view.women.marked),
			unmarked: view.targets.slice(view.women.marked, view.women.women)
		}),
		wantsToWait: () => false,
		chooseVictims: (view) => view.wretched.slice(0, view.victims),
		choosePatrolToReveal: (view, hidden) => hidden[0],
		chooseMove: (view) => {
			const walks = view.walks();
			const home = walks.find((mapid) => view.endsNight({ mapid, type: 'walk' }));
			if (home !== undefined) return { mapid: home, type: 'walk' };
			if (walks.length > 0) return { mapid: walks[0], type: 'walk' };
			return view.specialMoves()[0];
		}
	});
	for (let seed = 1; seed <= 5; seed++) {
		const { WC, game } = newGame(seed, simple);
		assert.strictEqual(playHeadless(WC, game, { seed }), 'over');
	}
});

test('the engine reports what happens, in order', () => {
	const { game, events } = newGame(5);
	game.start();
	assert.deepStrictEqual(events, ['started', 'phase', 'nightStarted', 'phase', 'phase', 'policeTurn']);
});
