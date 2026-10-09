// Candidate mechanisms for Jack AI v2 (docs/jack-ai-v2.md), each a small change to the unchanged Strategic Jack
// (js/ai/strategic-jack.js), so that one mechanism can be switched on at a time:
//
//   waypoint   (hypothesis C, purposeful deception) - on every night but the last, when he has moves to spare, Jack
//              first heads for a waypoint chosen at random among circles that make his route at least `extra` moves
//              longer than the direct way home while keeping a margin, then goes home. Detective AI v2 reads a direct
//              route as pointing at the hideout; a long one points at many.
//   blocked    (hypotheses A and B, containment and movement budget) - his "moves needed to get home" counts the
//              policemen where they stand now (he can't walk past them; one alley or coach may get round them), instead
//              of the empty board. His escape estimates then see a guarded hideout as far away.
//   stochastic (hypothesis E) - among his best-valued moves (within `epsilon` of the best), choose at random.
//   early      (hypothesis C, as Detour Jack does it: research/detective-v2/jacks.js) - on his first `earlyMoves` moves
//              of a night, while at least `earlySpare` moves would be left to spare after it, walk to a random circle
//              farther from home. With `earlyLastNight` false, not on the last night.
//
// The mechanisms change only what Strategic Jack is told the distance home is (a board whose distance() answers
// differently during his move choice) or which of his top-ranked moves is played. Everything they use is what Jack
// knows at the table: his hideout, his route tonight, the map, his tokens and where the policemen stand.
const { WC, _ } = require('../../detective-inference/lib');

function blockedDistances(home, police, tokens) {
	// Moves from every circle to the hideout with the policemen where they stand: walks can't pass them; at most one
	// alley (1 move) or coach (2 moves, may pass them) on the way, but the last move onto the hideout must be a walk
	const walking = { [home]: 0 };
	const queue = [home];
	while (queue.length) {
		const at = queue.shift();
		for (const next of WC.board.walk(at, police)) {
			if (walking[next] === undefined) {
				walking[next] = walking[at] + 1;
				queue.push(next);
			}
		}
	}
	return function (from) {
		let best = walking[from] !== undefined ? walking[from] : Infinity;
		if (tokens.alleys > 0) {
			for (const to of WC.board.alleys(from)) if (to !== home && walking[to] !== undefined) best = Math.min(best, 1 + walking[to]);
		}
		if (tokens.carriages > 0) {
			for (const via of WC.board.walk(from, [])) {
				for (const to of WC.board.walk(via, [])) if (to !== from && to !== home && walking[to] !== undefined) best = Math.min(best, 2 + walking[to]);
			}
		}
		return best;
	};
}

function createCandidate(random, mechanisms) {
	const m = Object.assign({ waypoint: false, extra: 4, margin: 4, away: false, lastNight: false, early: false, earlyMoves: 3, earlySpare: 6, earlyLastNight: true, blocked: false, stochastic: false, epsilon: 0.03 }, mechanisms);
	// Strategic Jack plays with this board. Outside his move choice it answers exactly as the real one
	const board = Object.create(WC.board);
	let hunt = null; // During a move choice: { home, distance(from) }
	board.distance = function (from, to) {
		if (hunt && to === hunt.home) return hunt.distance(from);
		return WC.board.distance(from, to);
	};
	const strategic = WC.createStrategicJack(board, WC.deduction, random, _);
	const waypoints = { night: null, at: null };
	const debug = { waypoint: null, waypointsSet: 0, waypointsReached: 0, stochasticChanges: 0 };

	function chooseWaypoint(view) {
		// Circles w where going scene -> w -> home costs at least `extra` more than the direct way and still leaves
		// `margin` moves to spare; one of them at random, preferring those the policemen are not near
		const home = view.hideout;
		const direct = WC.board.distance(view.position, home);
		const budget = view.remainingMoves - m.margin;
		const reach = {};
		for (const crossing of view.policeNow()) for (const id of WC.board.crossingsWithinTwo(crossing).concat([crossing])) for (const c of WC.board.adjacentNumbers(id)) reach[c] = true;
		const options = WC.board.numbered().filter((w) => {
			const via = WC.board.distance(view.position, w) + WC.board.distance(w, home);
			// With `away`, only waypoints farther from home than he is: he leads the hunt away from it, not past it
			return w !== home && w !== view.position && via - direct >= m.extra && via <= budget && (!m.away || WC.board.distance(w, home) > direct);
		});
		if (!options.length) return null;
		const safe = options.filter((w) => !reach[w]);
		const pool = safe.length ? safe : options;
		return pool[random.int(0, pool.length)];
	}

	function chooseMove(view) {
		const home = view.hideout;
		if (m.early && (m.earlyLastNight || view.night < WC.rules.config.nights - 1)) {
			// Exactly Detour Jack's rule, so that with nothing else switched on it plays Detour Jack's games
			const movesSoFar = view.route.length - 1;
			const walks = view.walks();
			const spare = view.remainingMoves - view.distanceToHideout(view.position);
			if (movesSoFar <= m.earlyMoves && spare - 2 >= m.earlySpare && walks.length) {
				const away = _.filter(walks, (mapid) => mapid !== home && view.distanceToHideout(mapid) > view.distanceToHideout(view.position));
				if (away.length) return { mapid: away[random.int(0, away.length)], type: 'walk' };
			}
		}
		let distance = (from) => WC.board.distance(from, home);
		if (m.blocked) {
			const blocked = blockedDistances(home, view.policeNow(), view.tokens);
			// Walled off: the policemen will move, so not hopeless, but far (3 more than the empty board says)
			distance = (from) => { const d = blocked(from); return isFinite(d) ? d : WC.board.distance(from, home) + 3; };
		}
		if (m.waypoint) {
			// Hiding the hideout only matters for nights still to come; with `lastNight` he also detours on the last night
			const last = !m.lastNight && view.night === WC.rules.config.nights - 1;
			if (waypoints.night !== view.night) {
				waypoints.night = view.night;
				waypoints.at = last ? null : chooseWaypoint(view);
				debug.waypoint = waypoints.at;
				if (waypoints.at) debug.waypointsSet++;
			}
			if (waypoints.at === view.position) {
				waypoints.at = null;
				debug.waypointsReached++;
			}
			if (waypoints.at && view.remainingMoves - WC.board.distance(view.position, waypoints.at) - WC.board.distance(waypoints.at, home) < m.margin - 1) {
				waypoints.at = null; // Delays (policemen in the way) ate the margin: give it up and go home
			}
			if (waypoints.at) {
				const w = waypoints.at;
				const toHome = distance;
				distance = (from) => (from === w ? toHome(w) : WC.board.distance(from, w) + WC.board.distance(w, home));
			}
		}
		hunt = m.blocked || waypoints.at ? { home, distance } : null;
		let move;
		try {
			move = strategic.chooseMove(view);
		} finally {
			hunt = null;
		}
		if (m.stochastic && strategic.debug.lastMove && strategic.debug.lastMove.length > 1) {
			const ranked = strategic.debug.lastMove;
			const score = (o) => (o.ahead !== undefined ? o.ahead : o.now * 0.5);
			const best = score(ranked[0]);
			const near = ranked.filter((o) => o.type !== 'carriage' && score(o) >= best - m.epsilon && !(o.type === 'walk' && o.mapid === home));
			if (near.length > 1 && !(move.type === 'walk' && move.mapid === home)) {
				const pick = near[random.int(0, near.length)];
				if (pick.mapid !== move.mapid || pick.type !== move.type) debug.stochasticChanges++;
				move = { mapid: pick.mapid, type: pick.type };
			}
		}
		return move;
	}

	return Object.assign({}, strategic, { chooseMove, debug: Object.assign(strategic.debug, debug), mechanisms: m });
}

const variant = (mechanisms) => (random) => createCandidate(random, mechanisms);

module.exports = {
	createCandidate,
	blockedDistances,
	policies: {
		'cand-none': variant({}), // All mechanisms off: must play exactly as Strategic Jack (a check on the wrapper)
		'cand-waypoint': variant({ waypoint: true }),
		'cand-blocked': variant({ blocked: true }),
		'cand-stochastic': variant({ stochastic: true }),
		// Revised after screening (docs/jack-ai-v2.md): a 6-move reserve, where his escape estimates level off, and
		// waypoints away from home
		'cand-waypoint-away': variant({ waypoint: true, margin: 6, away: true }),
		'cand-waypoint-away-all': variant({ waypoint: true, margin: 6, away: true, lastNight: true }),
		// Detour Jack's early detours as a mechanism (cand-early must replay Detour Jack's games), without them on the
		// last night, and with the blocked-distance estimates
		'cand-early': variant({ early: true }),
		'cand-early-notlast': variant({ early: true, earlyLastNight: false }),
		'cand-early+blocked': variant({ early: true, blocked: true }),
		'cand-early-notlast+blocked': variant({ early: true, earlyLastNight: false, blocked: true })
	}
};
