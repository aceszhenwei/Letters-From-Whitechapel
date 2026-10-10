// Human Jack in the engine (js/core/engine.js, game.settings.humanJack): the engine waits for each of Jack's decisions,
// takes a legal one exactly once, refuses the rest without changing anything, and plays the same game as the AI path.
// And the information boundary: a computer police player gets only the police's methods and the police view.
const test = require('node:test');
const assert = require('node:assert');
const { loadCore, nightState } = require('../helpers/core');
const { seededRandom } = require('../helpers/game');

const plain = (value) => JSON.parse(JSON.stringify(value));
const last = (array) => array[array.length - 1];

function humanGame(WC, options = {}) {
	const game = WC.engine.create({ humanJack: true });
	const actions = [];
	const events = [];
	game.on((type, data) => {
		events.push(type);
		if (type === 'action') actions.push(plain(data));
	});
	return { game, actions, events };
}

// Random legal police play, through the police's methods only
function policeStep(WC, game, random) {
	WC.randomPolice.turn(game.policeActions(), WC.rules.policeView(game.state), random);
}

// Plays the police until the engine waits for Jack (or the game ends)
function untilJack(WC, game, random) {
	for (let i = 0; i < 500 && !game.state.over && !game.jackTurn(); i++) policeStep(WC, game, random);
}

function unchanged(game, attempt) {
	const before = JSON.stringify(game.state);
	const turn = game.jackTurn();
	const result = attempt();
	assert.strictEqual(result, false);
	assert.strictEqual(JSON.stringify(game.state), before, 'a refused decision changes nothing');
	assert.strictEqual(game.jackTurn(), turn, 'and the engine still waits for the same decision');
}

test('the engine waits for a human Jack\'s hideout, refuses illegal ones, and takes a legal one once', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const { game, actions, events } = humanGame(WC);
	game.start();
	assert.strictEqual(game.jackTurn(), 'hideout');
	assert.ok(events.includes('jackTurn') && events.includes('started'));
	assert.strictEqual(game.state.base, undefined);
	const red = WC.board.redCircles()[0];
	const crossing = WC.board.crossingsWithinTwo(WC.rules.hideoutChoices()[0])[0];
	unchanged(game, () => game.jackHideout(red));
	unchanged(game, () => game.jackHideout(crossing));
	unchanged(game, () => game.jackHideout(undefined));
	unchanged(game, () => game.jackWomen([], []));
	unchanged(game, () => game.jackMove({ type: 'walk', mapid: 1 }));
	const home = WC.rules.hideoutChoices()[10];
	assert.strictEqual(game.jackHideout(home), true);
	assert.strictEqual(game.jackHideout(home), false, 'only once');
	assert.strictEqual(game.state.base, home);
	assert.strictEqual(game.jackTurn(), 'women', 'the first night begins and waits for the women');
	assert.deepStrictEqual(actions.map((a) => a.type), ['hideout']);
});

test('women: the right numbers of marked and unmarked women, on red circles, each once', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const { game } = humanGame(WC);
	game.start();
	game.jackHideout(WC.rules.hideoutChoices()[3]);
	const targets = WC.rules.targetCircles(game.state);
	const { women, marked } = WC.rules.womenTonight(game.state);
	unchanged(game, () => game.jackWomen(targets.slice(0, marked - 1), targets.slice(marked, women)));
	unchanged(game, () => game.jackWomen(targets.slice(0, marked), targets.slice(marked, women - 1)));
	unchanged(game, () => game.jackWomen(targets.slice(0, marked), targets.slice(marked, women).concat([WC.rules.hideoutChoices()[0]])));
	unchanged(game, () => game.jackWomen(targets.slice(0, marked), [targets[0]].concat(targets.slice(marked + 1, women))));
	unchanged(game, () => game.jackWomen([WC.rules.hideoutChoices()[0]].concat(targets.slice(1, marked)), targets.slice(marked, women)));
	unchanged(game, () => game.jackWomen('8,9', []));
	assert.strictEqual(game.jackWomen(targets.slice(0, marked), targets.slice(marked, women)), true);
	assert.strictEqual(game.state.phase, 2, 'the police place their patrols next');
	assert.strictEqual(game.jackTurn(), null);
	assert.strictEqual(game.jackWomen(targets.slice(0, marked), targets.slice(marked, women)), false);
});

test('kill or wait: waiting is refused on V, victims must be the Wretched, and the double event keeps its order', () => {
	const WC = loadCore({ seed: 2 }).WC;
	const random = seededRandom(5);
	const { game, actions } = humanGame(WC);
	game.start();
	game.jackHideout(WC.rules.hideoutChoices()[20]);
	const place = () => {
		const targets = WC.rules.targetCircles(game.state);
		const { women, marked } = WC.rules.womenTonight(game.state);
		const m = Math.min(marked, targets.length);
		assert.ok(game.jackWomen(targets.slice(0, m), targets.slice(m, Math.min(women, targets.length))));
		untilJack(WC, game, random);
	};
	place();
	assert.strictEqual(game.jackTurn(), 'murder');
	// Wait until V: every wait moves the Time of the Crime on, the police move the Wretched, Jack reveals a token
	for (let toc = 1; toc < 5; toc++) {
		assert.strictEqual(game.state.timeOfCrime, toc);
		assert.strictEqual(game.jackWait(), true);
		assert.strictEqual(game.jackWait(), false, 'once');
		untilJack(WC, game, random);
		if (game.jackTurn() === 'reveal') {
			const hidden = WC.rules.hiddenPatrols(game.state);
			unchanged(game, () => game.jackReveal(WC.board.redCircles()[0]));
			assert.strictEqual(game.jackReveal(hidden[0]), true);
			assert.ok(game.state.police[0].revealed.includes(hidden[0]));
		}
		assert.strictEqual(game.jackTurn(), 'murder');
	}
	assert.strictEqual(game.state.timeOfCrime, 5);
	unchanged(game, () => game.jackWait());
	unchanged(game, () => game.jackVictims([WC.rules.hideoutChoices()[0]]));
	unchanged(game, () => game.jackVictims(game.state.womenMarked.slice(0, 2)));
	const victim = game.state.womenMarked[0];
	assert.strictEqual(game.jackVictims([victim]), true);
	assert.deepStrictEqual(plain(game.state.crimeScenes), [victim]);
	assert.strictEqual(game.state.remainingMoves, 20 - 1, 'killing on V leaves 19 moves');
	assert.deepStrictEqual(actions.filter((a) => a.side === 'jack').map((a) => a.type).slice(0, 3), ['hideout', 'women', 'wait']);
});

test('moves: walks can\'t pass a policeman, alleys and coaches need tokens, and only a walk onto the hideout ends the night', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const { game } = humanGame(WC);
	const R = WC.rules;
	// A night set up by hand, at Escape in the night: find a circle with an alley, and a policeman next to it
	const from = WC.board.numbered().find((m) => WC.board.alleys(m).length > 0 && R.jackWalks(nightState(WC, { base: 1, from: m }), m).length > 1);
	const blocker = WC.board.neighbours(from).find((c) => !WC.board.isNumbered(c));
	const blocked = WC.board.walk(from, []).filter((m) => !WC.board.walk(from, [blocker]).includes(m));
	const base = WC.board.walk(from, [blocker])[0];
	game.state = nightState(WC, { base, from, police: [blocker], remaining: 3, carriages: 1, alleys: 1 });
	game.enter(9);
	assert.strictEqual(game.jackTurn(), 'move');
	if (blocked.length) unchanged(game, () => game.jackMove({ type: 'walk', mapid: blocked[0] }));
	unchanged(game, () => game.jackMove({ type: 'teleport', mapid: base }));
	unchanged(game, () => game.jackMove(null));
	unchanged(game, () => game.jackMove({ type: 'carriage', mapid: from, via: WC.board.walk(from, [])[0] }));
	const alley = WC.board.alleys(from).find((m) => m !== base);
	// An alley: uses the alley token, one move
	assert.strictEqual(game.jackMove({ type: 'alley', mapid: alley }), true);
	assert.strictEqual(R.jackNight(game.state).alleys, 0);
	assert.strictEqual(game.state.remainingMoves, 2);
	assert.strictEqual(game.state.phase, 10, 'the police move next');
	assert.strictEqual(game.jackMove({ type: 'walk', mapid: from }), false, 'not Jack\'s turn');
});

test('a coach onto the hideout doesn\'t end the night; a walk onto it does; running out of moves ends the game', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const R = WC.rules;
	const from = WC.board.numbered()[40];
	const via = WC.board.walk(from, [])[0];
	const to = WC.board.walk(via, []).find((m) => m !== from && !WC.board.walk(from, []).includes(m));
	// Coach onto the hideout: the night goes on
	let { game } = humanGame(WC);
	game.state = nightState(WC, { base: to, from, remaining: 4, carriages: 1, alleys: 0 });
	game.enter(9);
	assert.strictEqual(game.jackMove({ type: 'carriage', via, mapid: to }), true);
	assert.strictEqual(R.jackNight(game.state).carriages, 0);
	assert.strictEqual(game.state.remainingMoves, 2);
	assert.ok(!game.state.over && game.state.phase !== 0, 'a coach onto the hideout is not an escape');
	// Too few moves for a coach
	({ game } = humanGame(WC));
	game.state = nightState(WC, { base: to, from, remaining: 1, carriages: 1, alleys: 0 });
	game.enter(9);
	unchanged(game, () => game.jackMove({ type: 'carriage', via, mapid: to }));
	// The last move, not home: out of moves
	const step = WC.board.walk(from, [])[0];
	assert.strictEqual(game.jackMove({ type: 'walk', mapid: step === to ? WC.board.walk(from, [])[1] : step }), true);
	assert.strictEqual(game.state.result.type, 'outOfMoves');
	assert.strictEqual(game.jackTurn(), null, 'nothing is awaited once the game is over');
	// A walk onto the hideout on the last night: Jack wins
	({ game } = humanGame(WC));
	game.state = nightState(WC, { base: via, from, remaining: 2 });
	for (let n = 1; n < 4; n++) {
		game.state.jack.unshift(plain(game.state.jack[0]));
		game.state.police.unshift(plain(game.state.police[0]));
	}
	game.enter(9);
	assert.strictEqual(game.jackMove({ type: 'walk', mapid: via }), true);
	assert.strictEqual(game.state.result.type, 'jackWins');
});

test('trapped: with no legal move, Jack loses before he is asked', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const from = WC.board.numbered().find((m) => WC.board.alleys(m).length === 0);
	const police = WC.board.neighbours(from).filter((c) => !WC.board.isNumbered(c));
	const { game } = humanGame(WC);
	game.state = nightState(WC, { base: WC.board.numbered()[100], from, police, remaining: 1, carriages: 0, alleys: 0 });
	game.enter(9);
	assert.strictEqual(game.state.result.type, 'trapped');
	assert.strictEqual(game.jackTurn(), null);
});

test('an arrest ends the game, and no decision is awaited after it', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const from = WC.board.numbered()[60];
	const crossing = WC.board.neighbours(from).find((c) => !WC.board.isNumbered(c));
	const { game } = humanGame(WC);
	game.state = nightState(WC, { base: WC.board.numbered()[100], from, police: [crossing], remaining: 8 });
	game.enter(11);
	const actions = game.policeActions();
	assert.ok(actions.chooseAction(0, 'arrest'));
	assert.strictEqual(actions.arrest(0, from), 'arrested');
	assert.strictEqual(game.state.result.type, 'arrested');
	assert.strictEqual(game.jackTurn(), null);
	assert.strictEqual(game.jackMove({ type: 'walk', mapid: WC.board.walk(from, [])[0] }), false);
});

test('a human Jack making an AI\'s decisions plays exactly the AI\'s game: the same actions, results and record', () => {
	for (const seed of [3, 11]) {
		// The AI's game: strategic Jack against random police
		const core = loadCore({ seed });
		const WC = core.WC;
		const ai = WC.createStrategicJack(WC.board, WC.deduction, WC.random, core._);
		const decisions = [];
		const record = (name, fn) => function () { const value = fn.apply(this, arguments); decisions.push({ name, value: plain(value) }); return value; };
		const scripted = Object.assign({}, ai, {
			chooseHideout: record('hideout', ai.chooseHideout), placeWomen: record('women', ai.placeWomen), wantsToWait: record('wait', ai.wantsToWait),
			chooseVictims: record('victims', ai.chooseVictims), choosePatrolToReveal: record('reveal', ai.choosePatrolToReveal), chooseMove: record('move', ai.chooseMove)
		});
		const aiGame = WC.engine.create({ ai: scripted });
		const aiActions = [];
		aiGame.on((type, data) => { if (type === 'action') aiActions.push(plain(data)); });
		let random = seededRandom(seed + 100);
		aiGame.start();
		for (let i = 0; i < 3000 && !aiGame.state.over; i++) policeStep(WC, aiGame, random);
		assert.ok(aiGame.state.over);

		// The same decisions, made by a person through the human methods
		const WC2 = loadCore({ seed }).WC;
		const { game, actions } = humanGame(WC2);
		random = seededRandom(seed + 100);
		let cursor = 0;
		const next = (name) => { while (decisions[cursor].name !== name) cursor++; return decisions[cursor++].value; };
		game.start();
		for (let i = 0; i < 5000 && !game.state.over; i++) {
			const turn = game.jackTurn();
			if (!turn) { policeStep(WC2, game, random); continue; }
			if (turn === 'hideout') assert.ok(game.jackHideout(next('hideout')));
			else if (turn === 'women') { const w = next('women'); assert.ok(game.jackWomen(w.marked, w.unmarked)); }
			else if (turn === 'murder') {
				if (WC2.rules.mustKill(game.state)) assert.ok(game.jackVictims(next('victims')));
				else if (next('wait')) assert.ok(game.jackWait());
				else assert.ok(game.jackVictims(next('victims')));
			} else if (turn === 'reveal') assert.ok(game.jackReveal(next('reveal')));
			else if (turn === 'move') assert.ok(game.jackMove(next('move')));
		}
		assert.deepStrictEqual(actions, aiActions, 'seed ' + seed);
		assert.deepStrictEqual(plain(game.state), plain(aiGame.state));
	}
});

test('the police\'s methods alone: a computer police player is never handed the game, its state or Jack\'s AI', () => {
	const WC = loadCore({ seed: 1 }).WC;
	const { game } = humanGame(WC);
	const actions = game.policeActions();
	assert.ok(Object.isFrozen(actions));
	assert.deepStrictEqual(Object.keys(actions).sort(), ['arrest', 'beginNextNight', 'canUndoPoliceMove', 'chooseAction', 'finishPoliceMoves',
		'keepWretched', 'movePoliceman', 'moveWretched', 'search', 'togglePatrol', 'undoPoliceMove']);
	for (const key of Object.keys(actions)) assert.strictEqual(typeof actions[key], 'function');
	assert.ok(!('state' in actions) && !('ai' in actions) && !('jackTurn' in actions));
	assert.strictEqual(game.policeActions(), actions);
});

// Plays a human-Jack game with random Jack decisions against a police AI, to a phase, and returns it
function playTo(WC, police, seed, stop) {
	const { game } = humanGame(WC);
	const random = seededRandom(seed);
	const pick = (list) => list[Math.floor(random() * list.length)];
	game.start();
	for (let i = 0; i < 3000 && !game.state.over && !stop(game); i++) {
		const turn = game.jackTurn();
		const s = game.state;
		if (!turn) { police.turn(game.policeActions(), WC.rules.policeView(s), random); continue; }
		if (turn === 'hideout') game.jackHideout(pick(WC.rules.hideoutChoices()));
		else if (turn === 'women') {
			const t = WC.rules.targetCircles(s);
			const c = WC.rules.womenTonight(s);
			const m = Math.min(c.marked, t.length);
			game.jackWomen(t.slice(0, m), t.slice(m, Math.min(c.women, t.length)));
		} else if (turn === 'murder') game.jackVictims(s.womenMarked.slice(0, WC.rules.victimsTonight(s)));
		else if (turn === 'reveal') game.jackReveal(WC.rules.hiddenPatrols(s)[0]);
		else if (turn === 'move') {
			const walks = WC.rules.jackWalks(s, WC.rules.jackPosition(s));
			const toward = walks.slice().sort((a, b) => WC.board.distance(a, s.base) - WC.board.distance(b, s.base));
			if (toward.length) game.jackMove({ type: 'walk', mapid: random() < 0.7 ? toward[0] : pick(walks) });
			else game.jackMove(WC.rules.jackSpecialMoves(s, WC.rules.jackPosition(s))[0]);
		}
	}
	return game;
}

for (const variant of ['v2', 'v3']) {
	test(`Detective AI ${variant} decides from public information only: changing Jack's secrets changes none of its moves`, () => {
		const core = loadCore({ seed: 4 });
		const WC = core.WC;
		const make = () => WC.createPolice(WC.board, WC.rules, WC.deduction, core._, WC.policeVariants[variant]);
		let checked = 0;
		for (const seed of [21, 22, 23, 24]) {
			// Night 2 or later, when the police must move: their view is the same whatever Jack's hideout and route
			const game = playTo(WC, make(), seed, (g) => g.state.jack.length >= 2 && g.state.phase === 10);
			if (game.state.over) continue;
			const secret = WC.engine.create({});
			secret.state = plain(game.state);
			const s = secret.state;
			// Another hideout, and another route tonight ending elsewhere: nothing the police can see
			s.base = WC.rules.hideoutChoices().find((h) => h !== game.state.base && !s.jack.some((n) => n.route.includes(h)));
			const night = last(s.jack);
			night.route = night.route.slice(0, night.murder.length).concat(night.route.slice(night.murder.length).map((m) => WC.board.walk(m, [])[0]));
			night.moves = night.moves.map((move, i) => Object.assign({}, move, { mapid: night.route[night.murder.length + i] }));
			const view = (g) => {
				const v = WC.rules.policeView(g.state);
				return JSON.stringify(Object.assign({}, v, { publicLog: v.publicLog(), pastLogs: v.pastLogs() }));
			};
			assert.strictEqual(view(secret), view(game), 'the police view holds none of Jack\'s secrets');
			assert.ok(!view(game).includes('"base"') && !view(game).includes('"route":[' + night.route[0]));
			const real = make();
			const other = make();
			real.turn(game.policeActions(), WC.rules.policeView(game.state), seededRandom(9));
			other.turn(secret.policeActions(), WC.rules.policeView(secret.state), seededRandom(9));
			assert.deepStrictEqual(plain(WC.rules.policeNight(secret.state).now), plain(WC.rules.policeNight(game.state).now));
			checked++;
		}
		assert.ok(checked >= 2, 'enough positions checked');
	});
}
