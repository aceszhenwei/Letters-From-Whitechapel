/* Interface: shows the game and turns the police's clicks into engine actions.
   - It displays the state (game.state) and reacts to the engine's events (game.on).
   - Clickable choices come from the rules (WC.rules): the interface never decides what is legal.
   - It never changes the state itself: clicks call the engine (togglePatrol, movePoliceman, search ...).
   When the player plays Jack (setRole('jack')), it draws only what both sides share (the map, the phase card, the
   move track) and leaves the rest to WC.ui.jackPlayer, which shows the game from Jack's side. */
var WC = WC || {};

WC.ui = (function ($, _, board, rules, content) {

	var game;
	var role = 'detectives'; // Who the player plays: 'detectives' or 'jack'

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
			// Scale the 1000 by 663 board: to the space available ('fit'), or larger, to pan with a finger or the
			// scroll bars. On a touch screen the board starts large enough to tap (numbered circles about 21 pixels)
			var board = $('.board');
			var width = board.width();
			if (!width) {
				return;
			}
			var fitScale = Math.min(1, width / 1000);
			if (zoom.level === null) {
				var touch = typeof window.matchMedia == 'function' && window.matchMedia('(pointer: coarse)').matches;
				zoom.level = touch && fitScale < zoom.touch ? zoom.touch : 'fit';
			}
			var scale = zoom.level == 'fit' ? fitScale : Math.max(fitScale, zoom.level);
			var zoomed = scale > fitScale + 0.001;
			$('.map').css('transform', 'scale(' + scale + ')');
			board.toggleClass('zoomed', zoomed);
			board.find('.board-sizer').css({ width: Math.round(1000 * scale) + 'px', height: Math.round(663 * scale) + 'px' });
			// Zoomed in, the board is a window onto the map, at most most of the screen's height
			var tall = Math.round(663 * scale);
			var room = Math.max(320, Math.round(($(window).height() || 800) * 0.65));
			board.css('height', (zoomed ? Math.min(tall, room) : tall) + 'px');
			$('.zoom-out').prop('disabled', !zoomed);
			$('.zoom-fit').prop('disabled', !zoomed);
			$('.zoom-in').prop('disabled', scale >= zoom.steps[zoom.steps.length - 1] - 0.001);
			draw.reveal();
		},
		zoomBy: function (direction) {
			// One step in or out among the zoom steps, keeping the middle of the view where it was
			var board = $('.board');
			var width = board.width();
			if (!width) {
				return;
			}
			var fitScale = Math.min(1, width / 1000);
			var current = zoom.level == 'fit' ? fitScale : Math.max(fitScale, zoom.level);
			var steps = _.filter(zoom.steps, function (s) { return s > fitScale + 0.001; });
			var next = direction > 0 ? _.find(steps, function (s) { return s > current + 0.001; }) :
				_.last(_.filter(steps, function (s) { return s < current - 0.001; }));
			var element = board[0];
			var centre = [(element.scrollLeft + element.clientWidth / 2) / current, (element.scrollTop + element.clientHeight / 2) / current];
			zoom.level = next === undefined ? (direction > 0 ? current : 'fit') : next;
			draw.fit();
			var scale = zoom.level == 'fit' ? fitScale : zoom.level;
			element.scrollLeft = centre[0] * scale - element.clientWidth / 2;
			element.scrollTop = centre[1] * scale - element.clientHeight / 2;
		},
		zoomFit: function () {
			zoom.level = 'fit';
			draw.fit();
		},
		reveal: function () {
			// Zoomed in, bring what the player can click into view, unless some of it already is
			var board = $('.board');
			var element = board[0];
			if (!element || !board.hasClass('zoomed')) {
				return;
			}
			var view = element.getBoundingClientRect();
			var targets = board.find('.map .selectable').filter(function () { return !$(this).hasClass('waiting'); }).toArray();
			if (!targets.length) {
				return;
			}
			var boxes = _.map(targets, function (t) { return t.getBoundingClientRect(); });
			var visible = _.some(boxes, function (b) {
				return b.right > view.left && b.left < view.right && b.bottom > view.top && b.top < view.bottom;
			});
			if (visible) {
				return;
			}
			var left = _.min(_.pluck(boxes, 'left'));
			var top = _.min(_.pluck(boxes, 'top'));
			var right = _.max(_.pluck(boxes, 'right'));
			var bottom = _.max(_.pluck(boxes, 'bottom'));
			element.scrollLeft += (left + right) / 2 - (view.left + view.right) / 2;
			element.scrollTop += (top + bottom) / 2 - (view.top + view.bottom) / 2;
		}
	};
	// The board's zoom: 'fit', or a scale; null until the board is first drawn. Steps for the zoom buttons
	var zoom = { level: null, touch: 1.4, steps: [1, 1.4, 2] };

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

	/* Clues and suspicion: one policeman acts at a time. Every token is tagged with its policeman (for-police-N), so
	   when two policemen's circles overlap, one policeman's search or arrest never removes the other's tokens */
	var clues = { active: null }; // The policeman who has chosen to search or arrest and not finished

	function cluesBusy() {
		var turn = state().turn;
		return clues.active !== null && state().phase == 11 && !_.contains(turn.done, clues.active);
	}

	function searchRest(index) {
		// Search this policeman's remaining circles in order, until a clue turns up or none are left
		var list = rules.policeNight(state()).search[index];
		for (var i = 0; i < list.length; i++) {
			if (state().phase != 11 || _.contains(state().turn.done, index)) {
				return;
			}
			if (list[i] !== undefined && game.search(index, list[i]) !== 'miss') {
				return;
			}
		}
	}

	function cluesControls() {
		// The faster ways to search: the active policeman's remaining circles, or every policeman still to act
		var controls = $('.state.clues-and-suspicion .phase-actions');
		if (controls.length == 0) {
			controls = $('<div class="phase-actions"></div>').appendTo('.state.clues-and-suspicion');
			$('<button type="button" class="button button-secondary search-rest"></button>').text('Search his remaining circles').click(function () {
				if (cluesBusy() && state().turn.choice[clues.active] == 'search') {
					searchRest(clues.active);
				}
			}).appendTo(controls);
			$('<button type="button" class="button button-secondary search-everyone"></button>').text('Search with every policeman left').click(function () {
				if (cluesBusy()) {
					return;
				}
				// Each policeman still to act who can search searches all his circles; any who can only arrest are left
				var night = rules.policeNight(state());
				_.each(_.range(night.now.length), function (index) {
					if (state().phase == 11 && !_.contains(state().turn.done, index) && !state().turn.choice[index] &&
						_.some(night.search[index], function (c) { return c !== undefined; }) && game.chooseAction(index, 'search')) {
						clues.active = index;
						searchRest(index);
					}
				});
			}).appendTo(controls);
		}
		var turn = state().turn;
		var night = rules.policeNight(state());
		var searching = cluesBusy() && turn.choice[clues.active] == 'search';
		var waiting = !cluesBusy() && _.some(_.range(night.now.length), function (index) {
			return !_.contains(turn.done || [], index) && !(turn.choice || {})[index] && _.some(night.search[index], function (c) { return c !== undefined; });
		});
		controls.find('.search-rest').prop('hidden', !searching);
		controls.find('.search-everyone').prop('hidden', !waiting);
	}

	turns[11] = function cluesAndSuspicion() {
		draw.phaseText('clues-and-suspicion', 'Each policeman either searches or arrests. A search checks the circles next to him one at a time until a clue turns up. An arrest checks one circle: if Jack is there, you win. One policeman acts at a time.');
		var police = rules.policeNight(state());
		clues.active = null;
		_.each(police.now, function (a, index) {
			draw.createElement(a, 'policeman', 'label token token-pawn police-' + index).attr('title', 'The ' + policeNames[index] + ' policeman: tap to bring his choices to the front').click(function () {
				// Policemen side by side can have overlapping Search and Arrest pills
				$('.map .front').removeClass('front');
				$('.token-search-adjacent.for-police-' + index + ', .token-arrest-adjacent.for-police-' + index).addClass('front');
			}).appendTo('.map');
			if (police.search[index].length > 0) {
				draw.createElement(a, 'Search', 'label label-info selectable token token-search-adjacent token-search-adjacent-' + a + ' for-police-' + index).appendTo('.map');
			}
			if (police.arrest[index].length > 0) {
				draw.createElement(a, 'Arrest', 'label label-info selectable token token-arrest-adjacent token-arrest-adjacent-' + a + ' for-police-' + index).appendTo('.map');
			}
		});
		draw.progress('Policemen acted: ' + state().turn.acted + ' of ' + police.now.length);

		function choose(index, action) {
			// The policeman's choice; the other policemen wait until he has finished
			if (cluesBusy() || !game.chooseAction(index, action)) {
				return false;
			}
			clues.active = index;
			$('.token-search-adjacent.for-police-' + index + ', .token-arrest-adjacent.for-police-' + index).remove();
			$('.token-search-adjacent, .token-arrest-adjacent').addClass('waiting');
			cluesControls();
			return true;
		}
		$('.token-arrest-adjacent').click(function () {
			var index = _.indexOf(police.now, $(this).data('mapid'));
			if (!choose(index, 'arrest')) {
				return;
			}
			_.each(police.arrest[index], function (circle) {
				draw.createElement(circle, 'Arrest here', 'label label-info selectable token token-arrest for-police-' + index).click(function () {
					game.arrest(index, circle);
				}).appendTo('.map');
			});
		});
		$('.token-search-adjacent').click(function () {
			var index = _.indexOf(police.now, $(this).data('mapid'));
			if (!choose(index, 'search')) {
				return;
			}
			_.each(police.search[index], function (circle) {
				draw.createElement(circle, 'Search here', 'label label-info selectable token token-search token-search-' + circle + ' for-police-' + index).click(function () {
					game.search(index, circle);
				}).appendTo('.map');
			});
		});
		cluesControls();
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
			if (role == 'jack') {
				return; // WC.ui.jackPlayer draws Jack's board
			}
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
			$('.token-search-' + data.mapid + '.for-police-' + data.index).remove();
			draw.progress('No clue at ' + number(data.mapid) + '. Search another circle.');
		},
		searchFinished: function (data) {
			var missed = _.map(data.missed, number).join(', ');
			if (data.clue) {
				draw.log((data.missed.length ? 'No clue at ' + missed + ', then a clue' : 'Clue') + ' found at ' + number(data.mapid) + '! Jack has been there tonight.', 'clue');
				$('.token-search.for-police-' + data.index).remove();
				draw.clue(data.mapid);
			} else {
				$('.token-search.for-police-' + data.index).remove();
				draw.log('No clue at ' + missed + '.', 'police');
			}
		},
		arrestFailed: function (data) {
			draw.log('Arrest at ' + number(data.mapid) + ': Jack is not there.', 'police');
			$('.token-arrest.for-police-' + data.index).remove();
		},
		policemanActed: function (data) {
			draw.progress('Policemen acted: ' + data.acted + ' of ' + data.total);
			// He has finished: his tokens go, and the others may act
			$('.token-search.for-police-' + data.index + ', .token-arrest.for-police-' + data.index).remove();
			$('.token-search-adjacent.for-police-' + data.index + ', .token-arrest-adjacent.for-police-' + data.index).remove();
			$('.token-search-adjacent, .token-arrest-adjacent').removeClass('waiting');
			if (state().phase == 11) {
				cluesControls();
			}
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

	// What the board shows the same way whoever the player is
	var shared = ['started', 'phase', 'timeOfCrime'];

	function setRole(chosen) {
		role = chosen == 'jack' ? 'jack' : 'detectives';
	}

	function attach(attachedGame) {
		game = attachedGame;
		game.on(function (type, data) {
			if (role == 'jack' && !_.contains(shared, type)) {
				return; // Shown from Jack's side by WC.ui.jackPlayer
			}
			if (events[type]) {
				events[type](data);
			}
			if (type == 'policeTurn' || type == 'phase' || type == 'policemanActed' || type == 'nightOver') {
				setTimeout(draw.reveal, 0); // Once the new choices are drawn
			}
		});
		$('.zoom-in').click(function () { draw.zoomBy(1); });
		$('.zoom-out').click(function () { draw.zoomBy(-1); });
		$('.zoom-fit').click(draw.zoomFit);
		$('button.highlight-pieces').click(function () {
			// Make the women or the Wretched stand out from everything else on the board, or stop
			var on = !$('.board').hasClass('highlighting');
			$('.board').toggleClass('highlighting', on);
			$(this).attr('aria-pressed', on ? 'true' : 'false');
		});
	}

	return { attach: attach, draw: draw, setRole: setRole, role: function () { return role; }, policeNames: policeNames };
})(jQuery, _, WC.board, WC.rules, WC.content);
