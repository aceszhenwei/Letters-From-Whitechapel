// The rules on their own: questions about a state, answered without changing it.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore, nightState, crossingsAround } = require('../helpers/core');

const { WC, map } = loadCore();
const { board, rules } = WC;
const ids = board.numbered();

test('move-track spaces and their labels', () => {
	assert.deepStrictEqual([1, 2, 3, 4, 5].map(rules.timeOfCrimeSpace), [5, 4, 3, 2, 1]);
	assert.deepStrictEqual([1, 5, 6, 20].map(rules.trackLabel), ['V', 'I', '1', '15']);
});

test('patrol placement: five real, two fake, and switching a crossing between them', () => {
	const state = WC.engine.createState();
	state.jack.push({});
	state.police.push({ start: [], fake: [], revealed: [], now: [], route: [], clue: [] });
	const stations = board.stations();
	const police = rules.policeNight(state);
	stations.slice(0, 5).forEach((id) => { assert.ok(rules.canPlacePatrol(state, id, 'real')); police.start.push(id); });
	assert.strictEqual(rules.canPlacePatrol(state, stations[5], 'real'), false, 'only five real patrols');
	assert.ok(rules.canPlacePatrol(state, stations[0], 'fake'), 'a real patrol can be switched to fake');
	assert.strictEqual(rules.canPlacePatrol(state, ids[0], 'fake'), false, 'only on patrol crossings');
});

test('Jack\'s moves: walking, coaches by any route, alleys, and escaping', () => {
	const from = ids.find((id) => map[id].alley.length > 0 && board.walk(id, []).length >= 2);
	const base = board.walk(from, [])[0];
	const state = nightState(WC, { base, from, carriages: 1, alleys: 0, remaining: 5 });
	const via = board.walk(from, [])[1];
	const to = board.walk(via, []).find((id) => id !== from);
	assert.ok(rules.isLegalJackMove(state, { mapid: to, via, type: 'carriage' }), 'any coach route');
	assert.ok(!rules.isLegalJackMove(state, { mapid: from, via, type: 'carriage' }), 'not back to the start');
	assert.ok(!rules.isLegalJackMove(state, { mapid: map[from].alley[0], type: 'alley' }), 'no alleys left');
	assert.ok(rules.escapes(state, { mapid: base, type: 'walk' }));
	assert.ok(!rules.escapes(state, { mapid: base, type: 'alley' }), 'not by a special movement');
	const blocked = nightState(WC, { base, from, police: crossingsAround(WC, from) });
	assert.ok(!rules.isLegalJackMove(blocked, { mapid: base, type: 'walk' }), 'never past a policeman');
});

test('rules only read the state', () => {
	const from = ids[40];
	const police = [26, 132, 241, 344, 39];
	const state = nightState(WC, { base: ids[90], from, police, crimeScenes: [ids[5]] });
	state.womenMarked = [ids[60], ids[61]];
	rules.policeNight(state).fake = [33, 56];
	const before = JSON.stringify(state);
	const queries = [
		() => rules.patrolPositions(state), () => rules.canPlacePatrol(state, 33, 'real'), () => rules.patrolsPlaced(state),
		() => rules.mustKill(state), () => rules.victimsTonight(state), () => rules.patrolTokens(state), () => rules.hiddenPatrols(state),
		() => rules.wretchedMoves(state, ids[60]), () => rules.policeDestinations(state, 0), () => rules.canMovePoliceman(state, 0, 26),
		() => rules.searchable(state, 26), () => rules.jackWalks(state, from), () => rules.jackSpecialMoves(state, from),
		() => rules.jackCanMove(state), () => rules.isLegalJackMove(state, { mapid: ids[41], type: 'walk' }),
		() => rules.policeThreats(state), () => rules.targetCircles(state), () => rules.womenTonight(state),
		() => { const view = rules.jackView(state); view.walks(); view.specialMoves(); view.threats(); view.distanceToHideout(from); }
	];
	queries.forEach((query) => query());
	assert.strictEqual(JSON.stringify(state), before);
});
