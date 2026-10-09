/* Police AI: a computer opponent for Jack, used to measure how well Jack plays (tools/simulate.js).
   It sees only what the police see at the table (WC.rules.policeView): it never reads Jack's route, position
   or hideout. It works out where Jack could be with WC.deduction, then:
   - moves each policeman to cover as much of Jack's likely position as possible,
   - arrests when one circle next to a policeman is likely enough, and otherwise
   - searches the circles next to him that Jack's route most likely passed.
   A second, simpler opponent (WC.randomPolice) makes random legal choices, like a careless player.

   Each police AI is an object with turn(game, view, random): it takes the police's actions for the current phase
   through the engine (togglePatrol, moveWretched, keepWretched, movePoliceman, chooseAction, search, arrest). */
var WC = WC || {};

WC.createPolice = function (board, rules, deduction, _, options) {

	options = _.extend({
		// Arrest when a circle next to the policeman holds at least this share of where Jack could be.
		// Tried 0.2, 0.3 and 0.45 against the baseline Jack (400 games each): 0.2 caught him slightly more often
		arrestAt: 0.2,
		// How much a policeman values standing near Jack's likely hideouts, against standing next to Jack now.
		// Tried 0.5 and 1.5: both made the police weaker (Jack won 2 to 9 points more often), so it is off
		blockWeight: 0,
		// The options below are off by default, so the original police play exactly as before. Detective AI v2 turns
		// some of them on (WC.policeVariants, docs/detective-ai-v2.md).
		// How the possible hideouts are weighted: 'walk', 'uniform' or 'hybrid' (with hideoutW and hideoutRho);
		// see deduction.hideouts
		hideoutWeighting: 'walk',
		hideoutW: 0,
		hideoutRho: 0,
		// Count only the hideouts Jack could still reach tonight, by how much of his likely position could reach them
		liveHideouts: false,
		// Policemen placed later this turn get credit only for guarding a hideout better than those already placed
		coordinate: false,
		// Value standing on the crossings next to a likely hideout: Jack can only end the night by walking onto it,
		// through one of them
		cordon: false
	}, options || {});

	var hideoutChoices = rules.hideoutChoices();

	var memory = { hideoutsFor: null, hideouts: null, beliefFor: null, belief: null };

	function belief(view, trail) {
		// What the police can work out now. Past nights don't change, and tonight's belief only changes when
		// something new is seen, so both are remembered between actions
		if (memory.hideoutsFor !== view.night) {
			memory.hideouts = deduction.hideouts(view.pastLogs(), hideoutChoices, {
				weighting: options.hideoutWeighting, w: options.hideoutW, rho: options.hideoutRho
			});
			memory.hideoutsFor = view.night;
		}
		var log = view.publicLog();
		var key = view.night + ':' + log.length + ':' + view.remainingMoves + ':' + !!trail;
		if (memory.beliefFor !== key) {
			memory.belief = deduction.track(log, {
				remaining: view.remainingMoves,
				hideouts: _.map(_.keys(memory.hideouts), Number),
				alleysLeft: view.jackTokens ? view.jackTokens.alleys : 0,
				trail: trail
			});
			memory.beliefFor = key;
		}
		return { jack: memory.belief, hideouts: memory.hideouts };
	}

	/* Hell
	   ---- */
	function placePatrols(game, view) {
		var positions = view.patrolPositions();
		var red = board.redCircles();
		var nearRed = function (crossing) { // How many red circles are within reach of this crossing
			return _.filter(red, function (circle) {
				return _.some(board.crossingsWithinTwo(crossing).concat([crossing]), function (id) {
					return _.contains(board.adjacentNumbers(id), circle);
				});
			}).length;
		};
		var ranked = _.sortBy(positions.all, function (crossing) { return -nearRed(crossing); });
		var real = positions.required.length > 0 ? positions.required.slice() : ranked.slice(0, rules.config.police);
		_.each(real, function (crossing) { game.togglePatrol(crossing, 'real'); });
		_.each(_.difference(ranked, real).slice(0, rules.config.fakePolice), function (crossing) { game.togglePatrol(crossing, 'fake'); });
	}

	function moveWretched(game, view) {
		// Keep the Wretched close to real patrols, so a murder happens near the policemen
		var pending = view.turn.pending;
		var from = view.wretched[pending[0]];
		var moves = view.wretchedMoves(from);
		if (moves.length == 0) {
			game.keepWretched(from);
			return;
		}
		var near = function (circle) {
			return _.min(_.map(view.police.start, function (crossing) {
				return _.min(_.map(board.adjacentNumbers(crossing), function (id) { return board.distance(circle, id); }));
			}));
		};
		game.moveWretched(from, _.min(moves, near));
	}

	/* Hunting
	   ------- */
	var entryMemory = {};
	function entries(home) {
		// The crossings next to a circle: the last step of any walk onto it passes one of them
		if (!entryMemory[home]) {
			entryMemory[home] = _.reject(board.neighbours(home), function (id) { return board.isNumbered(id); });
		}
		return entryMemory[home];
	}

	function liveWeights(homes, jack, view) {
		// Each possible hideout, weighted by how much of Jack's likely position could still reach it tonight
		var alleys = view.jackTokens ? view.jackTokens.alleys > 0 : false;
		var weights = {};
		var total = 0;
		_.each(homes, function (p, home) {
			var bound = deduction.movesBound([Number(home)], alleys);
			var reach = _.reduce(jack, function (sum, q, circle) {
				return _.has(bound, circle) && bound[circle] <= view.remainingMoves ? sum + q : sum;
			}, 0);
			weights[home] = p * reach;
			total += weights[home];
		});
		if (total === 0) {
			return homes;
		}
		_.each(weights, function (w, home) { weights[home] = w / total; });
		return weights;
	}

	function movePolice(game, view, random) {
		// Each policeman in turn moves where he covers the most of Jack's likely position that no one else covers
		// yet, plus some value for standing near Jack's likely hideouts (to cut off his way home)
		var known = belief(view, false);
		var jack = known.jack ? known.jack.current : {};
		var homes = _.size(known.hideouts) < hideoutChoices.length ? known.hideouts : {}; // Only once something is known
		if (options.liveHideouts && _.size(homes) > 0) {
			homes = liveWeights(homes, jack, view);
		}
		var covered = {};
		var guarded = {}; // With coordinate: for each hideout, how well the policemen placed so far guard it
		var now = view.police.now;
		var guard = function (to, home) {
			var near = _.min(_.map(board.adjacentNumbers(to), function (circle) { return board.distance(circle, Number(home)); }));
			return 1 / (1 + near);
		};
		_.each(_.range(now.length), function (index) {
			if (_.contains(view.turn.moved, index)) {
				return;
			}
			var score = function (to) {
				var circles = board.adjacentNumbers(to);
				var mass = _.reduce(circles, function (sum, circle) {
					return covered[circle] ? sum : sum + (jack[circle] || 0);
				}, 0);
				var block = _.reduce(homes, function (sum, p, home) {
					var g = guard(to, home);
					if (options.coordinate) {
						g = Math.max(0, g - (guarded[home] || 0));
					}
					if (options.cordon && _.contains(entries(Number(home)), to)) {
						g += 1 / entries(Number(home)).length;
					}
					return sum + p * g;
				}, 0);
				return mass + options.blockWeight * block + random() * 1e-6; // The tiny random part breaks ties
			};
			var best = _.max(view.destinations(index).concat([now[index]]), score);
			_.each(board.adjacentNumbers(best), function (circle) { covered[circle] = true; });
			if (options.coordinate) {
				_.each(homes, function (p, home) { guarded[home] = Math.max(guarded[home] || 0, guard(best, home)); });
			}
			game.movePoliceman(index, best);
		});
	}

	function clues(game, view) {
		var police = view.police;
		var index = _.find(_.range(police.now.length), function (i) {
			return !_.contains(view.turn.done, i) && (police.search[i].length > 0 || police.arrest[i].length > 0);
		});
		var known = belief(view, true);
		var jack = known.jack ? known.jack.current : {};
		var arrestable = police.arrest[index];
		var best = _.max(arrestable, function (circle) { return jack[circle] || 0; });
		if (arrestable.length > 0 && (jack[best] || 0) >= options.arrestAt) {
			game.chooseAction(index, 'arrest');
			game.arrest(index, best);
			return;
		}
		if (police.search[index].length == 0) {
			game.chooseAction(index, 'arrest');
			game.arrest(index, best);
			return;
		}
		var visited = known.jack && known.jack.visited ? known.jack.visited : {};
		var order = _.sortBy(_.compact(police.search[index].slice()), function (circle) { return -(visited[circle] || 0); });
		game.chooseAction(index, 'search');
		for (var i = 0; i < order.length; i++) {
			var result = game.search(index, order[i]);
			if (result !== 'miss') {
				break;
			}
		}
	}

	function turn(game, view, random) {
		switch (view.phase) {
			case 2: return placePatrols(game, view);
			case 5: return moveWretched(game, view);
			case 10: return movePolice(game, view, random);
			case 11: return clues(game, view);
		}
	}

	return { turn: turn, belief: belief, options: options };
};

/* Random police: random legal choices (the headless test player), as a weaker opponent */
WC.randomPolice = (function (_) {
	function turn(game, view, random) {
		var pick = function (list) { return list[Math.floor(random() * list.length)]; };
		switch (view.phase) {
			case 2: {
				var positions = view.patrolPositions();
				var real = positions.required.length > 0 ? positions.required.slice() : positions.all.slice(0, 5);
				_.each(real, function (id) { game.togglePatrol(id, 'real'); });
				_.each(_.difference(positions.all, real).slice(0, 2), function (id) { game.togglePatrol(id, 'fake'); });
				return;
			}
			case 5: {
				var from = view.wretched[view.turn.pending[0]];
				var moves = view.wretchedMoves(from);
				return moves.length > 0 ? game.moveWretched(from, pick(moves)) : game.keepWretched(from);
			}
			case 10: {
				var now = view.police.now;
				var index = _.find(_.range(now.length), function (i) { return !_.contains(view.turn.moved, i); });
				return game.movePoliceman(index, pick(view.destinations(index).concat([now[index]])));
			}
			case 11: {
				var police = view.police;
				var i = _.find(_.range(police.now.length), function (j) {
					return !_.contains(view.turn.done, j) && (police.search[j].length > 0 || police.arrest[j].length > 0);
				});
				if (police.search[i].length > 0 && (random() >= 0.2 || police.arrest[i].length == 0)) {
					game.chooseAction(i, 'search');
					var circles = police.search[i].slice();
					for (var c = 0; c < circles.length; c++) {
						if (circles[c] !== undefined && game.search(i, circles[c]) !== 'miss') break;
					}
					return;
				}
				game.chooseAction(i, 'arrest');
				return game.arrest(i, pick(police.arrest[i]));
			}
		}
	}
	return { turn: turn };
})(_);

WC.policeAI = WC.createPolice(WC.board, WC.rules, WC.deduction, _);

/* Police configurations for WC.createPolice (docs/detective-ai-v2.md). The original police use the defaults.
   Detective AI v2 weights the possible hideouts by how direct Jack's routes would have been to reach them (with a
   uniform floor, fitted on calibration seeds over three Jacks), stands between Jack and those hideouts, and arrests
   at 15% instead of 20%. Coordination, the cordon and live hideouts were tried and left out: they did not help
   against every Jack. */
WC.policeVariants = {
	original: {},
	v2: { hideoutWeighting: 'hybrid', hideoutW: 0.9, hideoutRho: 0.5, blockWeight: 1, arrestAt: 0.15 }
};
