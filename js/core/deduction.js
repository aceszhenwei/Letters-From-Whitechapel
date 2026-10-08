/* Deduction: what can be worked out about Jack from public information alone.
   Given a night's public record (WC.rules.publicLog: crime scenes, the type of each of Jack's moves, where the
   policemen stood, search and arrest results), it works out where Jack could be and how likely each place is,
   and across nights, where his hideout could be. It never looks at the game state, only at the record.

   The police AI uses it to hunt Jack. Jack's AI uses it to estimate how much a move gives away, which is fair:
   it is exactly what the police can see.

   Method: forward filtering over Jack's possible routes, step by step. Each state is a circle plus which of
   the clue circles the route has passed (a small bit mask). Every observation is applied exactly when it
   happened; the approximations (at most `maxClues` clues tracked, a coach's two stops treated as two free
   steps, a uniform guess about which way Jack goes) only ever keep more places possible, never fewer, so the
   true position is never ruled out. */
var WC = WC || {};

WC.deduction = (function (board, _) {

	var maxClues = 10; // Clues tracked exactly; older ones are ignored (keeping more places possible)

	/* Moves without police in the way, and lower bounds on moves to a hideout
	   ----------------------------------------------------------------------- */
	var freeWalks = {};
	function freeWalk(mapid) {
		if (!freeWalks[mapid]) {
			freeWalks[mapid] = board.walk(mapid, []);
		}
		return freeWalks[mapid];
	}

	var boundCache = {};
	function movesBound(targets, alleys) {
		// Fewest moves from each circle to the nearest target, walking or (if Jack has alleys) by alley.
		// A lower bound on the moves Jack needs, since coaches don't save moves
		var key = (alleys ? 'a' : 'w') + targets.join(',');
		if (boundCache[key]) {
			return boundCache[key];
		}
		var moves = {};
		var queue = [];
		_.each(targets, function (target) {
			moves[target] = 0;
			queue.push(target);
		});
		while (queue.length > 0) {
			var current = queue.shift();
			var next = freeWalk(current);
			if (alleys) {
				next = next.concat(board.alleys(current));
			}
			_.each(next, function (id) {
				if (!_.has(moves, id)) {
					moves[id] = moves[current] + 1;
					queue.push(id);
				}
			});
		}
		if (_.size(boundCache) > 200) {
			boundCache = {};
		}
		boundCache[key] = moves;
		return moves;
	}

	/* Reading a night's record
	   ------------------------ */
	function readLog(log) {
		var night = { scenes: null, steps: [], exclusions: {}, clues: [], noClue: [], escaped: false };
		var k = 0;
		_.each(log, function (entry) {
			if (entry.type == 'crime') {
				night.scenes = entry.scenes;
			} else if (entry.type == 'move') {
				if (entry.move == 'carriage') { // Two steps, past policemen
					night.steps.push({ kind: 'free' }, { kind: 'free' });
					k += 2;
				} else if (entry.move == 'alley') {
					night.steps.push({ kind: 'alley' });
					k += 1;
				} else {
					night.steps.push({ kind: 'walk', police: entry.police });
					k += 1;
				}
			} else if (entry.type == 'search') {
				(entry.clue ? night.clues : night.noClue).push({ mapid: entry.mapid, by: k });
			} else if (entry.type == 'arrest') {
				(night.exclusions[k] = night.exclusions[k] || []).push(entry.mapid);
			} else if (entry.type == 'escaped') {
				night.escaped = true;
			}
		});
		night.clues = night.clues.slice(-maxClues);
		return night;
	}

	var blockedWalks = new Map();
	function successors(mapid, step) {
		if (step.kind == 'alley') {
			return board.alleys(mapid);
		}
		if (step.kind == 'walk') {
			var key = mapid + '|' + step.police.join(',');
			if (!blockedWalks.has(key)) {
				if (blockedWalks.size > 100000) {
					blockedWalks.clear();
				}
				blockedWalks.set(key, board.walk(mapid, step.police));
			}
			return blockedWalks.get(key);
		}
		return freeWalk(mapid);
	}

	/* Where Jack could be
	   ------------------- */
	function track(log, options) {
		// options: remaining (moves Jack has left now), hideouts (possible hideouts), alleysLeft, trail (true to
		// also work out where his route may have passed). Returns null before the crime.
		// Result: { current: { mapid: probability }, size, entropy, visited: { mapid: probability } }
		options = options || {};
		var night = readLog(log);
		if (!night.scenes) {
			return null;
		}
		var steps = night.steps;
		var last = steps.length;
		var clueBit = {};
		_.each(night.clues, function (clue, index) {
			clueBit[clue.mapid] = clueBit[clue.mapid] || [];
			clueBit[clue.mapid].push(index);
		});
		var excludedAt = _.map(_.range(last + 1), function (k) { // Circles Jack was not on at step k
			var circles = new Set(night.exclusions[k] || []);
			_.each(night.noClue, function (search) {
				if (k <= search.by) {
					circles.add(search.mapid);
				}
			});
			return circles;
		});
		var excluded = function (mapid, k) {
			return excludedAt[k].has(mapid);
		};
		var bound = options.hideouts ? movesBound(options.hideouts, options.alleysLeft > 0) : null;
		var feasible = function (mapid, k) {
			// Jack must still be able to reach a possible hideout in the moves left at step k
			if (!bound || options.remaining === undefined) {
				return true;
			}
			var left = options.remaining + (last - k);
			return _.has(bound, mapid) && bound[mapid] <= left;
		};
		var visit = function (mask, mapid, k) {
			_.each(clueBit[mapid] || [], function (bit) {
				if (k <= night.clues[bit].by) {
					mask |= (1 << bit);
				}
			});
			return mask;
		};
		var settle = function (layer, k) {
			// Apply what is known about step k: failed searches and arrests, clue deadlines, time
			var kept = new Map();
			layer.forEach(function (weight, key) {
				var mapid = Math.floor(key / 4096);
				var mask = key % 4096;
				if (excluded(mapid, k) || !feasible(mapid, k)) {
					return;
				}
				var ok = true;
				_.each(night.clues, function (clue, bit) {
					if (clue.by == k && !(mask & (1 << bit))) {
						ok = false;
					}
				});
				if (ok) {
					kept.set(mapid * 4096 + mask, (kept.get(mapid * 4096 + mask) || 0) + weight);
				}
			});
			return kept;
		};

		var layers = [];
		var start = new Map();
		_.each(night.scenes, function (mapid) {
			start.set(mapid * 4096 + visit(0, mapid, 0), 1 / night.scenes.length);
		});
		layers.push(settle(start, 0));
		for (var k = 0; k < last; k++) {
			var next = new Map();
			layers[k].forEach(function (weight, key) {
				var mapid = Math.floor(key / 4096);
				var mask = key % 4096;
				var targets = successors(mapid, steps[k]);
				_.each(targets, function (to) {
					var nextKey = to * 4096 + visit(mask, to, k + 1);
					next.set(nextKey, (next.get(nextKey) || 0) + weight / targets.length);
				});
			});
			layers.push(settle(next, k + 1));
		}

		var current = marginal(layers[last]);
		var result = { current: current, size: _.size(current), entropy: entropy(current), steps: last };
		if (options.trail) {
			result.visited = trail();
		}
		result.next = function (move, police) {
			return project(layers[last], options.remaining, move, police);
		};
		return result;

		function project(layer, remaining, move, police) {
			// What the police would believe after one more move of this type, with the policemen where they are.
			// Cheap: one step on from the last layer (all clue deadlines have passed, so the masks no longer matter)
			var kinds = move == 'carriage' ? [{ kind: 'free' }, { kind: 'free' }] : (move == 'alley' ? [{ kind: 'alley' }] : [{ kind: 'walk', police: police }]);
			var left = remaining === undefined ? undefined : remaining - kinds.length;
			var currentLayer = layer;
			_.each(kinds, function (step, index) {
				var next = new Map();
				currentLayer.forEach(function (weight, key) {
					var targets = successors(Math.floor(key / 4096), step);
					_.each(targets, function (to) {
						next.set(to * 4096, (next.get(to * 4096) || 0) + weight / targets.length);
					});
				});
				var stepsLeft = left === undefined ? undefined : left + (kinds.length - 1 - index);
				if (bound && stepsLeft !== undefined) {
					next.forEach(function (weight, key) {
						var mapid = Math.floor(key / 4096);
						if (!_.has(bound, mapid) || bound[mapid] > stepsLeft) {
							next.delete(key);
						}
					});
				}
				currentLayer = next;
			});
			var distribution = marginal(currentLayer);
			return {
				current: distribution,
				size: _.size(distribution),
				entropy: entropy(distribution),
				next: function (nextMove, nextPolice) {
					return project(currentLayer, left, nextMove, nextPolice);
				}
			};
		}

		function trail() {
			// How likely each circle is to be on Jack's route tonight, using everything known up to now.
			// A backward pass keeps only the part of each step that leads to where Jack could be now
			var notVisited = {};
			var addStep = function (layer, beta) {
				var byCircle = {};
				var sum = 0;
				layer.forEach(function (weight, key) {
					var b = beta.get(key) || 0;
					if (b > 0) {
						var mapid = Math.floor(key / 4096);
						byCircle[mapid] = (byCircle[mapid] || 0) + weight * b;
						sum += weight * b;
					}
				});
				_.each(byCircle, function (w, mapid) {
					var p = Math.min(1, w / sum);
					notVisited[mapid] = (notVisited[mapid] === undefined ? 1 : notVisited[mapid]) * (1 - p);
				});
			};
			var beta = new Map();
			layers[last].forEach(function (weight, key) { beta.set(key, 1); });
			addStep(layers[last], beta);
			for (var k = last - 1; k >= 0; k--) {
				var previous = new Map();
				layers[k].forEach(function (weight, key) {
					var mapid = Math.floor(key / 4096);
					var mask = key % 4096;
					var targets = successors(mapid, steps[k]);
					var total = 0;
					_.each(targets, function (to) {
						total += (beta.get(to * 4096 + visit(mask, to, k + 1)) || 0) / targets.length;
					});
					if (total > 0) {
						previous.set(key, total);
					}
				});
				beta = previous;
				addStep(layers[k], beta);
			}
			var visited = {};
			_.each(notVisited, function (q, mapid) {
				visited[mapid] = 1 - q;
			});
			return visited;
		}
	}

	function marginal(layer) {
		var totals = {};
		var sum = 0;
		layer.forEach(function (weight, key) {
			var mapid = Math.floor(key / 4096);
			totals[mapid] = (totals[mapid] || 0) + weight;
			sum += weight;
		});
		_.each(totals, function (weight, mapid) {
			totals[mapid] = weight / sum;
		});
		return totals;
	}

	function entropy(distribution) {
		return -_.reduce(distribution, function (sum, p) {
			return p > 0 ? sum + p * Math.log2(p) : sum;
		}, 0);
	}

	/* Where the hideout could be
	   -------------------------- */
	function hideouts(pastLogs, choices) {
		// Each night Jack ended on his hideout, so it is where he could have been when he escaped, on every night.
		// Returns { mapid: probability } over the possible hideouts.
		var weights = {};
		_.each(choices, function (mapid) {
			weights[mapid] = 1;
		});
		_.each(pastLogs, function (log) {
			if (!_.findWhere(log, { type: 'escaped' })) {
				return;
			}
			var end = track(log);
			if (!end) {
				return;
			}
			_.each(_.keys(weights), function (mapid) {
				weights[mapid] *= end.current[mapid] || 0;
			});
		});
		var sum = _.reduce(weights, function (total, w) { return total + w; }, 0);
		var result = {};
		_.each(weights, function (w, mapid) {
			if (w > 0) {
				result[mapid] = w / sum;
			}
		});
		return _.size(result) > 0 ? result : _.object(choices, _.map(choices, function () { return 1 / choices.length; }));
	}

	return {
		track: track,
		hideouts: hideouts,
		movesBound: movesBound,
		readLog: readLog,
		entropy: entropy
	};
})(WC.board, _);
