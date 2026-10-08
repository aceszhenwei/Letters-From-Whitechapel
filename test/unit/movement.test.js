const test = require('node:test');
const assert = require('node:assert');
const { loadCore, nightState, crossingsAround } = require('../helpers/core');

const { WC, map } = loadCore();
const { board, rules } = WC;
const plain = (array) => Array.from(array);
const crossings = () => map.map((place, id) => id).filter((id) => !map[id].number);
const numbered = () => board.numbered();

test('police only move between crossings', () => {
	for (const id of crossings()) {
		for (const step of board.crossingsWithinTwo(id)) {
			assert.ok(!map[step].number, `police at ${id} could move onto number ${step}`);
		}
		assert.ok(board.crossingSteps(id).every((step) => board.crossingsWithinTwo(id).includes(step)));
	}
});

test('police can move through crossing 0 in the corner of the map', () => {
	assert.ok(board.crossingSteps(1).includes(0));
});

test('police can arrest or search the numbers next to their crossing', () => {
	for (const id of crossings()) {
		assert.deepStrictEqual(plain(rules.arrestable(id)), plain(map[id].adjacent.filter((adj) => map[adj].number)));
	}
});

test('searchable skips clues already found and the murder scene', () => {
	const state = nightState(WC, { base: 3, from: 3 });
	const crossing = crossings().find((id) => rules.arrestable(id).length >= 2);
	const [first, second] = rules.arrestable(crossing);
	rules.policeNight(state).clue.push(first);
	rules.jackNight(state).murder.push(second);
	const searchable = rules.searchable(state, crossing);
	assert.ok(!searchable.includes(first));
	assert.ok(!searchable.includes(second));
});

test('Jack walks between neighbouring numbers, matching the hand entered adjacent numbers', () => {
	for (const id of numbered()) {
		const steps = plain(board.walk(id, [])).sort((a, b) => a - b);
		assert.deepStrictEqual(steps, plain(map[id].adjacentNumber).sort((a, b) => a - b), `from map id ${id}`);
	}
});

test('Jack cannot walk past police', () => {
	const from = numbered().find((id) => crossingsAround(WC, id).length >= 2);
	const blocked = crossingsAround(WC, from)[0];
	const state = nightState(WC, { base: 3, from, police: [blocked] });
	const open = board.walk(from, []);
	const avoiding = rules.jackWalks(state, from);
	assert.ok(avoiding.length < open.length);
	assert.ok(avoiding.every((id) => open.includes(id)));
});

test('distance counts the fewest walking moves to the hideout', () => {
	const base = numbered()[50];
	assert.strictEqual(board.distance(base, base), 0);
	for (const id of board.walk(base, [])) {
		assert.strictEqual(board.distance(id, base), 1);
	}
	for (const id of numbered()) {
		const best = Math.min(...board.walk(id, []).map((next) => board.distance(next, base)));
		if (id !== base) assert.strictEqual(board.distance(id, base), best + 1, `map id ${id}`);
	}
});

test('shortestRoutes agrees with distance for nearby numbers', () => {
	const base = numbered()[80];
	for (const id of numbered().filter((id) => board.distance(id, base) <= 4)) {
		assert.strictEqual(board.shortestRoutes(id, base, [], 15).moves, board.distance(id, base), `map id ${id}`);
	}
});
