const test = require('node:test');
const assert = require('node:assert');
const { loadGame, numbered } = require('../helpers/game');

const window = loadGame();
const map = window.map;
const plain = (array) => Array.from(array); // Arrays from the game window belong to another realm

test('every street connection goes both ways', () => {
	assert.strictEqual(map.debug(), '0 errors');
});

test('there are 195 numbered positions, numbered 1 to 195', () => {
	const numbers = numbered(window).map((id) => map[id].number).sort((a, b) => a - b);
	assert.strictEqual(numbers.length, 195);
	numbers.forEach((number, index) => assert.strictEqual(number, index + 1));
});

test('the streets form a planar graph with 164 blocks', () => {
	let edges = 0;
	for (let a = 0; a < map.length; a++) {
		edges += map[a].adjacent.filter((b) => a < b).length;
	}
	const blocks = map.computeAlleys();
	assert.strictEqual(blocks, 164);
	assert.strictEqual(map.length - edges + (blocks + 1), 2, 'Euler: vertices - edges + faces = 2');
});

test('alleys link numbered positions both ways, never to themselves', () => {
	for (const id of numbered(window)) {
		for (const other of map[id].alley) {
			assert.ok(map[other].number, `${other} is not numbered`);
			assert.notStrictEqual(other, id);
			assert.ok(map[other].alley.includes(id), `alley ${id} -> ${other} is one way`);
		}
	}
});

test('only number 43 (on a spur at the edge of the map) has no alleys', () => {
	const withoutAlleys = numbered(window).filter((id) => map[id].alley.length === 0).map((id) => map[id].number);
	assert.deepStrictEqual(plain(withoutAlleys), [43]);
});

test('alleys match the hand entered lantern data', () => {
	// Map ids and lanterns originally entered by hand (the computed alleys replace them)
	const handEntered = {
		3: [119, 121], 8: [72, 118], 10: [70, 72], 14: [46, 51], 16: [42, 40, 44],
		19: [34, 36, 38, 40, 42], 22: [25, 27, 29], 25: [27, 29, 22], 32: [29, 34],
		34: [32, 36, 38, 40, 42, 19], 36: [165, 168, 170, 172, 174, 38, 40, 42, 19, 34],
		38: [42, 19, 34, 36, 165, 168, 170, 172, 174, 57, 47, 40], 40: [16, 42, 19, 34, 36, 38, 57, 47, 44],
		42: [19, 34, 36, 38, 40, 16], 44: [16, 40, 47, 49, 46], 46: [44, 47, 49, 51, 14],
		47: [44, 40, 38, 57, 49, 46], 49: [46, 44, 47, 54], 51: [14, 46, 53], 53: [51, 55, 66, 68],
		74: [70, 68, 83, 82, 80, 108, 110, 113, 115]
	};
	const sort = (array) => plain(array).sort((a, b) => a - b);
	for (const id in handEntered) {
		assert.deepStrictEqual(sort(map[id].alley), sort(handEntered[id]), `alleys from map id ${id}`);
	}
	// These two were only partly entered: they also border the block with numbers 58, 76 and 77
	assert.deepStrictEqual(sort(map[27].alley), [22, 25, 29, 158, 160, 163]);
	assert.deepStrictEqual(sort(map[29].alley), [22, 25, 27, 32, 158, 160, 163]);
});

test('there are 7 police stations and 8 murder spots', () => {
	assert.deepStrictEqual(plain(map.key('station')), [33, 56, 76, 190, 210, 312, 385]);
	assert.strictEqual(map.key('murder').length, 8);
});
