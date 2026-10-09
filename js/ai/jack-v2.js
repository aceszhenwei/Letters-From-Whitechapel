/* Jack AI v2: the strategic Jack (js/ai/strategic-jack.js), unchanged, plus one habit that the Jack v2 study found
   makes him much harder to catch for police who guard his likely hideout (docs/jack-ai-v2.md):

   On each night but the last, while he has time to spare, his first moves walk AWAY from his hideout.

   Detective AI v2 reads a direct route home as pointing at the hideout, and stands between Jack and it on later
   nights. A route that starts by walking away points at many hideouts instead. On the last night there are no later
   nights to protect, so he goes home the best way he can. The rule only ever spends moves he can spare: a detour is
   taken only while at least `detourSpare` moves would still be left over after it.

   The study tried and left out (docs/jack-ai-v2.md): a planned waypoint detour, estimates of the way home that count
   where the policemen stand, random choice among nearly-best moves, and changes to how he chooses his hideout.

   Like every Jack AI it uses only Jack's view (WC.rules.jackView). */
var WC = WC || {};

WC.createJackV2 = function (board, deduction, random, _, options) {

	options = _.extend({
		detourMoves: 3, // Walk away from home while he has made at most this many moves tonight...
		detourSpare: 6, // ...while at least this many moves would be left to spare after the move...
		detourLastNight: false // ...and not on the last night, when no later night needs the hideout hidden
	}, options || {});

	var strategic = WC.createStrategicJack(board, deduction, random, _);
	var debug = _.extend(strategic.debug, { detours: 0, fallbacks: 0 }); // Moves made by the detour rule, and by the fallback

	function detour(view) {
		// A walk away from home, or null when the rule doesn't apply
		var lastNight = view.night >= WC.rules.config.nights - 1;
		if (lastNight && !options.detourLastNight) {
			return null;
		}
		var movesSoFar = view.route.length - 1; // His sheet starts with the crime scene
		var here = view.distanceToHideout(view.position);
		var spare = view.remainingMoves - here;
		// A move away costs two moves to spare: one there and one back
		if (movesSoFar > options.detourMoves || spare - 2 < options.detourSpare) {
			return null;
		}
		var away = _.filter(view.walks(), function (mapid) {
			return mapid != view.hideout && view.distanceToHideout(mapid) > here;
		});
		return away.length > 0 ? { mapid: away[random.int(0, away.length)], type: 'walk' } : null;
	}

	function fallback(view) {
		// A legal move whatever happens: the walk that gets closest to home, or any special movement the rules allow
		var walks = view.walks();
		if (walks.length > 0) {
			return { mapid: _.min(walks, function (mapid) { return view.distanceToHideout(mapid); }), type: 'walk' };
		}
		var special = view.specialMoves()[0];
		return special.type == 'carriage' ? { mapid: special.mapid, type: 'carriage', via: special.via } : { mapid: special.mapid, type: special.type };
	}

	function chooseMove(view) {
		var move = detour(view);
		if (move) {
			debug.detours++;
			return move;
		}
		try {
			return strategic.chooseMove(view);
		} catch (e) {
			// The strategic Jack's work per move is bounded (a fixed beam two moves deep), so this should never
			// happen; if it does, Jack still moves legally instead of stopping the game
			debug.fallbacks++;
			return fallback(view);
		}
	}

	return _.extend({}, strategic, {
		chooseMove: chooseMove,
		options: options,
		debug: debug,
		fallback: fallback
	});
};
