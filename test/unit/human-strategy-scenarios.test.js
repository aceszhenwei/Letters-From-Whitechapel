// Board facts from the BoardGameGeek strategy threads (docs/human-strategy-literature.md), checked on this map in the
// printed numbers the posts use. They agree with the posts, an independent check on the map data; the tactical
// conclusions drawn from them are in the document (research/human-strategy/scenarios.js prints them all).
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../research/human-strategy/board');

const { board, n, walks, coaches, distance, red, crossingsNextTo, _ } = B;
const R = red();
const nonRed = Array.from(board.numbered(), n).filter((x) => !R.includes(x));

test('walking neighbours: fewest 2 (61, 81), most 15 (125, and 159), about 8 on average', () => {
	const deg = Array.from(board.numbered(), (m) => [n(m), board.walk(m, []).length]);
	assert.deepStrictEqual(deg.filter((d) => d[1] === 2).map((d) => d[0]).sort((a, b) => a - b), [61, 81]);
	assert.deepStrictEqual(deg.filter((d) => d[1] === 15).map((d) => d[0]).sort((a, b) => a - b), [125, 159]);
	assert.ok(Math.abs(deg.reduce((s, d) => s + d[1], 0) / deg.length - 8) < 0.1);
});

test('only 51, 66 and 67 are one walk from two red circles (65 and 84)', () => {
	assert.deepStrictEqual(nonRed.filter((x) => walks(x).filter((y) => R.includes(y)).length >= 2).sort((a, b) => a - b), [51, 66, 67]);
});

test('a coach and a step from 27 reach exactly the 55 circles grey_wolf listed', () => {
	const posted = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 24, 25, 26, 27, 28, 29, 30, 31, 32, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 59, 60, 61, 62, 63, 64, 65, 66, 67, 78, 79, 80, 81, 82, 83, 84, 95, 96, 97, 98, 115, 116, 117];
	assert.deepStrictEqual(Array.from(new Set(coaches(27).flatMap((x) => walks(x)))).sort((a, b) => a - b), posted);
});

test('a policeman on the 65/66 crossing cuts 65 and 84 off from 51 and puts every red pair 3 or more walks apart', () => {
	const [bobby] = crossingsNextTo(65, 66);
	assert.ok(walks(51).includes(65) && walks(51).includes(84));
	assert.ok(!walks(51, [bobby]).includes(65) && !walks(51, [bobby]).includes(84));
	const pairs = [];
	for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) pairs.push([R[i], R[j]]);
	assert.strictEqual(_.min(pairs.map(([a, b]) => distance(a, b))), 1);
	assert.strictEqual(_.min(pairs.map(([a, b]) => distance(a, b, [bobby]))), 3);
});

test('147 walks to 111, 133, 134 and 146; a policeman on the 111/134/147 crossing stops the walk 147 to 134', () => {
	assert.deepStrictEqual(walks(147), [111, 133, 134, 146]);
	const [between] = crossingsNextTo(111, 134, 147);
	assert.strictEqual(distance(147, 134), 1);
	assert.strictEqual(distance(147, 134, [between]), 2);
});

test('two policemen can close 175 and 188 off together', () => {
	const police = [245].concat(Array.from(crossingsNextTo(164, 174)));
	const out = [175, 188].flatMap((x) => walks(x, police)).filter((x) => x !== 175 && x !== 188);
	assert.deepStrictEqual(out, []);
});
