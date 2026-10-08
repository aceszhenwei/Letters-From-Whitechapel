const test = require('node:test');
const assert = require('node:assert');
const { loadGame } = require('../helpers/game');

const { game } = loadGame({ seed: 42 });

test('randomInt returns lowest up to (but not including) highest', () => {
	const seen = new Set();
	for (let i = 0; i < 2000; i++) {
		const value = game.randomInt(5, 8);
		assert.ok(Number.isInteger(value) && value >= 5 && value < 8, `got ${value}`);
		seen.add(value);
	}
	assert.deepStrictEqual([...seen].sort(), [5, 6, 7]);
});

test('randomSafe stays between 0 and 10', () => {
	for (let i = 0; i < 2000; i++) {
		const value = game.randomSafe(0.9);
		assert.ok(value >= 0 && value <= 10, `got ${value}`);
	}
});

test('randomSafeIndex always returns a valid index', () => {
	for (let length = 1; length <= 10; length++) {
		for (let i = 0; i < 500; i++) {
			const index = game.randomSafeIndex(0.99, length);
			assert.ok(Number.isInteger(index) && index >= 0 && index < length, `got ${index} for length ${length}`);
		}
	}
});

test('randomSafeIndex prefers the start of the array', () => {
	let total = 0;
	for (let i = 0; i < 2000; i++) {
		total += game.randomSafeIndex(0.99, 10);
	}
	assert.ok(total / 2000 < 3, `average index ${total / 2000}`);
});
