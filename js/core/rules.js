/* Rules: what the rulebook allows, given the game state. The single source of truth for legality.
   Every function here only reads the state; changing it is the engine's job (js/core/engine.js).
   The engine, Jack's AI and the interface all ask these questions instead of answering them themselves. */
var WC = WC || {};

WC.rules = (function (board, _) {

	var config = {
		trackLength: 20, // Spaces on the move track: Roman numerals V to I, then 1 to 15
		carriages: [3, 2, 2, 1], // Coaches for each night
		alleys: [2, 2, 1, 1],
		women: [8, 7, 6, 4], // Woman tokens for each night
		wretched: [5, 4, 3, 1], // How many of them are marked (the Wretched)
		victims: [1, 1, 2, 1], // The third night is the double event
		police: 5, // Real patrol tokens (and policemen)
		fakePolice: 2,
		nights: 4
	};

	/* Reading the state
	   ----------------- */
	function nightIndex(state) {
		return state.jack.length - 1; // The current night, 0 to 3
	}

	function jackNight(state) {
		return _.last(state.jack);
	}

	function policeNight(state) {
		return _.last(state.police);
	}

	function jackPosition(state) {
		return _.last(jackNight(state).route);
	}

	/* Preparing the game and the scene
	   -------------------------------- */
	function hideoutChoices() {
		// Jack may choose any numbered circle for his hideout, except a red one
		return _.difference(board.numbered(), board.redCircles());
	}

	function isLegalHideout(mapid) {
		return _.contains(hideoutChoices(), mapid);
	}

	function targetCircles(state) {
		// Women go on red numbered circles, but not on crime scenes from earlier nights
		return _.difference(board.redCircles(), state.crimeScenes);
	}

	function womenTonight(state) {
		var night = nightIndex(state);
		return { women: config.women[night], marked: config.wretched[night] };
	}

	function isLegalWomen(state, marked, unmarked) {
		var targets = targetCircles(state);
		var counts = womenTonight(state);
		var all = marked.concat(unmarked);
		var markedCount = Math.min(counts.marked, targets.length);
		return marked.length == markedCount &&
			unmarked.length == Math.min(counts.women - counts.marked, targets.length - markedCount) &&
			_.uniq(all).length == all.length &&
			_.difference(all, targets).length == 0;
	}

	/* Patrolling the streets
	   ---------------------- */
	function patrolPositions(state) {
		// Where the patrol tokens can go, and which of them must be used.
		// First night: the yellow-bordered crossings. Later nights: a token on every crossing where a policeman
		// ended the previous night, and the other two on yellow-bordered crossings without a policeman.
		var previous = state.police.length > 1 ? state.police[state.police.length - 2].now : new Array();
		return {
			required: previous,
			all: _.union(previous, _.difference(board.stations(), previous)),
			others: config.police + config.fakePolice - previous.length // Tokens placed away from policemen
		};
	}

	function canPlacePatrol(state, mapid, kind) {
		// Can a real (kind 'real') or fake ('fake') patrol token go on this crossing now?
		var night = policeNight(state);
		var positions = patrolPositions(state);
		var tokens = kind == 'real' ? night.start : night.fake;
		var limit = kind == 'real' ? config.police : config.fakePolice;
		if (!_.contains(positions.all, mapid) || _.contains(tokens, mapid) || tokens.length >= limit) {
			return false;
		}
		var placed = _.contains(night.start, mapid) || _.contains(night.fake, mapid); // Switching real and fake is fine
		var placedElsewhere = _.difference(_.union(night.start, night.fake), positions.required).length;
		return placed || _.contains(positions.required, mapid) || placedElsewhere < positions.others;
	}

	function patrolsPlaced(state) {
		var night = policeNight(state);
		return night.start.length >= config.police && night.fake.length >= config.fakePolice;
	}

	/* The Time of the Crime and the move track
	   ---------------------------------------- */
	function mustKill(state) {
		return state.timeOfCrime >= 5; // On V Jack can no longer wait
	}

	function timeOfCrimeSpace(timeOfCrime) {
		// The move-track space of a Roman numeral: V is space 1, I is space 5
		return 6 - timeOfCrime;
	}

	function roman(number) {
		return ['', 'I', 'II', 'III', 'IV', 'V'][number];
	}

	function trackLabel(space) {
		// What is printed on a move-track space: V, IV, III, II, I, then 1 to 15
		return space <= 5 ? roman(6 - space) : String(space - 5);
	}

	function victimsTonight(state) {
		return Math.min(config.victims[nightIndex(state)], state.womenMarked.length);
	}

	function isLegalVictims(state, scenes) {
		return scenes.length == victimsTonight(state) &&
			_.uniq(scenes).length == scenes.length &&
			_.difference(scenes, state.womenMarked).length == 0;
	}

	/* Patrol tokens and the Wretched
	   ------------------------------ */
	function patrolTokens(state) {
		// Patrol tokens on the map (fake ones are removed when Jack reveals them)
		var night = policeNight(state);
		return _.difference(_.union(night.start, night.fake), _.intersection(night.revealed, night.fake));
	}

	function hiddenPatrols(state) {
		// Patrol tokens Jack hasn't revealed yet
		var night = policeNight(state);
		return _.difference(_.union(night.start, night.fake), night.revealed);
	}

	function isFakePatrol(state, mapid) {
		return _.contains(policeNight(state).fake, mapid);
	}

	function wretchedMoves(state, mapid) {
		// A Wretched moves to an adjacent numbered circle. It can't pass a patrol token, end next to one,
		// end on another Wretched, or end on a crime scene
		var patrols = patrolTokens(state);
		var nearPatrols = _.flatten(_.map(patrols, function (id) {
			return board.adjacentNumbers(id);
		}));
		return _.filter(board.walk(mapid, patrols), function (id) {
			return !_.contains(nearPatrols, id) && !_.contains(state.womenMarked, id) && !_.contains(state.crimeScenes, id);
		});
	}

	/* The police
	   ---------- */
	function policeDestinations(state, index) {
		// Crossings a policeman can move to: up to two crossings away, not where another policeman is
		var now = policeNight(state).now;
		return _.filter(board.crossingsWithinTwo(now[index]), function (id) {
			return !_.contains(now, id);
		});
	}

	function canMovePoliceman(state, index, to) {
		return to === policeNight(state).now[index] || _.contains(policeDestinations(state, index), to); // Staying is a move
	}

	function arrestable(crossing) {
		// Numbered circles a policeman can search or arrest at
		return board.adjacentNumbers(crossing);
	}

	function searchable(state, crossing) {
		// Leave out circles where a clue was already found and tonight's crime scenes
		return _.filter(arrestable(crossing), function (id) {
			return _.indexOf(policeNight(state).clue, id) < 0 && _.indexOf(jackNight(state).murder, id) < 0;
		});
	}

	/* Jack
	   ---- */
	function moveCost(move) {
		return move.type == 'carriage' ? 2 : 1; // A coach uses two spaces on the move track
	}

	function jackWalks(state, from) {
		// Jack walks to an adjacent numbered circle, never past a crossing with a policeman
		return board.walk(from, policeNight(state).now);
	}

	function canUseAlley(state, from, to) {
		return jackNight(state).alleys > 0 && _.contains(board.alleys(from), to);
	}

	function canUseCarriage(state, from, via, to) {
		// Two different circles, neither the start, even past policemen
		return jackNight(state).carriages > 0 && state.remainingMoves >= 2 &&
			_.contains(board.walk(from, []), via) && _.contains(board.walk(via, []), to) && to != from;
	}

	function jackSpecialMoves(state, from) {
		// Everywhere Jack could go using an alley or a coach (one coach route for each destination)
		var options = new Array();
		_.each(board.alleys(from), function (mapid) { // Alleys cut through the block, police can't block them
			if (canUseAlley(state, from, mapid)) {
				options.push({ mapid: mapid, type: 'alley', moves: 1 });
			}
		});
		if (jackNight(state).carriages > 0 && state.remainingMoves >= 2) {
			_.each(board.walk(from, []), function (via) { // Coaches move two steps and can pass police
				_.each(board.walk(via, []), function (mapid) {
					if (mapid != from && !_.findWhere(options, { mapid: mapid, type: 'carriage' })) {
						options.push({ mapid: mapid, type: 'carriage', via: via, moves: 2 });
					}
				});
			});
		}
		return options;
	}

	function jackCanMove(state) {
		// If Jack can't make a legal move, he loses
		var from = jackPosition(state);
		return !_.isEmpty(jackWalks(state, from)) || !_.isEmpty(jackSpecialMoves(state, from));
	}

	function isLegalJackMove(state, move) {
		var from = jackPosition(state);
		if (move.type == 'walk') {
			return _.contains(jackWalks(state, from), move.mapid);
		}
		if (move.type == 'alley') {
			return canUseAlley(state, from, move.mapid);
		}
		if (move.type == 'carriage') {
			return canUseCarriage(state, from, move.via, move.mapid);
		}
		return false;
	}

	function escapes(state, move) {
		// Jack escapes when a normal move takes him onto his hideout. A special movement onto it doesn't count
		return move.type == 'walk' && move.mapid == state.base;
	}

	function policeThreats(state) {
		// For each numbered circle, how many ways the policemen could arrest there next round,
		// from every crossing they have stood on tonight
		var reach = _.flatten(_.map(_.flatten(policeNight(state).route), function (mapid) {
			return board.crossingsWithinTwo(mapid);
		}));
		var circles = _.sortBy(_.flatten(_.map(reach, function (mapid) {
			return board.adjacentNumbers(mapid);
		})), function (id) { return id; });
		return _.countBy(circles, function (id) { return id; });
	}

	/* What Jack knows
	   --------------- */
	function jackView(state, options) {
		// The questions Jack's AI may ask. It shows Jack only what he would know at the table:
		// not which patrol tokens are real until he reveals them.
		var night = jackNight(state);
		var position = night && night.route.length > 0 ? _.last(night.route) : undefined;
		return {
			hideout: state.base,
			night: nightIndex(state),
			route: night ? night.route.slice() : [], // Jack's sheet tonight
			position: position,
			remainingMoves: state.remainingMoves,
			timeOfCrime: state.timeOfCrime,
			tokens: night ? { carriages: night.carriages, alleys: night.alleys } : null,
			targets: targetCircles(state), // Where women can go tonight
			women: night ? womenTonight(state) : null,
			wretched: state.womenMarked.slice(),
			victims: night ? victimsTonight(state) : 0,
			debug: !!(options && options.debug),
			walks: function () { return jackWalks(state, position); },
			specialMoves: function () { return jackSpecialMoves(state, position); },
			canMove: function () { return jackCanMove(state); },
			endsNight: function (move) { return escapes(state, move); },
			distanceToHideout: function (mapid) { return board.distance(mapid, state.base); },
			threats: function () { return policeThreats(state); },
			policeNow: function () { return policeNight(state).now.slice(); }
		};
	}

	return {
		config: config,
		nightIndex: nightIndex,
		jackNight: jackNight,
		policeNight: policeNight,
		jackPosition: jackPosition,
		hideoutChoices: hideoutChoices,
		isLegalHideout: isLegalHideout,
		targetCircles: targetCircles,
		womenTonight: womenTonight,
		isLegalWomen: isLegalWomen,
		patrolPositions: patrolPositions,
		canPlacePatrol: canPlacePatrol,
		patrolsPlaced: patrolsPlaced,
		mustKill: mustKill,
		timeOfCrimeSpace: timeOfCrimeSpace,
		roman: roman,
		trackLabel: trackLabel,
		victimsTonight: victimsTonight,
		isLegalVictims: isLegalVictims,
		patrolTokens: patrolTokens,
		hiddenPatrols: hiddenPatrols,
		isFakePatrol: isFakePatrol,
		wretchedMoves: wretchedMoves,
		policeDestinations: policeDestinations,
		canMovePoliceman: canMovePoliceman,
		arrestable: arrestable,
		searchable: searchable,
		moveCost: moveCost,
		jackWalks: jackWalks,
		jackSpecialMoves: jackSpecialMoves,
		jackCanMove: jackCanMove,
		isLegalJackMove: isLegalJackMove,
		escapes: escapes,
		policeThreats: policeThreats,
		jackView: jackView
	};
})(WC.board, _);
