// Waiting against Detective AI v3's containment (docs/waiting-containment.md): positions set up by hand, showing what
// killing at once, waiting once and waiting twice do to a one-walk escape, how the police's choice of where to move a
// Wretched opens or keeps it closed, and what v3's threat model covers. Nothing here changes an AI.
const test = require('node:test');
const assert = require('node:assert');
const lib = require('../../research/detective-inference/lib');
const B = require('../../research/human-strategy/board');
const configs = require('../../research/waiting-containment/configs');

const { WC, _ } = lib;
const { rules, board } = WC;
const { id, crossingsNextTo } = B;
const names = (list) => Array.from(list, (c) => board.number(c)).sort((a, b) => a - b);

// Night 4: hideout 134, one Wretched on 147 (one walk from it), a real patrol on the crossing that closes that walk
const home = id(134);
const red = id(147);
const [block] = crossingsNextTo(111, 134, 147);
function night({ base = home, wretched = [red], real = [block] } = {}) {
	const s = WC.engine.createState();
	const stations = board.stations();
	s.base = base;
	s.phase = 5;
	s.womenMarked = wretched.slice();
	s.police.push({ start: real.concat(stations.slice(0, 5 - real.length)), fake: stations.slice(5 - real.length, 7 - real.length), revealed: [], now: [], route: [], search: [], arrest: [], clue: [], log: [] });
	s.jack.push({ route: [], moves: [], murder: [], murderMove: [], trackPosition: 0, carriages: 1, alleys: 1 });
	s.turn = { pending: _.range(wretched.length), total: wretched.length };
	return s;
}
const openWalk = (s, site) => board.walk(site, rules.policeNight(s).start).includes(s.base);
function policeMove(s, config) {
	// Where a police configuration moves the first Wretched still to move
	const police = WC.createPolice(board, rules, WC.deduction, _, configs[config]);
	let to = null;
	police.turn({ moveWretched: (f, t) => { to = t; }, keepWretched: () => { to = 'kept'; } }, rules.policeView(s), () => 0.5);
	return to;
}

test('killing at once: the patrol on the crossing closes the one-walk escape', () => {
	const s = night();
	assert.ok(board.walk(red, []).includes(home), '147 is one walk from 134');
	assert.strictEqual(openWalk(s, red), false);
});

test('waiting once: the police choose between a circle that keeps the walk closed and one that opens it', () => {
	const s = night();
	const moves = rules.wretchedMoves(s, red);
	assert.deepStrictEqual(names(moves), [133, 146]);
	assert.strictEqual(openWalk(s, id(133)), true, '133 is one walk from 134 by a way the patrol doesn\'t block');
	assert.strictEqual(openWalk(s, id(146)), false);
	// Here both v3 and v3 with containWretched choose the safe circle
	assert.strictEqual(policeMove(s, 'v3'), id(146));
	assert.strictEqual(policeMove(s, 'v3-wretched'), id(146));
});

test('waiting twice: two steps from the red circle is beyond v3\'s threat model, which looks one step out', () => {
	const s = night();
	const oneStep = board.walk(red, []);
	const twoSteps = _.difference(_.uniq(_.flatten(rules.wretchedMoves(s, red).map((m) => board.walk(m, [])))), oneStep.concat([red]));
	assert.ok(twoSteps.length > 0);
	// The model's kill sites: the red circle (weight 1) and the circles one walk from it (containNeighbours)
	const sites = WC.containment.killSites([], 0.5, [red]);
	assert.ok(twoSteps.every((c) => sites[c] === undefined), 'no weight two steps out');
});

test('the threat model counts circles the police could never move a Wretched to', () => {
	const s = night();
	const sites = WC.containment.killSites([], 0.5, [red]);
	const modelled = Object.keys(sites).map(Number).filter((c) => c !== red);
	const legal = rules.wretchedMoves(s, red);
	assert.ok(legal.every((c) => modelled.includes(c)), 'every legal move is modelled');
	assert.deepStrictEqual(names(_.difference(modelled, legal)), [111, 134], 'and two that are not legal: next to a patrol, and the hideout itself');
});

test('across the board, v3 moves a Wretched where it opens an escape about half the time; containWretched less often', () => {
	// Every hideout one walk from a red circle, with a real patrol on a crossing that closes that walk, where one legal
	// move opens the escape and another doesn't
	let cases = 0;
	const opens = { v3: 0, 'v3-wretched': 0 };
	for (const r of board.redCircles()) {
		for (const h of rules.hideoutChoices()) {
			if (!board.walk(r, []).includes(h)) continue;
			for (const b of WC.containment.walkBlockers(r, h)) {
				const s = night({ base: h, wretched: [r], real: [b] });
				const moves = rules.wretchedMoves(s, r);
				if (!moves.some((m) => openWalk(s, m)) || moves.every((m) => openWalk(s, m))) continue;
				cases++;
				for (const config of Object.keys(opens)) {
					if (openWalk(s, policeMove(s, config))) opens[config]++;
				}
			}
		}
	}
	assert.ok(cases >= 20, `${cases} positions`);
	assert.ok(opens.v3 > 0 && opens['v3-wretched'] < opens.v3, JSON.stringify(opens));
});

test('the police decide from what they know: moving a Wretched never depends on Jack\'s true hideout', () => {
	const a = night();
	const b = night();
	b.base = rules.hideoutChoices().find((h) => h !== home && !board.walk(red, []).includes(h));
	for (const config of ['v3', 'v3-wretched']) assert.strictEqual(policeMove(a, config), policeMove(b, config));
});
