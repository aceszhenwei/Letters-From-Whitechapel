// The research tools of the Detective AI v3 study (research/detective-study/; docs/detective-study.md): the exact walking
// cut used by the interception analysis, and the hideout models the calibration compares.
const test = require('node:test');
const assert = require('node:assert');
const { WC, _ } = require('../../research/detective-inference/lib');
const B = require('../../research/human-strategy/board');
const { distance, cuts, findCut } = require('../../research/detective-study/interception');
const { mixture, adaptive, score } = require('../../research/detective-study/calibration');

const { id, crossingsNextTo } = B;
const [block] = crossingsNextTo(111, 134, 147);

test('walking distance respects blocked crossings, and a cut is a block that leaves him short of moves', () => {
	assert.strictEqual(distance(id(147), id(134), [], 5), 1);
	assert.ok(distance(id(147), id(134), [block], 5) > 1, 'with the crossing held he must go round');
	assert.strictEqual(cuts(id(147), id(134), 1, [block]), true, 'one move left: held, he can\'t get home');
	assert.strictEqual(cuts(id(147), id(134), 1, []), false);
});

test('the cut search finds a placement within the policemen\'s reach, and none when they are too far', () => {
	// A policeman two crossings from the blocking crossing can reach it this turn
	const near = WC.board.crossingsWithinTwo(block).find((c) => c !== block);
	assert.strictEqual(findCut(id(147), id(134), 1, [near]), 'yes');
	// A policeman far across the board can't
	const far = WC.board.stations().find((s) => distance(id(147), WC.board.adjacentNumbers(s)[0], [], 30) > 8);
	assert.strictEqual(findCut(id(147), id(134), 1, [far]), 'no');
});

test('the adaptive model\'s route styles are proper distributions, and with no night seen it is uniform', () => {
	for (const d of [0, 3, 8]) {
		const total = _.range(0, 20).reduce((s, n) => s + mixture(n, d, 0.9, 0.5), 0);
		assert.ok(Math.abs(total - 1) < 1e-9, `d = ${d}`);
	}
	const belief = adaptive([]);
	const values = Object.values(belief);
	assert.ok(values.every((v) => Math.abs(v - values[0]) < 1e-12));
	assert.strictEqual(values.length, WC.rules.hideoutChoices().length);
});

test('scores: a certain, correct belief has log loss 0 and Brier 0; a uniform one over n has log n', () => {
	const sure = score({ 5: 1 }, 5);
	assert.ok(Math.abs(sure.log) < 1e-12);
	assert.ok(Math.abs(sure.brier) < 1e-12);
	const flat = score({ 1: 0.25, 2: 0.25, 3: 0.25, 4: 0.25 }, 3);
	assert.ok(Math.abs(flat.log - Math.log(4)) < 1e-12);
});
