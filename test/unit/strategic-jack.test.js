// The strategic Jack (js/ai/strategic-jack.js): properties that must hold in every position, checked over whole
// seeded games against the deductive police, and in positions set up by hand.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadCore, nightState } = require('../helpers/core');
const { seededRandom } = require('../helpers/game');

const core = loadCore({ seed: 1 });
const { WC, _ } = core;

function strategicJack(seed, options) {
	return WC.createStrategicJack(WC.board, WC.deduction, WC.random.create(seededRandom(seed)), _, options);
}

// Plays a game, strategic Jack against the deductive police; onMove(view, move, state) sees every decision
function play(seed, onMove) {
	const ai = strategicJack(seed);
	const police = WC.createPolice(WC.board, WC.rules, WC.deduction, _);
	const policeRandom = seededRandom(seed + 1000);
	const moves = [];
	const game = WC.engine.create({
		ai: Object.assign({}, ai, {
			chooseMove(view) {
				const move = ai.chooseMove(view);
				moves.push(move);
				if (onMove) onMove(view, move, game.state);
				return move;
			}
		})
	});
	game.start();
	for (let actions = 0; !game.state.over && actions < 20000; actions++) {
		police.turn(game, WC.rules.policeView(game.state), policeRandom);
	}
	return { state: game.state, moves };
}

const seeds = [1, 2, 3, 4, 5, 6];
const games = seeds.map((seed) => {
	const decisions = [];
	const result = play(seed, (view, move) => decisions.push({
		move,
		position: view.position,
		hideout: view.hideout,
		remaining: view.remainingMoves,
		tokens: Object.assign({}, view.tokens),
		walks: view.walks(),
		specials: view.specialMoves()
	}));
	return Object.assign(result, { seed, decisions });
});

test('games finish, and every move is one the rules allow', () => {
	for (const game of games) {
		assert.ok(game.state.over, 'seed ' + game.seed);
		for (const d of game.decisions) {
			const { move } = d;
			if (move.type === 'walk') {
				assert.ok(d.walks.includes(move.mapid), `seed ${game.seed}: walk to ${move.mapid}`);
			} else {
				assert.ok(d.specials.some((o) => o.mapid === move.mapid && o.type === move.type), `seed ${game.seed}: ${move.type} to ${move.mapid}`);
			}
			if (move.type === 'carriage') { // A real coach route: two steps through the stop he names
				assert.ok(WC.board.walk(d.position, []).includes(move.via) && WC.board.walk(move.via, []).includes(move.mapid));
			}
		}
	}
});

test('he never uses a coach or alley he doesn\'t have, or more moves than are left', () => {
	for (const game of games) {
		for (const d of game.decisions) {
			if (d.move.type === 'carriage') assert.ok(d.tokens.carriages > 0 && d.remaining >= 2);
			if (d.move.type === 'alley') assert.ok(d.tokens.alleys > 0);
			assert.ok(WC.rules.moveCost(d.move) <= d.remaining);
		}
	}
});

test('with few moves left, he goes home when he can', () => {
	for (const game of games) {
		for (const d of game.decisions) {
			if (d.walks.includes(d.hideout) && d.remaining <= 3) {
				assert.strictEqual(d.move.mapid, d.hideout, `seed ${game.seed}`);
			}
		}
	}
	// And in a position set up for it, next to home with a policeman nearby and coaches to spare
	const base = WC.rules.hideoutChoices()[0];
	const from = WC.board.walk(base, [])[0];
	for (const remaining of [1, 2, 3]) {
		const station = WC.board.neighbours(from).find((id) => !WC.board.isNumbered(id) && WC.board.walk(from, [id]).includes(base));
		const move = decide(position({ base, from, police: station ? [station] : [], remaining, carriages: 2, alleys: 1 }));
		assert.deepStrictEqual([move.mapid, move.type], [base, 'walk'], `${remaining} moves left`);
	}
});

test('the same seed plays the same game', () => {
	const again = play(seeds[0]);
	assert.deepStrictEqual(again.moves, games[0].moves);
	assert.deepStrictEqual(again.state.result, games[0].state.result);
});

// A night set up by hand: Jack at `from` just after the crime, the police seen at `police`
function position({ base, from, police, remaining, carriages = 0, alleys = 0 }) {
	const state = nightState(WC, { base, from, police, remaining, carriages, alleys });
	state.police[0].log = [{ type: 'crime', scenes: [from] }];
	return state;
}

function decide(state, options) {
	const ai = strategicJack(9, options);
	ai.chooseHideout([state.base]);
	return ai.chooseMove(WC.rules.jackView(state));
}

test('when time is short, he takes a move that still gets him home', () => {
	// Jack exactly as many moves from home as he has left: only moves towards home keep him in time
	const base = WC.rules.hideoutChoices()[0];
	const from = _.find(_.range(1, 196), (id) => WC.board.distance(id, base) === 4);
	const move = decide(position({ base, from, police: [], remaining: 4 }));
	assert.strictEqual(WC.board.distance(move.mapid, base), 3);
});

test('between two equally good walks, he avoids the one a policeman could reach', () => {
	// Find a circle with two walks that bring Jack equally close to home, and a crossing that puts a policeman next
	// to one of them but out of reach of the other
	let scenario = null;
	for (const base of WC.rules.hideoutChoices()) {
		for (let from = 1; from < 196 && !scenario; from++) {
			if (from === base || WC.board.distance(from, base) < 4) continue;
			const closer = WC.board.walk(from, []).filter((id) => id !== base && WC.board.distance(id, base) === WC.board.distance(from, base) - 1);
			if (closer.length < 2) continue;
			const [risky, safe] = closer;
			const station = _.find(WC.board.neighbours(risky), (id) => !WC.board.isNumbered(id) &&
				!WC.board.crossingsWithinTwo(id).concat([id]).some((c) => WC.board.adjacentNumbers(c).includes(safe)) &&
				WC.board.walk(from, [id]).includes(risky) && WC.board.walk(from, [id]).includes(safe));
			if (station) scenario = { base, from, risky, safe, station };
		}
		if (scenario) break;
	}
	assert.ok(scenario, 'a position to test');
	const { base, from, safe, station } = scenario;
	const move = decide(position({ base, from, police: [station], remaining: WC.board.distance(from, base) + 4 }));
	assert.strictEqual(move.mapid, safe, JSON.stringify(scenario));
});

test('when a walk does as well, he keeps his coaches and alleys', () => {
	// No police and time to spare: every move is equally safe, so there is no reason to spend a token
	const base = WC.rules.hideoutChoices()[0];
	const from = _.find(_.range(1, 196), (id) => WC.board.distance(id, base) === 3 && WC.board.alleys(id).length > 0);
	const move = decide(position({ base, from, police: [], remaining: 15, carriages: 3, alleys: 2 }));
	assert.strictEqual(move.type, 'walk');
});

/* What Jack knows
   --------------- */
test('the strategic AI only reads the view, and never changes the game', () => {
	const { WC: W, _: u } = loadCore({ seed: 5 });
	const ai = W.createStrategicJack(W.board, W.deduction, W.random.create(seededRandom(5)), u);
	const state = nightState(W, { base: W.rules.hideoutChoices()[0], from: 50, police: [], remaining: 10, carriages: 2, alleys: 1 });
	state.police[0].log = [{ type: 'crime', scenes: [50] }];
	ai.chooseHideout([state.base]);
	const allowed = Object.keys(W.rules.jackView(state));
	const used = new Set();
	const view = new Proxy(W.rules.jackView(state), { get: (target, key) => { used.add(key); return target[key]; } });
	const before = JSON.stringify(state);
	ai.chooseMove(view);
	assert.strictEqual(JSON.stringify(state), before);
	assert.ok([...used].every((key) => allowed.includes(key)), `used ${[...used]}`);
});

test('what the police can deduce comes from the public record alone', () => {
	// Two games' states differing only in Jack's hidden route give the same police view and the same deduction
	const game = games[1];
	const view = WC.rules.policeView(game.state);
	const text = JSON.stringify(Object.assign({}, view, { log: view.publicLog(), past: view.pastLogs() }));
	assert.ok(!('route' in view) && !('position' in view) && !('hideout' in view), 'no Jack sheet in the police view');
	assert.ok(!/"base"|"via"|"murderMove"|"hideout"|"carriages":\[/.test(text), 'nothing hidden in the police view');
	const hidden = JSON.parse(JSON.stringify(game.state));
	hidden.jack.forEach((night) => { night.route = night.route.map(() => 1); });
	hidden.base = 1;
	const log = (state) => WC.rules.publicLog(state, state.police.length - 1);
	assert.deepStrictEqual(log(hidden), log(game.state));
	assert.deepStrictEqual(WC.deduction.track(log(hidden), {}).current, WC.deduction.track(log(game.state), {}).current);
});

test('the deduction never rules out where Jack really is', () => {
	for (const game of games) {
		const state = game.state;
		state.police.forEach((night, index) => {
			const known = WC.deduction.track(WC.rules.publicLog(state, index), {});
			const route = state.jack[index] && state.jack[index].route;
			if (known && route && route.length) {
				assert.ok(known.current[_.last(route)] > 0, `seed ${game.seed}, night ${index + 1}`);
			}
		});
	}
});

test('the AI modules never touch the page, the engine or the game state', () => {
	for (const file of ['strategic-jack.js', 'police.js']) {
		const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'ai', file), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
		assert.ok(!/\$\(|jQuery|document|window|WC\.engine|WC\.ui|\.state\b|\.base\b|\.route\b/.test(source.replace(/game\.\w+\(/g, '')), file);
	}
	const deduction = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'core', 'deduction.js'), 'utf8')
		.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
	assert.ok(!/state|WC\.rules|WC\.engine/.test(deduction), 'the deduction reads only the record');
});
