const test = require('node:test');
const assert = require('node:assert');
const { loadCore, nightState, crossingsAround } = require('../helpers/core');
const { loadGame, setupNight } = require('../helpers/game');

const { WC, map } = loadCore({ seed: 7 });
const { board, rules, jackAI } = WC;
const ids = board.numbered();
const base = ids[100];
const distance = (mapid) => board.distance(mapid, base);
// A number Jack can be boxed in at: every route out of it starts at a crossing
const boxable = ids.find((id) => id !== base && map[id].alley.length > 0 && crossingsAround(WC, id).length === map[id].adjacent.length);

test('alley options are the numbers around the same block', () => {
	const state = nightState(WC, { base, from: boxable, alleys: 2, carriages: 0 });
	const options = rules.jackSpecialMoves(state, boxable);
	assert.ok(options.every((option) => option.type === 'alley' && option.moves === 1));
	assert.deepStrictEqual(Array.from(options, (option) => option.mapid).sort(), Array.from(map[boxable].alley).sort());
});

test('carriage options are two walking steps away and never back to the start', () => {
	const state = nightState(WC, { base, from: boxable, alleys: 0, carriages: 1, remaining: 5 });
	const options = rules.jackSpecialMoves(state, boxable);
	assert.ok(options.length > 0);
	const destinations = new Set();
	for (const option of options) {
		assert.strictEqual(option.type, 'carriage');
		assert.strictEqual(option.moves, 2);
		assert.ok(board.walk(boxable, []).includes(option.via));
		assert.ok(board.walk(option.via, []).includes(option.mapid));
		assert.notStrictEqual(option.mapid, boxable);
		assert.ok(!destinations.has(option.mapid), 'each destination is listed once');
		assert.ok(rules.isLegalJackMove(state, option), 'every option is a legal move');
		destinations.add(option.mapid);
	}
});

test('no special options without tokens, or a carriage with only one move left', () => {
	assert.strictEqual(rules.jackSpecialMoves(nightState(WC, { base, from: boxable, alleys: 0, carriages: 0 }), boxable).length, 0);
	assert.strictEqual(rules.jackSpecialMoves(nightState(WC, { base, from: boxable, alleys: 0, carriages: 3, remaining: 1 }), boxable).length, 0);
});

test('alleys and carriages get Jack past police that block every street', () => {
	const state = nightState(WC, { base, from: boxable, police: crossingsAround(WC, boxable), alleys: 1, carriages: 1 });
	assert.strictEqual(rules.jackWalks(state, boxable).length, 0, 'Jack cannot walk');
	const types = new Set(Array.from(rules.jackSpecialMoves(state, boxable), (option) => option.type));
	assert.deepStrictEqual([...types].sort(), ['alley', 'carriage']);
	assert.strictEqual(rules.jackCanMove(state), true);
	const move = jackAI.chooseSpecial(rules.jackView(state), [], {});
	assert.ok(move && ['alley', 'carriage'].includes(move.type));
});

test('Jack is trapped when police block every street and he has no tokens', () => {
	const state = nightState(WC, { base, from: boxable, police: crossingsAround(WC, boxable), alleys: 0, carriages: 0 });
	assert.strictEqual(rules.jackCanMove(state), false);
});

test('Jack uses a special move when walking cannot reach base in time', () => {
	// Find a number where an alley gets Jack two steps closer to base than walking can
	const from = ids.find((id) => id !== base && map[id].alley.some((other) => distance(other) <= distance(id) - 2));
	assert.ok(from !== undefined);
	const remaining = distance(from) - 1;
	const state = nightState(WC, { base, from, remaining, alleys: 1, carriages: 0 });
	const move = jackAI.chooseSpecial(rules.jackView(state), rules.jackWalks(state, from), {});
	assert.ok(move, 'a special move is chosen');
	assert.strictEqual(move.type, 'alley');
	assert.ok(distance(move.mapid) <= remaining - 1);
});

test('Jack uses a special move when every walk could be arrested', () => {
	const from = ids.find((id) => id !== base && map[id].alley.length > 0);
	const state = nightState(WC, { base, from, remaining: 15, alleys: 2, carriages: 3 });
	const walks = rules.jackWalks(state, from);
	const arrestable = {};
	walks.forEach((id) => { arrestable[id] = 1; });
	const move = jackAI.chooseSpecial(rules.jackView(state), walks, arrestable);
	assert.ok(move, 'a special move is chosen');
	assert.ok(['alley', 'carriage'].includes(move.type));
	assert.strictEqual(arrestable[move.mapid] || 0, 0);
});

test('Jack saves his tokens when walking is safe', () => {
	const from = ids.find((id) => id !== base && map[id].alley.length > 0);
	const state = nightState(WC, { base, from, remaining: 15, alleys: 2, carriages: 3 });
	assert.strictEqual(jackAI.chooseSpecial(rules.jackView(state), rules.jackWalks(state, from), {}), false);
});

// The bookkeeping shows on the page, so these play a move in the simulated browser
function playMove(window, choose) {
	window.game.ai = Object.assign({}, window.WC.jackAI, { chooseMove: choose });
	window.game.enter(9);
	window.game.ai = window.WC.jackAI;
	return window._.last(window.game.state.jack);
}

test('a carriage uses a token and two moves, and both stops go on Jack\'s route', () => {
	const window = loadGame({ seed: 7 });
	const from = ids.find((id) => id !== base);
	setupNight(window, { base, from, remaining: 8, alleys: 2, carriages: 3 });
	const option = window.WC.rules.jackSpecialMoves(window.game.state, from).find((o) => o.type === 'carriage' && o.mapid !== base);
	const night = playMove(window, () => option);
	assert.deepStrictEqual(Array.from(night.route), [from, option.via, option.mapid]);
	assert.strictEqual(night.carriages, 2);
	assert.strictEqual(window.game.state.remainingMoves, 6);
	assert.strictEqual(night.trackPosition, 14);
	assert.strictEqual(window.$('.move-tracker .carriage').length, 2);
	assert.ok(window.$('.move-tracker span').eq(12).hasClass('carriage'), 'covers the two spaces after Jack\'s pawn');
	assert.ok(window.$('.move-tracker span').eq(13).hasClass('carriage'));
	assert.match(window.$('.jack-log').text(), /coach/);
});

test('an alley uses a token and one move', () => {
	const window = loadGame({ seed: 7 });
	const from = ids.find((id) => id !== base && map[id].alley.some((other) => other !== base));
	setupNight(window, { base, from, remaining: 8, alleys: 2, carriages: 3 });
	const option = window.WC.rules.jackSpecialMoves(window.game.state, from).find((o) => o.type === 'alley' && o.mapid !== base);
	const night = playMove(window, () => option);
	assert.deepStrictEqual(Array.from(night.route), [from, option.mapid]);
	assert.strictEqual(night.alleys, 1);
	assert.strictEqual(window.game.state.remainingMoves, 7);
	assert.strictEqual(window.$('.move-tracker .alley').length, 1);
	assert.match(window.$('.jack-log').text(), /alley/);
});

test('Jack gets fewer special movement tokens each night', () => {
	const { WC: core } = loadCore({ seed: 3 });
	const game = core.engine.create({ ai: core.jackAI });
	game.start();
	const counts = [];
	for (let night = 0; night < 4; night++) {
		if (night > 0) game.enter(0);
		const last = core.rules.jackNight(game.state);
		counts.push([last.carriages, last.alleys]);
	}
	assert.deepStrictEqual(counts, [[3, 2], [2, 2], [2, 1], [1, 1]]);
});
