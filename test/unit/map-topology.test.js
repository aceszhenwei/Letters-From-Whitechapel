// The board's topology, as verified against the physical board (docs/map-data.md, "Verified against the board").
// whitechapelR's map (test/fixtures/whitechapelR-map.json) differs from the board in 13 places; the board is right in
// all of them. These tests pin each of those 13 connections, and check that nothing else has drifted.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('../helpers/core');
const whitechapelR = require('../fixtures/whitechapelR-map.json');

const { WC, map } = loadCore();
const board = WC.board;
const circles = Array.from(board.numbered());
const byNumber = {};
circles.forEach((id) => { byNumber[map[id].number] = id; });
const walks = (a, b) => board.walk(byNumber[a], []).includes(byNumber[b]);
const alley = (a, b) => board.alleys(byNumber[a]).includes(byNumber[b]);
const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
const pairs = (neighbours) => {
	const set = new Set();
	for (const id of circles) for (const other of neighbours(id)) set.add(key(map[id].number, map[other].number));
	return set;
};

// The 13 connections checked on the physical board (printed numbers), and the crossings (map ids) each walk uses
const boardHas = [
	[16, 34, [50, 52]], [165, 189, [260, 252]], [169, 191, [284, 282]], [172, 183, [361, 345, 344, 324]],
	[182, 184, [326, 330]], [182, 185, [326, 330, 331]], [182, 186, [326, 330, 331, 332]], [182, 193, [326, 330, 331, 332]],
	[185, 192, [331, 330, 326]], [186, 192, [332, 331, 330, 326]]
];
const boardLacks = [[165, 186], [31, 36]];
const boardLacksAlley = [[35, 39]];

for (const [a, b, crossings] of boardHas) {
	test(`the board joins ${a} and ${b} by a street (through crossings ${crossings.join(', ')})`, () => {
		assert.ok(walks(a, b) && walks(b, a), 'both ways');
		assert.ok(map[byNumber[a]].adjacentNumber.includes(byNumber[b]), 'in the hand-entered neighbours too');
		// A policeman on any one of those crossings blocks it, as on the board
		for (const crossing of crossings) {
			assert.ok(!board.walk(byNumber[a], [crossing]).includes(byNumber[b]), `blocked at ${crossing}`);
		}
	});
}

for (const [a, b] of boardLacks) {
	test(`the board has no street between ${a} and ${b}`, () => {
		assert.ok(!walks(a, b) && !walks(b, a));
		assert.ok(board.distance(byNumber[a], byNumber[b]) > 1);
	});
}

for (const [a, b] of boardLacksAlley) {
	test(`${a} and ${b} are not on the same block, so no alley joins them`, () => {
		assert.ok(!alley(a, b) && !alley(b, a));
	});
}

test('the whole topology: 775 walking links, 451 alleys, 592 streets', () => {
	assert.strictEqual(pairs((id) => board.walk(id, [])).size, 775);
	assert.strictEqual(pairs((id) => board.alleys(id)).size, 451);
	const streets = new Set();
	for (let id = 0; id < map.length; id++) for (const other of map[id].adjacent) streets.add(key(id, other));
	assert.strictEqual(streets.size, 592);
	assert.strictEqual(map.topologyCorrections, undefined, 'walking follows the streets, with no overrides');
});

test('whitechapelR\'s map differs from the board in exactly these 13 places, and nowhere else', () => {
	const diff = (a, b) => [...a].filter((x) => !b.has(x)).sort();
	const ourWalks = pairs((id) => board.walk(id, []));
	const theirWalks = new Set(whitechapelR.roads.map(([a, b]) => key(a, b)));
	assert.deepStrictEqual(diff(ourWalks, theirWalks), boardHas.map(([a, b]) => key(a, b)).sort());
	assert.deepStrictEqual(diff(theirWalks, ourWalks), boardLacks.map(([a, b]) => key(a, b)).sort());
	const ourAlleys = pairs((id) => board.alleys(id));
	const theirAlleys = new Set(whitechapelR.alleys.map(([a, b]) => key(a, b)));
	assert.deepStrictEqual(diff(ourAlleys, theirAlleys), []);
	assert.deepStrictEqual(diff(theirAlleys, ourAlleys), boardLacksAlley.map(([a, b]) => key(a, b)).sort());
});
