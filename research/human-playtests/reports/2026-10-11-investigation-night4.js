// Investigation 2026-10-11, the night-4 escape (docs/playtests.md#investigations-targeted; the report is
// 2026-10-11-investigation-night4.md). In g6b7af2a30b071ae6 Jack killed on night 4 at 142, one walk from his hideout
// 126, and walked home on his first move. Did Detective AI v3 decide reasonably on what it knew, or miss a threat it
// could have seen?
//   node research/human-playtests/reports/2026-10-11-investigation-night4.js forensics [--json]
//   node research/human-playtests/reports/2026-10-11-investigation-night4.js counterfactual [runs] [--json]
//   node research/human-playtests/reports/2026-10-11-investigation-night4.js wretched [--json]
// forensics: replays the record to each police decision that shaped night 4 and asks v3 (the same configuration, from
//   the police's view only) what it knew and valued there: night 3's last hunting turn (containment), night 4's patrol
//   tokens, and the Wretched it moved after Jack waited.
// counterfactual: the record up to the police's Wretched move, then each legal destination for that Wretched in turn,
//   and from there the rest of the game played by a computer Jack standing in for the person (seeded runs) against v3.
//   It estimates how often Jack would still have got home on night 4, had the Wretched gone elsewhere.
// wretched: every Wretched move v3 made in every human game in the collection: towards or away from Jack's hideout, the
//   threat it left by v3's own belief against the least it could have left, and whether the night ended one walk away.
// Read-only: it changes no record and no AI. Circle numbers are the printed ones.
const path = require('path');
const { loadWithAI } = require('../../../tools/game-log/core');
const { seeded } = require('../../../tools/game-log/make-examples');

const id = 'g6b7af2a30b071ae6';
const full = require(path.join(__dirname, '..', 'records', id + '.json'));
const lastNight = 3;

function context() {
	const ctx = loadWithAI(() => 0.5);
	const W = ctx.WC;
	return { W, _: ctx._, B: W.board, C: W.containment, police: W.createPolice(W.board, W.rules, W.deduction, ctx._, W.policeVariants.v3) };
}

const seqIndex = (seq) => full.actions.findIndex((a) => a.seq === seq);
const find = (pred) => full.actions.find(pred);

function forensics() {
	const { W, _, B, C, police } = context();
	const num = (c) => B.number(c) || c; // Crossings have no printed number: their map id
	const stateBefore = (seq) => W.record.replay(full, { upto: seqIndex(seq) }).game.state;
	const home = find((a) => a.type === 'hideout').args.mapid;
	const n4 = full.nights[lastNight];
	const scene = n4.jack.murder[0];
	const blockers = C.walkBlockers(scene, home);
	const out = { game: id, hideout: num(home), scene: num(scene), blockers };

	// Night 4's hideout belief (fixed for the night: it comes from nights 1-3)
	const wretchedAction = find((a) => a.night === lastNight && a.type === 'wretched');
	let view = W.rules.policeView(stateBefore(wretchedAction.seq));
	const homes = police.belief(view, false).hideouts;
	const ranked = Object.keys(homes).sort((a, b) => homes[b] - homes[a]);
	out.hideoutBelief = ranked.map((h) => ({ circle: num(+h), p: +homes[h].toFixed(3) }));
	out.trueHideoutRank = ranked.indexOf(String(home)) + 1;

	// 1. Night 3's hunting turns: v3 weighs containment for the last night on night 3 (contain 10, coordinated)
	const n3moves = full.actions.filter((a) => a.night === lastNight - 1 && a.type === 'policeman');
	const turns = _.groupBy(n3moves, (a) => a.jackMove);
	out.night3 = Object.keys(turns).map((k) => {
		const first = turns[k][0];
		const v = W.rules.policeView(stateBefore(first.seq));
		const known = police.belief(v, false);
		const list = C.threats(known.hideouts, v.crimeScenes, { neighbourWeight: police.options.containNeighbours });
		const total = list.reduce((s, t) => s + t.weight, 0);
		const mine = list.filter((t) => t.site === scene && t.home === home);
		const sorted = list.slice().sort((a, b) => b.weight - a.weight);
		const after = turns[k].map((a) => a.args.to);
		const end = W.rules.policeView(stateBefore(turns[k][turns[k].length - 1].seq + 1)).police.now;
		return {
			jackMove: +k,
			threats: list.length,
			thisThreat: mine.length ? { weight: +mine[0].weight.toFixed(4), share: +(mine[0].weight / total).toFixed(4), rank: sorted.indexOf(mine[0]) + 1 } : null,
			openShareAfter: +(C.exposure(list, end) / total).toFixed(3),
			closesThis: mine.length ? !C.open(mine[0], end) : null,
			nearestTurnsToBlocker: Math.min(...end.map((c) => Math.min(...blockers.map((b) => (C.turns(b)[c] === undefined ? 99 : C.turns(b)[c])))))
		};
	});
	out.night3Last = out.night3[out.night3.length - 1];

	// 2. Night 4's patrol tokens: required on night 3's end positions; containPatrols may swap one for a station
	const patrolAction = find((a) => a.night === lastNight && a.type === 'patrol');
	view = W.rules.policeView(stateBefore(patrolAction.seq));
	const positions = view.patrolPositions();
	const list4 = C.threats(homes, view.crimeScenes, { neighbourWeight: police.options.containNeighbours, sites: view.women });
	const total4 = list4.reduce((s, t) => s + t.weight, 0);
	const share = (c, others) => (total4 > 0 ? C.value(list4, c, others) / total4 : 0);
	const weakest = _.min(positions.required, (c) => share(c, _.without(positions.required, c)));
	const stations = _.difference(positions.all, positions.required).map((c) => ({ crossing: c, gain: +(share(c, _.without(positions.required, weakest)) - share(weakest, _.without(positions.required, weakest))).toFixed(3), blocksThis: blockers.includes(c) }));
	out.patrols = {
		women: view.women.map(num),
		required: positions.required,
		stations: stations.sort((a, b) => b.gain - a.gain),
		swapThreshold: police.options.containSwap,
		thisThreatWeight: (() => { const t = list4.find((x) => x.site === scene && x.home === home); return t ? +t.weight.toFixed(4) : 0; })(),
		thisThreatShare: (() => { const t = list4.find((x) => x.site === scene && x.home === home); return t ? +(t.weight / total4).toFixed(4) : 0; })(),
		openShare: +(C.exposure(list4, positions.required) / total4).toFixed(3),
		blockerIsStation: blockers.some((b) => positions.all.includes(b))
	};

	// 3. The Wretched v3 moved after Jack waited: its rule (towards the real patrols) against the threat by its own belief
	view = W.rules.policeView(stateBefore(wretchedAction.seq));
	const from = wretchedAction.args.from;
	const near = (circle) => _.min(view.police.start.map((c) => _.min(B.adjacentNumbers(c).map((id2) => B.distance(circle, id2)))));
	const threatAt = (circle) => {
		const l = C.threats(homes, view.crimeScenes, { neighbourWeight: 0, sites: [circle] });
		return { total: l.reduce((s, t) => s + t.weight, 0), open: C.exposure(l, view.police.start), homes: l.map((t) => num(t.home)) };
	};
	const options = view.wretchedMoves(from).map((c) => {
		const t = threatAt(c);
		return { circle: num(c), patrolDistance: near(c), threat: +t.total.toFixed(3), openThreat: +t.open.toFixed(3), hideoutsOneWalk: t.homes, trueHomeOneWalk: B.walk(c, []).includes(home), trueHomeOpen: B.walk(c, view.police.start).includes(home) };
	});
	const stay = threatAt(from);
	out.wretched = {
		from: num(from), to: num(wretchedAction.args.to),
		fromWalksHome: B.distance(from, home),
		fromThreat: +stay.total.toFixed(3),
		options: options.sort((a, b) => a.openThreat - b.openThreat),
		v3Rule: num(_.min(view.wretchedMoves(from), near)),
		containWretchedRule: num(_.min(view.wretchedMoves(from), (c) => threatAt(c).open * 1000 + near(c))),
		chosenRankByOpenThreat: options.slice().sort((a, b) => a.openThreat - b.openThreat).findIndex((o) => o.circle === num(wretchedAction.args.to)) + 1
	};
	return out;
}

/* Counterfactual: branch the record at the Wretched move */
function branchPlay({ to, jack, seed, wretchedLever = false }) {
	// Replays the record to the police's night-4 Wretched move, moves that Wretched to `to` instead, and plays on with
	// a computer Jack (`jack`: a difficulty level) and v3, seeded (with `wretchedLever`, v3 with its containWretched
	// option on from there, for any later Wretched move). Returns how the game ended
	const ctx = loadWithAI(seeded(seed));
	const W = ctx.WC;
	const _ = ctx._;
	const branchAt = seqIndex(find((a) => a.night === lastNight && a.type === 'wretched').seq);
	const jackActions = full.actions.slice(0, branchAt).filter((a) => a.side === 'jack');
	let cursor = 0;
	let live = null;
	const next = (type) => {
		const a = jackActions[cursor];
		if (!a || a.type !== type) throw new Error('replay: expected Jack ' + type);
		cursor++;
		return a.args;
	};
	const ai = W.difficulty.create(W, jack);
	const hybrid = {
		chooseHideout: (...x) => (live ? ai.chooseHideout(...x) : next('hideout').mapid),
		placeWomen: (...x) => { if (live) return ai.placeWomen(...x); const a = next('women'); return { marked: a.marked.slice(), unmarked: a.unmarked.slice() }; },
		wantsToWait: (...x) => {
			if (live) return ai.wantsToWait(...x);
			const a = jackActions[cursor];
			if (a && a.type === 'wait') { cursor++; return true; }
			return false;
		},
		chooseVictims: (...x) => (live ? ai.chooseVictims(...x) : next('victims').scenes.slice()),
		choosePatrolToReveal: (...x) => (live ? ai.choosePatrolToReveal(...x) : next('reveal').mapid),
		chooseMove: (...x) => { if (live) return ai.chooseMove(...x); const a = next('move'); return a.type === 'carriage' ? { type: a.type, mapid: a.mapid, via: a.via } : { type: a.type, mapid: a.mapid }; }
	};
	const game = W.engine.create({ ai: hybrid });
	const calls = {
		patrol: (a) => game.togglePatrol(a.mapid, a.kind),
		wretched: (a) => game.moveWretched(a.from, a.to),
		keepWretched: (a) => game.keepWretched(a.mapid),
		policeman: (a) => game.movePoliceman(a.index, a.to),
		finishMoves: () => game.finishPoliceMoves(),
		beginNight: () => game.beginNextNight(),
		choose: (a) => game.chooseAction(a.index, a.action),
		search: (a) => game.search(a.index, a.mapid),
		arrest: (a) => game.arrest(a.index, a.mapid)
	};
	game.start();
	for (let i = 0; i < branchAt; i++) {
		const a = full.actions[i];
		if (a.side === 'police' && calls[a.type](a.args || {}) === false) throw new Error('replay: police action ' + a.seq + ' refused');
	}
	const branch = full.actions[branchAt];
	live = ai;
	if (game.moveWretched(branch.args.from, to) === false) throw new Error('illegal Wretched move to ' + to);
	const police = W.createPolice(W.board, W.rules, W.deduction, _, Object.assign({}, W.policeVariants.v3, wretchedLever ? { containWretched: true } : {}));
	const random = seeded(seed + 1);
	for (let i = 0; i < 5000 && !game.state.over; i++) police.turn(game, W.rules.policeView(game.state), random);
	const s = game.state;
	const night = s.jack[lastNight];
	return {
		result: s.result.type, moves: night ? night.route.length - night.murder.length : null,
		scene: night && night.murder.length ? W.board.number(night.murder[night.murder.length - 1]) : null,
		waits: s.timeOfCrime // The Time of the Crime: 2 after the one recorded wait, more if Jack waited again
	};
}

function counterfactual(runs) {
	// Every legal destination for the Wretched, then v3 as it is; and the containWretched option's own choice, with the
	// option kept on for any later Wretched move. Jacks: Jack AI v2 ('hard'; on the last night it plays as Strategic
	// Jack, so Normal would repeat it) and Jack AI v2 with strategic waiting ('hard-waiting'), which may wait again
	const { W, B } = context();
	const f = forensics();
	const wretchedAction = find((a) => a.night === lastNight && a.type === 'wretched');
	const options = W.rules.policeView(W.record.replay(full, { upto: seqIndex(wretchedAction.seq) }).game.state).wretchedMoves(wretchedAction.args.from);
	const lever = options.find((c) => B.number(c) === f.wretched.containWretchedRule);
	const scenarios = options.map((to) => ({ to, wretchedLever: false })).concat([{ to: lever, wretchedLever: true }]);
	const out = [];
	for (const { to, wretchedLever } of scenarios) {
		for (const jack of ['hard', 'hard-waiting']) {
			const games = Array.from({ length: runs }, (x, i) => branchPlay({ to, jack, seed: 613001 + i, wretchedLever }));
			out.push({
				to: B.number(to), police: wretchedLever ? 'v3 + containWretched' : 'v3', jack, runs,
				escaped: games.filter((g) => g.result === 'jackWins').length,
				escapedFirstMove: games.filter((g) => g.result === 'jackWins' && g.moves === 1).length,
				arrested: games.filter((g) => g.result === 'arrested').length,
				outOfMoves: games.filter((g) => g.result !== 'jackWins' && g.result !== 'arrested').length,
				waitedAgain: games.filter((g) => g.waits > 2).length,
				medianMoves: games.map((g) => g.moves).sort((a, b) => a - b)[Math.floor(runs / 2)],
				openThreat: (f.wretched.options.find((o) => o.circle === B.number(to)) || {}).openThreat,
				actual: B.number(to) === f.wretched.to && !wretchedLever
			});
		}
	}
	return out;
}

function wretchedMoves() {
	const fs = require('fs');
	const { W, _, B, C } = context();
	const dir = path.join(__dirname, '..', 'records');
	const rows = [];
	for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
		const rec = require(path.join(dir, file));
		const police = W.createPolice(W.board, W.rules, W.deduction, _, W.policeVariants.v3);
		const home = rec.actions.find((a) => a.type === 'hideout').args.mapid;
		rec.actions.forEach((a, i) => {
			if (a.type !== 'wretched') return;
			const view = W.rules.policeView(W.record.replay(rec, { upto: i }).game.state);
			const homes = police.belief(view, false).hideouts;
			const open = (c) => C.exposure(C.threats(homes, view.crimeScenes, { neighbourWeight: 0, sites: [c] }), view.police.start);
			const options = view.wretchedMoves(a.args.from);
			const scenes = rec.nights[a.night].jack.murder;
			rows.push({
				game: rec.game.id, night: a.night + 1, from: B.number(a.args.from), to: B.number(a.args.to),
				walksHomeBefore: B.distance(a.args.from, home), walksHomeAfter: B.distance(a.args.to, home),
				options: options.length, openThreatChosen: +open(a.args.to).toFixed(3), openThreatLeast: +Math.min(...options.map(open)).toFixed(3),
				openThreatMost: +Math.max(...options.map(open)).toFixed(3),
				killedThere: scenes.includes(a.args.to) || null,
				escapedFirstMove: scenes.includes(a.args.to) && rec.nights[a.night].police.escaped && (rec.nights[a.night].jack.moves || []).length === 1
			});
		});
	}
	return rows;
}

module.exports = { forensics, counterfactual, branchPlay, wretchedMoves };

if (require.main === module) {
	const [command, runs] = process.argv.slice(2);
	if (command === 'forensics') console.log(JSON.stringify(forensics(), null, 1));
	else if (command === 'wretched') console.log(JSON.stringify(wretchedMoves(), null, 1));
	else if (command === 'counterfactual') console.log(JSON.stringify(counterfactual(Number(runs) || 20), null, 1));
	else {
		console.error('Usage: forensics | counterfactual [runs] | wretched');
		process.exitCode = 1;
	}
}
