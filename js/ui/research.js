/* The Anonymous Gameplay Research setting (docs/automatic-playtest-collection.md#for-players): a notice with a switch
   in the setup dialog, before any game starts; a Research button in the top bar that opens the full notice and the
   same switch at any time; and a line in the ending dialog saying what happened to this game.
   It only shows when the site was built with an intake address (js/config.js); otherwise the site sends nothing and
   none of this appears. The switch is never pushed on the player again once they have chosen. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.research = function (submitter, options) {
	options = options || {};
	var configured = !!submitter && submitter.configured();
	var dialog = $('.research-dialog');
	var opener = null;
	var current = null; // The game id of the game that just ended, if it was kept

	$('.research-notice, .research-open').prop('hidden', !configured);
	if (!configured) {
		return { showFor: function () {}, open: function () {}, close: function () {} };
	}

	function sync() {
		var on = submitter.enabled();
		$('.research-toggle').prop('checked', on);
		$('.research-state').text(on ? 'On: your completed games are submitted anonymously.' :
			'Off: your games stay in this browser and are not sent anywhere.');
		if (!submitter.chosen() && submitter.privacySignal()) {
			$('.research-state').text('Off, because your browser asks sites not to track or share (Global Privacy Control or Do Not Track). You can turn it on.');
		}
	}

	function line(submission) {
		var s = submission || {};
		var id = current ? ' Game ID ' + current + '.' : '';
		switch (s.status) {
		case 'pending':
		case 'submitting':
			return 'This game is being submitted anonymously for research (Anonymous Gameplay Research is on: Research in the top bar turns it off).';
		case 'submitted':
			return 'Submitted anonymously for research. Thank you!' + id;
		case 'retry':
			return s.nextAttemptAt ? 'Not submitted yet: it will be tried again later. The game is kept in this browser.' :
				'Not submitted: the research service could not be reached. The game is kept in this browser.';
		case 'rejected':
			return 'The research service did not accept this game. It is still kept in this browser.';
		default:
			return s.reason == 'opted-out' || s.reason == 'cancelled' ? 'Not submitted for research: Anonymous Gameplay Research is off.' : '';
		}
	}

	function show(submission) {
		var text = line(submission);
		$('.playtest-submitted').text(text).prop('hidden', !text);
	}

	function open() {
		opener = document.activeElement;
		$('.overlay.open').not(dialog).addClass('was-open').removeClass('open');
		sync();
		dialog.addClass('open');
		dialog.find('.research-close').focus();
	}

	function close() {
		dialog.removeClass('open');
		$('.overlay.was-open').removeClass('was-open').addClass('open');
		if (opener && opener.focus) opener.focus();
	}

	$('.research-toggle').off('change').on('change', function () {
		var on = $(this).prop('checked');
		submitter.setEnabled(on);
		sync();
	});
	$('.research-open').off('click').on('click', open);
	$('.research-about').off('click').on('click', open);
	dialog.find('.research-close').off('click').on('click', close);
	dialog.off('keydown').on('keydown', function (event) {
		if (event.key == 'Escape') close();
	});
	submitter.onChange(function (id, submission) {
		if (id === current) show(submission);
	});
	sync();

	return {
		showFor: function (result) {
			// After the game was kept (or not): the ending dialog's line about submission
			if (!result || !result.entry || result.status != 'saved') {
				$('.playtest-submitted').prop('hidden', true);
				return;
			}
			current = result.entry.id;
			show(result.entry.submission);
		},
		open: open,
		close: close,
		sync: sync
	};
};
