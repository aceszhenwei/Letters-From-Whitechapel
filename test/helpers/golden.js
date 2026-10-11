// The golden-trace check (test/fixtures/golden-traces.json), shared by the two golden-trace test files, which split
// the recorded games between them (odd and even seeds) so they can run in parallel. Together they check every game.
const test = require('node:test');
const assert = require('node:assert');
const golden = require('../fixtures/golden-traces.json');
const { traceGame } = require('./trace');

const parts = {
	odd: (seed) => seed % 2 === 1,
	even: (seed) => seed % 2 === 0
};

function goldenTests(part) {
	for (const expected of golden.filter((g) => parts[part](g.seed))) {
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
}

module.exports = { goldenTests, parts, golden };
