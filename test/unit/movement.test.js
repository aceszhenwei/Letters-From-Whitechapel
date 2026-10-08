const test = require('node:test');
const assert = require('node:assert');
const { loadGame, setupNight, numbered, crossingsAround } = require('../helpers/game');

const window = loadGame();
const { map, game, jack } = window;
const crossings = () => map.map((place, id) => id).filter((id) => !map[id].number);

test('police only move between crossings', () => {
	setupNight(window, { base: 3, from: 3 });
	for (const id of crossings()) {
		for (const step of game.twoSteps(id)) {
			assert.ok(!map[step].number, `police at ${id} could move onto number ${step}`);
		}
		assert.ok(game.oneStep(id).every((step) => game.twoSteps(id).includes(step)));
	}
});

test('police can move through crossing 0 in the corner of the map', () => {
	assert.ok(game.oneStep(1).includes(0));
});

test('police can arrest or search the numbers next to their crossing', () => {
	setupNight(window, { base: 3, from: 3 });
	for (const id of crossings()) {
		const arrestable = game.arrestable(id);
		assert.deepStrictEqual(arrestable, map[id].adjacent.filter((adj) => map[adj].number));
	}
});

test('searchable skips clues already found and the murder scene', () => {
	setupNight(window, { base: 3, from: 3 });
	const crossing = crossings().find((id) => game.arrestable(id).length >= 2);
	const [first, second] = game.arrestable(crossing);
	window._.last(window.police).clue.push(first);
	window._.last(jack).murder.push(second);
	const searchable = game.searchable(crossing);
	assert.ok(!searchable.includes(first));
	assert.ok(!searchable.includes(second));
});

test('Jack walks between neighbouring numbers, matching the hand entered adjacent numbers', () => {
	setupNight(window, { base: 3, from: 3 });
	for (const id of numbered(window)) {
		const steps = jack.oneStep(id).slice().sort((a, b) => a - b);
		assert.deepStrictEqual(steps, map[id].adjacentNumber.slice().sort((a, b) => a - b), `from map id ${id}`);
	}
});

test('Jack cannot walk past police', () => {
	const from = numbered(window).find((id) => crossingsAround(window, id).length >= 2);
	const blocked = crossingsAround(window, from)[0];
	setupNight(window, { base: 3, from, police: [blocked] });
	const open = jack.oneStep(from);
	const avoiding = jack.oneStep(from, true);
	assert.ok(avoiding.length < open.length);
	assert.ok(avoiding.every((id) => open.includes(id)));
});

test('baseDistance counts the fewest walking moves to base', () => {
	const base = numbered(window)[50];
	setupNight(window, { base, from: base });
	assert.strictEqual(jack.baseDistance(base), 0);
	for (const id of jack.oneStep(base)) {
		assert.strictEqual(jack.baseDistance(id), 1);
	}
	for (const id of numbered(window)) {
		const best = Math.min(...jack.oneStep(id).map((next) => jack.baseDistance(next)));
		if (id !== base) assert.strictEqual(jack.baseDistance(id), best + 1, `map id ${id}`);
	}
});

test('bruteForceRoute agrees with baseDistance for nearby numbers', () => {
	const base = numbered(window)[80];
	setupNight(window, { base, from: base, remaining: 15 });
	for (const id of numbered(window).filter((id) => jack.baseDistance(id) <= 4)) {
		assert.strictEqual(jack.bruteForceRoute(id).moves, jack.baseDistance(id), `map id ${id}`);
	}
});
