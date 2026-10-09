// Undoing a policeman's move, the end-of-night review, and the public night records (js/core/engine.js settings,
// rules.nightRecord), without a page. The interface turns the settings on; simulations and computer police leave them off.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore } = require('../helpers/core');
const { seededRandom } = require('../helpers/game');

const core = loadCore({ seed: 1 });
const { WC, _ } = core;
const { rules } = WC;

function newGame(seed, settings) {
	const ai = WC.createJackAI(WC.board, WC.random.create(seededRandom(seed)), _);
	return WC.engine.create(Object.assign({ ai }, settings));
}

// One simple police action (first legal choices), including the steps the settings add
function act(game) {
	const s = game.state;
	if (s.phase === 2) {
		const p = rules.patrolPositions(s);
		const night = rules.policeNight(s);
		const spots = p.required.concat(p.all.filter((c) => !p.required.includes(c)).slice(0, p.others));
		const next = spots.find((c) => !night.start.includes(c) && !night.fake.includes(c));
		return game.togglePatrol(next, night.start.length < rules.config.police ? 'real' : 'fake');
	}
	if (s.phase === 5) {
		const from = s.womenMarked[s.turn.pending[0]];
		const moves = rules.wretchedMoves(s, from);
		return moves.length ? game.moveWretched(from, moves[0]) : game.keepWretched(from);
	}
	if (s.phase === 10) {
		const now = rules.policeNight(s).now;
		const index = now.findIndex((c, i) => !s.turn.moved.includes(i));
		return index === -1 ? game.finishPoliceMoves() : game.movePoliceman(index, now[index]);
	}
	if (s.phase === 11) {
		const night = rules.policeNight(s);
		const index = night.now.findIndex((c, i) => !s.turn.done.includes(i) && (night.search[i].length || night.arrest[i].length));
		if (!s.turn.choice[index]) game.chooseAction(index, night.search[index].length ? 'search' : 'arrest');
		return s.turn.choice[index] === 'search' ? game.search(index, night.search[index].find((c) => c !== undefined)) : game.arrest(index, night.arrest[index][0]);
	}
	if (s.phase === 12) return game.beginNextNight();
	return false;
}

function playUntil(game, done) {
	for (let i = 0; i < 20000 && !game.state.over && !done(game.state); i++) act(game);
	return done(game.state);
}

const atHunt = (seed) => {
	const game = newGame(seed, { confirmPoliceMoves: true, reviewNights: true });
	game.start();
	assert.ok(playUntil(game, (s) => s.phase === 10));
	return game;
};

test('undo puts the policeman back, with his route and his turn as they were', () => {
	const game = atHunt(3);
	const police = rules.policeNight(game.state);
	const before = JSON.stringify([police.now, police.route, game.state.turn.moved]);
	const to = rules.policeDestinations(game.state, 0)[0];
	assert.strictEqual(game.canUndoPoliceMove(), false, 'nothing to undo yet');
	assert.ok(game.movePoliceman(0, to));
	assert.strictEqual(police.now[0], to);
	assert.ok(!game.movePoliceman(0, police.route[0][0]), 'he has moved this turn');
	assert.ok(game.canUndoPoliceMove());
	assert.ok(game.undoPoliceMove());
	assert.strictEqual(JSON.stringify([police.now, police.route, game.state.turn.moved]), before);
	assert.strictEqual(game.canUndoPoliceMove(), false);
	assert.ok(game.movePoliceman(0, to), 'and he can move again');
});

test('several policemen: moves are undone newest first, so a crossing one left is free again for him', () => {
	// Two policemen near each other: the first moves away, the second onto the crossing he left
	const { nightState } = require('../helpers/core');
	const a = WC.board.stations()[0];
	const b = WC.board.crossingsWithinTwo(a).find((c) => c !== a && WC.board.crossingsWithinTwo(c).length > 2);
	const game = newGame(1, { confirmPoliceMoves: true });
	game.state = nightState(WC, { base: WC.rules.hideoutChoices()[0], from: WC.board.numbered()[0], police: [a, b] });
	game.state.phase = 10;
	game.state.turn = { moved: [], history: [] };
	const away = rules.policeDestinations(game.state, 0).find((c) => c !== b);
	assert.ok(game.movePoliceman(0, away));
	assert.ok(rules.policeDestinations(game.state, 1).includes(a), 'the crossing he left is free');
	assert.ok(game.movePoliceman(1, a));
	assert.ok(game.undoPoliceMove());
	assert.deepStrictEqual(Array.from(rules.policeNight(game.state).now), [away, b], 'the last move is undone first');
	assert.ok(game.undoPoliceMove());
	assert.deepStrictEqual(Array.from(rules.policeNight(game.state).now), [a, b]);
	assert.deepStrictEqual(Array.from(game.state.turn.moved), []);
	assert.strictEqual(game.undoPoliceMove(), false, 'nothing left to undo');
});

test('Done ends Hunting the monster only when everyone has moved, and nothing can be undone after it', () => {
	const game = atHunt(7);
	const police = rules.policeNight(game.state);
	assert.strictEqual(game.finishPoliceMoves(), false, 'not everyone has moved');
	police.now.forEach((c, i) => assert.ok(game.movePoliceman(i, c)));
	assert.strictEqual(game.state.phase, 10, 'with the setting, the phase waits for Done');
	assert.ok(game.canUndoPoliceMove(), 'the last move can still be undone');
	const log = rules.publicLog(game.state, game.state.police.length - 1).length;
	assert.ok(game.undoPoliceMove());
	assert.strictEqual(rules.publicLog(game.state, game.state.police.length - 1).length, log, 'moving and undoing record nothing');
	assert.ok(game.movePoliceman(police.now.length - 1, police.now[police.now.length - 1]));
	assert.ok(game.finishPoliceMoves());
	assert.strictEqual(game.state.phase, 11);
	assert.strictEqual(game.canUndoPoliceMove(), false, 'searches can reveal clues: the moves now stand');
	assert.strictEqual(game.undoPoliceMove(), false);
	assert.strictEqual(game.finishPoliceMoves(), false);
});

test('without the settings (computer police, simulations), the last move ends the phase at once and a night follows the last', () => {
	const game = newGame(7);
	game.start();
	assert.ok(playUntil(game, (s) => s.phase === 10));
	rules.policeNight(game.state).now.forEach((c, i) => game.movePoliceman(i, c));
	assert.notStrictEqual(game.state.phase, 10);
	// The computer police play whole games exactly as before: no phase 12 ever
	const auto = WC.engine.create({ ai: WC.createJackAI(WC.board, WC.random.create(seededRandom(8)), _) });
	const police = WC.createPolice(WC.board, rules, WC.deduction, _, WC.policeVariants.v3);
	const random = seededRandom(9);
	const phases = new Set();
	auto.on((type, data) => { if (type === 'phase') phases.add(data.phase); });
	auto.start();
	for (let i = 0; i < 20000 && !auto.state.over; i++) police.turn(auto, rules.policeView(auto.state), random);
	assert.ok(auto.state.over);
	assert.ok(!phases.has(12));
});

test('the night review: after Jack escapes the game waits, and only beginNextNight goes on', () => {
	const game = newGame(11, { confirmPoliceMoves: true, reviewNights: true });
	const events = [];
	game.on((type, data) => events.push([type, data]));
	game.start();
	assert.ok(playUntil(game, (s) => s.phase === 12));
	assert.strictEqual(game.state.jack.length, 1, 'still the first night');
	assert.ok(events.some(([type, data]) => type === 'nightOver' && data.night === 0));
	assert.ok(!game.undoPoliceMove() && !game.finishPoliceMoves(), 'no police action does anything');
	assert.ok(game.beginNextNight());
	assert.strictEqual(game.state.jack.length, 2);
	assert.strictEqual(game.beginNextNight(), false, 'only at the end of a night');
});

test('four nights: the game ends on the last escape (no review step), with a record for every night', () => {
	for (const seed of [21, 22, 23]) {
		const game = newGame(seed, { confirmPoliceMoves: true, reviewNights: true });
		const reviews = [];
		game.on((type, data) => { if (type === 'nightOver') reviews.push(data.night); });
		game.start();
		playUntil(game, () => false);
		assert.ok(game.state.over, `seed ${seed}`);
		const nights = game.state.jack.length;
		assert.deepStrictEqual(reviews, Array.from(_.range(nights - 1)), 'every night but the one the game ended on was reviewed');
		if (game.state.result.type === 'jackWins') assert.strictEqual(nights, 4);
		_.range(nights).forEach((n) => assert.ok(rules.nightRecord(game.state, n)));
	}
});

test('night records: frozen copies of what the police saw, unchanged by later nights, and nothing of Jack\'s secrets', () => {
	const game = newGame(31, { confirmPoliceMoves: true, reviewNights: true });
	const kept = [];
	game.on((type, data) => { if (type === 'nightOver') kept.push(rules.nightRecord(game.state, data.night)); });
	game.start();
	playUntil(game, () => false);
	assert.ok(kept.length >= 1, 'at least one night was reviewed');
	kept.forEach((record, n) => {
		// Frozen all the way down
		const frozen = (value) => !value || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(frozen));
		assert.ok(frozen(record));
		assert.throws(() => { 'use strict'; record.log.push({}); });
		// What was kept when the night ended is what the record says at the end of the game: later nights change nothing
		assert.deepStrictEqual(JSON.parse(JSON.stringify(record)), JSON.parse(JSON.stringify(rules.nightRecord(game.state, n))));
		// Only public facts: no hideout or route, and every circle named was a crime scene, searched, or an arrest
		assert.deepStrictEqual(Object.keys(record).sort(), ['clues', 'crimeScenes', 'earlierCrimeScenes', 'escaped', 'log', 'murderMove', 'night', 'patrols', 'policeRoutes'].sort());
		const text = JSON.stringify(record);
		assert.ok(!/"base"|"route"|"moves"|"position"/.test(text));
		const circles = new Set(record.crimeScenes.concat(record.earlierCrimeScenes));
		record.log.forEach((e) => { if (e.mapid !== undefined) circles.add(e.mapid); });
		record.clues.forEach((c) => assert.ok(record.log.some((e) => e.type === 'search' && e.mapid === c && e.clue), 'a clue was found by a search'));
		assert.ok(record.log.filter((e) => e.type === 'move').every((e) => Object.keys(e).sort().join() === 'move,police,type'), 'moves say only their kind and where the policemen stood');
		assert.ok([...circles].every((c) => WC.board.isNumbered(c)));
	});
});
