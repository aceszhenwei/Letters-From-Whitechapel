/* Night review: the police's case files, so a player can look over a night before the next one begins, and look back
   at any night that is over.
   - Each night's record comes from WC.rules.nightRecord: what the police saw, frozen when the night ended. It never
     holds Jack's route, position or hideout, so nothing here can show them.
   - Reviewing a night draws its record on the board on top of the game (the game's own pieces are hidden meanwhile)
     and changes nothing in the game: no engine action is called, except beginNextNight when the player asks for it.
   - A crime scene or clue in the review can be clicked to show the walking distance from it to the circles around,
     on an empty board (policemen, coaches and alleys ignored), to help reconstruct where Jack could have gone. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.review = (function ($, _, board, rules, content) {

	var game;
	var records = []; // records[night]: frozen, kept from the moment the night ended
	var showing = null; // The night shown on the board, or null
	var distanceFrom = null;
	var policeNames = ['blue', 'yellow', 'brown', 'red', 'green'];

	function number(mapid) {
		return board.number(mapid);
	}

	function movesMade(record) {
		// Move-track spaces Jack used after the murder (a coach uses two)
		return _.reduce(record.log, function (n, entry) {
			return entry.type == 'move' ? n + (entry.move == 'carriage' ? 2 : 1) : n;
		}, 0);
	}

	function lines(record) {
		// The night in order, in words, from the public record alone
		var out = [];
		var space = _.last(record.murderMove);
		var first = record.murderMove[0];
		var where = _.map(record.crimeScenes, number).join(' and ');
		out.push({ kind: 'crime', text: (record.crimeScenes.length > 1 ? 'The double event: bodies found at ' + where : 'Body found at ' + where) +
			' (Time of the Crime ' + rules.trackLabel(first) + ').' });
		var starts = _.map(record.policeRoutes, function (route, i) { return policeNames[i] + ' ' + crossingName(route[0]); });
		out.push({ kind: 'police', text: 'Policemen start at: ' + starts.join(', ') + '.' });
		var before = _.map(record.policeRoutes, function (route) { return route[0]; });
		_.each(record.log, function (entry) {
			if (entry.type == 'move') {
				var moved = _.filter(_.map(entry.police, function (c, i) {
					return c != before[i] ? policeNames[i] + ' to ' + crossingName(c) : null;
				}), _.identity);
				if (moved.length > 0) {
					out.push({ kind: 'police', text: 'Policemen moved: ' + moved.join(', ') + '.' });
				}
				before = entry.police;
				if (entry.move == 'carriage') {
					space += 2;
					out.push({ kind: 'jack', text: 'Moves ' + rules.trackLabel(space - 1) + ' and ' + rules.trackLabel(space) + ': Jack takes a coach.' });
				} else {
					space += 1;
					out.push({ kind: 'jack', text: 'Move ' + rules.trackLabel(space) + ': Jack ' + (entry.move == 'alley' ? 'slips through an alley.' : 'moves.') });
				}
			} else if (entry.type == 'search') {
				out.push(entry.clue ? { kind: 'clue', text: 'Searched ' + number(entry.mapid) + ': a clue. Jack had been there that night.' } :
					{ kind: 'search', text: 'Searched ' + number(entry.mapid) + ': no clue.' });
			} else if (entry.type == 'arrest') {
				out.push({ kind: 'arrest', text: 'Arrest at ' + number(entry.mapid) + ': Jack was not there.' });
			} else if (entry.type == 'escaped') {
				out.push({ kind: 'night', text: 'Move ' + rules.trackLabel(space) + ': Jack reached his hideout. The night was over.' });
			}
		});
		return out;
	}

	function crossingName(mapid) {
		// Crossings have no printed number: name one by the numbered circles beside it
		var near = _.map(board.adjacentNumbers(mapid), number).sort(function (a, b) { return a - b; });
		return near.length ? 'the crossing by ' + near.slice(0, 3).join('/') : 'a crossing';
	}

	/* The board */
	function clearBoard() {
		$('.map .review').remove();
		$('.board').removeClass('reviewing');
		distanceFrom = null;
	}

	function marker(mapid, classes, title) {
		return WC.ui.draw.createElement(mapid, '', 'label token review ' + classes).attr('title', title).appendTo('.map');
	}

	function drawNight(night) {
		var record = records[night];
		clearBoard();
		$('.board').addClass('reviewing');
		_.each(record.earlierCrimeScenes, function (c) { marker(c, 'review-crime review-earlier review-clickable', 'Crime scene from an earlier night, ' + number(c) + ': click for walking distances'); });
		_.each(record.crimeScenes, function (c) { marker(c, 'review-crime review-clickable', 'Crime scene this night, ' + number(c) + ': click for walking distances'); });
		_.each(record.clues, function (c) { marker(c, 'review-clue review-clickable', 'Clue found at ' + number(c) + ': click for walking distances'); });
		_.each(_.where(record.log, { type: 'search', clue: false }), function (e) { marker(e.mapid, 'review-searched', 'Searched ' + number(e.mapid) + ': no clue'); });
		_.each(_.where(record.log, { type: 'arrest' }), function (e) { marker(e.mapid, 'review-arrest', 'Arrest at ' + number(e.mapid) + ': Jack was not there'); });
		_.each(record.policeRoutes, function (route, i) {
			marker(_.last(route), 'token-pawn review-police police-' + i, 'The ' + policeNames[i] + ' policeman ended the night here');
		});
		$('.map .review-clickable').click(function () {
			showDistances(Number($(this).data('mapid')));
		});
	}

	function showDistances(from) {
		// Walking moves on an empty board from one circle to the circles around it
		$('.map .review-distance').remove();
		if (distanceFrom === from) {
			distanceFrom = null;
			$('.review-distance-note').text('');
			return;
		}
		distanceFrom = from;
		var reach = Number($('.review-radius').val()) || 6;
		_.each(board.numbered(), function (c) {
			var d = board.distance(from, c);
			if (c != from && d <= reach) {
				marker(c, 'review-distance review-distance-' + Math.min(d, 9), number(c) + ': ' + d + (d == 1 ? ' walk' : ' walks') + ' from ' + number(from)).text(d);
			}
		});
		$('.review-distance-note').text('Walking moves from ' + number(from) + ' on an empty board, up to ' + reach + '. Policemen, coaches and alleys are ignored, so these are not proof of where Jack went. Click it again to hide them.');
	}

	/* The case files card */
	function renderCard() {
		var finished = _.filter(_.range(records.length), function (n) { return records[n]; });
		$('.review-card').prop('hidden', finished.length == 0);
		var buttons = $('.review-nights').empty();
		_.each(finished, function (n) {
			$('<button type="button" class="button button-secondary review-night"></button>')
				.text('Night ' + (n + 1))
				.attr('aria-pressed', showing === n ? 'true' : 'false')
				.toggleClass('active', showing === n)
				.click(function () { show(showing === n ? null : n); })
				.appendTo(buttons);
		});
		var body = $('.review-body').empty();
		if (showing === null || !records[showing]) {
			return;
		}
		var record = records[showing];
		var night = content.nights[showing];
		$('<h3></h3>').text(night.name + ', ' + night.date + (record.escaped ? ': Jack escaped' : '')).appendTo(body);
		var list = $('<ol class="review-log"></ol>').appendTo(body);
		_.each(lines(record), function (line) {
			$('<li></li>', { class: 'event kind-' + line.kind, text: line.text }).appendTo(list);
		});
		var tool = $('<div class="review-tool"></div>').appendTo(body);
		var label = $('<label></label>').text('Walking distances up to ').appendTo(tool);
		var select = $('<select class="review-radius"></select>').appendTo(label);
		_.each(_.range(1, 16), function (r) { $('<option></option>').val(r).text(r).appendTo(select); });
		select.val(Math.max(1, Math.min(6, movesMade(record)))); // Nearer circles first: a larger radius covers most of the map
		label.append(' moves (Jack made ' + movesMade(record) + ' that night)');
		select.change(function () {
			if (distanceFrom !== null) {
				var from = distanceFrom;
				distanceFrom = null;
				showDistances(from);
			}
		});
		$('<p class="review-distance-note"></p>').text('Click a crime scene or clue on the board to see walking distances from it.').appendTo(tool);
		var actions = $('<div class="phase-actions"></div>').appendTo(body);
		if (game.state.phase == 12 && showing == game.state.jack.length - 1) {
			$('<button type="button" class="button button-primary begin-next-night"></button>').text('Begin the next night').click(beginNextNight).appendTo(actions);
		} else {
			$('<button type="button" class="button button-secondary close-review"></button>').text(game.state.over ? 'Close the case file' : 'Back to the current night').click(function () { show(null); }).appendTo(actions);
		}
	}

	function show(night) {
		showing = night;
		if (night === null) {
			clearBoard();
		} else {
			drawNight(night);
		}
		renderCard();
	}

	function beginNextNight() {
		show(null);
		$('.state.the-night-is-over').hide();
		game.beginNextNight();
	}

	function keep(night) {
		// Keep a night's record once it is over: it is frozen, and later nights never change it
		if (!records[night]) {
			records[night] = rules.nightRecord(game.state, night);
		}
	}

	function attach(attachedGame) {
		game = attachedGame;
		game.on(function (type, data) {
			if (type == 'nightOver') {
				keep(data.night);
				var text = 'Jack has reached his hideout: ' + content.nights[data.night].name.toLowerCase() + ' is over. The board stays as it was so you can look it over, with the night\'s log in the case files. Begin the next night when you are ready.';
				$('.state.the-night-is-over').empty().append($('<p></p>').text(text)).append(
					$('<div class="phase-actions"></div>').append($('<button type="button" class="button button-primary begin-next-night"></button>').text('Begin the next night').click(beginNextNight))
				).show();
				show(data.night);
			} else if (type == 'gameOver') {
				_.each(_.range(game.state.jack.length), keep);
				renderCard();
			} else if (type == 'phase' && showing !== null && data.phase != 12) {
				show(null); // A new phase of the game: back to the game's own board
			}
		});
		$('.review-case').click(function () {
			$('.ending').removeClass('open');
			show(game.state.jack.length - 1);
		});
	}

	return { attach: attach, records: function () { return records; }, show: show, lines: lines };
})(jQuery, _, WC.board, WC.rules, WC.content);
