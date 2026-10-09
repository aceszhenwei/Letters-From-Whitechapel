// Jack AI v2 (js/ai/jack-v2.js): the strategic Jack plus early detours on every night but the last. Checked over whole
// seeded games against Detective AI v2 and the original police, and in positions set up by hand.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadCore, nightState } = require('../helpers/core');
const { seededRandom } = require('../helpers/game');

const core = loadCore({ seed: 1 });
const { WC, _ } = core;

const jackV2 = (seed, options, deduction) => WC.createJackV2(WC.board, deduction || WC.deduction, WC.random.create(seededRandom(seed)), _, options);

// Plays a game against a police configuration; records every decision with what Jack saw
function play(seed, policeOptions) {
	const ai = jackV2(seed);
	const police = WC.createPolice(WC.board, WC.rules, WC.deduction, _, policeOptions);
	const policeRandom = seededRandom(seed + 1000);
	const decisions = [];
	const game = WC.engine.create({
		ai: Object.assign({}, ai, {
			chooseMove(view) {
				const before = { night: view.night, position: view.position, hideout: view.hideout, remaining: view.remainingMoves, movesSoFar: view.route.length - 1, walks: view.walks(), specials: view.specialMoves() };
				const detours = ai.debug.detours;
				const move = ai.chooseMove(view);
				decisions.push(Object.assign(before, { move, detour: ai.debug.detours > detours }));
				return move;
			}
		})
	});
	game.start();
	for (let actions = 0; !game.state.over && actions < 20000; actions++) {
		police.turn(game, WC.rules.policeView(game.state), policeRandom);
	}
	return { seed, state: game.state, decisions, ai };
}

const games = [1, 2, 3].map((seed) => play(seed, WC.policeVariants.v2)).concat([4, 5].map((seed) => play(seed, WC.policeVariants.original)));

test('games finish, and every move is one the rules allow, special movements included', () => {
	for (const game of games) {
		assert.ok(game.state.over, 'seed ' + game.seed);
		for (const d of game.decisions) {
			if (d.move.type === 'walk') assert.ok(d.walks.includes(d.move.mapid), `seed ${game.seed}: walk to ${d.move.mapid}`);
			else assert.ok(d.specials.some((o) => o.mapid === d.move.mapid && o.type === d.move.type), `seed ${game.seed}: ${d.move.type} to ${d.move.mapid}`);
		}
	}
});

test('detours: walks away from home, early in a night, never on the last night, and only with moves to spare', () => {
	let detours = 0;
	for (const game of games) {
		for (const d of game.decisions.filter((x) => x.detour)) {
			detours++;
			assert.strictEqual(d.move.type, 'walk');
			assert.ok(WC.board.distance(d.move.mapid, d.hideout) > WC.board.distance(d.position, d.hideout), 'away from home');
			assert.ok(d.night < WC.rules.config.nights - 1, 'not on the last night');
			assert.ok(d.movesSoFar <= 3, 'in the first moves of the night');
			// After the detour he still has 6 moves to spare: he can get home on the empty board
			assert.ok(d.remaining - 1 - WC.board.distance(d.move.mapid, d.hideout) >= 5, `seed ${game.seed}: keeps a reserve`);
		}
	}
	assert.ok(detours > 5, 'the games include detours');
	// Each night starts again: every night he reached with time to spare (but the last) began with a detour
	const nights = _.groupBy(games.flatMap((g) => g.decisions.map((d) => Object.assign({ seed: g.seed }, d))), (d) => d.seed + ':' + d.night);
	for (const moves of Object.values(nights)) {
		const first = moves[0];
		const roomy = first.remaining - WC.board.distance(first.position, first.hideout) - 2 >= 6;
		const away = first.walks.some((w) => w !== first.hideout && WC.board.distance(w, first.hideout) > WC.board.distance(first.position, first.hideout));
		if (first.night < 3 && roomy && away) assert.ok(first.detour, `seed ${first.seed}, night ${first.night + 1}`);
	}
});

test('the same seed plays the same game', () => {
	const again = play(1, WC.policeVariants.v2);
	assert.deepStrictEqual(again.decisions.map((d) => d.move), games[0].decisions.map((d) => d.move));
	assert.deepStrictEqual(again.state.result, games[0].state.result);
});

/* Positions set up by hand */
function position({ night = 0, base, from, police = [], remaining, carriages = 0, alleys = 0 }) {
	const state = nightState(WC, { base, from, police, remaining, carriages, alleys });
	state.police[0].log = [{ type: 'crime', scenes: [from] }];
	for (let k = 0; k < night; k++) { // Earlier nights, with nothing learnt from them
		state.jack.unshift({ route: [from], moves: [], murder: [from], murderMove: [5], carriages: 0, alleys: 0 });
		state.police.unshift({ fake: [], start: [], revealed: [], route: [], now: [], search: [], arrest: [], clue: [], log: [] });
	}
	return state;
}
const base = WC.rules.hideoutChoices()[0];
const from = _.find(_.range(1, 196), (id) => WC.board.distance(id, base) === 4 && WC.board.walk(id, []).some((w) => WC.board.distance(w, base) === 5));

function decide(state, options, seed = 9) {
	const ai = jackV2(seed, options);
	ai.chooseHideout([state.base]);
	return { move: ai.chooseMove(WC.rules.jackView(state)), ai };
}
function strategicDecides(state, seed = 9) {
	const ai = WC.createStrategicJack(WC.board, WC.deduction, WC.random.create(seededRandom(seed)), _);
	ai.chooseHideout([state.base]);
	return ai.chooseMove(WC.rules.jackView(state));
}

test('with time to spare on an early night, he walks away from home', () => {
	const { move, ai } = decide(position({ base, from, remaining: 15 }));
	assert.strictEqual(ai.debug.detours, 1);
	assert.strictEqual(WC.board.distance(move.mapid, base), 5);
});

test('on the last night, he plays exactly as the strategic Jack', () => {
	const state = position({ night: 3, base, from, remaining: 15 });
	assert.strictEqual(WC.rules.jackView(state).night, 3);
	const { move, ai } = decide(state);
	assert.strictEqual(ai.debug.detours, 0);
	assert.deepStrictEqual(move, strategicDecides(state));
});

test('deception never costs his way home: with too few moves to spare he does not detour', () => {
	// 4 from home: 11 moves leave 7 to spare, 5 after a detour, which is below the reserve of 6
	for (const remaining of [4, 6, 11]) {
		const state = position({ base, from, remaining });
		const { move, ai } = decide(state);
		assert.strictEqual(ai.debug.detours, 0, `remaining ${remaining}`);
		assert.deepStrictEqual(move, strategicDecides(state));
	}
	// With exactly enough (12: 8 to spare, 6 after the detour) he does
	assert.strictEqual(decide(position({ base, from, remaining: 12 })).ai.debug.detours, 1);
});

test('a policeman blocking every walk away: he does not detour, and moves as the strategic Jack', () => {
	// Policemen on every crossing next to his circle: no walk at all, so the detour rule has nothing to offer
	const crossings = WC.board.neighbours(from).filter((id) => !WC.board.isNumbered(id));
	const state = position({ base, from, police: crossings, remaining: 15, carriages: 1, alleys: 1 });
	assert.strictEqual(WC.rules.jackView(state).walks().length, 0);
	const { move, ai } = decide(state);
	assert.strictEqual(ai.debug.detours, 0);
	assert.ok(WC.rules.isLegalJackMove(state, move), JSON.stringify(move));
});

test('if the strategic planner fails, he still makes a legal move', () => {
	const broken = Object.assign({}, WC.deduction, { track() { throw new Error('planner failure'); } });
	for (const remaining of [5, 15]) {
		const state = position({ night: 3, base, from, remaining });
		const ai = jackV2(9, {}, broken);
		ai.chooseHideout([state.base]);
		const move = ai.chooseMove(WC.rules.jackView(state));
		assert.strictEqual(ai.debug.fallbacks, 1);
		assert.ok(WC.rules.isLegalJackMove(state, move), JSON.stringify(move));
	}
	// Walled in with only a coach: the fallback takes the special movement
	const crossings = WC.board.neighbours(from).filter((id) => !WC.board.isNumbered(id));
	const state = position({ night: 3, base, from, police: crossings, remaining: 6, carriages: 1 });
	const ai = jackV2(9, {}, broken);
	ai.chooseHideout([state.base]);
	const move = ai.chooseMove(WC.rules.jackView(state));
	assert.strictEqual(move.type, 'carriage');
	assert.ok(WC.rules.isLegalJackMove(state, move), JSON.stringify(move));
});

/* What Jack knows */
test('Jack AI v2 only reads his view, and never changes the game', () => {
	const state = position({ base, from, remaining: 15, carriages: 2, alleys: 1 });
	for (const remaining of [15, 6]) {
		state.remainingMoves = remaining;
		const ai = jackV2(5);
		ai.chooseHideout([state.base]);
		const allowed = Object.keys(WC.rules.jackView(state));
		const used = new Set();
		const view = new Proxy(WC.rules.jackView(state), { get: (target, key) => { used.add(key); return target[key]; } });
		const before = JSON.stringify(state);
		ai.chooseMove(view);
		assert.strictEqual(JSON.stringify(state), before);
		assert.ok([...used].every((key) => allowed.includes(key)), `used ${[...used]}`);
	}
	const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'ai', 'jack-v2.js'), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	assert.ok(!/\$\(|jQuery|document|window|WC\.engine|WC\.ui|\.state\b|\.base\b|policeView|publicLog/.test(source));
});
