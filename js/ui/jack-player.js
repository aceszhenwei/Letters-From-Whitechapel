/* Playing Jack: the game from Jack's side, when the player plays him against the computer's detectives.
   - It shows what Jack knows: his hideout, where he is, his route tonight, which women are marked, the patrol tokens
     (face down until he reveals one), the policemen, and everything the detectives do in public. Never anything the
     detectives' AI thinks: it only hears the engine's events, as a player at the table sees the detectives' moves.
   - At each of Jack's decisions (the engine's 'jackTurn'), it draws the legal choices, which come from the rules
     (WC.rules), lets the player pick and change their mind freely, and sends the decision to the engine only when they
     confirm (game.jackHideout, jackWomen, jackWait, jackVictims, jackReveal, jackMove). Nothing changes before then.
   - The detectives' turns are played by WC.ui.autoPolice; this paces them so they can be followed (policemen glide to
     their crossings one after another), and Skip hurries them. Pacing is only presentation: the detectives' decisions
     and the game are the same whatever the speed.
   The renderer (WC.ui, set to the 'jack' role) still draws the map, the phase card and the move track. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.jackPlayer = (function ($, _, board, rules, content) {

	var game;
	var draw;
	var police; // WC.ui.autoPolice, once paced
	var animate = true; // Show the detectives' moves step by step
	var hurry = false; // Skip pressed: the rest of the detectives' turn without pauses
	var stagger = 0; // Policemen moved so far in this Hunting the monster, for their glide one after another
	var moving = false; // Policemen are gliding: the next step waits for them
	var animUntil = 0; // When the last glide ends
	var pawns = {}; // The policemen's pawns, by index, kept so they can glide
	var choice = {}; // What the player has picked but not confirmed
	var promptTimer = null;
	var names = ['blue', 'yellow', 'brown', 'red', 'green'];
	var storageKey = 'whitechapel.animatePolice';

	function state() {
		return game.state;
	}

	function number(mapid) {
		return board.number(mapid);
	}

	function crossingName(mapid) {
		// Crossings have no printed number: name one by the numbered circles beside it
		var near = _.map(board.adjacentNumbers(mapid), number).sort(function (a, b) { return a - b; });
		return near.length ? 'the crossing by ' + near.slice(0, 3).join('/') : 'a crossing';
	}

	function night() {
		return state().jack.length ? rules.jackNight(state()) : null;
	}

	function position() {
		var n = night();
		return n && n.route.length ? _.last(n.route) : undefined;
	}

	function log(text, kind) {
		draw.log(text, kind);
	}

	function el(mapid, text, classes, title) {
		var element = draw.createElement(mapid, text, 'label token ' + classes);
		if (title) {
			element.attr('title', title);
		}
		return element;
	}

	function selectable(element, onPick) {
		// A choice on the board: clicked, or Enter or Space from the keyboard
		return element.addClass('selectable jv-choice').attr({ tabindex: 0, role: 'button' }).click(onPick).on('keydown', function (event) {
			if (event.key == 'Enter' || event.key == ' ') {
				event.preventDefault();
				onPick.call(this, event);
			}
		});
	}

	/* Jack's board: everything he knows, drawn from the state (cleared and drawn again at each change)
	   -------------------------------------------------------------------------------------------- */
	function paint() {
		var s = state();
		$('.map .jv-static').remove();
		$('.map .crime-scene').remove();
		_.each(s.crimeScenes, function (mapid) {
			$('<span></span>').addClass('label label-info crime-scene token-murder jv-static token-murder-' + mapid)
				.attr({ 'data-mapid': mapid, title: 'Crime scene at ' + number(mapid) })
				.css({ left: board.position(mapid)[0] + 'px', top: board.position(mapid)[1] + 'px' }).appendTo('.map');
		});
		if (!s.jack.length && s.base === undefined) {
			jackCard();
			return;
		}
		var phase = s.phase;
		var n = night();
		// Women and the Wretched: Jack knows which women are marked
		if (n && phase >= 2 && phase <= 7) {
			_.each(s.womenMarked, function (mapid) {
				el(mapid, '', 'token-wretched jv-static jv-wretched', (phase <= 2 ? 'A marked woman (only you know)' : 'A Wretched') + ' on ' + number(mapid)).appendTo('.map');
			});
			if (phase <= 2) {
				_.each(s.womenUnmarked, function (mapid) {
					el(mapid, '', 'token-woman jv-static', 'An unmarked woman on ' + number(mapid) + ': a decoy').appendTo('.map');
				});
			}
		}
		// Patrol tokens, face down unless Jack revealed them
		if (n && phase >= 2 && phase <= 7) {
			_.each(rules.jackView(s).patrols(), function (patrol) {
				if (patrol.revealed && patrol.real) {
					el(patrol.mapid, 'police', 'token-police revealed jv-static jv-patrol', 'A real patrol on ' + crossingName(patrol.mapid) + ' (you revealed it)').appendTo('.map');
				} else if (!patrol.revealed) {
					el(patrol.mapid, 'police', 'token-police jv-static jv-patrol', 'A patrol token, face down, on ' + crossingName(patrol.mapid) + ': real or fake').appendTo('.map');
				}
			});
		}
		// Clues the detectives found tonight
		if (n && s.police.length) {
			_.each(rules.policeNight(s).clue, function (mapid) {
				el(mapid, '', 'token-clue jv-static', 'The detectives found a clue at ' + number(mapid)).appendTo('.map');
			});
		}
		// His hideout, his route tonight, and where he is
		if (s.base !== undefined) {
			el(s.base, '', 'jv-hideout jv-static', 'Your hideout, ' + number(s.base) + ': secret. Walk onto it to end the night').appendTo('.map');
		}
		if (n && phase >= 8 && n.route.length) {
			_.each(_.initial(n.route), function (mapid, i) {
				el(mapid, String(i + 1), 'jv-trail jv-static', 'Your route tonight, step ' + (i + 1) + ': ' + number(mapid)).appendTo('.map');
			});
			el(_.last(n.route), '', 'jv-jack jv-static', 'You are here: ' + number(_.last(n.route))).appendTo('.map');
		}
		paintPolice(false);
		jackCard();
	}

	function paintPolice(glide) {
		// The policemen's pawns. With glide, a pawn that moved slides to its new crossing after those before it
		var s = state();
		var showing = s.police.length && s.phase >= 8 && s.phase <= 11 && !s.over ? rules.policeNight(s).now : [];
		if (s.over && s.police.length && s.phase >= 9) {
			showing = rules.policeNight(s).now;
		}
		_.each(_.keys(pawns), function (i) {
			if (showing[i] === undefined) {
				pawns[i].remove();
				delete pawns[i];
			}
		});
		_.each(showing, function (mapid, i) {
			var at = board.position(mapid);
			var title = 'The ' + names[i] + ' policeman, on ' + crossingName(mapid);
			if (!pawns[i]) {
				pawns[i] = el(mapid, '', 'token-pawn jv-police police-' + i, title).appendTo('.map');
				return;
			}
			var element = pawns[i];
			if (element.data('mapid') !== mapid) {
				var delay = glide && animate && !hurry ? stagger * 0.3 : 0;
				element.css('transition-delay', delay + 's').attr({ 'data-mapid': mapid, title: title }).data('mapid', mapid)
					.css({ left: at[0] + 'px', top: at[1] + 'px' });
				if (glide && animate && !hurry) {
					animUntil = Math.max(animUntil, Date.now() + (delay + 0.45) * 1000);
				}
			}
		});
	}

	function jackCard() {
		// The Jack the Ripper card, from Jack's side: where he is and what he has left
		var s = state();
		var n = night();
		$('.jack-card-title').text('You: Jack the Ripper');
		var murdered = n && n.murder.length > 0;
		var stats = [
			['Hideout', s.base !== undefined ? number(s.base) : '–'],
			['You are at', murdered && position() !== undefined ? number(position()) : '–'],
			['Moves left', murdered ? s.remainingMoves : '–'],
			['Coaches left', n ? n.carriages : '–'],
			['Alleys left', n ? n.alleys : '–'],
			['Victims', s.crimeScenes.length + ' of 5']
		];
		var list = $('<dl></dl>', { class: 'stats' });
		_.each(stats, function (stat) {
			var item = $('<div></div>', { class: 'stat' }).appendTo(list);
			$('<dt></dt>', { text: stat[0] }).appendTo(item);
			$('<dd></dd>', { text: stat[1] }).appendTo(item);
		});
		$('.jack-log').empty().append(list);
		if (murdered) {
			var steps = [n.murder.length > 1 ? number(n.murder[0]) + ' and ' + number(n.murder[1]) : number(n.murder[0])];
			_.each(n.moves, function (move) {
				steps.push(move.type == 'carriage' ? number(move.mapid) + ' (coach via ' + number(move.via) + ')' :
					move.type == 'alley' ? number(move.mapid) + ' (alley)' : number(move.mapid));
			});
			$('<p></p>', { class: 'stat-note jack-route', text: 'Your route tonight: ' + steps.join(' → ') + '. Only you know it.' }).appendTo('.jack-log');
		}
	}

	/* Jack's decisions
	   ---------------- */
	function clearChoices() {
		$('.map .jv-choice').remove();
		$('.map .jv-picked').removeClass('jv-picked');
	}

	function panel(intro) {
		// The phase card's place for Jack's decision. Drawing a decision again first clears its old choices
		clearChoices();
		$('.state.jack-watch').hide();
		var box = $('.state.jack-turn').empty().show();
		$('<h3 class="jack-turn-title"></h3>').text('Your turn').appendTo(box);
		var words = $('<div class="jack-intro"></div>').appendTo(box);
		_.each([].concat(intro), function (text) {
			$('<p></p>').text(text).appendTo(words);
		});
		$('<div class="jack-status" aria-live="polite"></div>').appendTo(box);
		return box;
	}

	function buttons(box) {
		var actions = $('<div class="phase-actions"></div>').appendTo(box);
		setTimeout(function () { mirror(box); }, 0); // Once the prompt has its buttons
		return actions;
	}

	function mirror(box) {
		// On a narrow screen the board is below the phase card: the same status and buttons under the board too, so a
		// choice made on the board can be confirmed without scrolling back up (hidden on wide screens by the style sheet)
		var bar = $('.jack-board-actions').empty();
		if (box.css('display') == 'none' || !game || !game.jackTurn()) {
			bar.prop('hidden', true);
			return;
		}
		bar.append(box.find('.jack-status').clone(), box.find('.jack-move-kinds').clone(true), box.find('.phase-actions').clone(true)).prop('hidden', false);
	}

	function button(where, text, kind, onClick) {
		return $('<button type="button" class="button"></button>').addClass(kind).text(text).click(function () {
			if (!$(this).prop('disabled')) onClick();
		}).appendTo(where);
	}

	function status(box, text) {
		box.find('.jack-status').text(text);
	}

	var prompts = {};

	prompts.hideout = function () {
		var box = panel([
			'Choose your hideout: any numbered circle except a red one. It stays secret all game: the detectives never see it.',
			'Each night ends only when you walk onto it (a coach or an alley onto it doesn\'t count), so pick somewhere you can reach from many directions.'
		]);
		var picked = choice.hideout;
		_.each(rules.hideoutChoices(), function (mapid) {
			selectable(el(mapid, '', 'jv-target jv-hideout-choice' + (picked === mapid ? ' jv-picked' : ''), 'Hide at ' + number(mapid)), function () {
				choice.hideout = mapid;
				prompts.hideout();
			}).appendTo('.map');
		});
		var actions = buttons(box);
		status(box, picked === undefined ? 'Tap a circle on the board. Red circles can\'t be chosen.' : 'Your hideout: ' + number(picked) + '.');
		button(actions, 'Confirm the hideout', 'button-primary jack-confirm', function () {
			decide(function (c) { return game.jackHideout(c.hideout); });
		}).prop('disabled', picked === undefined);
	};

	function womenNeeded() {
		var targets = rules.targetCircles(state());
		var counts = rules.womenTonight(state());
		var marked = Math.min(counts.marked, targets.length);
		return { marked: marked, unmarked: Math.min(counts.women - counts.marked, targets.length - marked), targets: targets };
	}

	prompts.women = function () {
		var need = womenNeeded();
		choice.marked = choice.marked || [];
		choice.unmarked = choice.unmarked || [];
		var box = panel([
			'Place ' + (need.marked + need.unmarked) + ' women on the red circles: ' + need.marked + ' marked, your possible victims (the Wretched), and ' +
				need.unmarked + ' unmarked, as decoys. The detectives see them all face down.',
			'Tap a red circle to mark a woman there, again to make her a decoy, and again to take her away.'
		]);
		_.each(need.targets, function (mapid) {
			var kind = _.contains(choice.marked, mapid) ? 'marked' : _.contains(choice.unmarked, mapid) ? 'unmarked' : 'empty';
			var classes = kind == 'marked' ? 'token-wretched' : kind == 'unmarked' ? 'token-woman' : 'jv-target';
			var title = kind == 'marked' ? 'A marked woman on ' + number(mapid) + ': tap to make her a decoy' :
				kind == 'unmarked' ? 'A decoy on ' + number(mapid) + ': tap to take her away' : 'Place a woman on ' + number(mapid);
			selectable(el(mapid, '', classes + ' jv-woman-choice jv-' + kind, title), function () {
				cycleWoman(mapid, need, box);
			}).appendTo('.map');
		});
		var ready = choice.marked.length == need.marked && choice.unmarked.length == need.unmarked;
		status(box, 'Marked: ' + choice.marked.length + ' of ' + need.marked + ' · Decoys: ' + choice.unmarked.length + ' of ' + need.unmarked +
			(ready ? '. Ready.' : ''));
		var actions = buttons(box);
		button(actions, 'Clear', 'button-secondary jack-clear', function () {
			choice.marked = [];
			choice.unmarked = [];
			prompts.women();
		}).prop('disabled', !choice.marked.length && !choice.unmarked.length);
		button(actions, 'Confirm the women', 'button-primary jack-confirm', function () {
			decide(function (c) { return game.jackWomen(c.marked, c.unmarked); });
		}).prop('disabled', !ready);
	};

	function cycleWoman(mapid, need, box) {
		// Empty -> marked -> decoy -> empty, skipping a kind that is full; a full set says so
		var marked = _.contains(choice.marked, mapid);
		var unmarked = _.contains(choice.unmarked, mapid);
		choice.marked = _.without(choice.marked, mapid);
		choice.unmarked = _.without(choice.unmarked, mapid);
		if (!marked && !unmarked) {
			if (choice.marked.length < need.marked) {
				choice.marked.push(mapid);
			} else if (choice.unmarked.length < need.unmarked) {
				choice.unmarked.push(mapid);
			} else {
				prompts.women();
				status($('.state.jack-turn'), 'Every woman is placed. Tap a placed woman to change her first.');
				return;
			}
		} else if (marked && choice.unmarked.length < need.unmarked) {
			choice.unmarked.push(mapid);
		}
		prompts.women();
	}

	prompts.murder = function (data) {
		var s = state();
		var victims = rules.victimsTonight(s);
		choice.victims = _.filter(choice.victims || [], function (mapid) { return _.contains(s.womenMarked, mapid); });
		var canWait = !rules.mustKill(s);
		var intro = [victims > 1 ?
			'The double event: kill twice tonight. Tap two Wretched in order: you are at the second when the whistles blow, and reaching it is your first move.' :
			'Kill: tap the Wretched who will be your victim.'];
		intro.push(canWait ?
			'Or wait: the Time of the Crime moves from ' + rules.roman(s.timeOfCrime) + ' to ' + rules.roman(s.timeOfCrime + 1) +
				', giving you one more move after the murder. The detectives then move each Wretched, and you reveal one patrol token.' :
			'The Time of the Crime is on V: you can\'t wait any longer, you must kill now.');
		var box = panel(intro);
		_.each(s.womenMarked, function (mapid) {
			var order = _.indexOf(choice.victims, mapid);
			selectable(el(mapid, order >= 0 && victims > 1 ? String(order + 1) : '', 'token-wretched jv-victim-choice' + (order >= 0 ? ' jv-picked' : ''),
				order >= 0 ? 'Your victim on ' + number(mapid) + ': tap to change your mind' : 'Kill on ' + number(mapid)), function () {
				if (_.contains(choice.victims, mapid)) {
					choice.victims = _.without(choice.victims, mapid);
				} else if (choice.victims.length < victims) {
					choice.victims.push(mapid);
				} else if (victims == 1) {
					choice.victims = [mapid];
				}
				prompts.murder(data);
			}).appendTo('.map');
		});
		var ready = choice.victims.length == victims;
		status(box, ready ? 'Victim' + (victims > 1 ? 's' : '') + ': ' + _.map(choice.victims, number).join(' then ') + '.' :
			'Choose ' + (victims > 1 ? (victims - choice.victims.length) + ' more' : 'a victim') + (canWait ? ', or wait.' : '.'));
		var actions = buttons(box);
		button(actions, 'Wait', 'button-secondary jack-wait', function () {
			decide(function () { return game.jackWait(); });
		}).prop('disabled', !canWait).attr('title', canWait ? 'Move the Time of the Crime on' : 'On V you must kill');
		button(actions, 'Kill', 'button-primary jack-confirm', function () {
			decide(function (c) { return game.jackVictims(c.victims); });
		}).prop('disabled', !ready);
	};

	prompts.reveal = function () {
		var hidden = rules.hiddenPatrols(state());
		var box = panel(['Ready to kill: reveal one patrol token. A fake one leaves the board; a real one stays, face up, so you know a policeman will start there.']);
		_.each(hidden, function (mapid) {
			selectable(el(mapid, 'police', 'token-police jv-reveal-choice' + (choice.reveal === mapid ? ' jv-picked selected' : ''),
				'Reveal the patrol token on ' + crossingName(mapid)), function () {
				choice.reveal = mapid;
				prompts.reveal();
			}).appendTo('.map');
		});
		status(box, choice.reveal === undefined ? 'Tap a face-down patrol token.' : 'Reveal the token on ' + crossingName(choice.reveal) + '.');
		var actions = buttons(box);
		button(actions, 'Reveal it', 'button-primary jack-confirm', function () {
			decide(function (c) { return game.jackReveal(c.reveal); });
		}).prop('disabled', choice.reveal === undefined);
	};

	function moveOptions() {
		// Every legal move from here, by kind, from the rules. Coaches: one entry per destination, with every stop
		var s = state();
		var from = position();
		var n = night();
		var coaches = {};
		if (n.carriages > 0 && s.remainingMoves >= 2) {
			_.each(board.walk(from, []), function (via) {
				_.each(board.walk(via, []), function (to) {
					if (rules.isLegalJackMove(s, { type: 'carriage', via: via, mapid: to })) {
						coaches[to] = _.union(coaches[to] || [], [via]);
					}
				});
			});
		}
		return {
			walk: rules.jackWalks(s, from),
			alley: _.pluck(_.where(rules.jackSpecialMoves(s, from), { type: 'alley' }), 'mapid'),
			carriage: coaches
		};
	}

	function unavailable(kind, options) {
		// Why a kind of move can't be made now, or null
		var s = state();
		var n = night();
		if (kind == 'walk') {
			return options.walk.length ? null : 'Policemen block every walk from here.';
		}
		if (kind == 'alley') {
			return n.alleys <= 0 ? 'No alleys left tonight.' : options.alley.length ? null : 'No alley leads from here.';
		}
		if (n.carriages <= 0) {
			return 'No coaches left tonight.';
		}
		if (s.remainingMoves < 2) {
			return 'A coach takes two moves, and you have only ' + s.remainingMoves + ' left.';
		}
		return _.keys(options.carriage).length ? null : 'No coach can go anywhere from here.';
	}

	prompts.move = function () {
		var s = state();
		var n = night();
		var from = position();
		var options = moveOptions();
		var kinds = ['walk', 'alley', 'carriage'];
		if (!choice.kind || unavailable(choice.kind, options)) {
			choice.kind = _.find(kinds, function (kind) { return !unavailable(kind, options); });
			choice.to = undefined;
			choice.via = undefined;
		}
		var home = board.distance(from, s.base);
		var intro = ['You are at ' + number(from) + ' with ' + s.remainingMoves + ' move' + (s.remainingMoves == 1 ? '' : 's') + ' left. Your hideout, ' +
			number(s.base) + ', is ' + home + ' walk' + (home == 1 ? '' : 's') + ' away (by the shortest streets, ignoring policemen).'];
		if (home > s.remainingMoves) {
			intro.push('You can\'t walk home in time from here: a coach covers two circles for two moves, and an alley cuts through a block.');
		}
		intro.push('Walking onto your hideout ends the night. Walks can\'t pass a crossing with a policeman; coaches and alleys can.');
		var box = panel(intro);
		var tabs = $('<div class="jack-move-kinds" role="group" aria-label="Kind of move"></div>').insertBefore(box.find('.jack-status'));
		var labels = { walk: 'Walk', alley: 'Alley (' + n.alleys + ' left)', carriage: 'Coach (' + n.carriages + ' left)' };
		_.each(kinds, function (kind) {
			var why = unavailable(kind, options);
			$('<button type="button" class="button jack-kind"></button>').addClass('jack-kind-' + kind)
				.addClass(choice.kind == kind ? 'button-primary' : 'button-secondary').text(labels[kind])
				.attr({ 'aria-pressed': choice.kind == kind ? 'true' : 'false', title: why || '' }).prop('disabled', !!why)
				.click(function () {
					choice.kind = kind;
					choice.to = undefined;
					choice.via = undefined;
					prompts.move();
				}).appendTo(tabs);
		});
		var reasons = _.compact(_.map(kinds, function (kind) {
			var why = unavailable(kind, options);
			return why ? labels[kind].replace(/ \(.*/, '') + ': ' + why : null;
		}));
		if (reasons.length) {
			$('<div class="jack-unavailable"></div>').text(reasons.join(' ')).insertBefore(box.find('.jack-status'));
		}
		// The destinations of the chosen kind of move
		var list = choice.kind == 'carriage' ? _.map(_.keys(options.carriage), Number) : options[choice.kind] || [];
		var showVias = choice.kind == 'carriage' && choice.to !== undefined && options.carriage[choice.to].length > 1 && choice.via === undefined;
		_.each(list, function (to) {
			var homeMove = to === s.base;
			var label = homeMove ? 'Home' : '';
			var title = (choice.kind == 'walk' ? 'Walk' : choice.kind == 'alley' ? 'Slip through the alley' : 'Take a coach') + ' to ' + number(to) +
				(homeMove ? (choice.kind == 'walk' ? ': your hideout, ends the night' : ': your hideout, but only a walk onto it ends the night') : '');
			selectable(el(to, label, 'jv-dest jv-dest-' + choice.kind + (homeMove ? ' jv-dest-home' : '') + (choice.to === to ? ' jv-picked' : ''), title), function () {
				choice.to = to;
				choice.via = choice.kind == 'carriage' && options.carriage[to].length == 1 ? options.carriage[to][0] : undefined;
				prompts.move();
			}).appendTo('.map');
		});
		if (showVias) {
			_.each(options.carriage[choice.to], function (via) {
				selectable(el(via, 'via', 'jv-via', 'The coach passes ' + number(via) + ' (both stops go on your sheet)'), function () {
					choice.via = via;
					prompts.move();
				}).appendTo('.map');
			});
		}
		var move = moveChosen();
		var actions = buttons(box);
		if (move) {
			status(box, describeMove(move) + (move.type == 'walk' && move.mapid === s.base ? ' This ends the night.' : '') +
				(move.type != 'walk' && move.mapid === s.base ? ' (Not a walk: the night goes on.)' : ''));
		} else if (showVias) {
			status(box, 'The coach to ' + number(choice.to) + ' can pass different circles: tap the one marked "via" it should stop at.');
		} else {
			status(box, 'Tap a ringed circle on the board.');
		}
		button(actions, 'Cancel', 'button-secondary jack-cancel', function () {
			choice.to = undefined;
			choice.via = undefined;
			prompts.move();
		}).prop('disabled', choice.to === undefined);
		button(actions, 'Confirm the move', 'button-primary jack-confirm', function () {
			var chosen = moveChosen();
			if (chosen) {
				decide(function () { return game.jackMove(chosen); });
			}
		}).prop('disabled', !move);
	};

	function decide(send) {
		// Send a confirmed decision. The choices are cleared first: the engine may ask for the next decision at once,
		// and its prompt starts afresh. A refused decision (the rules said no) keeps them and draws the prompt again
		var made = choice;
		choice = {};
		if (!send(made)) {
			choice = made;
			prompt();
		}
	}

	function moveChosen() {
		if (choice.to === undefined || (choice.kind == 'carriage' && choice.via === undefined)) {
			return null;
		}
		return choice.kind == 'carriage' ? { type: 'carriage', via: choice.via, mapid: choice.to } : { type: choice.kind, mapid: choice.to };
	}

	function describeMove(move) {
		var left = state().remainingMoves - rules.moveCost(move);
		var verb = move.type == 'carriage' ? 'Coach to ' + number(move.mapid) + ' via ' + number(move.via) :
			move.type == 'alley' ? 'Alley to ' + number(move.mapid) : 'Walk to ' + number(move.mapid);
		return verb + ': ' + left + ' move' + (left == 1 ? '' : 's') + ' left after it.';
	}

	function prompt() {
		// Show what the player has to do now: one of Jack's decisions, or the detectives at work
		clearTimeout(promptTimer);
		promptTimer = null;
		clearChoices();
		if (!game || state().over) {
			$('.state.jack-turn, .state.jack-watch').hide();
			return;
		}
		var decision = game.jackTurn();
		if (!decision) {
			watching();
			return;
		}
		var wait = animUntil - Date.now();
		if (wait > 0 && animate && !hurry) {
			// The policemen are still gliding: Jack's choices once they stop
			watching();
			promptTimer = setTimeout(prompt, wait);
			return;
		}
		hurry = false;
		$('.board').removeClass('jv-hurry');
		prompts[decision]();
		draw.reveal();
	}

	function watching() {
		$('.state.jack-turn').hide();
		$('.jack-board-actions').empty().prop('hidden', true);
		var phase = state().phase;
		var text = {
			2: 'The detectives are placing their patrol tokens, face down: five real policemen and two fakes.',
			5: 'You waited: the detectives move each Wretched.',
			10: 'The detectives are moving their policemen.',
			11: 'The detectives search for clues, or try to arrest you.'
		}[phase] || 'The detectives are at work.';
		var box = $('.state.jack-watch').empty().show();
		$('<h3 class="jack-turn-title"></h3>').text('The detectives\' turn').appendTo(box);
		$('<div class="jack-intro"></div>').append($('<p></p>').text(text)).appendTo(box);
		var actions = buttons(box);
		button(actions, 'Skip to my turn', 'button-secondary skip-animations', skip);
	}

	function skip() {
		// Finish the detectives' turn at once: the same decisions, without the pauses
		hurry = true;
		animUntil = 0;
		$('.board').addClass('jv-hurry');
		if (police) {
			police.setDelay(delay);
			police.nudge();
		}
		if (game.jackTurn()) {
			prompt();
		}
	}

	function delay(phase) {
		// The pause before the detectives' next step: long enough to follow, nothing when hurried or not animating
		if (!animate || hurry) {
			return 0;
		}
		if (moving) {
			moving = false;
			return Math.max(700, animUntil - Date.now() + 300);
		}
		return phase == 2 ? 500 : 800;
	}

	/* What the engine reports, from Jack's side
	   ----------------------------------------- */
	var events = {
		started: function () {
			$('button.highlight-pieces').prop('hidden', true);
			paint();
		},
		phase: function (data) {
			if (data.phase == 10) {
				stagger = 0;
			}
			if (data.phase == 8) {
				log('The whistles blow: the real patrols become policemen.', 'police');
			}
			paint();
		},
		nightStarted: function (data) {
			var nightInfo = content.nights[data.night];
			_.each(_.keys(pawns), function (i) { pawns[i].remove(); });
			pawns = {};
			$('.move-tracker p span').removeClass('active murder carriage alley');
			var coaches = rules.config.carriages[data.night];
			var alleys = rules.config.alleys[data.night];
			log(nightInfo.name + ', ' + nightInfo.date + (nightInfo.note ? ' (' + nightInfo.note.toLowerCase() + ')' : '') + '. You have ' +
				coaches + (coaches == 1 ? ' coach' : ' coaches') + ' and ' + alleys + (alleys == 1 ? ' alley' : ' alleys') + ' tonight.', 'night');
		},
		action: function (data) {
			if (data.side != 'jack') {
				return;
			}
			if (data.type == 'hideout') {
				log('You chose your hideout: ' + number(data.args.mapid) + '. Only you know it.', 'jack');
			} else if (data.type == 'women') {
				log('You placed the women: marked on ' + _.map(data.args.marked, number).join(', ') + '; decoys on ' +
					(_.map(data.args.unmarked, number).join(', ') || 'none') + '. The detectives see them face down.', 'jack');
			}
		},
		patrolChanged: paint,
		patrolsPlaced: function () {
			log('The detectives have placed their patrol tokens, face down.', 'police');
			paint();
		},
		jackWaited: function (data) {
			draw.tracker();
			log('You wait. The Time of the Crime moves to ' + rules.roman(data.timeOfCrime) + '.', 'jack');
		},
		noWretchedCanMove: function () {
			log('No Wretched can move.', 'police');
		},
		wretchedMoved: function (data) {
			log('The detectives move a Wretched from ' + number(data.from) + ' to ' + number(data.to) + '.', 'police');
			paint();
		},
		wretchedStays: function (data) {
			log('The Wretched on ' + number(data.mapid) + ' can\'t move, and stays.', 'police');
		},
		patrolRevealed: function (data) {
			log(data.fake ? 'You reveal the patrol on ' + crossingName(data.mapid) + ': a fake, and it leaves the board.' :
				'You reveal the patrol on ' + crossingName(data.mapid) + ': a real policeman.', 'jack');
			paint();
		},
		murder: function (data) {
			draw.tracker();
			var where = _.map(data.scenes, number);
			log(where.length > 1 ? 'The double event: you kill at ' + where.join(' and then ') + '. The whistles blow!' :
				'You kill at ' + where[0] + '. The whistles blow!', 'crime');
			paint();
		},
		jackMoved: function (data) {
			var move = data.move;
			var space = rules.jackNight(state()).trackPosition;
			var spans = $('.move-tracker p span');
			if (move.type == 'carriage') {
				spans.eq(space - 2).addClass('carriage');
				spans.eq(space - 1).addClass('carriage');
				log('You take a coach via ' + number(move.via) + ' to ' + number(move.mapid) + ' (moves ' + rules.trackLabel(space - 1) + ' and ' + rules.trackLabel(space) + ').', 'jack');
			} else if (move.type == 'alley') {
				spans.eq(space - 1).addClass('alley');
				log('You slip through an alley to ' + number(move.mapid) + ' (move ' + rules.trackLabel(space) + ').', 'jack');
			} else {
				log('You walk to ' + number(move.mapid) + ' (move ' + rules.trackLabel(space) + ').', 'jack');
			}
			draw.tracker();
			paint();
		},
		jackEscaped: function () {
			log('You are home: the night is over, and the detectives never saw where you went.', 'night');
		},
		policemanMoved: function (data) {
			log(data.from === data.to ? 'The ' + names[data.index] + ' policeman stays on ' + crossingName(data.to) + '.' :
				'The ' + names[data.index] + ' policeman moves to ' + crossingName(data.to) + '.', 'police');
			paintPolice(true);
			if (data.from !== data.to) {
				stagger++;
				moving = true;
			}
		},
		searchFinished: function (data) {
			var missed = _.map(data.missed, number);
			if (data.clue) {
				log('The ' + names[data.index] + ' policeman searches' + (missed.length ? ' ' + missed.join(', ') + ', then' : '') + ' ' + number(data.mapid) +
					' and finds a clue: you passed there tonight.', 'clue');
			} else {
				log('The ' + names[data.index] + ' policeman searches ' + missed.join(', ') + ': no clue.', 'police');
			}
			paint();
		},
		arrestFailed: function (data) {
			log('The ' + names[data.index] + ' policeman tries to arrest you at ' + number(data.mapid) + ': you aren\'t there.', 'police');
		},
		gameOver: function (result) {
			ending(result);
		}
	};

	function ending(result) {
		var s = state();
		var nightName = content.nights[Math.max(0, s.jack.length - 1)].name.toLowerCase();
		var messages = {
			arrested: 'You were arrested at ' + (result.mapid !== undefined ? number(result.mapid) : '') + ' on the ' + nightName + '. The detectives win.',
			trapped: 'The policemen have you surrounded on the ' + nightName + ': you can\'t move. The detectives win.',
			outOfMoves: 'Your time ran out on the ' + nightName + ' before you reached your hideout. The detectives win.',
			jackWins: 'You killed five victims and escaped on all four nights. You win!'
		};
		var message = messages[result.type];
		log(message, 'end');
		clearChoices();
		$('.state.jack-turn, .state.jack-watch').hide();
		$('.jack-board-actions').empty().prop('hidden', true);
		draw.progress('');
		paint();
		var escaped = _.filter(_.range(s.police.length), function (n) {
			return _.findWhere(rules.publicLog(s, n), { type: 'escaped' });
		}).length;
		var clues = _.reduce(s.police, function (sum, p) { return sum + p.clue.length; }, 0);
		var searches = _.reduce(_.range(s.police.length), function (sum, n) {
			return sum + _.where(rules.publicLog(s, n), { type: 'search' }).length;
		}, 0);
		var arrests = _.reduce(_.range(s.police.length), function (sum, n) {
			return sum + _.where(rules.publicLog(s, n), { type: 'arrest' }).length;
		}, 0) + (result.type == 'arrested' ? 1 : 0);
		var summary = $('.ending-summary').empty().prop('hidden', false);
		_.each([
			'Nights escaped: ' + escaped + ' of ' + rules.config.nights,
			'Victims: ' + s.crimeScenes.length + ' of 5',
			'Your hideout: ' + (s.base !== undefined ? number(s.base) : '–'),
			'Circles the detectives searched: ' + searches + ', finding ' + clues + ' clue' + (clues == 1 ? '' : 's'),
			'Arrests they attempted: ' + arrests
		], function (line) {
			$('<li></li>').text(line).appendTo(summary);
		});
		$('.ending .dialog-kicker').text(result.type == 'jackWins' ? 'Jack escapes' : 'Jack is caught');
		$('.game-over').text(message);
		$('.ending').addClass('open');
	}

	function attach(attachedGame, options) {
		options = options || {};
		game = attachedGame;
		draw = WC.ui.draw;
		WC.ui.setRole('jack');
		var stored = null;
		try { stored = window.localStorage ? window.localStorage.getItem(storageKey) : null; } catch (e) { stored = null; }
		animate = options.animate !== undefined ? !!options.animate : stored !== 'off';
		$('.board').toggleClass('jv-still', !animate);
		addAnimationToggle(options);
		game.on(function (type, data) {
			if (events[type]) {
				events[type](data);
			}
			if (type == 'jackTurn' || type == 'policeTurn' || type == 'phase' || type == 'started') {
				prompt();
			}
		});
		return {
			delay: function () { return delay; },
			pace: function (autoPolice) { police = autoPolice; },
			skip: skip,
			animating: function () { return animate; },
			choice: function () { return choice; }
		};
	}

	function addAnimationToggle(options) {
		// A setting in the phase card: show the detectives' moves step by step, or play them at once
		$('.jack-animate').remove();
		var label = $('<label class="jack-animate"></label>').append(
			$('<input type="checkbox" class="jack-animate-toggle">').prop('checked', animate).change(function () {
				animate = $(this).prop('checked');
				$('.board').toggleClass('jv-still', !animate);
				try { if (window.localStorage && options.animate === undefined) window.localStorage.setItem(storageKey, animate ? 'on' : 'off'); } catch (e) { /* Not saved */ }
				if (police) {
					police.setDelay(delay);
				}
			}),
			$('<span></span>').text(' Show the detectives\' moves step by step')
		);
		label.insertBefore('.phase-steps');
	}

	return { attach: attach };
})(jQuery, _, WC.board, WC.rules, WC.content);
