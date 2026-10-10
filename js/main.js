/* Start-up: creates the game, attaches the interface, and opens the setup dialog.
   `game` is the one global the page creates, for the browser console and the tests.
   Jack plays Easy (the baseline AI, js/ai/jack.js) until the setup dialog applies the chosen difficulty when the
   game starts (js/ui/setup.js, js/ai/difficulty.js). `recorder` keeps the game's record for exporting. */
var game = WC.engine.create({ ai: WC.jackAI, confirmPoliceMoves: true, reviewNights: true }); // The player confirms moves and starts each night
var recorder = WC.record.attach(game); // The game log the player can export (js/ui/export.js); it stays in the page
WC.ui.attach(game);
WC.ui.review.attach(game);

if (!window.WHITECHAPEL_NO_AUTOSTART) { // Tests load the game without starting it
	$(function () {
		var setup = WC.ui.setup(game, { search: window.location.search, recorder: recorder });
		WC.ui.exportLog(game, recorder, { stopWatching: function () { var w = setup.watching(); if (w) w.stop(); } });
		$('.intro').addClass('open');
		$('.start-game').focus();
		$('.new-game').click(function () {
			window.location.reload();
		});
		$(window).resize(WC.ui.draw.fit);
	});
}
