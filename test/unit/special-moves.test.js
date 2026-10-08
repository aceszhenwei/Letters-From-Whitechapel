const test = require('node:test');
const assert = require('node:assert');
const { loadGame, setupNight, numbered, crossingsAround } = require('../helpers/game');

const window = loadGame({ seed: 7 });
const { map, game, jack } = window;
const ids = numbered(window);
const base = ids[100];
// A number Jack can be boxed in at: every route out of it starts at a crossing
const boxable = ids.find((id) => id !== base && map[id].alley.length > 0 && crossingsAround(window, id).length === map[id].adjacent.length);

test('alley options are the numbers around the same block', () => {
	setupNight(window, { base, from: boxable, alleys: 2, carriages: 0 });
	const options = jack.specialOptions(boxable);
	assert.ok(options.every((option) => option.type === 'alley' && option.moves === 1));
	assert.deepStrictEqual(Array.from(options, (option) => option.mapid).sort(), Array.from(map[boxable].alley).sort());
});

test('carriage options are two walking steps away and never back to the start', () => {
	setupNight(window, { base, from: boxable, alleys: 0, carriages: 1, remaining: 5 });
	const options = jack.specialOptions(boxable);
	assert.ok(options.length > 0);
	const destinations = new Set();
	for (const option of options) {
		assert.strictEqual(option.type, 'carriage');
		assert.strictEqual(option.moves, 2);
		assert.ok(jack.oneStep(boxable).includes(option.via));
		assert.ok(jack.oneStep(option.via).includes(option.mapid));
		assert.notStrictEqual(option.mapid, boxable);
		assert.ok(!destinations.has(option.mapid), 'each destination is listed once');
		destinations.add(option.mapid);
	}
});

test('no special options without tokens, or a carriage with only one move left', () => {
	setupNight(window, { base, from: boxable, alleys: 0, carriages: 0 });
	assert.strictEqual(jack.specialOptions(boxable).length, 0);
	setupNight(window, { base, from: boxable, alleys: 0, carriages: 3, remaining: 1 });
	assert.strictEqual(jack.specialOptions(boxable).length, 0);
});

test('alleys and carriages get Jack past police that block every street', () => {
	setupNight(window, { base, from: boxable, police: crossingsAround(window, boxable), alleys: 1, carriages: 1 });
	assert.strictEqual(jack.oneStep(boxable, true).length, 0, 'Jack cannot walk');
	const types = new Set(Array.from(jack.specialOptions(boxable), (option) => option.type));
	assert.deepStrictEqual([...types].sort(), ['alley', 'carriage']);
	assert.strictEqual(jack.canMove(), true);
	const move = jack.chooseSpecial(boxable, [], {});
	assert.ok(move && ['alley', 'carriage'].includes(move.type));
});

test('Jack is trapped when police block every street and he has no tokens', () => {
	setupNight(window, { base, from: boxable, police: crossingsAround(window, boxable), alleys: 0, carriages: 0 });
	assert.strictEqual(jack.canMove(), false);
});

test('Jack uses a special move when walking cannot reach base in time', () => {
	// Find a number where an alley gets Jack two steps closer to base than walking can
	setupNight(window, { base, from: base });
	const from = ids.find((id) => id !== base && map[id].alley.some((other) => jack.baseDistance(other) <= jack.baseDistance(id) - 2));
	assert.ok(from !== undefined);
	const remaining = jack.baseDistance(from) - 1;
	setupNight(window, { base, from, remaining, alleys: 1, carriages: 0 });
	const move = jack.chooseSpecial(from, jack.oneStep(from, true), {});
	assert.ok(move, 'a special move is chosen');
	assert.strictEqual(move.type, 'alley');
	assert.ok(jack.baseDistance(move.mapid) <= remaining - 1);
});

test('Jack uses a special move when every walk could be arrested', () => {
	const from = ids.find((id) => id !== base && map[id].alley.length > 0);
	setupNight(window, { base, from, remaining: 15, alleys: 2, carriages: 3 });
	const walks = jack.oneStep(from, true);
	const arrestable = {};
	walks.forEach((id) => { arrestable[id] = 1; });
	const move = jack.chooseSpecial(from, walks, arrestable);
	assert.ok(move, 'a special move is chosen');
	assert.ok(['alley', 'carriage'].includes(move.type));
	assert.strictEqual(arrestable[move.mapid] || 0, 0);
});

test('Jack saves his tokens when walking is safe', () => {
	const from = ids.find((id) => id !== base && map[id].alley.length > 0);
	setupNight(window, { base, from, remaining: 15, alleys: 2, carriages: 3 });
	assert.strictEqual(jack.chooseSpecial(from, jack.oneStep(from, true), {}), false);
});

test('a carriage uses a token and two moves, and both stops go on Jack\'s route', () => {
	const from = ids.find((id) => id !== base);
	setupNight(window, { base, from, remaining: 8, alleys: 2, carriages: 3 });
	const option = jack.specialOptions(from).find((o) => o.type === 'carriage' && o.mapid !== base);
	const move = jack.move;
	jack.move = () => option;
	game.config.state = 9;
	game.escapeTheNight();
	jack.move = move;
	const night = window._.last(jack);
	assert.deepStrictEqual(Array.from(night.route), [from, option.via, option.mapid]);
	assert.strictEqual(night.carriages, 2);
	assert.strictEqual(game.config.remainingMoves, 6);
	assert.strictEqual(night.trackPosition, 14);
	assert.strictEqual(window.$('.move-tracker .carriage').length, 2);
	assert.ok(window.$('.move-tracker span').eq(12).hasClass('carriage'), 'covers the two spaces after Jack\'s pawn');
	assert.ok(window.$('.move-tracker span').eq(13).hasClass('carriage'));
	assert.match(window.$('.jack-log').text(), /carriage/);
});

test('an alley uses a token and one move', () => {
	window.$('.move-tracker span').removeClass('carriage alley');
	const from = ids.find((id) => id !== base && map[id].alley.some((other) => other !== base));
	setupNight(window, { base, from, remaining: 8, alleys: 2, carriages: 3 });
	const option = jack.specialOptions(from).find((o) => o.type === 'alley' && o.mapid !== base);
	const move = jack.move;
	jack.move = () => option;
	game.config.state = 9;
	game.escapeTheNight();
	jack.move = move;
	const night = window._.last(jack);
	assert.deepStrictEqual(Array.from(night.route), [from, option.mapid]);
	assert.strictEqual(night.alleys, 1);
	assert.strictEqual(game.config.remainingMoves, 7);
	assert.strictEqual(window.$('.move-tracker .alley').length, 1);
	assert.match(window.$('.jack-log').text(), /alley/);
});

test('Jack gets fewer special movement tokens each night', () => {
	const fresh = loadGame({ seed: 3 });
	fresh.game.selectBase();
	const counts = [];
	for (let night = 0; night < 4; night++) {
		fresh.game.nextState(0);
		const last = fresh._.last(fresh.jack);
		counts.push([last.carriages, last.alleys]);
	}
	assert.deepStrictEqual(counts, [[3, 2], [2, 2], [2, 1], [1, 1]]);
});
