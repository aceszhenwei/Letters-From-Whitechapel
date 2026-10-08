/* Board: questions about the map itself, independent of any game.
   Where can you walk from here? Which circles touch this crossing? How far apart are two circles?
   Uses the map data (js/data/map.js) and nothing else. */
var WC = WC || {};

WC.board = (function (map, _) {

	function numbered() {
		return map.key('number');
	}

	function redCircles() { // Red numbered circles, where women are placed
		return map.key('murder');
	}

	function stations() { // Yellow-bordered crossings, where patrols start
		return map.key('station');
	}

	function isNumbered(mapid) {
		return !!map[mapid].number;
	}

	function isRed(mapid) {
		return !!map[mapid].murder;
	}

	function isStation(mapid) {
		return !!map[mapid].station;
	}

	function neighbours(mapid) { // Places joined by a dotted line
		return map[mapid].adjacent;
	}

	function number(mapid) {
		return map[mapid].number;
	}

	function position(mapid) {
		return map[mapid].position;
	}

	function walk(from, blocked) {
		// Numbered circles next to a numbered circle, along dotted lines through crossings,
		// without passing the blocked crossings. This is how Jack and the Wretched move.
		var adjacentNumbers = new Array();
		blocked = blocked || [];

		var nextStep = function (array, blacklist) {
			_.each(array, function (id) {
				if (_.indexOf(blacklist, id) !== -1) { // If it's been processed already
					return;
				}
				blacklist.push(id); // Make sure it's not processed again

				if (_.indexOf(blocked, id) !== -1) { // Can't pass a blocked crossing
					return;
				}
				if (map[id].number) {
					adjacentNumbers.push(id); // Store numbers
				} else {
					nextStep(map[id].adjacent, blacklist); // Keep walking through crossings (map id 0 is a crossing too)
				}
			});
		}

		nextStep(map[from].adjacent, []); // Go
		return _.without(adjacentNumbers, from);
	}

	function crossingSteps(mapid) {
		// Crossings one step from a crossing, passing through numbered circles. This is how policemen move.
		var addNonNumber = function(array, id) {
			if (!map[id].number) {
				array.push(id);
				return array;
			} else {
				return _.union(withoutNumbers(_.filter(map[id].adjacent, function (mapid) {
					return !map[mapid].number;
				})), array);
			}
		}
		var withoutNumbers = function(current) {
			return _.reduce(current, function(memo, item) {
				return addNonNumber(memo, item);
			}, []);
		}
		return _.union(_.flatten(_.map(withoutNumbers([mapid]), function(a, i) {
				return withoutNumbers(map[a].adjacent);
			})
		))
	}

	function crossingsWithinTwo(mapid) {
		return _.union(_.flatten(_.map(crossingSteps(mapid), function (id) {
			return crossingSteps(id);
		})));
	}

	function adjacentNumbers(crossing) {
		// Numbered circles joined directly to a crossing, with no crossing in between (where police search and arrest)
		return _.filter(map[crossing].adjacent, function (adj) {
			return _.has(map[adj], 'number');
		});
	}

	function alleys(mapid) {
		// Numbered circles around the same block(s), computed from the map by map.computeAlleys
		return map[mapid].alley || [];
	}

	var distanceCache = {};

	function distancesTo(target) {
		// Fewest walking moves from every numbered circle to the target (ignoring police), by breadth-first search
		if (!distanceCache[target]) {
			var moves = {};
			moves[target] = 0;
			var queue = [target];
			while (queue.length > 0) {
				var current = queue.shift();
				_.each(walk(current, []), function (next) {
					if (!_.has(moves, next)) {
						moves[next] = moves[current] + 1;
						queue.push(next);
					}
				});
			}
			distanceCache[target] = moves;
		}
		return distanceCache[target];
	}

	function distance(from, to) {
		var moves = distancesTo(to);
		return _.has(moves, from) ? moves[from] : Infinity;
	}

	function straightLine(from, to) {
		return Math.hypot(Math.abs(map[from].position[0] - map[to].position[0]), Math.abs(map[from].position[1] - map[to].position[1]));
	}

	function shortestRoutes(from, to, blocked, maxLength) {
		// Shortest walking routes between two circles, found by growing routes from both ends until they meet.
		// Slow: only used for debugging (see the engine's debug option). Gives up after 7 steps from each end.
		var advance = function (routes) {
			var newRoutes = new Array();
			for (var a = 0; a < routes.length; a++) {
				var adjacent = walk(_.last(routes[a]), blocked);
				if (routes[a].length < maxLength) { // Don't advance a route that is out of moves
					for (var b = 0; b < adjacent.length; b++) {
						if (_.indexOf(routes[a], adjacent[b]) == -1) { // Don't retrace steps
							newRoutes.push(routes[a].concat([adjacent[b]]));
						}
					}
				}
			}
			return newRoutes;
		}
		var fromRoutes = [[from]];
		var toRoutes = [[to]];
		var result = { intersection: [], jackToIntersection: [], intersectionToBase: [] };

		var intersects = function () {
			var fromEnds = _.map(fromRoutes, _.last);
			var toEnds = _.map(toRoutes, _.last);
			var intersection = _.intersection(fromEnds, toEnds);
			if (intersection.length > 0) {
				result.intersection = intersection;
				_.each(intersection, function (meet) {
					_.each(fromEnds, function (end, b) { if (end == meet) result.jackToIntersection.push(fromRoutes[b]); });
					_.each(toEnds, function (end, b) { if (end == meet) result.intersectionToBase.push(toRoutes[b]); });
				});
			}
		}

		intersects(); // Already there
		while (result.jackToIntersection.length < 1 && fromRoutes.length > 0 && toRoutes.length > 0 && fromRoutes[0].length < 7) {
			fromRoutes = advance(fromRoutes);
			intersects();
			if (result.jackToIntersection.length > 0) break;
			toRoutes = advance(toRoutes);
			intersects();
		}

		result.moves = result.jackToIntersection.length > 0
			? result.jackToIntersection[0].length + result.intersectionToBase[0].length - 2
			: Infinity; // No route found within the limit
		return result;
	}

	return {
		size: map.length,
		numbered: numbered,
		redCircles: redCircles,
		stations: stations,
		isNumbered: isNumbered,
		isRed: isRed,
		isStation: isStation,
		neighbours: neighbours,
		number: number,
		position: position,
		walk: walk,
		crossingSteps: crossingSteps,
		crossingsWithinTwo: crossingsWithinTwo,
		adjacentNumbers: adjacentNumbers,
		alleys: alleys,
		distancesTo: distancesTo,
		distance: distance,
		straightLine: straightLine,
		shortestRoutes: shortestRoutes
	};
})(map, _);
