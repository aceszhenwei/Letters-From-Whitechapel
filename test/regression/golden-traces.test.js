// Seeded games must play exactly as they did when the traces were recorded (before the module refactor):
// the same police actions, Jack's moves, case log, screen text and final state, step by step.
const test = require('node:test');
const assert = require('node:assert');
const golden = require('../fixtures/golden-traces.json');
const { traceGame } = require('../helpers/trace');

for (const expected of golden) {
	test(`seed ${expected.seed} plays the same game as the recorded trace`, () => {
		const actual = traceGame(expected.seed);
		delete actual.snapshot;
		// Readable parts first, so a failure shows where the games diverge
		assert.strictEqual(actual.errors, 0);
		assert.deepStrictEqual(actual.jack, expected.jack, 'Jack\'s moves and routes');
		assert.deepStrictEqual(actual.log, expected.log, 'case log');
		assert.strictEqual(actual.ending, expected.ending);
		assert.strictEqual(actual.actions, expected.actions);
		assert.strictEqual(actual.final, expected.final, 'final state');
		assert.strictEqual(actual.steps, expected.steps, 'state and screen after every action');
	});
}
