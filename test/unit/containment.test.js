// Containment (js/ai/containment.js) and Detective AI v3 (js/ai/police.js options; docs/detective-ai-v3.md): the
// tactical scenarios of the study, deterministic. Board positions are named by the printed numbers players use.
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../../research/detective-inference/lib');
const B = require('../../research/human-strategy/board');
const policies = require('../../research/human-strategy/policies');
const jacks = require('../../research/detective-v3/jacks');
const configs = require('../../research/detective-v3/configs');

const { WC, _ } = lib;
const C = WC.containment;
const { id, crossingName, crossingsNextTo, distance } = B;
const names = (crossings) => Array.from(crossings, crossingName).sort();
const homesOf = (weights) => _.object(Object.keys(weights).map((n) => id(Number(n))), Object.values(weights));
const sites = (...numbers) => numbers.map(id);

test('a one-walk escape is closed only by a policeman on a crossing that walk passes', () => {
	assert.deepStrictEqual(names(C.walkBlockers(id(147), id(134))), ['111/134/147']);
	assert.deepStrictEqual(names(C.walkBlockers(id(65), id(51))), ['51/67', '65/66']);
	assert.deepStrictEqual(Array.from(C.walkBlockers(id(149), id(51))), [], 'not one walk apart: no threat');
});

test('Scenario A (hideout 134): Detective AI v2 never stops the scheme; v3 does, through the real-patrol choice', () => {
	lib.registerJack('bgg-134', (random) => policies['bgg-134'](random));
	const v2 = lib.play({ jack: 'bgg-134', police: 'deductive', seed: 460001, policeOptions: configs.v2 });
	assert.strictEqual(v2.result.type, 'jackWins');
	assert.ok(v2.jack.every((night) => night.moves.length <= 2), 'every night ends in one or two moves');
	// Even told the true hideout, v2 loses: the problem is the police's position, not their knowledge
	const oracle = Object.assign({}, WC.deduction, { hideouts: () => _.object([id(134)], [1]) });
	const told = WC.createPolice(WC.board, WC.rules, oracle, _, configs.v2);
	const createPolice = WC.createPolice;
	WC.createPolice = () => told;
	try {
		assert.strictEqual(lib.play({ jack: 'bgg-134', police: 'deductive', seed: 460001, policeOptions: configs.v2 }).result.type, 'jackWins');
	} finally {
		WC.createPolice = createPolice;
	}
	const v3 = lib.play({ jack: 'bgg-134', police: 'deductive', seed: 460001, policeOptions: configs.v3 });
	assert.notStrictEqual(v3.result.type, 'jackWins');
	// The station next to 130 and 145 is the only one within two police turns of the 111/134/147 crossing; v3 makes it
	// a real policeman on night 2
	const station = WC.board.stations().find((c) => crossingName(c) === '130/145');
	assert.ok(v3.police[1].start.includes(station));
	assert.ok(!v2.police[1].start.includes(station));
});

test('Scenario B (central hideouts 51, 66, 67): one policeman on the 65/66 crossing closes most of the threat to all three', () => {
	const list = C.threats(homesOf({ 51: 1 / 3, 66: 1 / 3, 67: 1 / 3 }), [], { sites: sites(65, 84) });
	assert.strictEqual(list.length, 6, 'each hideout is one walk from both 65 and 84');
	const [c6566] = crossingsNextTo(65, 66);
	const best = _.max(_.uniq(_.flatten(list.map((t) => t.blockers))), (c) => C.value(list, c, []));
	assert.strictEqual(best, c6566);
	assert.ok(C.exposure(list, [c6566]) < 0.5 * C.exposure(list, []));
	// A second policeman closes the rest
	const second = _.max(_.uniq(_.flatten(list.map((t) => t.blockers))), (c) => C.value(list, c, [c6566]));
	assert.strictEqual(C.exposure(list, [c6566, second]), 0);
});

test('Scenario C (Night 4 trap at 51): no policeman, a one-move escape; the right one, a longer escape; a longer escape is not a capture', () => {
	const [c6566] = crossingsNextTo(65, 66);
	assert.strictEqual(distance(65, 51), 1);
	assert.strictEqual(distance(65, 51, [c6566]), 4, 'closed: Jack must go round');
	assert.strictEqual(distance(84, 51, [c6566]), 5);
	// But not every crossing near 51 helps: one on the far side leaves both escapes open
	const far = crossingsNextTo(31, 50)[0] || crossingsNextTo(50, 51)[0];
	const list = C.threats(homesOf({ 51: 1 }), [], { sites: sites(65, 84) });
	assert.strictEqual(C.exposure(list, [far]), C.exposure(list, []));
});

test('Scenario D (uncertain hideout): the defence follows the belief, and a crossing far from every threat is worth nothing', () => {
	// Two candidate hideouts in different places: 51 (by 65 and 84) and 134 (by 147)
	const likely51 = C.threats(homesOf({ 51: 0.8, 134: 0.2 }), [], { sites: sites(65, 84, 147) });
	const likely134 = C.threats(homesOf({ 51: 0.2, 134: 0.8 }), [], { sites: sites(65, 84, 147) });
	const [c6566] = crossingsNextTo(65, 66);
	const [c134] = crossingsNextTo(111, 134, 147);
	assert.ok(C.value(likely51, c6566, []) > C.value(likely51, c134, []));
	assert.ok(C.value(likely134, c134, []) > C.value(likely134, c6566, []));
	// A station across the board, five police turns from the 111/134/147 crossing (more than the four the model looks
	// ahead), is worth nothing against that threat
	const only134 = C.threats(homesOf({ 134: 1 }), [], { sites: sites(147) });
	const distant = WC.board.stations().find((c) => crossingName(c) === '40/57');
	assert.strictEqual(C.value(only134, distant, []), 0);
	assert.ok(C.value(only134, WC.board.stations().find((c) => crossingName(c) === '130/145'), []) > 0);
	// No possible hideout next to a kill site: no threat at all, so containment pulls nowhere
	assert.strictEqual(C.threats(homesOf({ 1: 1 }), [], { sites: sites(147) }).length, 0);
});

test('coordination: a second policeman gets no credit for a threat the first already closes', () => {
	const list = C.threats(homesOf({ 134: 1 }), [], { sites: sites(147) });
	const [c134] = crossingsNextTo(111, 134, 147);
	assert.ok(C.value(list, c134, []) > 0);
	assert.strictEqual(C.value(list, c134, [c134]), 0);
});

test('Detective AI v3 plays whole games legally against every kind of Jack, the same way twice', () => {
	lib.registerJack('short-return', (random) => jacks['short-return'](random));
	for (const jack of ['short-return', 'strategic', 'baseline']) {
		for (const seed of [470001, 470002]) {
			const a = lib.play({ jack, police: 'deductive', seed, policeOptions: configs.v3 });
			const b = lib.play({ jack, police: 'deductive', seed, policeOptions: configs.v3 });
			assert.ok(a.over, `${jack} ${seed}: the game ends (patrol placement never stalls)`);
			assert.deepStrictEqual(JSON.stringify([a.result, a.police.map((p) => p.route)]), JSON.stringify([b.result, b.police.map((p) => p.route)]));
			a.police.forEach((night) => {
				assert.strictEqual(night.start.length, WC.rules.config.police);
				assert.strictEqual(night.fake.length, WC.rules.config.fakePolice);
			});
		}
	}
});

test('with its options off, the police play exactly as Detective AI v2', () => {
	const a = lib.play({ jack: 'strategic', police: 'deductive', seed: 470003, policeOptions: configs.v2 });
	const b = lib.play({ jack: 'strategic', police: 'deductive', seed: 470003, policeOptions: Object.assign({}, configs.v2, { contain: 0, containPatrols: false, containWretched: false }) });
	assert.deepStrictEqual(JSON.stringify(a.police), JSON.stringify(b.police));
});
