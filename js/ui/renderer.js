/* Interface: shows the game and turns the police's clicks into engine actions.
   - It displays the state (game.state) and reacts to the engine's events (game.on).
   - Clickable choices come from the rules (WC.rules): the interface never decides what is legal.
   - It never changes the state itself: clicks call the engine (togglePatrol, movePoliceman, search ...). */
var WC = WC || {};

WC.ui = (function ($, _, board, rules, content) {

	var game;

	function state() {
		return game.state;
	}

	/* Drawing
	   ------- */
	var draw = {
		map: function() {
			$('.map .location, .map .location-number, .map .token-clue').remove(); // Safe to redraw
			for (var a = 0; a < board.size; a++) {
				var position = board.position(a);
				if (position != undefined) {
					if (board.isNumbered(a)) {
						var murder = (board.isRed(a) ? ' location-murder' : '');
						var classes = 'label label-primary location-number location-' + a + murder;
						draw.createElement(a, board.number(a), classes).prependTo('.map');
					} else {
						if (board.isStation(a)) {
							var classes = 'label label-default location location-' + a + ' location-station';
							draw.createElement(a, 's', classes).prependTo('.map');
						} else {
							var classes = 'label label-default location location-' + a;
							draw.createElement(a, ' ', classes).prependTo('.map');
						}
					}
					if (game && state().police.length > 0 && _.contains(rules.policeNight(state()).clue, a)) {
						draw.clue(a);
					}
				}
			}
		},
		crimeScene: function (mapid) {
			// Crime scene markers stay for the whole game, so they aren't tokens that get cleared
			var classes = 'label label-info crime-scene token-murder token-murder-' + mapid;
			draw.createElement(mapid, '', classes).appendTo('.map');
		},
		pieces: function () {
			// The women and the Wretched, from what the police can see (rules.policeView): before the victims are chosen,
			// women face down, all alike (which are marked is Jack's secret); from then until the alarm, the Wretched.
			// Each is a ring around its circle, so the printed number stays readable, with a small badge
			$('.map .token-woman, .map .token-wretched').remove();
			var view = rules.policeView(state());
			var phase = state().phase;
			var pieces = phase <= 2 ? view.women : phase <= 7 ? view.wretched : [];
			var kind = phase <= 2 ? 'woman' : 'wretched';
			_.each(pieces, function (mapid) {
				var title = kind == 'woman' ? 'A woman, face down, on ' + board.number(mapid) + ' (marked or not: only Jack knows)' : 'A Wretched on ' + board.number(mapid);
				draw.createElement(mapid, '', 'label token token-' + kind + ' token-' + kind + '-' + mapid).attr('title', title).appendTo('.map');
			});
			$('button.highlight-pieces').prop('hidden', pieces.length == 0).text(kind == 'woman' ? 'Highlight the women' : 'Highlight the Wretched');
			if (pieces.length == 0) {
				$('.board').removeClass('highlighting');
				$('button.highlight-pieces').attr('aria-pressed', 'false');
			}
		},
		clue: function (mapid) {
			var classes = 'label label-info token token-clue token-clue-' + mapid;
			draw.createElement(mapid, '', classes).prependTo('.map');
		},
		tracker: function () {
			// The Time of the Crime token, then Jack's pawn once he has killed
			var night = rules.jackNight(state());
			var spans = $('.move-tracker p span');
			spans.removeClass('active murder');
			_.each(night.murderMove, function (space) {
				spans.eq(space - 1).addClass('murder');
			});
			var space = night.trackPosition > 0 ? night.trackPosition : rules.timeOfCrimeSpace(state().timeOfCrime);
			spans.eq(space - 1).addClass('active');
		},
		jackLog: function () {
			// What the police know about Jack. Special movement tokens are played face up
			var night = rules.jackNight(state());
			var murdered = night.murder.length > 0;
			var stats = [
				['Coaches left', night.carriages],
				['Alleys left', night.alleys],
				['Moves left', murdered ? state().remainingMoves : '–'],
				['Victims', state().crimeScenes.length + ' of 5']
			];
			var list = $('<dl></dl>', { class: 'stats' });
			_.each(stats, function (stat) {
				var item = $('<div></div>', { class: 'stat' }).appendTo(list);
				$('<dt></dt>', { text: stat[0] }).appendTo(item);
				$('<dd></dd>', { text: stat[1] }).appendTo(item);
			});
			$('.jack-log').empty().append(list);
			var used = _.filter(night.moves, function (move) { return move.type != 'walk'; });
			if (used.length > 0) {
				$('<p></p>', {
					class: 'stat-note',
					text: 'Tonight Jack used ' + _.map(used, function (move) { return move.type == 'carriage' ? 'a coach' : 'an alley'; }).join(', ') + '.'
				}).appendTo('.jack-log');
			}
		},
		createElement: function (mapid, labelText, classes) {
			var place = board.isNumbered(mapid) ? 'number ' + board.number(mapid) : 'crossing';
			var position = board.position(mapid);
			return $('<span></span>', {
				'data-mapid': mapid,
				class: classes,
				text: labelText,
				title: labelText ? labelText + ' (' + place + ')' : place,
				style: 'left:' + position[0] + 'px;' + 'top:' + position[1] + 'px;'
			});
		},
		streets: function () {
			// The dotted streets, drawn from the map data
			$('.map .streets').remove();
			var ns = 'http://www.w3.org/2000/svg';
			var svg = document.createElementNS(ns, 'svg');
			svg.setAttribute('class', 'streets');
			svg.setAttribute('viewBox', '0 0 1000 663');
			svg.setAttribute('aria-hidden', 'true');
			var path = '';
			for (var a = 0; a < board.size; a++) {
				_.each(board.neighbours(a), function (c) {
					if (a < c) { // Each street once
						path += 'M' + board.position(a).join(' ') + 'L' + board.position(c).join(' ');
					}
				});
			}
			var streets = document.createElementNS(ns, 'path');
			streets.setAttribute('d', path);
			svg.appendChild(streets);
			$('.map .vintage-map').after(svg);
		},
		updateTitle: function() {
			// The phase card and the night in the header
			var phase = state().phase;
			var current = content.phases[phase];
			$('.phase-title').text(current.title);
			$('.phase-part').text(current.part);
			$('.phase-description').text(current.description + '.');
			var steps = $('.phase-steps');
			if (steps.children().length == 0) { // Built once, then only the current phase changes
				_.each(content.phases, function (item, index) {
					if (index == 0 || index == 9) {
						$('<li></li>', { class: 'phase-steps-part', text: item.part }).appendTo(steps);
					}
					$('<li></li>', { class: 'phase-step phase-step-' + index, text: item.title }).appendTo(steps);
				});
			}
			steps.children('.current').removeClass('current');
			steps.children('.phase-step-' + phase).addClass('current');
			var night = content.nights[state().jack.length - 1];
			if (night) {
				$('.night-name').text(night.name + ' of four');
				$('.night-date').text(night.date + (night.note ? ' · ' + night.note : ''));
			}
		},
		phaseText: function (name, text) {
			// Instructions for the current phase (replacing what was there)
			$('.state.' + name).empty().append($('<p></p>', { text: text })).show();
		},
		progress: function (text) {
			$('.phase-progress').text(text);
		},
		log: function (text, kind) {
			// The case log: everything the police know, newest first
			$('<li></li>', {
				class: 'event kind-' + (kind || 'info'),
				'data-night': state().jack.length > 0 ? 'Night ' + state().jack.length : '',
				text: text
			}).prependTo('.event-log');
		},
		fit: function () {
			// Scale the 1000 by 663 board to the space available
			var width = $('.board').width();
			if (!width) {
				return;
			}
			var scale = Math.min(1, width / 1000);
			$('.map').css('transform', 'scale(' + scale + ')');
			$('.board').css('height', Math.round(663 * scale) + 'px');
		}
	};

	function number(mapid) {
		return board.number(mapid);
	}

	/* The police's turns: draw the legal choices, and send clicks to the engine
	   ------------------------------------------------------------------------- */
	function patrolProgress() {
		var police = rules.policeNight(state());
		draw.progress('Real ' + police.start.length + ' of ' + rules.config.police + ' · Fake ' + police.fake.length + ' of ' + rules.config.fakePolice);
	}

	function wretchedProgress(moved, total) {
		draw.progress('Wretched moved: ' + moved + ' of ' + total);
	}

	var turns = {};

	turns[2] = function patrollingTheStreets() {
		var positions = rules.patrolPositions(state());
		var config = rules.config;
		var text = 'Place ' + config.police + ' real patrols and ' + config.fakePolice + ' fake ones to mislead Jack: choose Real or Fake beside a crossing.';
		if (positions.required.length > 0) {
			text += ' There must be a patrol where each policeman ended last night, and ' + positions.others + ' on yellow-bordered crossings without a policeman.';
		}
		draw.phaseText('patrolling-the-streets', text);
		patrolProgress();
		_.each(positions.all, function (a) {
			var required = _.contains(positions.required, a) ? ' required' : '';
			draw.createElement(a, 'Real', 'label label-info selectable token token-police marked token-police-' + a + required).appendTo('.map');
			draw.createElement(a, 'Fake', 'label label-info selectable token token-police unmarked token-police-' + a + required).appendTo('.map');
		});
		$('.token-police').click(function () {
			game.togglePatrol($(this).data('mapid'), $(this).hasClass('marked') ? 'real' : 'fake');
		});
	};

	turns[5] = function suspenseGrows() {
		draw.phaseText('suspense-grows', 'Jack is waiting. Move each Wretched to a nearby circle: click a Wretched, then where it goes. They can\'t pass a patrol, stop next to one, or stop on a crime scene.');
		var police = rules.policeNight(state());
		var patrols = rules.patrolTokens(state());
		for (var a = 0; a < board.size; a++) {
			if (_.contains(patrols, a)) {
				if (_.contains(police.revealed, a)) {
					draw.createElement(a, 'real police', 'label label-info revealed token token-police token-police-' + a).appendTo('.map');
				} else {
					draw.createElement(a, 'police', 'label label-info token token-police token-police-' + a).appendTo('.map');
				}
			}
		}
		var turn = state().turn;
		wretchedProgress(0, turn.total);
		_.each(state().womenMarked, function (a, index) {
			if (_.contains(turn.pending, index)) {
				$('.map .token-wretched-' + a).addClass('selectable').attr('title', 'A Wretched on ' + board.number(a) + ': click to move it');
			}
		});
		$('.map .token-wretched.selectable').click(function () {
			var from = $(this).data('mapid');
			var moves = rules.wretchedMoves(state(), from);
			$('.token-move-wretched').remove();
			$('.map .token-wretched.selected').removeClass('selected');
			$(this).addClass('selected');
			if (moves.length == 0) {
				game.keepWretched(from); // Blocked by another Wretched that moved, so it stays
				return;
			}
			_.each(moves, function (to) {
				draw.createElement(to, 'move here', 'label label-info selectable token token-move-wretched token-wretched-' + to).click(function () {
					game.moveWretched(from, to);
				}).appendTo('.map');
			});
		});
	};

	var policeNames = ['blue', 'yellow', 'brown', 'red', 'green'];

	function moveControls() {
		// Undo the last move (while Hunting the monster lasts), and, once every policeman has moved, finish
		var all = state().turn.moved && state().turn.moved.length >= rules.policeNight(state()).now.length;
		var controls = $('.state.hunting-the-monster .phase-actions');
		if (controls.length == 0) {
			controls = $('<div class="phase-actions"></div>').appendTo('.state.hunting-the-monster');
			$('<button type="button" class="button button-secondary undo-move"></button>').text('Undo last move').click(function () {
				game.undoPoliceMove();
			}).appendTo(controls);
			$('<button type="button" class="button button-primary finish-moves"></button>').text('Done: on to Clues and suspicion').click(function () {
				game.finishPoliceMoves();
			}).appendTo(controls);
		}
		controls.find('.undo-move').prop('disabled', !game.canUndoPoliceMove());
		controls.find('.finish-moves').prop('hidden', !game.settings.confirmPoliceMoves).prop('disabled', !all);
	}

	turns[10] = function huntingTheMonster() {
		draw.phaseText('hunting-the-monster', 'Move each policeman up to two crossings: click a policeman, then one of the crossings ringed in his colour, or Stay. Policemen can pass each other but not share a crossing.' +
			(game.settings.confirmPoliceMoves ? ' A move can be undone until you choose Done.' : ''));
		var police = rules.policeNight(state());
		draw.progress('Policemen moved: ' + state().turn.moved.length + ' of ' + police.now.length);
		var chosen = null; // The policeman whose choices are showing: { mapid, index }

		function policeman(mapid, index) {
			// A policeman still to move, who shows his choices when clicked
			draw.createElement(mapid, 'police', 'label label-info selectable revealed token token-police police-' + index + ' token-police-' + mapid)
				.attr('title', 'The ' + policeNames[index] + ' policeman on a crossing: click to choose where he goes').click(function () {
					choose(mapid, index);
				}).appendTo('.map');
		}

		function putBack() {
			// Choosing another policeman first takes the last one's choices away, so he can still move
			$('.token-move-police').remove();
			$('.map .token-police.selected').removeClass('selected');
			chosen = null;
		}

		function move(index, to) {
			chosen = null; // policemanMoved draws him where he went
			game.movePoliceman(index, to);
		}

		function choose(mapid, index) {
			putBack();
			chosen = { mapid: mapid, index: index };
			$('.map .token-police-' + mapid).addClass('selected');
			_.each(rules.policeDestinations(state(), index), function (to) {
				draw.createElement(to, 'move here', 'label label-info selectable token token-move-police for-police-' + index + ' token-police-' + to)
					.attr('title', 'Move the ' + policeNames[index] + ' policeman here').click(function () {
						move(index, to);
					}).appendTo('.map');
			});
			draw.createElement(mapid, 'Stay', 'label label-info selectable token token-move-police token-police-' + mapid)
				.attr('title', 'Stay: the ' + policeNames[index] + ' policeman keeps his crossing').click(function () {
					move(index, mapid);
				}).appendTo('.map');
		}

		turns[10].policeman = policeman;
		for (var a = 0; a < board.size; a++) {
			var index = _.indexOf(police.now, a);
			if (index !== -1) {
				if (_.contains(state().turn.moved, index)) {
					draw.createElement(a, 'policeman', 'label label-info revealed token token-police-' + a + ' token-police police-' + index).attr('title', 'The ' + policeNames[index] + ' policeman (moved)').appendTo('.map');
				} else {
					policeman(a, index);
				}
			}
		}
		moveControls();
	};

	turns[11] = function cluesAndSuspicion() {
		draw.phaseText('clues-and-suspicion', 'Each policeman either searches or arrests. A search checks the circles next to him one at a time until a clue turns up. An arrest checks one circle: if Jack is there, you win.');
		var police = rules.policeNight(state());
		_.each(police.now, function (a, index) {
			draw.createElement(a, 'policeman', 'label token token-pawn police-' + index).appendTo('.map');
			if (police.search[index].length > 0) {
				draw.createElement(a, 'Search', 'label label-info selectable token token-search-adjacent token-search-adjacent-' + a).appendTo('.map');
			}
			if (police.arrest[index].length > 0) {
				draw.createElement(a, 'Arrest', 'label label-info selectable token token-arrest-adjacent token-arrest-adjacent-' + a).appendTo('.map');
			}
		});
		draw.progress('Policemen acted: ' + state().turn.acted + ' of ' + police.now.length);

		$('.token-arrest-adjacent').click(function () {
			var mapid = $(this).data('mapid');
			var index = _.indexOf(police.now, mapid);
			if (!game.chooseAction(index, 'arrest')) {
				return;
			}
			_.each(police.arrest[index], function (circle) {
				draw.createElement(circle, 'Arrest here', 'label label-info selectable token token-arrest').click(function () {
					game.arrest(index, circle);
				}).appendTo('.map');
			});
			$('.token-search-adjacent-' + mapid).remove();
			$(this).remove();
		});
		$('.token-search-adjacent').click(function () {
			var mapid = $(this).data('mapid');
			var index = _.indexOf(police.now, mapid);
			if (!game.chooseAction(index, 'search')) {
				return;
			}
			_.each(police.search[index], function (circle) {
				draw.createElement(circle, 'Search here', 'label label-info selectable token token-search token-search-' + circle).click(function () {
					game.search(index, circle);
				}).appendTo('.map');
			});
			$('.token-arrest-adjacent-' + mapid).remove();
			$(this).remove();
		});
	};

	/* What the engine reports
	   ----------------------- */
	var endings = {
		arrested: function (result) { return 'Jack has been arrested at ' + number(result.mapid) + '. The police win!'; },
		trapped: function () { return 'Jack is trapped by the police and cannot move. The police win!'; },
		outOfMoves: function () { return 'Jack has used his last move without reaching his hideout. The police win!'; },
		jackWins: function () { return 'Jack has killed five victims and escaped on all four nights. Jack wins!'; }
	};

	var events = {
		started: function () {
			draw.streets();
			draw.map();
			draw.fit();
			draw.updateTitle();
		},
		phase: function (data) {
			$('.state').hide();
			draw.progress('');
			draw.updateTitle();
			// The last phase's choices and pieces. A filter function, not a selector: jQuery's selector engine
			// draws on Math.random, which Jack's AI also uses
			$('.map .token').filter(function () { return !$(this).hasClass('token-clue'); }).remove();
			draw.pieces();
			if (data.phase == 4) {
				draw.phaseText('blood-on-the-streets', 'Jack chooses between killing or waiting.');
			}
		},
		policeTurn: function (data) {
			turns[data.phase]();
		},
		nightStarted: function (data) {
			var night = content.nights[data.night];
			$('.move-tracker p span').removeClass('active murder carriage alley');
			draw.log(night.name + ', ' + night.date + (night.note ? ' (' + night.note.toLowerCase() + ')' : '') + '. Jack has ' + rules.config.carriages[data.night] + ' coaches and ' + rules.config.alleys[data.night] + ' alleys.', 'night');
			draw.updateTitle();
			draw.jackLog();
		},
		patrolChanged: function (data) {
			var police = rules.policeNight(state());
			$('.token-police.marked.token-police-' + data.mapid).toggleClass('selected', _.contains(police.start, data.mapid));
			$('.token-police.unmarked.token-police-' + data.mapid).toggleClass('selected', _.contains(police.fake, data.mapid));
			patrolProgress();
		},
		patrolsPlaced: function () {
			draw.log('The patrols are on the streets.', 'police');
		},
		timeOfCrime: function () {
			draw.tracker();
		},
		jackWaited: function (data) {
			draw.tracker();
			draw.log('Jack waits. The time of the crime moves to ' + rules.roman(data.timeOfCrime) + '.', 'jack');
		},
		noWretchedCanMove: function () {
			draw.log('No Wretched can move.', 'police');
		},
		wretchedMoved: function (data) {
			$('.token-move-wretched').remove();
			$('.token-wretched-' + data.from).remove();
			draw.createElement(data.to, '', 'label token token-wretched token-wretched-' + data.to).attr('title', 'A Wretched on ' + number(data.to) + ' (moved)').appendTo('.map');
			wretchedProgress(data.moved, data.total);
		},
		wretchedStays: function (data) {
			$('.token-wretched-' + data.mapid).removeClass('selectable selected').unbind('click');
			wretchedProgress(data.moved, data.total);
		},
		patrolRevealed: function (data) {
			draw.log(data.fake ? 'Jack reveals a patrol: it was fake, and is removed.' : 'Jack reveals a patrol: a real policeman.', 'jack');
		},
		murder: function (data) {
			_.each(data.scenes, draw.crimeScene);
			draw.tracker();
			var numbers = _.map(data.scenes, number);
			if (numbers.length > 1) {
				draw.log('The double event: bodies are found at ' + numbers.join(' and ') + '. The whistles blow!', 'crime');
			} else {
				draw.log('A body is found at ' + numbers[0] + '. The whistles blow!', 'crime');
			}
			draw.jackLog();
		},
		jackMoved: function (data) {
			var move = data.move;
			var space = rules.jackNight(state()).trackPosition;
			var spans = $('.move-tracker p span');
			if (move.type == 'carriage') {
				spans.eq(space - 2).addClass('carriage');
				spans.eq(space - 1).addClass('carriage');
			}
			if (move.type == 'alley') {
				spans.eq(space - 1).addClass('alley');
			}
			draw.tracker();
			draw.jackLog();
			if (move.type == 'carriage') {
				draw.log('Jack takes a coach (moves ' + rules.trackLabel(space - 1) + ' and ' + rules.trackLabel(space) + ').', 'jack');
			} else if (move.type == 'alley') {
				draw.log('Jack slips through an alley (move ' + rules.trackLabel(space) + ').', 'jack');
			} else {
				draw.log('Jack moves (move ' + rules.trackLabel(space) + ').', 'jack');
			}
		},
		jackEscaped: function () {
			draw.log('Jack has reached his hideout. The night is over.', 'night');
			$('.token').remove(); // Clue markers are removed, crime scenes stay
		},
		policemanMoved: function (data) {
			$('.token-move-police').remove();
			$('.map .token-police-' + data.from + '.police-' + data.index).remove();
			draw.createElement(data.to, 'policeman', 'label label-info revealed token token-police-' + data.to + ' token-police police-' + data.index).attr('title', 'The ' + policeNames[data.index] + ' policeman (moved)').appendTo('.map');
			draw.progress('Policemen moved: ' + data.moved + ' of ' + data.total + (data.moved == data.total && game.settings.confirmPoliceMoves ? '. Undo a move, or choose Done' : ''));
			moveControls();
		},
		policeMoveUndone: function (data) {
			// The policeman goes back to his crossing, and can be moved again
			$('.token-move-police').remove();
			$('.map .token-police.selected').removeClass('selected');
			$('.map .token-police-' + data.from + '.police-' + data.index).remove();
			turns[10].policeman(data.to, data.index);
			draw.progress('Policemen moved: ' + data.moved + ' of ' + data.total + ' (the ' + policeNames[data.index] + ' policeman\'s move was undone)');
			moveControls();
		},
		searchMissed: function (data) {
			$('.token-search-' + data.mapid).remove();
			draw.progress('No clue at ' + number(data.mapid) + '. Search another circle.');
		},
		searchFinished: function (data) {
			var missed = _.map(data.missed, number).join(', ');
			if (data.clue) {
				draw.log((data.missed.length ? 'No clue at ' + missed + ', then a clue' : 'Clue') + ' found at ' + number(data.mapid) + '! Jack has been there tonight.', 'clue');
				$('.token-search').remove();
				draw.clue(data.mapid);
			} else {
				$('.token-search-' + data.mapid).remove();
				draw.log('No clue at ' + missed + '.', 'police');
			}
		},
		arrestFailed: function (data) {
			draw.log('Arrest at ' + number(data.mapid) + ': Jack is not there.', 'police');
			$('.token-arrest').remove();
		},
		policemanActed: function (data) {
			draw.progress('Policemen acted: ' + data.acted + ' of ' + data.total);
		},
		gameOver: function (result) {
			var message = endings[result.type](result);
			draw.log(message, 'end');
			$('.token').remove();
			$('.state').hide();
			draw.progress('');
			$('.game-over').text(message);
			$('.ending').addClass('open');
		}
	};

	function attach(attachedGame) {
		game = attachedGame;
		game.on(function (type, data) {
			if (events[type]) {
				events[type](data);
			}
		});
		$('button.highlight-pieces').click(function () {
			// Make the women or the Wretched stand out from everything else on the board, or stop
			var on = !$('.board').hasClass('highlighting');
			$('.board').toggleClass('highlighting', on);
			$(this).attr('aria-pressed', on ? 'true' : 'false');
		});
	}

	return { attach: attach, draw: draw };
})(jQuery, _, WC.board, WC.rules, WC.content);
