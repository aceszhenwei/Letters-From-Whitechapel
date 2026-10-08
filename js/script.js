/*!
 * w
 * by David Apple
 * @davidappleremix
 */

/* Jack
   ---- */

var jack = new Array();

/* Police
   ------ */

var police = new Array();

/* Game
   ---- */
var game = {
	config: {
		state: 0,
		totalMoves: 20,
		startingMoves: 15,
		remainingMoves: 15,
		carriages: [3, 2, 2, 1], // Special movement tokens for each night
		alleys: [2, 2, 1, 1],
		women: 8,
		wretched: 4,
		police: 5,
		fakePolice: 2,
		womenMarked: new Array(),
		womenUnmarked: new Array(),
		nights: 4,
		over: false,
		debug: false // Calculate Jack's shortest routes to base on every move (CPU intensive)
	},
	nextState: function(x) {
		if (game.config.over) {
			return; // The game has ended
		}
		if (x !== undefined) { // State 0 is falsy, so check for undefined
			game.config.state = x;
		}
		$('.state').hide();
		draw.updateTitle();
		switch(game.config.state) {
			case 0:
				game.preparingTheScene();
			break;
			case 1:
				game.theTargetsAreIdentified();
			break;
			case 2:
				game.patrollingTheStreets();
			break;
			case 4:
				game.bloodOnTheStreets();
			break;
			case 5:
				game.suspenseGrows();
			break;
			case 8:
				game.alarmWhistles();
			break;
			case 9:
				game.escapeTheNight();
			break;
			case 10:
				game.huntingTheMonster();
			break;
			case 11:
				game.cluesAndSuspicion();
			break;
		}
	},
	preparingTheScene: function () {
		var night = jack.length;
		$('<p></p>', {
			text: 'Jack collects the special movement tokens (' + game.config.carriages[night] + ' carriages and ' + game.config.alleys[night] + ' alleys).'
		}).prependTo('.preparing-the-scene');

		// Reset the night
		game.config.remainingMoves = game.config.startingMoves;
		game.config.womenMarked = new Array();
		game.config.womenUnmarked = new Array();
		$('.move-tracker p span').removeClass('active murder carriage alley');
		$('.move-tracker p span:nth-child(' + (game.config.totalMoves - game.config.remainingMoves + 1) + ')').addClass('active');

		jack[jack.length] = { // New night
			route: new Array(),
			moves: new Array(), // Each move Jack makes: { mapid, type: 'walk', 'alley' or 'carriage', via }
			murder: new Array(),
			murderMove: new Array(),
			carriages: game.config.carriages[night],
			alleys: game.config.alleys[night]
		}
		police[police.length] = {
			fake: new Array(),
			start: new Array(),
			revealed: new Array(),
			route: new Array(),
			now: new Array(),
			search: new Array(), // How many adjacent numbers are searchable
			arrest: new Array(), // How many adjacent numbers are arrestable
			clue: new Array()
		}
		draw.jackLog();
		game.nextState(1);
	},
	theTargetsAreIdentified: function () {
		var mapMurders = map.key('murder');
		mapMurders = game.sortSevenSteps(mapMurders);
		while (game.config.womenMarked.length < game.config.wretched) {
			// More likely to select murder spots 7 steps from base
			var index = game.randomSafeIndex(0.9, mapMurders.length);
			game.config.womenMarked.push(mapMurders[index]); // Randomly select wreched
			mapMurders.splice(index, 1); // Prevent possibility of choosing duplicate locations
		}
		while (game.config.womenUnmarked.length < (game.config.women - game.config.wretched)) {
			var index = game.randomInt(0, mapMurders.length);
			game.config.womenUnmarked.push(mapMurders[index]); // Randomly select unmarked women
			mapMurders.splice(index, 1); // Prevent possibility of choosing duplicate locations
		}
		game.nextState(2);
	},
	patrollingTheStreets: function () {
		$('.patrolling-the-streets').show();
		$('.patrolling-the-streets .next-state').hide();
		$('<p></p>', {
			text: 'The head of the investigation places ' + game.config.police + ' police patrol tokens and ' + game.config.fakePolice + ' fake police tokens on the map.'
		}).prependTo('.state.patrolling-the-streets');
		for (var a = 0; a < map.length; a++) {
			if (($.inArray(a, game.config.womenMarked) !== -1) || ($.inArray(a, game.config.womenUnmarked) !== -1)) {
				var classes = 'label label-info token token-woman token-woman-' + a;
				draw.createElement(a, '', classes).appendTo('.map');
			}
			if (map[a].station) {
				var classes = 'label label-info selectable token token-police marked token-police-' + a;
				draw.createElement(a, 'police', classes).appendTo('.map');
				classes = 'label label-info selectable token token-police unmarked token-police-' + a;
				draw.createElement(a, 'not police', classes).appendTo('.map');
			}
		}
		$('.token-police').click(function(){
			var mapid = $(this).data('mapid');
			if ($(this).hasClass('marked')) {
				if ($(this).hasClass('selected')) {
					$(this).removeClass('selected');
					_.last(police).start = _.without(_.last(police).start, mapid); // Splice the mapid
				} else {
					if (_.last(police).start.length < game.config.police) {
						$(this).addClass('selected');
						_.last(police).start.push(mapid);
						if ($(this).next().hasClass('selected')) {
							$(this).next().removeClass('selected');
							_.last(police).fake = _.without(_.last(police).fake, mapid);
						}
					}
				}
			}
			if ($(this).hasClass('unmarked')) {
				if ($(this).hasClass('selected')) {
					$(this).removeClass('selected');
					_.last(police).fake = _.without(_.last(police).fake, mapid);
				} else {
					if (_.last(police).fake.length < game.config.fakePolice) {
						$(this).addClass('selected');
						_.last(police).fake.push(mapid);
						if ($(this).prev().hasClass('selected')) {
							$(this).prev().removeClass('selected');
							_.last(police).start = _.without(_.last(police).start, mapid);
						}
					}
				}
			}
			if (_.last(police).start.length >= game.config.police && _.last(police).fake.length >= game.config.fakePolice) {
				$('.token-woman').remove();
				$('.token-police').remove();
				game.nextState(4);
			}
		});
	},
	bloodOnTheStreets: function () {
		$('<p></p>', {
			text: 'Jack chooses between killing or waiting.'
		}).prependTo('.state.blood-on-the-streets');

		if (jack[jack.length - 1].route.length == 0) {
			if (game.config.totalMoves > game.config.remainingMoves) { // If Jack has enough moves to reveal a police token
				var randomIndex = Math.random(); // Jack chooses between killing or waiting based on the toss of a coin
				if (randomIndex > 0.5) {
					game.config.remainingMoves++;
					game.revealPolice();
					game.nextState(5);
				} else {
					game.murder();
					game.config.remainingMoves--;
					$('.token-police').remove();
					game.nextState(8);
				}
			} else { // Forced to murder
				game.murder();
				game.config.remainingMoves--;
				$('.token-police').remove();
				game.nextState(8);
			}
		} else {
			console.log('Error: Multiple murders attempted.');
		}
	},
	suspenseGrows: function() {
		$('.suspense-grows').show();
		if ($.inArray(_.last(_.last(police).revealed), _.last(police).fake) !== -1) {
			$('<p></p>', {
				text: 'Jack has discovered that a police token is not real.'
			}).prependTo('.state.suspense-grows');
		}

		var movedWretched = 0;

		// Move the time of crime token back
		var availableMoves = game.config.totalMoves - game.config.remainingMoves + 1;
		$('.move-tracker p span').removeClass('active');
		$('.move-tracker p span:nth-child(' + availableMoves + ')').addClass('active');

		for (var a = 0; a < map.length; a++) {
			if ($.inArray(a, game.config.womenMarked) !== -1) {
				var classes = 'label label-info selectable token token-wretched token-wretched-' + a;
				draw.createElement(a, 'wretched', classes).appendTo('.map');
			}
			if ($.inArray(a, _.last(police).revealed) !== -1) {
				if ($.inArray(a, _.last(police).start) !== -1) {
					var classes = 'label label-info revealed token token-police token-police-' + a;
					draw.createElement(a, 'real police', classes).appendTo('.map');
				}
			} else {
				if (($.inArray(a, _.last(police).start) !== -1) || ($.inArray(a, _.last(police).fake) !== -1)) {
					var classes = 'label label-info token token-police token-police-' + a;
					draw.createElement(a, 'police', classes).appendTo('.map');
				}
			}
		}
		$('.token-wretched').click(function(){
			var mapid = $(this).data('mapid');

			// Cannot move wretched adjacent to a police token
			var allPolice = _.union(_.last(police).start, _.last(police).fake);
			var illegalMoves = _.map(allPolice, function(num, key) {
				// But revealed police that are unmarked are fine
				if (!(_.contains(_.intersection(_.last(police).revealed, _.last(police).fake), num))) {
					return map[num].adjacent;
				}
			});
			// Also cannot move wretched on top of another wretched
			illegalMoves.push(game.config.womenMarked);

			// TODO: Wretched tokens cannot move past police tokens or on crime scene markers

			illegalMoves = _.flatten(illegalMoves);

			for (var b = 0; b < map[mapid].adjacentNumber.length; b++) {
				if ($.inArray(map[mapid].adjacentNumber[b], illegalMoves) == -1) {
					var classes = 'label label-info selectable token token-move-wretched token-wretched-' + map[mapid].adjacentNumber[b];
					draw.createElement(map[mapid].adjacentNumber[b], 'move here', classes).data('mapidPrev', mapid).click(function(){
						var index = game.config.womenMarked.indexOf(mapid); // Find previous map id in array
						if (index !== -1) {
							game.config.womenMarked[index] = $(this).data('mapid'); // Replace map id in array with new location
						}
						$(this).removeClass('selectable token-move-wretched').addClass('token-wretched').text('wretched').unbind('click');
						$('.token-move-wretched').remove();
						movedWretched++;
						if (movedWretched >= game.config.wretched) {
							$('.token-wretched').remove();
							game.nextState(4);
						}
					}).appendTo('.map');
				}
			}
			$('.token-wretched-' + mapid).remove();
		});
	},
	alarmWhistles: function () {
		_.last(police).route = _.map(_.last(police).start, function (mapid) { // Setup police to move
			_.last(police).now.push(mapid);
			return [mapid];
		});
		game.nextState(9);
	},
	escapeTheNight: function () {
		if (game.config.remainingMoves <= 0) {
			game.end('Jack ran out of moves before reaching his base. The police win!');
			return;
		}
		if ( jack.canMove() ) {
			var move = jack.move();
			var night = _.last(jack);
			var trackerMove = game.config.totalMoves - game.config.remainingMoves + 1;
			if (move.type == 'carriage') {
				night.route.push(move.via); // Jack passes through, so police can find clues here
				night.carriages--;
				game.config.remainingMoves--; // A carriage uses two moves
				$('.move-tracker p span:nth-child(' + trackerMove + '), .move-tracker p span:nth-child(' + (trackerMove + 1) + ')').addClass('carriage');
			}
			if (move.type == 'alley') {
				night.alleys--;
				$('.move-tracker p span:nth-child(' + trackerMove + ')').addClass('alley');
			}
			night.route.push(move.mapid);
			night.moves.push(move);
			draw.jackLog();
		} else {
			game.end('Jack is trapped by the police and cannot move. The police win!');
			return;
		}

		// Announce the end of the night (but not too early)
		if (_.last(jack).route.length >= 6) {
			if (_.last(_.last(jack).route) == game.config.base) {
				console.log('Jack has reached his base.');
				$('.token').remove();
				if (jack.length >= game.config.nights) {
					game.end('Jack has escaped for ' + game.config.nights + ' nights. Jack wins!');
				} else {
					game.nextState(0); // Start a new night
				}
				return;
			}
		}

		$('.move-tracker p span:nth-child(' + _.last(jack).murderMove[_.last(jack).murderMove.length - 1] + ')').addClass('murder');
		var availableMoves = game.config.totalMoves - game.config.remainingMoves + 1;
		$('.move-tracker p span').removeClass('active');
		$('.move-tracker p span:nth-child(' + availableMoves + ')').addClass('active');
		game.nextState(10);
	},
	huntingTheMonster: function () {
		$('.hunting-the-monster').show();
		$('.hunting-the-monster .next-state').hide();
		$('<p></p>', {
			text: 'Each policeman pawn moves.'
		}).prependTo('.state.hunting-the-monster');

		var movedPolice = 0;
		var policeCounter = 0;
		for (var a = 0; a < map.length; a++) {
			if ($.inArray(a, _.last(police).now) !== -1) {
				var classes = 'label label-info selectable revealed token token-police police-' + policeCounter + ' token-police-' + a;
				draw.createElement(a, 'police', classes).appendTo('.map');
				policeCounter++;
			}
			if (a == _.last(_.last(jack).murder)) {
				draw.murder(a);
			}
		}
		$('.token-police').click(function(){
			var mapid = $(this).data('mapid');
			var twoSteps = game.twoSteps(mapid);

			for (var b = 0; b < twoSteps.length; b++) {
				if ($.inArray(twoSteps[b], _.last(police).now) == -1) {
					var classes = 'label label-info selectable token token-move-police token-police-' + twoSteps[b];
					draw.createElement(twoSteps[b], 'move here', classes).data('mapidPrev', mapid).click(function(){
						var index = _.last(police).now.indexOf($(this).data('mapidPrev')); // Find previous map id in array
						var mapid = $(this).data('mapid');
						if (index !== -1) {
							police[police.length - 1].route[index].push(mapid);
							police[police.length - 1].now[index] = mapid;
						}
						$(this).removeClass('selectable token-move-police').addClass('token-police').text('real police').unbind('click');
						$('.token-move-police').remove();
						movedPolice++;
						if (movedPolice >= _.last(police).now.length) {
							$('.token-police').remove();
							game.nextState(11);
						}
					}).appendTo('.map');
				}
			}
			$('.token-police-' + mapid).remove();

			var classes = 'label label-info selectable token token-move-police token-police-' + mapid;
			draw.createElement(mapid, 'don\'t move', classes).data('mapidPrev', mapid).click(function(){
				var index = _.last(police).now.indexOf(mapid); // Find previous map id in array
				if (index !== -1) {
					police[police.length - 1].route[index].push($(this).data('mapid'));
				}
				$(this).removeClass('selectable token-move-police').addClass('token-police').text('real police').unbind('click');
				$('.token-move-police').remove();
				movedPolice++;
				if (movedPolice >= _.last(police).now.length) {
					$('.token-police').remove();
					game.nextState(11);
				}
			}).appendTo('.map');
		});
	},
	cluesAndSuspicion: function () {
		$('.clues-and-suspicion').show();
		$('.clues-and-suspicion .next-state').hide();

		$('<p></p>', {
			text: 'Each policeman pawn either looks for clues or executes an arrest.'
		}).prependTo('.clues-and-suspicion');

		var movedPolice = 0;
		var completePolice = 0;

		_.last(police).search = _.map(_.last(police).now, function (mapid) {
			return game.searchable(mapid);
		});
		_.last(police).arrest = _.map(_.last(police).now, function (mapid) {
			return game.arrestable(mapid);
		});

		for (var a = 0; a < map.length; a++) {
			if ($.inArray(a, _.last(police).now) !== -1) {
				var classes = 'label label-info selectable token token-search-adjacent token-search-adjacent-' + a;
				draw.createElement(a, 'search', classes).appendTo('.map');
				classes = 'label label-info selectable token token-arrest-adjacent token-arrest-adjacent-' + a;
				draw.createElement(a, 'arrest', classes).appendTo('.map');

			}
			if (a == _.last(_.last(jack).murder)) {
				draw.murder(a);
			}
		}
		$('.token-arrest-adjacent').click(function(){
			var mapid = $(this).data('mapid');
			var index = _.indexOf(_.last(police).now, mapid);

			for (var b = 0; b < _.last(police).arrest[index].length; b++) {
				var classes = 'label label-info selectable token token-arrest';
				draw.createElement(_.last(police).arrest[index][b], 'arrest', classes).click(function(){
					var mapid = $(this).data('mapid');
					if (mapid == _.last(_.last(jack).route)) {
						console.log('Jack has been arrested.');
						game.end('Jack has been arrested at ' + map[mapid].number + '. The police win!');
						return;
					} else {
						console.log('Jack has not been arrested.');
					}
					$('.token-arrest').remove();
					_.last(police).search[index] = undefined;
					if (_.isEmpty(_.compact(_.flatten(_.last(police).search)))) {
						$('.token.selectable').remove();
						game.config.remainingMoves--;
						game.nextState(9);
					}
				}).appendTo('.map');
			}
			$(this).prev().remove();
			$(this).remove();
		});
		$('.token-search-adjacent').click(function(){
			var mapid = $(this).data('mapid');
			var index = _.indexOf(_.last(police).now, mapid);

			for (var b = 0; b < _.last(police).search[index].length; b++) {
				var classes = 'label label-info selectable token token-search token-search-' + _.last(police).search[index][b];
				draw.createElement(_.last(police).search[index][b], 'search', classes).click(function(){
					var mapidAdjacent = $(this).data('mapid');
					if ($.inArray(mapidAdjacent, _.last(jack).route) !== -1) {
						console.log('Clue found at ' + map[mapidAdjacent].number + '.');
						$('.token-search').remove();
						_.last(police).search[index] = undefined;
						_.last(police).clue.push(mapidAdjacent);
						draw.clue(mapidAdjacent);
					} else {
						console.log('No clue found.');
						$(this).remove();
						_.last(police).search[index][_.indexOf(_.last(police).search[index], mapidAdjacent)] = undefined;
					}
					if (_.isEmpty(_.compact(_.flatten(_.last(police).search)))) {
						$('.token.selectable').remove();
						game.config.remainingMoves--;
						game.nextState(9);
					}
				}).appendTo('.map');
			}
			$(this).next().remove();
			$(this).remove();
		});
	},
	selectBase: function () {
		var mapNumbers = map.key('number');
		game.config.base = mapNumbers[ game.randomInt(0, mapNumbers.length) ];
	},
	randomFloat: function (highest) {
		return Math.random() * highest;
	},
	randomLog: function () {
		var randomLog = Math.log(Math.random() * 22026.4657948066);
		if (randomLog < 0) { // Prevent the very rare occassions when this is negative
			randomLog = 0;
		}
		return randomLog; // Returns a float between 0 and 9.9999999999
	},
	randomInt: function (lowest, highest) { // Returns an integer from lowest up to (but not including) highest
		return Math.floor(game.randomFloat(highest - lowest)) + lowest;
	},
	randomSafe: function (percentage) { // For example game.randomSafe(0.5) would be 50% safe
		var randomFloat = game.randomFloat(10) * (1 - percentage);
		var randomLog = game.randomLog() * percentage;
		return randomFloat + randomLog;
	},
	randomSafeIndex: function (percentage, length) {
		// Returns an index into an array of the given length, more likely to be near the start
		var index = Math.floor(Math.abs((game.randomSafe(percentage) / 10) - 1) * length);
		return Math.max(0, Math.min(index, length - 1));
	},
	end: function (message) {
		console.log(message);
		game.config.over = true;
		$('.token').remove();
		$('.state').hide();
		$('.game-over').text(message).show();
	},
	revealPolice: function() {
		var randomIndex = Math.floor(Math.random() * (_.last(police).start.length + _.last(police).fake.length)) + 1; // Randomly select a police (marked or unmarked)
		if (randomIndex <= _.last(police).start.length) {
			var mapid = _.last(police).start[randomIndex - 1];
		} else {
			var mapid = _.last(police).fake[randomIndex - _.last(police).start.length - 1];
		}
		_.last(police).revealed.push(mapid);
	},
	murder: function() {
		game.config.womenMarked = game.sortSevenSteps(game.config.womenMarked);

		// TODO: If there are revealed police, murder far from them?

		var randomIndex = game.randomSafeIndex(0.2, game.config.womenMarked.length);
		
		var mapid = game.config.womenMarked[randomIndex];
		jack[jack.length - 1].route.push(mapid); // Put Jack at the scene of the crime
		jack[jack.length - 1].murder.push(mapid);
		jack[jack.length - 1].murderMove.push(game.config.totalMoves - game.config.remainingMoves + 1);
	},
	sortSevenSteps: function (arrayToSort) {
		// Sort by moves to base (7 being optimal)

		var arrayMoves = new Array();

		for (var a = 0; a < arrayToSort.length; a++) {
			arrayMoves.push(jack.baseDistance(arrayToSort[a]));
		}

		var object = _.sortBy(_.map(arrayToSort, function(mapid, index) {
			var sevenOffset = Math.abs( arrayMoves[index] - 7 );
			return { mapid: mapid, moves: arrayMoves[index], sevenOffset: sevenOffset };
		}), 'sevenOffset');

		var sortedArray = _.map(object, function(item) {
			return item.mapid;
		});

		return sortedArray;
	},
	oneStep: function (mapid) {
		// Show all possible police movements
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
	},
	twoSteps: function (mapid) {
		return _.union(_.flatten(_.map(game.oneStep(mapid), function (id) {
			return game.oneStep(id);
		})));
	},
	threeSteps: function (mapid) {
		return _.union(_.flatten(_.map(game.twoSteps(mapid), function (id) {
			return game.oneStep(id);
		})));
	},
	arrestable: function (mapid) {
		// Show all searchable (or arrestable) numbered map ids given a police location
		return _.filter(map[mapid].adjacent, function (adj) {
			return _.has(map[adj], 'number');
		});
	},
	searchable: function (mapid) {
		// Filter locations with clues and murder spots
		return _.filter(game.arrestable(mapid), function (id) {
			return _.indexOf(_.last(police).clue, id) < 0 && _.indexOf(_.last(jack).murder, id) < 0;
		});
	},
	sort: function (array) {
		return _.sortBy(array, function (num) {
			return num;
		});
	}
}

jack.move = function () {
	// Returns Jack's next move: { mapid: destination, type: 'walk', 'alley' or 'carriage', via: carriage stop }

	var from = _.last(_.last(jack).route);
	var arrestable = jack.arrestable();
	var walks = jack.oneStep(from, true); // Prevent moving through police

	if (game.config.debug) { // Save this info to jack for console reference
		_.last(jack).shortestRoutes = jack.bruteForceRoute(from);
		_.last(jack).shortestRoutesAvoidPolice = jack.bruteForceRoute(from, true);
	}

	var special = jack.chooseSpecial(from, walks, arrestable);
	if (special) {
		return special;
	}
	return { mapid: jack.walk(walks, arrestable), type: 'walk' };
}

jack.arrestable = function () {
	// Everywhere police could be
	var policeMoves = _.flatten(_.map(_.flatten(_.last(police).route), function (mapid) {
		return game.twoSteps(mapid);
	}));

	// Everywhere police could arrest (and angles from which it can be arrested)
	return _.countBy(game.sort(
		_.flatten(_.map(policeMoves, function (mapid) {
			return game.arrestable(mapid);
		}))
	), function (num) {
		return num;
	});
}

jack.walk = function (adjacentNumber, arrestable) {
	// Choose an adjacent number to walk to

	// TODO: If close to base but too early in the night; avoid base

	var adjacent = new Array();
	var baseX = map[game.config.base].position[0];
	var baseY = map[game.config.base].position[1];

	var randomIndex;

	for (var a = 0; a < adjacentNumber.length; a++) { // For each position adjacent to Jack
		var baseDistance = Math.hypot(Math.abs(map[adjacentNumber[a]].position[0] - baseX), Math.abs(map[adjacentNumber[a]].position[1] - baseY));
		adjacent[a] = new Array(); // Create a lovely array of options listing pros and cons
		adjacent[a].mapid = adjacentNumber[a];
		adjacent[a].distance = baseDistance;
		adjacent[a].arrestable = _.has(arrestable, adjacentNumber[a]) ? arrestable[adjacentNumber[a]] : false;
	}

	switch (_.last(jack).route.length) {
		case 1: // Jack's first move
			adjacent = _.sortBy(adjacent, 'distance');
			adjacent = _.sortBy(adjacent, 'arrestable');
			var unarrestableCount = _.filter(adjacent, function (obj) { return obj.arrestable === false; }).length;
			if (unarrestableCount > 0) {
				adjacent.splice(unarrestableCount, (adjacent.length - unarrestableCount)); // Splice arrestable locations
			}
			randomIndex = game.randomSafeIndex(0.99, adjacent.length);
		break;
		case 2: // Jack's second move
			adjacent = _.sortBy(adjacent, 'distance');
			adjacent = _.sortBy(adjacent, 'arrestable');
			randomIndex = game.randomSafeIndex(0.99, adjacent.length);
		break;
		// TODO: If less than (three) moves from base; move away from base
		default:
			// After 6 moves, if Jack can move to his base; make it so
			var baseIndex = _.indexOf(_.pluck(adjacent, 'mapid'), game.config.base);
			if (_.last(jack).route.length >= 6 && baseIndex !== -1) {
				randomIndex = baseIndex;
			} else {
				adjacent = _.sortBy(adjacent, 'distance');
				randomIndex = game.randomSafeIndex(0.99, adjacent.length);
			}
		break;
	}

	// Save this info to jack for console reference
	_.last(jack).adjacent = adjacent;

	return adjacent[randomIndex].mapid;
}

jack.specialOptions = function (from) {
	// Everywhere Jack could go using an alley or a carriage
	var night = _.last(jack);
	var options = new Array();
	if (night.alleys > 0) {
		_.each(map[from].alley, function (mapid) { // Alleys cut through the block, police can't block them
			options.push({ mapid: mapid, type: 'alley', moves: 1 });
		});
	}
	if (night.carriages > 0 && game.config.remainingMoves >= 2) {
		_.each(jack.oneStep(from), function (via) { // Carriages move two steps and can pass police
			_.each(jack.oneStep(via), function (mapid) {
				if (mapid != from && !_.findWhere(options, { mapid: mapid, type: 'carriage' })) {
					options.push({ mapid: mapid, type: 'carriage', via: via, moves: 2 });
				}
			});
		});
	}
	return options;
}

jack.chooseSpecial = function (from, walks, arrestable) {
	// Decide whether to use an alley or a carriage, returns the move or false
	var options = jack.specialOptions(from);
	if (options.length == 0) {
		return false;
	}
	var remaining = game.config.remainingMoves;
	var arrestCount = function (mapid) {
		return _.has(arrestable, mapid) ? arrestable[mapid] : 0;
	}
	_.each(options, function (option) {
		option.arrestable = arrestCount(option.mapid);
		option.baseMoves = jack.baseDistance(option.mapid);
		option.inTime = option.baseMoves <= remaining - option.moves;
	});
	var best = function (list) {
		// Prefer reaching base in time, then avoiding arrest, then being close to base, then saving moves
		list = _.sortBy(list, 'moves');
		list = _.sortBy(list, 'baseMoves');
		list = _.sortBy(list, 'arrestable');
		list = _.sortBy(list, function (option) { return option.inTime ? 0 : 1; });
		return _.first(list);
	}

	// Blocked by police: a special move is the only way out
	if (walks.length == 0) {
		return best(options);
	}

	// Running out of time: walking can't reach base before the night ends
	var walksInTime = _.filter(walks, function (mapid) {
		return jack.baseDistance(mapid) <= remaining - 1;
	});
	var optionsInTime = _.where(options, { inTime: true });
	if (walksInTime.length == 0 && optionsInTime.length > 0) {
		return best(optionsInTime);
	}

	// Cornered: every walk could be arrested, but a special move gets away
	var walksSafe = _.filter(walks, function (mapid) {
		return arrestCount(mapid) == 0;
	});
	var optionsSafe = _.where(optionsInTime, { arrestable: 0 });
	if (walksSafe.length == 0 && optionsSafe.length > 0) {
		return best(optionsSafe);
	}

	return false;
}

jack.baseDistance = function (mapid) {
	// Fewest walking moves from a number to Jack's base (ignoring police)
	if (!jack.distances || jack.distances.base !== game.config.base) {
		jack.distances = { base: game.config.base, moves: {} };
		jack.distances.moves[game.config.base] = 0;
		var queue = [game.config.base];
		while (queue.length > 0) {
			var current = queue.shift();
			_.each(jack.oneStep(current), function (next) {
				if (!_.has(jack.distances.moves, next)) {
					jack.distances.moves[next] = jack.distances.moves[current] + 1;
					queue.push(next);
				}
			});
		}
	}
	return _.has(jack.distances.moves, mapid) ? jack.distances.moves[mapid] : Infinity;
}

jack.oneStep = function (mapid, avoidPolice) {
	// Show all possible Jack movements
	var adjacentNumbers = new Array();
	avoidPolice = typeof avoidPolice !== 'undefined' ? avoidPolice : false; // Can pass police by default

	var nextStep = function (array, blacklist) {
		_.each(array, function (id) {
			if (_.indexOf(blacklist, id) !== -1) { // If it's been processed already
				return;
			}
			blacklist.push(id); // Make sure it's not processed again

			if (avoidPolice && _.indexOf(_.last(police).now, id) !== -1) { // Jack can't pass police
				return;
			}
			if (map[id].number) {
				adjacentNumbers.push(id); // Store numbers
			} else {
				nextStep(map[id].adjacent, blacklist); // Keep walking through crossings (map id 0 is a crossing too)
			}
		});
	}

	nextStep(map[mapid].adjacent, []); // Go
	return _.without(adjacentNumbers, mapid);
}

jack.canMove = function () {
	var from = _.last(_.last(jack).route);
	return !_.isEmpty(jack.oneStep(from, true)) || !_.isEmpty(jack.specialOptions(from));
}

jack.mapidToRoutes = function (mapid) {
	return [[mapid]];
}

jack.routesAdvance = function (routes, avoidPolice) {
	var newRoutes = new Array();
	avoidPolice = typeof avoidPolice !== 'undefined' ? avoidPolice : false; // Can pass police by default
	for (var a = 0; a < routes.length; a++) {
		var adjacent = jack.oneStep(_.last(routes[a]), avoidPolice);
		if (routes[a].length < game.config.remainingMoves) { // Don't advance route if out of moves
			for (var b = 0; b < adjacent.length; b++) {
				if (_.indexOf(routes[a], adjacent[b]) == -1) { // Don't retrace steps
					newRoutes[newRoutes.length] = new Array();
					for (var c = 0; c < routes[a].length; c++) {
						_.last(newRoutes).push(routes[a][c]);
					}
					_.last(newRoutes).push(adjacent[b]);
				}
			}
		}
	}
	return newRoutes;
}

jack.bruteForceRoute = function (mapid, avoidPolice) {
	var jackRoutes = jack.mapidToRoutes(mapid);
	var baseRoutes = jack.mapidToRoutes(game.config.base);
	var shortestRoutes = {
		intersection: new Array(),
		jackToIntersection: new Array(),
		intersectionToBase: new Array()
	}
	avoidPolice = typeof avoidPolice !== 'undefined' ? avoidPolice : false; // Can pass police by default

	var intersects = function (jackRoutes, baseRoutes) {
		var jackRoutesEnds = _.map(jackRoutes, function(route) { return _.last(route) });
		var baseRoutesEnds = _.map(baseRoutes, function(route) { return _.last(route) });
		var intersection = _.intersection(jackRoutesEnds, baseRoutesEnds);
		if (intersection.length > 0) {
			shortestRoutes.intersection = intersection;
			for (var a = 0; a < intersection.length; a++) {
				for (var b = 0; b < jackRoutesEnds.length; b++) {
					if (jackRoutesEnds[b] == intersection[a]) {
						shortestRoutes.jackToIntersection.push(jackRoutes[b]);
					}
				}
				for (var b = 0; b < baseRoutesEnds.length; b++) {
					if (baseRoutesEnds[b] == intersection[a]) {
						shortestRoutes.intersectionToBase.push(baseRoutes[b]);
					}
				}
			}
		}
	}

	intersects(jackRoutes, baseRoutes); // Jack may already be at his base

	// Loop
	while (shortestRoutes.jackToIntersection.length < 1 && jackRoutes.length > 0 && baseRoutes.length > 0 && jackRoutes[0].length < 7) { // Impose a limit to stop it crashing
		jackRoutes = jack.routesAdvance(jackRoutes, avoidPolice); // Advance Jack
		intersects(jackRoutes, baseRoutes); // Check for intersection
		if (shortestRoutes.jackToIntersection.length > 0) break; // Escape loop if intersection found
		baseRoutes = jack.routesAdvance(baseRoutes, avoidPolice); // Advance Base
		intersects(jackRoutes, baseRoutes); // Check for intersection
	}

	if (shortestRoutes.jackToIntersection.length > 0) {
		shortestRoutes.moves = shortestRoutes.jackToIntersection[0].length + shortestRoutes.intersectionToBase[0].length - 2;
	} else {
		shortestRoutes.moves = Infinity; // No route to base found within the limit
	}
	return shortestRoutes;
}

/* Draw
   ----- */
var draw = {
	map: function() {
		$('.map .location, .map .location-number, .map .token-clue').remove(); // Safe to redraw
		for (var a = 0; a < map.length; a++) {
			if (map[a].position != undefined) {
				if (map[a].number != undefined) {
					var murder = (map[a].murder ? ' location-murder' : '');
					var classes = 'label label-primary location-number location-' + a + murder;
					draw.createElement(a, map[a].number, classes).prependTo('.map');
				} else {
					if (map[a].station) {
						var station = ' location-station';
						var classes = 'label label-default location location-' + a + station;
						draw.createElement(a, 's', classes).prependTo('.map');
					} else {
						var classes = 'label label-default location location-' + a;
						draw.createElement(a, ' ', classes).prependTo('.map');
					}
				}
				if (police.length > 0) {
					if ( _.indexOf(_.last(police).clue, a) !== -1 ) {
						draw.clue(a);
					}
				}
			}
		}
	},
	murder: function (mapid) {
		$('.token-murder').remove(); // Only one crime scene is shown at a time
		var classes = 'label label-info token token-murder token-murder-' + mapid;
		draw.createElement(mapid, '', classes).appendTo('.map');
	},
	clue: function (mapid) {
		var classes = 'label label-info token token-clue token-clue-' + mapid;
		draw.createElement(mapid, '', classes).prependTo('.map');
	},
	jackLog: function () {
		// Special movement tokens are played face up, so the police know when Jack uses them
		var night = _.last(jack);
		$('.jack-log').empty();
		$('<p></p>', {
			text: 'Night ' + jack.length + ': Jack has ' + night.carriages + ' carriages and ' + night.alleys + ' alleys left.'
		}).appendTo('.jack-log');
		_.each(night.moves, function (move, index) {
			if (move.type != 'walk') {
				$('<p></p>', {
					text: 'Move ' + (index + 1) + ': Jack used ' + (move.type == 'carriage' ? 'a carriage (two moves).' : 'an alley.')
				}).appendTo('.jack-log');
			}
		});
	},
	createElement: function (mapid, labelText, classes) {
		return $('<span></span>', {
			'data-mapid': mapid,
			class: classes,
			text: labelText,
			style: 'left:' + map[mapid].position[0] + ';' + 'top:' + map[mapid].position[1] + ';'
		});
	},
	updateTitle: function() {
		$('h1').remove();
		$('<h1></h1>', {
			text: state[game.config.state].title,
		}).prependTo('.container');
	}
}

/* Start
   ----- */
game.start = function () {
	draw.map();
	draw.updateTitle();
	game.selectBase();
	game.nextState();
}

if (!window.WHITECHAPEL_NO_AUTOSTART) { // Tests load the game without starting it
	game.start();
}