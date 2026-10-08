/* Jack's AI: the computer's decisions as Jack the Ripper.
   Every function is a decision: it receives a view of what Jack knows (WC.rules.jackView) and returns a choice.
   It never changes the game; the engine checks each choice against the rules and applies it.
   To replace the strategy, provide another object with the same six functions (see docs/jack-ai.md). */
var WC = WC || {};

WC.jackAI = (function (board, random, _) {

	var debug = {}; // The last decisions' working, for the browser console

	function sortSevenSteps(circles, view) {
		// Sort by moves to the hideout, 7 being best
		var moves = _.map(circles, function (mapid) {
			return view.distanceToHideout(mapid);
		});
		var sorted = _.sortBy(_.map(circles, function (mapid, index) {
			return { mapid: mapid, sevenOffset: Math.abs(moves[index] - 7) };
		}), 'sevenOffset');
		return _.pluck(sorted, 'mapid');
	}

	function chooseHideout(choices) {
		return choices[random.int(0, choices.length)];
	}

	function placeWomen(view) {
		// Marked women (the Wretched) on red circles about 7 moves from the hideout, the others at random
		var circles = sortSevenSteps(view.targets, view);
		var marked = new Array();
		var unmarked = new Array();
		while (marked.length < view.women.marked && circles.length > 0) {
			var index = random.safeIndex(0.9, circles.length);
			marked.push(circles[index]);
			circles.splice(index, 1); // Prevent possibility of choosing duplicate locations
		}
		while (unmarked.length < (view.women.women - view.women.marked) && circles.length > 0) {
			var index = random.int(0, circles.length);
			unmarked.push(circles[index]);
			circles.splice(index, 1);
		}
		return { marked: marked, unmarked: unmarked };
	}

	function wantsToWait(view) {
		// Only asked when the rules allow waiting. A toss of a coin
		return random.float(1) > 0.5;
	}

	function chooseVictims(view) {
		// TODO: If there are revealed police, murder far from them?

		// Jack escapes from his last victim, so choose that one carefully
		var sorted = sortSevenSteps(view.wretched, view);
		var last = sorted[random.safeIndex(0.2, sorted.length)];
		var others = _.without(sorted, last);
		var scenes = new Array();
		while (scenes.length < view.victims - 1) { // The double event: another victim first
			var index = random.int(0, others.length);
			scenes.push(others[index]);
			others.splice(index, 1);
		}
		scenes.push(last);
		return scenes;
	}

	function choosePatrolToReveal(view, hidden) {
		return hidden[random.int(0, hidden.length)];
	}

	function chooseMove(view) {
		// Jack's next move: { mapid, type: 'walk', 'alley' or 'carriage', via: the coach's first stop }
		var threats = view.threats();
		var walks = view.walks();

		if (view.debug) {
			debug.shortestRoutes = board.shortestRoutes(view.position, view.hideout, [], view.remainingMoves);
			debug.shortestRoutesAvoidPolice = board.shortestRoutes(view.position, view.hideout, view.policeNow(), view.remainingMoves);
		}

		var special = chooseSpecial(view, walks, threats);
		if (special) {
			return special;
		}
		return { mapid: chooseWalk(view, walks, threats), type: 'walk' };
	}

	function chooseSpecial(view, walks, threats) {
		// Decide whether to use an alley or a coach. Returns the move, or false to walk
		var options = view.specialMoves();
		if (options.length == 0) {
			return false;
		}
		var remaining = view.remainingMoves;
		var threatCount = function (mapid) {
			return _.has(threats, mapid) ? threats[mapid] : 0;
		}
		_.each(options, function (option) {
			option.arrestable = threatCount(option.mapid);
			// If a special movement onto the hideout doesn't end the night, Jack has to step off and walk back on
			option.baseMoves = view.endsNight(option) ? 0 : (option.mapid == view.hideout ? 2 : view.distanceToHideout(option.mapid));
			option.inTime = option.baseMoves <= remaining - option.moves;
		});
		var best = function (list) {
			// Prefer reaching the hideout in time, then avoiding arrest, then being close to it, then saving moves
			list = _.sortBy(list, 'moves');
			list = _.sortBy(list, 'baseMoves');
			list = _.sortBy(list, 'arrestable');
			list = _.sortBy(list, function (option) { return option.inTime ? 0 : 1; });
			return _.first(list);
		}

		// Blocked by police: a special movement is the only way out
		if (walks.length == 0) {
			return best(options);
		}

		// Running out of time: walking can't reach the hideout before the night ends
		var walksInTime = _.filter(walks, function (mapid) {
			return view.distanceToHideout(mapid) <= remaining - 1;
		});
		var optionsInTime = _.where(options, { inTime: true });
		if (walksInTime.length == 0 && optionsInTime.length > 0) {
			return best(optionsInTime);
		}

		// Cornered: every walk could be arrested, but a special movement gets away
		var walksSafe = _.filter(walks, function (mapid) {
			return threatCount(mapid) == 0;
		});
		var optionsSafe = _.where(optionsInTime, { arrestable: 0 });
		if (walksSafe.length == 0 && optionsSafe.length > 0) {
			return best(optionsSafe);
		}

		return false;
	}

	function chooseWalk(view, walks, threats) {
		// Choose an adjacent number to walk to

		// TODO: If close to the hideout but too early in the night; avoid it

		var adjacent = _.map(walks, function (mapid) { // A lovely list of options with their pros and cons
			return {
				mapid: mapid,
				distance: board.straightLine(mapid, view.hideout),
				arrestable: _.has(threats, mapid) ? threats[mapid] : false
			};
		});
		var index;

		switch (view.route.length) {
			case 1: // Jack's first move
				adjacent = _.sortBy(adjacent, 'distance');
				adjacent = _.sortBy(adjacent, 'arrestable');
				var unarrestableCount = _.filter(adjacent, function (option) { return option.arrestable === false; }).length;
				if (unarrestableCount > 0) {
					adjacent.splice(unarrestableCount, (adjacent.length - unarrestableCount)); // Drop arrestable circles
				}
				index = random.safeIndex(0.99, adjacent.length);
			break;
			case 2: // Jack's second move
				adjacent = _.sortBy(adjacent, 'distance');
				adjacent = _.sortBy(adjacent, 'arrestable');
				index = random.safeIndex(0.99, adjacent.length);
			break;
			// TODO: If less than (three) moves from the hideout; move away from it
			default:
				// After 6 moves, if Jack can walk to his hideout; make it so
				var hideoutIndex = _.indexOf(_.pluck(adjacent, 'mapid'), view.hideout);
				if (view.route.length >= 6 && hideoutIndex !== -1) {
					index = hideoutIndex;
				} else {
					adjacent = _.sortBy(adjacent, 'distance');
					index = random.safeIndex(0.99, adjacent.length);
				}
			break;
		}

		debug.lastWalk = adjacent;
		return adjacent[index].mapid;
	}

	return {
		chooseHideout: chooseHideout,
		placeWomen: placeWomen,
		wantsToWait: wantsToWait,
		chooseVictims: chooseVictims,
		choosePatrolToReveal: choosePatrolToReveal,
		chooseMove: chooseMove,
		// Exposed for tests and experiments
		chooseSpecial: chooseSpecial,
		chooseWalk: chooseWalk,
		sortSevenSteps: sortSevenSteps,
		debug: debug
	};
})(WC.board, WC.random, _);
