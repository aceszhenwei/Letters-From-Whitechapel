/* Exporting the game log: a dialog that saves the game's record (js/core/record.js) as a JSON file on this device.
   - The police's record (public): only what the police could see. Available at any time, so it never spoils a game.
   - Jack's record (public, role 'jack'), when the player plays Jack: what Jack knew, his own secrets included, and
     the detectives' public moves; never the detectives' patrol tokens before they are turned over.
   - The full record: Jack's hideout and route too. Only once the game is over, or after the player ends it on
     purpose, ticking that they understand it reveals Jack's secrets and can't be continued.
   Nothing is sent anywhere: the file is made in the page and saved through the browser. The optional label and
   comments are the player's own, and only go in the file if they write them. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.exportLog = function (game, recorder, options) {
	options = options || {};
	var dialog = $('.export-dialog');
	var opener = null;
	var stopWatching = options.stopWatching || function () {};
	var last = null;

	function save(record) {
		// Through a link to the file, as the browser downloads one. options.save replaces it (tests)
		last = record;
		var text = WC.record.stringify(record);
		if (options.save) {
			options.save(WC.record.filename(record), text);
			return;
		}
		var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
		var link = $('<a></a>').attr({ href: url, download: WC.record.filename(record) }).appendTo('body');
		link[0].click();
		link.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
	}

	function feedback() {
		return { label: dialog.find('.export-label').val(), comments: dialog.find('.export-comments').val() };
	}

	function describe() {
		var state = game.state;
		var status = recorder.status();
		var night = 'night ' + Math.max(1, state.jack.length) + ' of ' + WC.rules.config.nights;
		var actions = recorder.actions().length + ' actions recorded';
		if (status == 'completed') {
			return 'The game is over (' + night + '). ' + actions + '.';
		}
		if (status == 'abandoned') {
			return 'You ended the game on ' + night + '. Jack\'s hideout was ' + WC.board.number(state.base) + '. ' + actions + '.';
		}
		return 'The game is in progress (' + night + '). ' + actions + '.';
	}

	function refresh() {
		var full = recorder.canExportFull();
		dialog.find('.export-status').text(describe());
		dialog.find('.export-full').prop('disabled', !full);
		dialog.find('.export-full-note').text(full ?
			'Spoilers: it includes Jack\'s hideout, every move he made and his secret choices.' :
			'Available once the game is over, or if you end the game below.');
		dialog.find('.export-end').prop('hidden', recorder.status() != 'inProgress');
		dialog.find('.export-end-game').prop('disabled', !dialog.find('.export-confirm').prop('checked'));
		dialog.find('.export-jack-choice').prop('hidden', !game.settings.humanJack);
	}

	function open() {
		opener = document.activeElement;
		$('.overlay.open').not(dialog).addClass('was-open').removeClass('open');
		refresh();
		dialog.addClass('open');
		dialog.find('.export-public').focus();
	}

	function close() {
		dialog.removeClass('open');
		$('.overlay.was-open').removeClass('was-open').addClass('open');
		if (opener && opener.focus) opener.focus();
	}

	$('.export-open').off('click').on('click', open);
	dialog.find('.export-close').off('click').on('click', close);
	dialog.off('keydown').on('keydown', function (event) {
		if (event.key == 'Escape') close();
	});
	dialog.find('.export-public').off('click').on('click', function () {
		save(recorder.exportPublic('police', { feedback: feedback() }));
	});
	dialog.find('.export-jack').off('click').on('click', function () {
		save(recorder.exportPublic('jack', { feedback: feedback() }));
	});
	dialog.find('.export-full').off('click').on('click', function () {
		if (recorder.canExportFull()) {
			save(recorder.exportFull({ feedback: feedback() }));
		}
	});
	dialog.find('.export-confirm').off('change').on('change', refresh);
	dialog.find('.export-end-game').off('click').on('click', function () {
		// Ending the game: the board stops taking moves, the computer police stop, and the full record is available
		if (!recorder.abandon({ confirmed: dialog.find('.export-confirm').prop('checked') })) {
			return;
		}
		stopWatching();
		$('body').addClass('game-ended');
		$('.brand-subtitle').text('London, 1888 · You ended this game');
		dialog.find('.export-confirm').prop('checked', false);
		refresh();
		dialog.find('.export-full').focus();
	});
	game.on(function (type) {
		if (type == 'started') {
			$('.export-open').prop('hidden', false);
		}
		if (dialog.hasClass('open')) {
			refresh();
		}
	});

	return { open: open, close: close, last: function () { return last; } };
};
