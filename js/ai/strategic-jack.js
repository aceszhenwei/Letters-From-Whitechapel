/* Strategic Jack: an AI that estimates, for each move, the chance of surviving the police's next turn and the
   chance of still getting home in time, and plays the move that makes both most likely.

   It uses only what Jack knows (the view from WC.rules.jackView). To judge how exposed a move is, it works out
   what the police could deduce from public information (WC.deduction), which is fair: the police see exactly that.

   Its estimates come from measurements, not guesses: tools/sim/calibrate.js played 1,500 games (seeds 900001 to
   902500, kept apart from the evaluation seeds) and recorded, after each of Jack's moves, how often he was
   arrested straight away and how often he got home that night. The tables below are those measurements.

   Its parts can be switched off one at a time (options), to measure which of them help (docs/jack-ai.md). */
var WC = WC || {};

WC.createStrategicJack = function (board, deduction, random, _, options) {

	options = _.extend({
		path: true, // Real walking distances and a time model, instead of straight-line distance
		risk: true, // The chance of arrest: police in reach, and how sure they could be of his circle
		lookahead: true, // Look two moves ahead
		hideout: true, // Don't end the night in a way that pins down the hideout, when there is time to spare
		hell: true, // Choose the hideout, victims and waiting with the same estimates
		beam: 6 // First moves looked at in depth (the most promising ones)
	}, options || {});

	var hideoutChoices = null; // Set when Jack chooses his hideout
	var debug = {};

	/* What the measurements say
	   ------------------------- */
	// Arrested straight after a move, when a policeman could reach a crossing next to Jack's circle:
	// by how sure the police could be that he is on it (share of where he could be). Out of reach: 0.8%.
	var arrestTable = [[0, 0.012], [0.075, 0.032], [0.15, 0.123], [0.275, 0.583], [0.4, 0.75], [1, 0.75]];
	var outOfReach = 0.008;
	// Escaped that night, by moves to spare after the move (moves left minus walking distance home)
	var escapeTable = { '-1': 0.04, '0': 0.558, '1': 0.65, '2': 0.73, '3': 0.735, '4': 0.755, '5': 0.755, '6': 0.83, '7': 0.83, '8': 0.83, '9': 0.874 };

	function interpolate(table, x) {
		for (var i = 1; i < table.length; i++) {
			if (x <= table[i][0]) {
				var a = table[i - 1];
				var b = table[i];
				return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
			}
		}
		return _.last(table)[1];
	}

	function chanceOfArrest(belief, inReach) {
		return inReach ? interpolate(arrestTable, belief) : outOfReach;
	}

	function chanceOfEscape(spare) {
		if (spare < 0) {
			return escapeTable['-1'];
		}
		return escapeTable[String(Math.min(9, spare))];
	}

	/* What the police could know
	   -------------------------- */
	var hideoutMemory = { night: null, hideouts: null };

	function policeKnowledge(view) {
		// Exactly the police's own deduction (js/ai/police.js): tonight's record, and the hideouts earlier nights allow.
		// Earlier nights don't change during a night, so that part is worked out once a night
		if (hideoutMemory.night !== view.night) {
			hideoutMemory.hideouts = deduction.hideouts(view.pastLogs(), hideoutChoices || [view.hideout]);
			hideoutMemory.night = view.night;
		}
		var hideouts = hideoutMemory.hideouts;
		return {
			hideouts: hideouts,
			tonight: deduction.track(view.publicLog(), {
				remaining: view.remainingMoves,
				hideouts: _.map(_.keys(hideouts), Number),
				alleysLeft: view.tokens ? view.tokens.alleys : 0
			})
		};
	}

	function policeReach(policeNow, rounds) {
		// Circles a policeman could search or arrest at after moving up to two crossings, `rounds` times
		var crossings = policeNow.slice();
		for (var r = 0; r < rounds; r++) {
			crossings = _.union(crossings, _.flatten(_.map(crossings, function (crossing) { return board.crossingsWithinTwo(crossing); })));
		}
		var circles = {};
		_.each(crossings, function (crossing) {
			_.each(board.adjacentNumbers(crossing), function (circle) { circles[circle] = true; });
		});
		return circles;
	}

	/* Valuing a move
	   -------------- */
	var walkMemory = { key: null, walks: {} };
	function walksFrom(from, policeNow) {
		var key = policeNow.join(',');
		if (walkMemory.key !== key) {
			walkMemory = { key: key, walks: {} };
		}
		if (!walkMemory.walks[from]) {
			walkMemory.walks[from] = board.walk(from, policeNow);
		}
		return walkMemory.walks[from];
	}

	function legalMoves(view, from, tokens, policeNow) {
		// Every legal move from `from`: walks (not past policemen) and the special movements Jack still has
		var moves = _.map(walksFrom(from, policeNow), function (mapid) { return { mapid: mapid, type: 'walk', moves: 1 }; });
		if (tokens.alleys > 0) {
			_.each(board.alleys(from), function (mapid) { moves.push({ mapid: mapid, type: 'alley', moves: 1 }); });
		}
		if (tokens.carriages > 0) {
			var seen = {};
			_.each(board.walk(from, []), function (via) {
				_.each(board.walk(via, []), function (mapid) {
					if (mapid != from && !seen[mapid]) {
						seen[mapid] = true;
						moves.push({ mapid: mapid, type: 'carriage', via: via, moves: 2 });
					}
				});
			});
		}
		return moves;
	}

	function value(move, context, belief) {
		// The chance of getting through tonight, as far as this move can tell: surviving the police's next turn,
		// times getting home in time from where it leaves him
		var spare = context.remaining - move.moves - (options.path ? board.distance(move.mapid, context.hideout) : straightLineMoves(move.mapid, context.hideout));
		var escape = chanceOfEscape(spare);
		if (move.type == 'walk' && move.mapid == context.hideout) {
			return context.endNight ? context.endNight(move) : 1;
		}
		if (!options.risk) {
			return escape;
		}
		var share = belief ? (belief.current[move.mapid] || 0) : 0;
		return (1 - chanceOfArrest(share, !!context.reach[move.mapid])) * escape;
	}

	function straightLineMoves(from, to) {
		// Without path planning: guess the moves from the straight-line distance. Over 1,811 pairs of circles,
		// a move covers 72 pixels of straight line on average (median and mean both 72)
		return Math.round(board.straightLine(from, to) / 72);
	}

	/* Choosing a move
	   --------------- */
	function chooseMove(view) {
		var known = options.risk || options.hideout ? policeKnowledge(view) : null;
		var policeNow = view.policeNow();
		var tokens = view.tokens;
		var context = {
			hideout: view.hideout,
			remaining: view.remainingMoves,
			reach: policeReach(policeNow, 1),
			endNight: options.hideout ? function () { return escapeValue(view, known); } : null
		};
		var legal = _.filter(legalMoves(view, view.position, tokens, policeNow), function (move) {
			// Only moves the rules allow (special movements are checked against what the view offers)
			return move.type == 'walk' || _.some(view.specialMoves(), function (o) { return o.mapid == move.mapid && o.type == move.type; });
		});
		// What the police would believe after a move depends only on its type (walk, alley or coach), which is
		// public, not on where Jack goes. So it is worked out once for each type (and pair of types, ahead)
		var beliefs = {};
		var belief = function (move) {
			if (!known || !known.tonight) {
				return null;
			}
			if (!beliefs[move.type]) {
				beliefs[move.type] = { now: known.tonight.next(move.type, policeNow), next: {} };
			}
			return beliefs[move.type].now;
		};
		var beliefAfter = function (move, next) {
			var first = belief(move);
			if (!first) {
				return null;
			}
			var memo = beliefs[move.type].next;
			if (!memo[next.type]) {
				memo[next.type] = first.next(next.type, policeNow);
			}
			return memo[next.type];
		};
		var first = _.map(legal, function (move) {
			var after = belief(move);
			return { move: move, after: after, now: value(move, context, after) };
		});
		var ranked = _.sortBy(first, function (option) { return -option.now; });

		if (options.lookahead) {
			// Two moves ahead for the most promising first moves: by then the police will have moved, so treat
			// every circle they could reach in two turns as in reach
			var later = { hideout: view.hideout, reach: policeReach(policeNow, 2), endNight: context.endNight };
			_.each(ranked.slice(0, options.beam), function (option) {
				if (option.move.type == 'walk' && option.move.mapid == view.hideout) {
					option.ahead = option.now;
					return;
				}
				var left = { carriages: tokens.carriages - (option.move.type == 'carriage' ? 1 : 0), alleys: tokens.alleys - (option.move.type == 'alley' ? 1 : 0) };
				later.remaining = view.remainingMoves - option.move.moves;
				var best = 0;
				if (later.remaining > 0) {
					_.each(legalMoves(view, option.move.mapid, left, policeNow), function (next) {
						if (next.moves > later.remaining) {
							return;
						}
						var after = beliefAfter(option.move, next);
						best = Math.max(best, value(next, later, after));
					});
				}
				var survive = options.risk ? 1 - chanceOfArrest(option.after ? (option.after.current[option.move.mapid] || 0) : 0, !!context.reach[option.move.mapid]) : 1;
				option.ahead = survive * best;
			});
			ranked = _.sortBy(ranked, function (option) {
				return -(option.ahead !== undefined ? option.ahead : option.now * 0.5); // Unexplored moves rank below explored ones
			});
		}
		var top = ranked[0];
		var score = function (option) { return option.ahead !== undefined ? option.ahead : option.now; };
		var tied = _.filter(ranked, function (option) { return Math.abs(score(option) - score(top)) < 1e-9; });
		var chosen = tied[random.int(0, tied.length)];
		debug.lastMove = _.map(ranked.slice(0, 8), function (o) { return { mapid: o.move.mapid, type: o.move.type, now: o.now, ahead: o.ahead }; });
		return chosen.move.type == 'carriage' ? { mapid: chosen.move.mapid, type: 'carriage', via: chosen.move.via } : { mapid: chosen.move.mapid, type: chosen.move.type };
	}

	function escapeValue(view, known) {
		// Ending the night on the hideout is worth 1, unless it gives the hideout away while there is time to spare:
		// then it is worth what the measurements say about escaping later, minus nothing (he can still come back)
		if (!known || !known.tonight || view.remainingMoves - 1 < 3) {
			return 1;
		}
		// Where the police would think the hideout could be if he ended the night here
		var end = known.tonight.next('walk', view.policeNow());
		var after = _.filter(_.keys(known.hideouts), function (h) { return (end.current[h] || 0) > 0; });
		var pinned = after.length <= 2;
		return pinned ? chanceOfEscape(view.remainingMoves - 1 - 2) : 1; // Leave and come back: two more moves
	}

	/* Hell
	   ---- */
	var baseline = WC.createJackAI(board, random, _);

	function chooseHideout(choices) {
		hideoutChoices = choices;
		if (!options.hell) {
			return baseline.chooseHideout(choices);
		}
		// A hideout from which the red circles are a comfortable walk: the best average chance of getting home with
		// the 15 moves of a murder at I. Among the best, choose at random, so the police can't guess it
		var reds = board.redCircles();
		var scored = _.map(choices, function (h) {
			return { h: h, score: _.reduce(reds, function (sum, r) { return sum + chanceOfEscape(15 - board.distance(r, h)); }, 0) / reds.length };
		});
		var best = _.max(scored, 'score').score;
		var good = _.filter(scored, function (o) { return o.score >= best - 0.02; }); // Within 2 points of the best
		return good[random.int(0, good.length)].h;
	}

	function placeWomen(view) {
		return baseline.placeWomen(view);
	}

	function wantsToWait(view) {
		if (!options.hell) {
			return baseline.wantsToWait(view);
		}
		// Wait (one more move tonight) only while the best victim still leaves fewer than 6 moves to spare: the
		// measurements show the chance of getting home levels off at about 83% from 6 spare moves
		var moves = 20 - (6 - view.timeOfCrime);
		var best = _.max(_.map(view.wretched, function (w) { return moves - board.distance(w, view.hideout); }));
		return best < 6;
	}

	function chooseVictims(view) {
		if (!options.hell) {
			return baseline.chooseVictims(view);
		}
		// The last victim is where the hunt starts. Value each like a move: the chance of getting home in time, times
		// the chance of surviving the first round. After his first move the police know he is on one of the circles
		// next to the crime scene, so that is how sure they can be; real patrols he has revealed may be in reach
		var moves = 20 - (6 - view.timeOfCrime) - (view.victims - 1);
		var realPatrols = _.pluck(_.where(view.patrols(), { real: true }), 'mapid');
		var reach = policeReach(realPatrols, 1);
		var scored = _.sortBy(view.wretched, function (w) {
			var share = 1 / Math.max(1, board.walk(w, []).length);
			return -chanceOfEscape(moves - board.distance(w, view.hideout)) * (1 - chanceOfArrest(share, !!reach[w]));
		});
		var last = scored[0];
		var others = _.without(view.wretched, last);
		var scenes = new Array();
		while (scenes.length < view.victims - 1) {
			var index = random.int(0, others.length);
			scenes.push(others[index]);
			others.splice(index, 1);
		}
		scenes.push(last);
		return scenes;
	}

	function choosePatrolToReveal(view, hidden) {
		return baseline.choosePatrolToReveal(view, hidden);
	}

	return {
		chooseHideout: chooseHideout,
		placeWomen: placeWomen,
		wantsToWait: wantsToWait,
		chooseVictims: chooseVictims,
		choosePatrolToReveal: choosePatrolToReveal,
		chooseMove: chooseMove,
		options: options,
		debug: debug
	};
};

// The variants measured in docs/jack-ai.md, from the baseline's walking up to the full strategy
WC.strategicVariants = {
	'path': { path: true, risk: false, lookahead: false, hideout: false, hell: false },
	'path+risk': { path: true, risk: true, lookahead: false, hideout: false, hell: false },
	'path+risk+lookahead': { path: true, risk: true, lookahead: true, hideout: false, hell: false },
	'path+risk+lookahead+hideout': { path: true, risk: true, lookahead: true, hideout: true, hell: false },
	'strategic': { path: true, risk: true, lookahead: true, hideout: true, hell: true },
	'strategic-no-path': { path: false, risk: true, lookahead: true, hideout: true, hell: true },
	'strategic-no-risk': { path: true, risk: false, lookahead: true, hideout: true, hell: true },
	'strategic-no-lookahead': { path: true, risk: true, lookahead: false, hideout: true, hell: true },
	'strategic-no-hideout': { path: true, risk: true, lookahead: true, hideout: false, hell: true },
	'strategic-no-hell': { path: true, risk: true, lookahead: true, hideout: true, hell: false }
};
