// The deduction (js/core/deduction.js): where Jack could be, from the public record alone. Checked against an
// independent, exhaustive list of legal routes, with special attention to coaches, which may not end where they
// started (rules.canUseCarriage).
const test = require('node:test');
const assert = require('node:assert');
const { WC, play, publicPrefixes, enumerate, seeded } = require('../../research/detective-inference/lib');

const board = WC.board;
const circles = board.numbered();
const sorted = (o) => Object.keys(o).map(Number).sort((a, b) => a - b);

test('a coach never ends where it started', () => {
	for (const start of circles.slice(0, 60)) {
		const log = [{ type: 'crime', scenes: [start] }, { type: 'move', move: 'carriage', police: [] }];
		const known = WC.deduction.track(log, {});
		assert.ok(!known.current[start], `track from ${start}`);
		const projected = WC.deduction.track([{ type: 'crime', scenes: [start] }], {}).next('carriage', []);
		assert.ok(!projected.current[start], `projection from ${start}`);
		assert.deepStrictEqual(sorted(known.current), sorted(enumerate(log).circles), `the same circles as the rules allow, from ${start}`);
	}
});

test('a coach can still return to its start over two coaches, or end next to it', () => {
	const start = circles[40];
	const log = [{ type: 'crime', scenes: [start] }, { type: 'move', move: 'carriage', police: [] }, { type: 'move', move: 'carriage', police: [] }];
	assert.ok(WC.deduction.track(log, {}).current[start] > 0, 'two coaches can come back');
	assert.deepStrictEqual(sorted(WC.deduction.track(log, {}).current), sorted(enumerate(log).circles));
});

test('a coach\'s stop counts as visited: a clue there keeps only routes through it', () => {
	const start = circles[70];
	const via = board.walk(start, [])[0];
	const log = [{ type: 'crime', scenes: [start] }, { type: 'move', move: 'carriage', police: [] }, { type: 'search', mapid: via, clue: true }];
	const known = WC.deduction.track(log, {});
	assert.deepStrictEqual(sorted(known.current), sorted(enumerate(log).circles));
	// Either the clue circle was the stop and he went on from it, or he coached through another stop to end on it
	for (const end of sorted(known.current)) assert.ok(end !== start && (end === via || board.walk(via, []).includes(end)), `end ${end}`);
});

test('random records with coaches, walks, alleys and searches match the exhaustive reference exactly', () => {
	const random = seeded(4242);
	const pick = (list) => list[Math.floor(random() * list.length)];
	let checked = 0;
	for (let n = 0; n < 40; n++) {
		let at = pick(circles);
		const route = [at];
		const log = [{ type: 'crime', scenes: [at] }];
		for (let m = 0; m < 4; m++) {
			const kind = pick(['walk', 'walk', 'carriage', 'alley']);
			if (kind === 'alley' && board.alleys(at).length) {
				at = pick(board.alleys(at));
			} else if (kind === 'carriage') {
				const via = pick(board.walk(at, []));
				const ends = board.walk(via, []).filter((c) => c !== at);
				if (!ends.length) continue;
				route.push(via);
				at = pick(ends);
			} else {
				at = pick(board.walk(at, []));
			}
			route.push(at);
			log.push({ type: 'move', move: kind === 'alley' && board.alleys(route[route.length - 2]).includes(at) ? 'alley' : kind === 'carriage' ? 'carriage' : 'walk', police: [] });
			if (random() < 0.4) { // A search somewhere near, with its true result
				const mapid = pick(board.walk(at, []));
				log.push({ type: 'search', mapid, clue: route.includes(mapid) });
			}
		}
		const reference = enumerate(log, 2e5);
		if (!reference) continue;
		const known = WC.deduction.track(log, {});
		assert.ok(known.current[at] > 0, `record ${n}: Jack's circle kept`);
		assert.deepStrictEqual(sorted(known.current), sorted(reference.circles), `record ${n}`);
		checked++;
	}
	assert.ok(checked >= 30, `checked ${checked}`);
});

test('in real games, Jack\'s circle is never ruled out, and short records match the reference', () => {
	for (const seed of [800011, 800012]) {
		const state = play({ jack: 'strategic', police: 'deductive', seed });
		for (const item of publicPrefixes(state)) {
			const known = WC.deduction.track(item.prefix, {});
			assert.ok(known.current[item.truth] > 0, `seed ${seed}, night ${item.night + 1}, step ${item.steps}`);
			if (item.steps <= 5) {
				const reference = enumerate(item.prefix, 1e5);
				if (reference) assert.deepStrictEqual(sorted(known.current), sorted(reference.circles), `seed ${seed}, step ${item.steps}`);
			}
		}
	}
});
