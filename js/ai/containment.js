/* Containment: where a policeman should stand so that Jack can't kill next to his hideout and walk straight home
   (docs/detective-ai-v3.md).

   A night that starts with a murder one walk from Jack's hideout can end on Jack's first move, before any policeman
   moves. The only defence is a policeman already standing on a crossing that walk passes. The policemen stand where
   the last hunting turn left them: their positions then become the next night's patrol tokens (rules.patrolPositions).
   So every hunting turn's positions may have to defend the next night.

   This module values crossings for that defence, from the board and what the police know:
   - the possible hideouts, weighted (deduction.hideouts);
   - the circles where Jack could kill next: the red circles that are not crime scenes yet (women only go there), and,
     with less weight, the circles next to them (a waiting Jack lets the police move his victim one step).

   A threat is a (kill site, hideout) pair one walk apart. It is closed when a policeman stands on a crossing every such
   walk passes. Against a Jack who ends his nights in a move or two the police get very few turns, so a policeman
   several turns from such a crossing must start towards it early: a crossing is worth more the fewer police turns (two
   crossings each) it is from one that closes the threat, 1 / (1 + turns), up to `reach` turns. Everything here
   depends only on the map, so it is worked out once and remembered.

   Pure: no state, no page, no randomness. Used by js/ai/police.js when its containment options are on. */
var WC = WC || {};

WC.createContainment = function (board, _) {

	var blockers = {}; // 'site:home' -> crossings that each stop the walk on their own ([] when the two aren't one walk apart)
	var turnsFrom = {}; // crossing -> { crossing: police turns to reach it }, up to `maxTurns`
	var maxTurns = 4;

	function turns(from) {
		// Police turns (up to two crossings each) from a crossing to the crossings around it
		if (!turnsFrom[from]) {
			var result = {};
			result[from] = 0;
			var frontier = [from];
			for (var t = 1; t <= maxTurns && frontier.length > 0; t++) {
				var next = new Array();
				_.each(frontier, function (c) {
					_.each(board.crossingsWithinTwo(c), function (d) {
						if (!_.has(result, d)) {
							result[d] = t;
							next.push(d);
						}
					});
				});
				frontier = next;
			}
			turnsFrom[from] = result;
		}
		return turnsFrom[from];
	}

	function closeness(crossing, threat) {
		// 1 on a crossing that closes the threat, 1 / (1 + turns) when it takes turns to reach one, 0 beyond maxTurns
		var best = 0;
		_.each(threat.blockers, function (b) {
			var t = turns(b)[crossing];
			if (t !== undefined) {
				best = Math.max(best, 1 / (1 + t));
			}
		});
		return best;
	}

	function walkBlockers(site, home) {
		// The crossings that, with a policeman on them, stop Jack walking from site to home in one move
		var key = site + ':' + home;
		if (!blockers[key]) {
			var result = new Array();
			if (site != home && _.contains(board.walk(site, []), home)) {
				// A walk passes only crossings joined to the start through other crossings; try each
				var seen = {};
				var queue = _.reject(board.neighbours(site), function (id) { return board.isNumbered(id); });
				while (queue.length > 0) {
					var crossing = queue.shift();
					if (seen[crossing]) {
						continue;
					}
					seen[crossing] = true;
					if (!_.contains(board.walk(site, [crossing]), home)) {
						result.push(crossing);
					}
					_.each(board.neighbours(crossing), function (next) {
						if (!board.isNumbered(next) && !seen[next]) {
							queue.push(next);
						}
					});
				}
			}
			blockers[key] = result;
		}
		return blockers[key];
	}

	function killSites(crimeScenes, neighbourWeight, given) {
		// Where Jack could kill next, with weights: red circles not yet crime scenes (or the circles `given`, such as
		// the women already on the board), and the circles one step from them (where the police may have to move a
		// Wretched when Jack waits)
		var sites = {};
		_.each(given || board.redCircles(), function (red) {
			if (_.contains(crimeScenes, red)) {
				return;
			}
			sites[red] = 1;
			if (neighbourWeight > 0) {
				_.each(board.walk(red, []), function (next) {
					if (!_.contains(crimeScenes, next) && !sites[next]) {
						sites[next] = neighbourWeight;
					}
				});
			}
		});
		return sites;
	}

	function threats(homes, crimeScenes, options) {
		// Every open-able threat: { site, home, weight (hideout probability x site weight), blockers }
		options = options || {};
		var sites = killSites(crimeScenes, options.neighbourWeight || 0, options.sites);
		var list = new Array();
		_.each(homes, function (p, home) {
			home = Number(home);
			if (!(p > 0)) {
				return;
			}
			_.each(sites, function (w, site) {
				site = Number(site);
				var stops = walkBlockers(site, home);
				if (stops.length > 0) {
					list.push({ site: site, home: home, weight: p * w, blockers: stops });
				}
			});
		});
		return list;
	}

	function open(threat, police) {
		// Is this one-walk escape still possible with policemen on these crossings?
		return !_.some(threat.blockers, function (c) { return _.contains(police, c); });
	}

	function exposure(list, police) {
		// The weight of the threats left open by policemen on these crossings
		return _.reduce(list, function (sum, t) { return open(t, police) ? sum + t.weight : sum; }, 0);
	}

	function value(list, crossing, others) {
		// What a policeman on this crossing adds: for each threat, how close he is to closing it, beyond the closest
		// of `others` (policemen already placed; none for an independent value)
		return _.reduce(list, function (sum, t) {
			var mine = closeness(crossing, t);
			if (mine == 0) {
				return sum;
			}
			var theirs = _.reduce(others || [], function (m, o) { return Math.max(m, closeness(o, t)); }, 0);
			return sum + t.weight * Math.max(0, mine - theirs);
		}, 0);
	}

	return {
		walkBlockers: walkBlockers,
		killSites: killSites,
		threats: threats,
		open: open,
		exposure: exposure,
		value: value,
		closeness: closeness,
		turns: turns
	};
};

WC.containment = WC.createContainment(WC.board, _);
