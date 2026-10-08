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
		totalMoves: 20, // Spaces on the move track: Roman numerals V to I, then 1 to 15
		remainingMoves: 15,
		timeOfCrime: 1, // The Roman numeral the Time of the Crime token is on (1 to 5)
		carriages: [3, 2, 2, 1], // Special movement tokens for each night
		alleys: [2, 2, 1, 1],
		women: [8, 7, 6, 4], // Woman tokens for each night
		wretched: [5, 4, 3, 1], // How many of them are marked (the Wretched)
		victims: [1, 1, 2, 1], // The third night is the double event
		police: 5,
		fakePolice: 2,
		womenMarked: new Array(), // Where the Wretched are
		womenUnmarked: new Array(),
		crimeScenes: new Array(), // Crime Scene markers stay on the map for the whole game
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
			case 3:
				game.theVictimsAreChosen();
			break;
			case 4:
				game.bloodOnTheStreets();
			break;
			case 5:
				game.suspenseGrows();
			break;
			case 6:
				game.readyToKill();
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
	night: function () {
		return jack.length - 1; // The current night, 0 to 3
	},
	preparingTheScene: function () {
		var night = jack.length;
		$('<p></p>', {
			text: 'Jack collects the special movement tokens (' + game.config.carriages[night] + ' carriages and ' + game.config.alleys[night] + ' alleys).'
		}).prependTo('.preparing-the-scene');

		// Reset the night
		game.config.remainingMoves = game.config.totalMoves - 5;
		game.config.timeOfCrime = 1;
		game.config.womenMarked = new Array();
		game.config.womenUnmarked = new Array();
		$('.move-tracker p span').removeClass('active murder carriage alley');

		jack[jack.length] = { // New night
			route: new Array(),
			moves: new Array(), // Each move Jack makes: { mapid, type: 'walk', 'alley' or 'carriage', via }
			murder: new Array(),
			murderMove: new Array(), // Move track spaces of the crime scenes
			trackPosition: 0, // Move track space of Jack's pawn (1 is V, 5 is I, 6 is 1 and 20 is 15)
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
		// Jack places Woman tokens on red numbered circles, but not on crime scenes from earlier nights
		var night = game.night();
		var redCircles = _.difference(map.key('murder'), game.config.crimeScenes);
		redCircles = game.sortSevenSteps(redCircles);
		while (game.config.womenMarked.length < game.config.wretched[night] && redCircles.length > 0) {
			// More likely to select murder spots 7 steps from base
			var index = game.randomSafeIndex(0.9, redCircles.length);
			game.config.womenMarked.push(redCircles[index]); // Randomly select wreched
			redCircles.splice(index, 1); // Prevent possibility of choosing duplicate locations
		}
		while (game.config.womenUnmarked.length < (game.config.women[night] - game.config.wretched[night]) && redCircles.length > 0) {
			var index = game.randomInt(0, redCircles.length);
			game.config.womenUnmarked.push(redCircles[index]); // Randomly select unmarked women
			redCircles.splice(index, 1); // Prevent possibility of choosing duplicate locations
		}
		game.nextState(2);
	},
	patrolPositions: function () {
		// Where the Police Patrol tokens can go, and which of them must be used.
		// First night: the yellow-bordered crossings. Later nights: a token on every crossing where a policeman
		// ended the previous night, and the other two on yellow-bordered crossings without a policeman.
		var previous = police.length > 1 ? police[police.length - 2].now : new Array();
		return {
			required: previous,
			all: _.union(previous, _.difference(map.key('station'), previous)),
			others: game.config.police + game.config.fakePolice - previous.length // Tokens placed away from policemen
		};
	},
	patrollingTheStreets: function () {
		$('.patrolling-the-streets').show();
		$('.patrolling-the-streets .next-state').hide();
		var positions = game.patrolPositions();
		var text = 'The head of the investigation places ' + game.config.police + ' police patrol tokens and ' + game.config.fakePolice + ' fake police tokens on the map.';
		if (positions.required.length > 0) {
			text += ' There must be a token where each policeman ended last night, and ' + positions.others + ' on yellow-bordered crossings without a policeman.';
		}
		$('<p></p>', {
			text: text
		}).prependTo('.state.patrolling-the-streets');
		for (var a = 0; a < map.length; a++) {
			if (($.inArray(a, game.config.womenMarked) !== -1) || ($.inArray(a, game.config.womenUnmarked) !== -1)) {
				var classes = 'label label-info token token-woman token-woman-' + a;
				draw.createElement(a, '', classes).appendTo('.map');
			}
		}
		_.each(positions.all, function (a) {
			var required = _.contains(positions.required, a) ? ' required' : '';
			var classes = 'label label-info selectable token token-police marked token-police-' + a + required;
			draw.createElement(a, 'police', classes).appendTo('.map');
			classes = 'label label-info selectable token token-police unmarked token-police-' + a + required;
			draw.createElement(a, 'not police', classes).appendTo('.map');
		});
		var placedElsewhere = function () { // Tokens not on a crossing where a policeman ended last night
			return _.difference(_.union(_.last(police).start, _.last(police).fake), positions.required).length;
		}
		$('.token-police').click(function(){
			var mapid = $(this).data('mapid');
			var placed = _.contains(_.last(police).start, mapid) || _.contains(_.last(police).fake, mapid);
			if (!placed && !_.contains(positions.required, mapid) && placedElsewhere() >= positions.others) {
				return; // Too many tokens away from the policemen
			}
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
				game.nextState(3);
			}
		});
	},
	theVictimsAreChosen: function () {
		// The marked women become Wretched, the others are removed. The Time of the Crime token goes on I
		game.config.timeOfCrime = 1;
		draw.tracker();
		game.nextState(4);
	},
	bloodOnTheStreets: function () {
		$('<p></p>', {
			text: 'Jack chooses between killing or waiting.'
		}).prependTo('.state.blood-on-the-streets');

		if (_.last(jack).murder.length > 0) {
			console.log('Error: Multiple murders attempted.');
			return;
		}
		// On V Jack can no longer wait. Otherwise he decides on the toss of a coin
		if (game.config.timeOfCrime < 5 && Math.random() > 0.5) {
			game.nextState(5);
		} else {
			game.murder();
			game.nextState(8);
		}
	},
	suspenseGrows: function() {
		$('.suspense-grows').show();
		if ($.inArray(_.last(_.last(police).revealed), _.last(police).fake) !== -1) {
			$('<p></p>', {
				text: 'Jack has discovered that a police token is not real.'
			}).prependTo('.state.suspense-grows');
		}

		// Move the Time of the Crime token on to the next Roman numeral
		game.config.timeOfCrime++;
		draw.tracker();

		var patrols = game.patrolTokens();
		for (var a = 0; a < map.length; a++) {
			if ($.inArray(a, patrols) !== -1) {
				if ($.inArray(a, _.last(police).revealed) !== -1) {
					var classes = 'label label-info revealed token token-police token-police-' + a;
					draw.createElement(a, 'real police', classes).appendTo('.map');
				} else {
					var classes = 'label label-info token token-police token-police-' + a;
					draw.createElement(a, 'police', classes).appendTo('.map');
				}
			}
		}

		// Every Wretched with a legal move must move, the others stay where they are
		var toMove = _.filter(game.config.womenMarked, function (mapid) {
			return game.wretchedMoves(mapid).length > 0;
		});
		var movedWretched = 0;
		var done = function () {
			$('.token-wretched').remove();
			$('.token-police').remove();
			game.nextState(6);
		}
		if (toMove.length == 0) {
			done();
			return;
		}
		_.each(game.config.womenMarked, function (a) {
			var selectable = _.contains(toMove, a) ? ' selectable' : '';
			var classes = 'label label-info token token-wretched token-wretched-' + a + selectable;
			draw.createElement(a, 'wretched', classes).appendTo('.map');
		});
		$('.token-wretched.selectable').click(function(){
			var mapid = $(this).data('mapid');
			var moves = game.wretchedMoves(mapid);
			$('.token-move-wretched').remove();
			if (moves.length == 0) { // Blocked by another Wretched that moved, so it stays
				$(this).removeClass('selectable').unbind('click');
				movedWretched++;
				if (movedWretched >= toMove.length) {
					done();
				}
				return;
			}
			var wretched = $(this);
			for (var b = 0; b < moves.length; b++) {
				var classes = 'label label-info selectable token token-move-wretched token-wretched-' + moves[b];
				draw.createElement(moves[b], 'move here', classes).data('mapidPrev', mapid).click(function(){
					var index = game.config.womenMarked.indexOf(mapid); // Find previous map id in array
					if (index !== -1) {
						game.config.womenMarked[index] = $(this).data('mapid'); // Replace map id in array with new location
					}
					$(this).removeClass('selectable token-move-wretched').addClass('token-wretched').text('wretched').unbind('click');
					$('.token-move-wretched').remove();
					wretched.remove();
					movedWretched++;
					if (movedWretched >= toMove.length) {
						done();
					}
				}).appendTo('.map');
			}
		});
	},
	patrolTokens: function () {
		// Police Patrol tokens on the map (fake ones are removed when Jack reveals them)
		var last = _.last(police);
		return _.difference(_.union(last.start, last.fake), _.intersection(last.revealed, last.fake));
	},
	wretchedMoves: function (mapid) {
		// A Wretched moves to an adjacent numbered circle. It can't pass a Police Patrol token, end next to one,
		// end on another Wretched, or end on a crime scene
		var patrols = game.patrolTokens();
		var nearPatrols = _.flatten(_.map(patrols, function (id) {
			return game.arrestable(id);
		}));
		return _.filter(game.walk(mapid, patrols), function (id) {
			return !_.contains(nearPatrols, id) && !_.contains(game.config.womenMarked, id) && !_.contains(game.config.crimeScenes, id);
		});
	},
	readyToKill: function () {
		game.revealPolice();
		game.nextState(4);
	},
	alarmWhistles: function () {
		_.last(police).route = _.map(_.last(police).start, function (mapid) { // Setup police to move
			_.last(police).now.push(mapid);
			return [mapid];
		});
		if (_.last(jack).murder.length > 1) {
			game.nextState(10); // Double event: the second crime scene was Jack's first move, so the police go first
		} else {
			game.nextState(9);
		}
	},
	escapeTheNight: function () {
		if (!jack.canMove()) {
			game.end('Jack is trapped by the police and cannot move. The police win!');
			return;
		}
		var move = jack.move();
		var night = _.last(jack);
		var spans = $('.move-tracker p span');
		var moves = (move.type == 'carriage') ? 2 : 1; // A carriage uses two moves
		if (move.type == 'carriage') {
			night.route.push(move.via); // Both stops are recorded, so police can find clues at either
			night.carriages--;
			spans.eq(night.trackPosition).addClass('carriage');
			spans.eq(night.trackPosition + 1).addClass('carriage');
		}
		if (move.type == 'alley') {
			night.alleys--;
			spans.eq(night.trackPosition).addClass('alley');
		}
		night.route.push(move.mapid);
		night.moves.push(move);
		night.trackPosition += moves;
		game.config.remainingMoves -= moves;
		draw.tracker();
		draw.jackLog();

		// Jack declares his escape when a normal move takes him to his hideout (not a special movement)
		if (move.mapid == game.config.base && move.type == 'walk') {
			console.log('Jack has reached his base.');
			$('.token').remove(); // Clue markers are removed, crime scenes stay
			if (jack.length >= game.config.nights) {
				game.end('Jack has killed five victims and escaped on all four nights. Jack wins!');
			} else {
				game.nextState(0); // Start a new night
			}
			return;
		}
		if (game.config.remainingMoves <= 0) {
			game.end('Jack has used his last move without reaching his hideout. The police win!');
			return;
		}
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

		_.last(police).search = _.map(_.last(police).now, function (mapid) {
			return game.searchable(mapid);
		});
		_.last(police).arrest = _.map(_.last(police).now, function (mapid) {
			return game.arrestable(mapid);
		});

		// Each policeman takes one action: looking for clues or executing an arrest
		var acted = 0;
		var actionDone = function () {
			acted++;
			if (acted >= _.last(police).now.length) {
				$('.token.selectable').remove();
				game.nextState(9);
			}
		}

		var canAct = 0;
		_.each(_.last(police).now, function (a, index) {
			if (_.last(police).search[index].length > 0) {
				var classes = 'label label-info selectable token token-search-adjacent token-search-adjacent-' + a;
				draw.createElement(a, 'search', classes).appendTo('.map');
			}
			if (_.last(police).arrest[index].length > 0) {
				var classes = 'label label-info selectable token token-arrest-adjacent token-arrest-adjacent-' + a;
				draw.createElement(a, 'arrest', classes).appendTo('.map');
			}
			if (_.last(police).search[index].length > 0 || _.last(police).arrest[index].length > 0) {
				canAct++;
			}
		});
		acted = _.last(police).now.length - canAct; // Policemen with no numbered circles next to them can't act
		if (canAct == 0) {
			game.nextState(9);
			return;
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
					actionDone();
				}).appendTo('.map');
			}
			$('.token-search-adjacent-' + mapid).remove();
			$(this).remove();
		});
		$('.token-search-adjacent').click(function(){
			var mapid = $(this).data('mapid');
			var index = _.indexOf(_.last(police).now, mapid);
			var search = _.last(police).search[index];

			for (var b = 0; b < search.length; b++) {
				var classes = 'label label-info selectable token token-search token-search-' + search[b];
				draw.createElement(search[b], 'search', classes).click(function(){
					var mapidAdjacent = $(this).data('mapid');
					if ($.inArray(mapidAdjacent, _.last(jack).route) !== -1) {
						console.log('Clue found at ' + map[mapidAdjacent].number + '.');
						$('.token-search').remove();
						_.last(police).clue.push(mapidAdjacent);
						draw.clue(mapidAdjacent);
						actionDone(); // Finding a clue ends the search
					} else {
						console.log('No clue found.');
						$(this).remove();
						search[_.indexOf(search, mapidAdjacent)] = undefined;
						if (_.isEmpty(_.reject(search, _.isUndefined))) {
							actionDone(); // Nothing left to search
						}
					}
				}).appendTo('.map');
			}
			$('.token-arrest-adjacent-' + mapid).remove();
			$(this).remove();
		});
	},
	selectBase: function () {
		// Jack may choose any numbered circle for his hideout, except a red one
		var mapNumbers = _.difference(map.key('number'), map.key('murder'));
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
		// Jack reveals one of the Police Patrol tokens he hasn't revealed yet
		var hidden = _.difference(_.union(_.last(police).start, _.last(police).fake), _.last(police).revealed);
		if (hidden.length > 0) {
			_.last(police).revealed.push(hidden[game.randomInt(0, hidden.length)]);
		}
	},
	murder: function() {
		var night = _.last(jack);
		var victims = Math.min(game.config.victims[game.night()], game.config.womenMarked.length);
		var sorted = game.sortSevenSteps(game.config.womenMarked);

		// TODO: If there are revealed police, murder far from them?

		// Jack escapes from his last victim, so choose that one carefully
		var last = sorted[game.randomSafeIndex(0.2, sorted.length)];
		var others = _.without(sorted, last);
		var scenes = new Array();
		while (scenes.length < victims - 1) { // The double event: another victim first
			var index = game.randomInt(0, others.length);
			scenes.push(others[index]);
			others.splice(index, 1);
		}
		scenes.push(last);

		// Jack's pawn starts on the Time of the Crime token (the second crime scene of the double event uses his first move)
		var position = 6 - game.config.timeOfCrime;
		_.each(scenes, function (mapid, index) {
			night.route.push(mapid); // Put Jack at the scene of the crime
			night.murder.push(mapid);
			night.murderMove.push(position + index);
			game.config.crimeScenes.push(mapid);
			game.config.womenMarked = _.without(game.config.womenMarked, mapid);
			draw.crimeScene(mapid);
		});
		night.trackPosition = position + scenes.length - 1;
		game.config.remainingMoves = game.config.totalMoves - night.trackPosition;
		draw.tracker();
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
		// Jack can't declare his escape after a special movement, so landing on his hideout means stepping off and back
		option.baseMoves = option.mapid == game.config.base ? 2 : jack.baseDistance(option.mapid);
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
	avoidPolice = typeof avoidPolice !== 'undefined' ? avoidPolice : false; // Can pass police by default
	return game.walk(mapid, avoidPolice ? _.last(police).now : []);
}

game.walk = function (mapid, blocked) {
	// Numbered circles next to a numbered circle, along dotted lines through crossings, without passing the blocked crossings
	var adjacentNumbers = new Array();

	var nextStep = function (array, blacklist) {
		_.each(array, function (id) {
			if (_.indexOf(blacklist, id) !== -1) { // If it's been processed already
				return;
			}
			blacklist.push(id); // Make sure it's not processed again

			if (_.indexOf(blocked, id) !== -1) { // Can't pass police
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
	crimeScene: function (mapid) {
		// Crime Scene markers stay for the whole game, so they aren't tokens that get cleared
		var classes = 'label label-info crime-scene token-murder token-murder-' + mapid;
		draw.createElement(mapid, '', classes).appendTo('.map');
	},
	tracker: function () {
		// The Time of the Crime token, then Jack's pawn once he has killed
		var night = _.last(jack);
		var spans = $('.move-tracker p span');
		spans.removeClass('active murder');
		_.each(night.murderMove, function (position) {
			spans.eq(position - 1).addClass('murder');
		});
		var position = night.trackPosition > 0 ? night.trackPosition : 6 - game.config.timeOfCrime;
		spans.eq(position - 1).addClass('active');
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