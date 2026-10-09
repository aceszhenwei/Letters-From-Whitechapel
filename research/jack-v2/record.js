// Plays one seeded game between a Jack policy and a police configuration and records, as the referee, what the
// Jack v2 study measures (docs/jack-ai-v2.md): for every night, how it ended, how many moves Jack had and used,
// his special movements, how the police's blocking constrained his way home, and how well Detective AI v2's
// hideout inference pointed at his true hideout. The referee's view is used only to measure, never to play.
const { WC, _, play, registerJack } = require('../detective-inference/lib');
const policies = require('./policies');
const policeConfigs = require('../detective-v2/configs');

// Walking distance home with the policemen where they stand now (Jack can't walk past a crossing with a policeman).
// Alleys are ignored, so it is an upper bound when Jack still has one; Infinity when the hideout is walled off
function blockedDistance(from, home, police) {
	if (from === home) return 0;
	const seen = { [from]: 0 };
	const queue = [from];
	while (queue.length) {
		const at = queue.shift();
		for (const next of WC.board.walk(at, police)) {
			if (seen[next] !== undefined) continue;
			seen[next] = seen[at] + 1;
			if (next === home) return seen[next];
			queue.push(next);
		}
	}
	return Infinity;
}

// The crossings next to a circle: the last step of any walk onto it passes one of them
const finite = (x) => (x === Infinity ? 99 : x); // JSON has no Infinity: 99 means walled off
const entries = (home) => WC.board.neighbours(home).filter((id) => !WC.board.isNumbered(id));

// Arrest risk as Strategic Jack's measured table puts it (js/ai/strategic-jack.js), for calibration against v2
const arrestTable = [[0, 0.012], [0.075, 0.032], [0.15, 0.123], [0.275, 0.583], [0.4, 0.75], [1, 0.75]];
function tableRisk(share, inReach) {
	if (!inReach) return 0.008;
	for (let i = 1; i < arrestTable.length; i++) {
		if (share <= arrestTable[i][0]) {
			const [x0, y0] = arrestTable[i - 1];
			const [x1, y1] = arrestTable[i];
			return y0 + (y1 - y0) * (share - x0) / (x1 - x0);
		}
	}
	return 0.75;
}
function reach(police) {
	const circles = {};
	for (const crossing of _.union(police, _.flatten(police.map((c) => WC.board.crossingsWithinTwo(c))))) {
		for (const circle of WC.board.adjacentNumbers(crossing)) circles[circle] = true;
	}
	return circles;
}

function recordGame({ jack, police, seed, decisions: keepDecisions = true }) {
	const policeOptions = policeConfigs[police];
	if (!policeOptions) throw new Error('Unknown police configuration: ' + police);
	const nights = [];
	const decisions = [];
	let current = null;
	let state = null;
	let pendingRisk = null;
	const hybrid = { weighting: 'hybrid', w: 0.9, rho: 0.5 };
	const ai = policies.create(jack, seed);
	const timedAI = Object.assign({}, ai, {
		chooseMove(view) {
			const t = process.hrtime.bigint();
			const move = ai.chooseMove(view);
			const ms = Number(process.hrtime.bigint() - t) / 1e6;
			const night = view.night;
			if (!current || current.night !== night) {
				current = {
					night, hideout: view.hideout, start: view.position, movesAvailable: view.remainingMoves,
					startDistance: WC.board.distance(view.position, view.hideout), used: 0, carriages: 0, alleys: 0,
					tokens: Object.assign({}, view.tokens), firstNoRoute: null, entryGuarded: 0, policeTurns: 0, minBlockedSlack: Infinity
				};
				// Detective AI v2's belief about the hideout at the start of the night (hybrid weights, public logs only)
				const homes = WC.deduction.hideouts(view.pastLogs(), WC.rules.hideoutChoices(), hybrid);
				const sorted = Object.entries(homes).sort((a, b) => b[1] - a[1]);
				current.hideoutCandidates = sorted.length;
				current.hideoutBelief = homes[view.hideout] || 0;
				current.hideoutRank = sorted.findIndex(([h]) => Number(h) === view.hideout) + 1;
				nights.push(current);
			}
			const policeNow = view.policeNow();
			const dist = WC.board.distance(view.position, view.hideout);
			const blocked = blockedDistance(view.position, view.hideout, policeNow);
			const cost = move.type === 'carriage' ? 2 : 1;
			const slack = view.remainingMoves - dist;
			const blockedSlack = view.remainingMoves - blocked;
			current.minBlockedSlack = Math.min(current.minBlockedSlack, blockedSlack);
			if (blockedSlack < 0 && current.firstNoRoute === null) current.firstNoRoute = current.used;
			current.used += cost;
			if (move.type === 'carriage') current.carriages++;
			if (move.type === 'alley') current.alleys++;
			// What the police could deduce about his circle after this move, and whether a policeman could reach it
			const log = view.publicLog().concat([{ type: 'move', move: move.type, police: policeNow }]);
			const homes = Object.keys(WC.deduction.hideouts(view.pastLogs(), WC.rules.hideoutChoices())).map(Number);
			const known = WC.deduction.track(log, { remaining: view.remainingMoves - cost, hideouts: homes, alleysLeft: view.tokens.alleys - (move.type === 'alley' ? 1 : 0) });
			const share = known ? (known.current[move.mapid] || 0) : 0;
			const inReach = !!reach(policeNow)[move.mapid];
			pendingRisk = { predicted: tableRisk(share, inReach), share, inReach };
			if (keepDecisions) {
				decisions.push({
					night, step: current.used, type: move.type, mapid: move.mapid, remaining: view.remainingMoves, slack, blockedSlack: blockedSlack === -Infinity ? -99 : blockedSlack,
					distAfter: WC.board.distance(move.mapid, view.hideout), ms, share, inReach, predictedRisk: pendingRisk.predicted, arrestedNext: false
				});
			}
			return move;
		}
	});
	const onPolice = (st, view) => {
		state = st;
		if (st.phase !== 11 || (st.turn.done && st.turn.done.length) || !current) return;
		// The policemen have just moved: is one of them next to the hideout?
		const now = WC.rules.policeNight(st).now;
		current.policeTurns++;
		if (now.some((x) => entries(st.base).includes(x))) current.entryGuarded++;
	};
	registerJack('__recorded', () => timedAI); // play() builds Jack by name; this one is already built
	const final = play({ jack: '__recorded', police: 'deductive', seed, policeOptions, onPolice });
	state = final;
	nights.forEach((n, i) => {
		const jackNight = final.jack[n.night];
		n.escaped = i < nights.length - 1 || final.result.type === 'jackWins';
		n.outcome = n.escaped ? 'escaped' : final.result.type;
		n.timeOfCrime = jackNight ? jackNight.murderMove[jackNight.murderMove.length - 1] : null;
		n.detour = n.escaped ? n.used - n.startDistance : null;
		n.entryGuarded = n.policeTurns ? n.entryGuarded / n.policeTurns : 0;
		n.finalDistance = i === nights.length - 1 ? WC.board.distance(WC.rules.jackPosition(final), final.base) : 0;
		n.finalBlocked = i === nights.length - 1 && !n.escaped ? finite(blockedDistance(WC.rules.jackPosition(final), final.base, WC.rules.policeNight(final).now)) : null;
		if (n.minBlockedSlack === Infinity) n.minBlockedSlack = null; // He never moved
		if (n.minBlockedSlack === -Infinity) n.minBlockedSlack = -99; // At some point the policemen walled the hideout off
	});
	if (final.result.type === 'arrested' && decisions.length) decisions[decisions.length - 1].arrestedNext = true;
	return {
		seed, jack, police, result: final.result.type, night: final.jack.length, hideout: final.base,
		nights, decisions: keepDecisions ? decisions : undefined
	};
}

module.exports = { recordGame, blockedDistance, entries };
