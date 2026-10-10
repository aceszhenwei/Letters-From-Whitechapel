// Study J3's research Jacks and detectives (research/jack-adaptive/, docs/jack-adaptive.md): the fixed extents replay
// the existing Jacks exactly, the detour-aware police are Detective AI v2 when they forgive nothing, the pressure
// signal reads only Jack's view, the last night never deceives, and the adaptive choice follows the pressure.
const test = require('node:test');
const assert = require('node:assert');
const { WC, _, seeded } = require('../../research/detective-inference/lib');
const jacks = require('../../research/jack-adaptive/jacks');
const police = require('../../research/jack-adaptive/police');

function play(jack, makePolice, seed) {
	const ai = typeof jack === 'string' ? jacks.policies[jack](seed) : jack;
	const p = makePolice();
	const random = seeded(seed * 104729 + 2);
	const game = WC.engine.create({ ai });
	game.start();
	for (let i = 0; i < 20000 && !game.state.over; i++) p.turn(game, WC.rules.policeView(game.state), random);
	return { game, ai, trace: JSON.stringify([game.state.result, game.state.jack.map((n) => n.route)]) };
}
const v2 = () => WC.createPolice(WC.board, WC.rules, WC.deduction, _, WC.policeVariants.v2);

test('the fixed extents replay the existing Jacks exactly: v2 is Jack AI v2, none is Strategic Jack', () => {
	for (const seed of [31, 32]) {
		assert.strictEqual(play('fixed-v2', v2, seed).trace, play('jack-v2', v2, seed).trace);
		assert.strictEqual(play('fixed-none', v2, seed).trace, play('strategic', v2, seed).trace);
	}
});

test('detour-aware police that forgive nothing are Detective AI v2; forgiving moves changes the weights', () => {
	assert.strictEqual(play('jack-v2', () => WC.createPolice(WC.board, WC.rules, police.detourAware(0), _, WC.policeVariants.v2), 33).trace, play('jack-v2', v2, 33).trace);
	const { game } = play('jack-v2', v2, 33);
	const logs = game.state.police.map((n, i) => WC.rules.publicLog(game.state, i)).filter((log) => log.some((e) => e.type === 'escaped'));
	const options = { weighting: 'hybrid', w: 0.9, rho: 0.5 };
	const plain = WC.deduction.hideouts(logs, WC.rules.hideoutChoices(), options);
	const forgiving = police.detourAware(8).hideouts(logs, WC.rules.hideoutChoices(), options);
	assert.deepStrictEqual(Object.keys(forgiving).sort(), Object.keys(plain).sort(), 'the same candidate set');
	assert.ok(Math.abs(_.reduce(forgiving, (s, x) => s + x, 0) - 1) < 1e-9);
	assert.notDeepStrictEqual(forgiving, plain);
});

test('a candidate never deceives on the last night, and the adaptive choice follows the pressure', () => {
	const { ai } = play('adaptive', v2, 34);
	const nights = ai.debug.nights;
	assert.ok(nights.length >= 1);
	assert.strictEqual(nights[0].mode, 'v2', 'night 1, with nothing observed: Jack AI v2\'s detours');
	for (const n of nights) {
		if (n.night === 3) assert.deepStrictEqual([n.mode, n.detours], ['none', 0]);
		if (n.night > 0 && n.night < 3) {
			const expected = n.pressure >= jacks.defaults.high ? 'long' : n.pressure <= jacks.defaults.low ? 'none' : 'v2';
			assert.strictEqual(n.mode, expected);
		}
	}
});

test('the pressure reads only Jack\'s view, and the mixed control ignores the police', () => {
	const { game } = play('jack-v2', v2, 35);
	// A view whose every read is recorded: pressure may use only the public record and his own hideout
	const view = WC.rules.jackView(game.state);
	const used = new Set();
	const watched = new Proxy(view, { get: (t, k) => { used.add(k); return t[k]; } });
	const p = jacks.pressure(watched);
	assert.ok(p === null || (p >= -1 && p <= 1));
	assert.deepStrictEqual([...used].sort(), ['hideout', 'pastLogs']);
	// The mixed control's choices come from its own stream: the same seed chooses the same extents, whatever the police
	const a = play('mixed', v2, 36).ai.debug.nights.map((n) => n.mode);
	const b = play('mixed', () => WC.createPolice(WC.board, WC.rules, WC.deduction, _, {}), 36).ai.debug.nights.map((n) => n.mode);
	const k = Math.min(a.length, b.length) - 1; // The last night played may differ in length of game
	assert.deepStrictEqual(a.slice(0, Math.min(k, 3)), b.slice(0, Math.min(k, 3)));
});
