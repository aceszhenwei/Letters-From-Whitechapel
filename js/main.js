/* Start-up: creates the game with Jack's AI, attaches the interface, and opens the intro dialog.
   `game` is the one global the page creates, for the browser console and the tests.
   Jack plays the baseline AI (js/ai/jack.js); index.html?jack=strategic plays the stronger one (docs/jack-ai.md). */
var game = WC.engine.create({
	ai: /[?&]jack=strategic\b/.test(window.location.search) ? WC.createStrategicJack(WC.board, WC.deduction, WC.random, _) : WC.jackAI
});
WC.ui.attach(game);

if (!window.WHITECHAPEL_NO_AUTOSTART) { // Tests load the game without starting it
	$(function () {
		$('.intro').addClass('open');
		$('.start-game').click(function () {
			$('.intro').removeClass('open');
			game.start();
		}).focus();
		$('.new-game').click(function () {
			window.location.reload();
		});
		$(window).resize(WC.ui.draw.fit);
	});
}
