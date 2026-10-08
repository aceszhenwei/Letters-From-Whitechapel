// The board's topology follows whitechapelR's map, which this project treats as canonical (docs/map-data.md,
// "Topology corrections"): every walking link and alley between numbered circles, and the 13 corrections.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('../helpers/core');
const canonical = require('../fixtures/whitechapelR-map.json');

const { WC, map } = loadCore();
const board = WC.board;
const circles = Array.from(board.numbered());
const byNumber = {};
circles.forEach((id) => { byNumber[map[id].number] = id; });
const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
const pairs = (neighbours) => {
	const set = new Set();
	for (const id of circles) for (const other of neighbours(id)) set.add(key(map[id].number, map[other].number));
	return set;
};
const canonicalSet = (list) => new Set(list.map(([a, b]) => key(a, b)));
const difference = (a, b) => [...a].filter((x) => !b.has(x)).sort();

test('walking links between numbered circles are exactly whitechapelR\'s', () => {
	const ours = pairs((id) => board.walk(id, []));
	const theirs = canonicalSet(canonical.roads);
	assert.deepStrictEqual(difference(ours, theirs), [], 'links whitechapelR doesn\'t have');
	assert.deepStrictEqual(difference(theirs, ours), [], 'whitechapelR links missing here');
	assert.strictEqual(ours.size, 767);
});

test('alleys are exactly whitechapelR\'s', () => {
	const ours = pairs((id) => board.alleys(id));
	const theirs = canonicalSet(canonical.alleys);
	assert.deepStrictEqual(difference(ours, theirs), []);
	assert.deepStrictEqual(difference(theirs, ours), []);
	assert.strictEqual(ours.size, 452);
});

test('each of the 13 corrections is in place, both ways', () => {
	const walks = (a, b) => board.walk(byNumber[a], []).includes(byNumber[b]);
	const alley = (a, b) => board.alleys(byNumber[a]).includes(byNumber[b]);
	const { walks: w, alleys: al } = map.topologyCorrections;
	assert.strictEqual(w.remove.length + w.add.length + al.add.length + al.remove.length, 13);
	for (const [a, b] of w.remove) assert.ok(!walks(a, b) && !walks(b, a), `no walk ${a}-${b}`);
	for (const [a, b] of w.add) assert.ok(walks(a, b) && walks(b, a), `walk ${a}-${b}`);
	for (const [a, b] of al.add) assert.ok(alley(a, b) && alley(b, a), `alley ${a}-${b}`);
	// The hand-entered list of walking neighbours agrees
	for (const [a, b] of w.add) assert.ok(map[byNumber[a]].adjacentNumber.includes(byNumber[b]));
	for (const [a, b] of w.remove) assert.ok(!map[byNumber[a]].adjacentNumber.includes(byNumber[b]));
});

test('policemen still block the links that pass their crossing, and can\'t block the added ones', () => {
	// 182 still walks to 183's side through crossing 326 (map ids), but no longer to 184
	const from = byNumber[182];
	const blocked = board.walk(from, [326]);
	assert.ok(!blocked.includes(byNumber[192]), 'a policeman on the way blocks a remaining link');
	assert.ok(!board.walk(from, []).includes(byNumber[184]));
	// An added link passes no crossing
	const around = board.neighbours(byNumber[165]).filter((id) => !board.isNumbered(id));
	assert.ok(board.walk(byNumber[165], around).includes(byNumber[186]));
});

test('the streets themselves are unchanged: still a planar graph with 164 blocks', () => {
	const streets = new Set();
	for (let id = 0; id < map.length; id++) for (const other of map[id].adjacent) streets.add(key(id, other));
	assert.strictEqual(map.length, 429);
	assert.strictEqual(streets.size, 592);
});

test('distances use the corrected links', () => {
	assert.strictEqual(board.distance(byNumber[165], byNumber[186]), 1);
	assert.ok(board.distance(byNumber[182], byNumber[184]) > 1);
});
