// Strategic waiting (js/ai/jack-waiting.js; docs/jack-waiting.md): killing now against waiting, in positions set up
// by hand with a table made up for the test, and over whole seeded games with the calibrated table.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('../helpers/core');
const { seededRandom } = require('../helpers/game');

const core = loadCore({ seed: 1 });
const { WC, _ } = core;
const B = WC.board;

// Made up for the test: the chance of escaping rises by 0.1 a move to spare, and halves within reach of a patrol
const clear = _.range(10).map((s) => s / 10);
const table = { earlyClear: clear, earlyReach: clear.map((p) => p / 2), lastClear: clear, lastReach: clear.map((p) => p / 2) };
const reachOf = (crossing) => _.uniq(_.flatten([crossing].concat(B.crossingsWithinTwo(crossing)).map((c) => B.adjacentNumbers(c))));

// The base AI only needs to exist: the policy replaces its wantsToWait
const base = { wantsToWait: () => false, debug: {} };
const jack = (options) => WC.createWaitingJack(B, base, _, Object.assign({ table }, options));

// A view at Blood on the streets: Wretched at the given circles, with how far each is from home and where the police
// could move each; patrol tokens as Jack knows them
function view({ wretched, home, moves = {}, patrols, timeOfCrime = 1, night = 0, victims = 1 }) {
	return {
		night, timeOfCrime, victims, wretched,
		patrols: () => patrols,
		wretchedMoves: (w) => moves[w] || [],
		distanceToHideout: (w) => home[w]
	};
}

// Seven tokens on the stations, none of them reaching the circles used below unless a test says so
const stations = B.stations();
const farCircle = _.find(_.range(1, 196).map((n) => B.numbered().find((m) => B.number(m) === n)), (c) => stations.every((s) => !reachOf(s).includes(c)));
const hiddenTokens = stations.map((mapid) => ({ mapid, revealed: false }));

test('time pays: a victim far from home that the police cannot move is worth waiting for', () => {
	const w = farCircle;
	const ai = jack();
	assert.strictEqual(ai.wantsToWait(view({ wretched: [w], home: { [w]: 14 }, patrols: hiddenTokens })), true);
	assert.strictEqual(ai.debug.waiting.decision, 'wait');
	assert.ok(ai.debug.waiting.waitAtWorst > ai.debug.waiting.killNow);
});

test('no gain: with moves to spare already, he kills at once', () => {
	const w = farCircle;
	const ai = jack();
	assert.strictEqual(ai.wantsToWait(view({ wretched: [w], home: { [w]: 3 }, patrols: hiddenTokens })), false);
	assert.strictEqual(ai.debug.waiting.decision, 'kill', 'a tie goes to killing now');
});

test('the police move the victim: if they can put it next to a patrol, waiting is valued at that worst case', () => {
	// The Wretched can only be moved into a station's reach, as far from home as now
	const station = stations[0];
	const into = _.find(reachOf(station), (c) => B.isNumbered(c) && c !== farCircle);
	const w = farCircle;
	const home = { [w]: 11, [into]: 11 };
	// (What the next reveal may show is left out here: test 4 covers it)
	const ai = jack({ info: false });
	assert.strictEqual(ai.wantsToWait(view({ wretched: [w], home, moves: { [w]: [into], [into]: [into] }, patrols: hiddenTokens })), false);
	// Where the police could also leave it clear, they are assumed to choose the worse
	const clearToo = jack({ info: false });
	assert.strictEqual(clearToo.wantsToWait(view({ wretched: [w], home, moves: { [w]: [into, w], [into]: [into] }, patrols: hiddenTokens })), false);
	// Without that threat the same victim is worth waiting for
	assert.strictEqual(jack({ info: false }).wantsToWait(view({ wretched: [w], home, moves: { [w]: [w] }, patrols: hiddenTokens })), true);
});

test('information: a reveal that may show the only patrol in reach is fake can be worth waiting for', () => {
	// The Wretched is in reach of one hidden token only; four others are revealed real and far away
	const lone = _.find(stations, (s) => reachOf(s).some((c) => B.isNumbered(c) && stations.every((t) => t === s || !reachOf(t).includes(c))));
	const w = _.find(reachOf(lone), (c) => B.isNumbered(c) && stations.every((t) => t === lone || !reachOf(t).includes(c)));
	const others = _.without(stations, lone);
	const patrols = [{ mapid: lone, revealed: false }].concat(others.slice(0, 2).map((mapid) => ({ mapid, revealed: false })),
		others.slice(2).map((mapid) => ({ mapid, revealed: true, real: true })));
	// Time alone gains nothing here: within reach every spare move is worth the same
	const flat = Object.assign({}, table, { earlyReach: clear.map(() => 0.2) });
	const v = view({ wretched: [w], home: { [w]: 11 }, patrols });
	const informed = jack({ table: flat });
	assert.strictEqual(informed.wantsToWait(v), true);
	assert.ok(Math.abs(informed.debug.waiting.revealFakeChance - 2 / 3) < 0.001, 'two fakes among three hidden tokens');
	assert.strictEqual(jack({ table: flat, info: false }).wantsToWait(v), false, 'without the information, no reason to wait');
});

test('at IV he weighs one more wait only; the last night uses its own row', () => {
	const w = farCircle;
	const ai = jack();
	ai.wantsToWait(view({ wretched: [w], home: { [w]: 14 }, patrols: hiddenTokens, timeOfCrime: 4 }));
	// 18 moves leave 4 to spare now, 19 leave 5 after waiting
	assert.strictEqual(ai.debug.waiting.killNow, 0.4);
	assert.strictEqual(ai.debug.waiting.waitAtWorst, 0.5);
	const last = jack({ table: Object.assign({}, table, { lastClear: clear.map(() => 0.9) }) });
	assert.strictEqual(last.wantsToWait(view({ wretched: [w], home: { [w]: 14 }, patrols: hiddenTokens, night: 3 })), false);
});

/* Whole games, with the calibrated table */
function play(seed, policeOptions) {
	const base = WC.createJackV2(B, WC.deduction, WC.random.create(seededRandom(seed)), _);
	const ai = WC.createWaitingJack(B, base, _, { table: 'jack-v2' });
	const police = WC.createPolice(B, WC.rules, WC.deduction, _, policeOptions);
	const policeRandom = seededRandom(seed + 1000);
	const traces = [];
	const game = WC.engine.create({
		ai: Object.assign({}, ai, {
			wantsToWait(view) {
				// What Jack is told the police could do with each Wretched is exactly what the rules let them do
				view.wretched.forEach((w) => assert.deepStrictEqual(view.wretchedMoves(w), WC.rules.wretchedMoves(game.state, w)));
				const wait = ai.wantsToWait(view);
				traces.push(Object.assign({}, ai.debug.waiting));
				return wait;
			}
		})
	});
	game.start();
	for (let actions = 0; !game.state.over && actions < 20000; actions++) {
		police.turn(game, WC.rules.policeView(game.state), policeRandom);
	}
	return { state: game.state, traces };
}

const games = [11, 12, 13].map((seed) => play(seed, WC.policeVariants.v3));

test('whole games finish, and every choice to wait or kill leaves a trace of why', () => {
	for (const { state, traces } of games) {
		assert.ok(state.over);
		assert.ok(traces.length >= state.jack.filter((n) => n.murder.length > 0).length, 'a decision before every murder');
		for (const t of traces) {
			assert.ok(['wait', 'kill'].includes(t.decision));
			assert.strictEqual(t.decision === 'wait', t.waitAtWorst > t.killNow);
		}
	}
	// He neither always waits nor never does, over these games
	const decisions = _.countBy(games.flatMap((g) => g.traces), 'decision');
	assert.ok(decisions.wait > 0 && decisions.kill > 0, JSON.stringify(decisions));
});

test('the same seed plays the same game', () => {
	const again = play(11, WC.policeVariants.v3);
	assert.deepStrictEqual(again.traces, games[0].traces);
	assert.deepStrictEqual(again.state.result, games[0].state.result);
});

test('no player\'s difficulty level plays the waiting policy; only Developer Mode\'s experimental level does', () => {
	for (const level of WC.difficulty.levels) {
		const ai = level.create(WC);
		assert.strictEqual(!!ai.waitingOptions, level.id === 'hard-waiting', level.id);
		if (level.player) assert.ok(!ai.waitingOptions, level.id);
	}
});
