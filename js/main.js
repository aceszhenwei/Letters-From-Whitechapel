/* Start-up: creates the game with Jack's AI, attaches the interface, and opens the intro dialog.
   `game` is the one global the page creates, for the browser console and the tests. */
var game = WC.engine.create({ ai: WC.jackAI });
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
