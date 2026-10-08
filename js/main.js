/* Start-up: creates the game, attaches the interface, and opens the setup dialog.
   `game` is the one global the page creates, for the browser console and the tests.
   Jack plays Easy (the baseline AI, js/ai/jack.js) until the setup dialog applies the chosen difficulty when the
   game starts (js/ui/setup.js, js/ai/difficulty.js). */
var game = WC.engine.create({ ai: WC.jackAI });
WC.ui.attach(game);

if (!window.WHITECHAPEL_NO_AUTOSTART) { // Tests load the game without starting it
	$(function () {
		WC.ui.setup(game, { search: window.location.search });
		$('.intro').addClass('open');
		$('.start-game').focus();
		$('.new-game').click(function () {
			window.location.reload();
		});
		$(window).resize(WC.ui.draw.fit);
	});
}
