/* Strategic waiting: a choice between killing now and waiting, for any Jack AI (docs/jack-waiting.md).

   Waiting moves the Time of the Crime on, so Jack gets one more move tonight (up to 19 instead of 15), and he reveals
   a patrol token. But the police then move every Wretched one step, and they choose where. The strategic Jack only
   waits when his best victim would leave him fewer than 6 moves to spare, which with his hideouts never happens.

   This policy values both choices with the same measure: the chance of getting home that night, measured in
   calibration games (research/jack-waiting/calibrate.sh) by the moves he has to spare after the murder, whether the
   crime scene is within one police turn of a patrol token that could be real, and whether it is the last night.
   - Killing now is worth his best victim's chance.
   - Waiting is worth what he can still guarantee after the police move each Wretched where it hurts him most (they
     may; he doesn't assume they will be kind), with one more move, and then the same choice again, until he must kill.
   - The token he will reveal may be fake (two of the tokens are): when that alone would put a Wretched out of reach,
     the chance is weighed in.
   He waits only when waiting is worth more. Ties go to killing now. Everything comes from Jack's view.

   WC.createWaitingJack(board, base, _, options) returns `base` with this wantsToWait; every other decision is
   base's. options.table names the calibrated table ('jack-v2' or 'strategic'); options.info false ignores what a
   reveal may show. The last decision's working is in .debug.waiting. */
var WC = WC || {};

WC.waitingTables = {
	// The chance of escaping the night, by moves to spare after the murder (0 to 15 or more), whether the crime scene is
	// within one police turn of a token that could be real, and whether it is the last night. Measured for each base
	// Jack over 1,500 calibration games against the original police, v2 and v3, weighted equally (seeds 540001-540050;
	// research/jack-waiting/fit.js, results/escape-table.txt)
	'jack-v2': {
		earlyClear: [0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.929, 0.945, 0.952, 0.952, 0.952, 0.968, 0.968, 0.968],
		earlyReach: [0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.638, 0.652, 0.721, 0.721, 0.721, 0.868],
		lastClear: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.836, 0.836, 0.836, 0.838, 0.872, 0.872, 0.872, 0.892],
		lastReach: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.836, 0.836, 0.836, 0.838, 0.872, 0.872, 0.872, 0.892]
	},
	'strategic': {
		earlyClear: [0.866, 0.866, 0.866, 0.866, 0.866, 0.866, 0.866, 0.866, 0.891, 0.926, 0.93, 0.93, 0.95, 0.95, 0.95, 0.987],
		earlyReach: [0.697, 0.697, 0.697, 0.697, 0.697, 0.697, 0.697, 0.697, 0.697, 0.697, 0.697, 0.724, 0.793, 0.793, 0.793, 0.926],
		lastClear: [0.693, 0.693, 0.693, 0.693, 0.693, 0.693, 0.693, 0.693, 0.701, 0.701, 0.722, 0.722, 0.778, 0.778, 0.778, 0.778],
		lastReach: [0.693, 0.693, 0.693, 0.693, 0.693, 0.693, 0.693, 0.693, 0.694, 0.694, 0.694, 0.722, 0.778, 0.778, 0.778, 0.778]
	}
};

WC.createWaitingJack = function (board, base, _, options) {

	options = _.extend({ table: 'jack-v2', info: true }, options || {});
	var table = typeof options.table == 'string' ? WC.waitingTables[options.table] : options.table; // A table itself, for tests
	var debug = _.extend(base.debug || {}, { waiting: null });

	function escapeChance(spare, inReach, lastNight) {
		var row = table[(lastNight ? 'last' : 'early') + (inReach ? 'Reach' : 'Clear')];
		return spare < 0 ? 0 : row[Math.min(row.length - 1, spare)];
	}

	function reachOf(tokens) {
		// Circles a policeman starting on one of these crossings could search or arrest at in his first turn
		var circles = {};
		_.each(tokens, function (crossing) {
			_.each([crossing].concat(board.crossingsWithinTwo(crossing)), function (c) {
				_.each(board.adjacentNumbers(c), function (circle) { circles[circle] = true; });
			});
		});
		return circles;
	}

	function wantsToWait(view) {
		var lastNight = view.night >= WC.rules.config.nights - 1;
		var possible = _.pluck(_.reject(view.patrols(), function (p) { return p.revealed && !p.real; }), 'mapid');
		var reach = reachOf(possible);
		var hidden = _.pluck(_.reject(view.patrols(), 'revealed'), 'mapid');
		// A revealed fake leaves the board, so the fakes still hidden are the two less those missing from the board
		var tokens = WC.rules.config.police + WC.rules.config.fakePolice;
		var fakesLeft = Math.max(0, Math.min(hidden.length, WC.rules.config.fakePolice - (tokens - view.patrols().length)));
		var moves = function (time) { return WC.rules.config.trackLength - (6 - time) - (view.victims - 1); };
		var value = function (w, time, inReach) {
			return escapeChance(moves(time) - view.distanceToHideout(w), inReach, lastNight);
		};
		// The token the base AI would reveal next, and the chance it is fake: then any Wretched only it reaches is clear
		var next = hidden.length > 0 && options.info ? _.max(hidden, function (mapid) {
			var r = reachOf([mapid]);
			return _.filter(view.wretched, function (w) { return r[w]; }).length;
		}) : null;
		var withoutNext = next !== null ? reachOf(_.without(possible, next)) : reach;
		var fakeChance = next !== null && hidden.length > 0 ? fakesLeft / hidden.length : 0;
		var afterReveal = function (w, time) {
			// Value at `time`, after one more reveal
			var now = value(w, time, !!reach[w]);
			return reach[w] && !withoutNext[w] ? (1 - fakeChance) * now + fakeChance * value(w, time, false) : now;
		};
		var memo = {};
		function guaranteed(w, time) {
			// The most Jack can guarantee with this Wretched from `time` on: kill then, or wait and let the police move it
			// where it is worth least to him (it stays if it can't move). At V he must kill
			var key = w + ':' + time;
			if (_.has(memo, key)) {
				return memo[key];
			}
			var best = afterReveal(w, time);
			if (time < 5) {
				var to = view.wretchedMoves(w);
				var worst = _.min(_.map(to.length > 0 ? to : [w], function (next) { return guaranteed(next, time + 1); }));
				best = Math.max(best, worst);
			}
			memo[key] = best;
			return best;
		}
		var now = _.max(_.map(view.wretched, function (w) { return value(w, view.timeOfCrime, !!reach[w]); }));
		var wait = _.max(_.map(view.wretched, function (w) {
			var to = view.wretchedMoves(w);
			return _.min(_.map(to.length > 0 ? to : [w], function (next) { return guaranteed(next, view.timeOfCrime + 1); }));
		}));
		debug.waiting = {
			night: view.night,
			timeOfCrime: view.timeOfCrime,
			killNow: Math.round(now * 1000) / 1000,
			waitAtWorst: Math.round(wait * 1000) / 1000,
			revealFakeChance: Math.round(fakeChance * 1000) / 1000,
			decision: wait > now ? 'wait' : 'kill'
		};
		return wait > now;
	}

	return _.extend({}, base, { wantsToWait: wantsToWait, debug: debug, waitingOptions: options });
};
