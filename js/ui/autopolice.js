/* Computer police in the page: when the player chooses to watch, a police AI (js/ai/police.js) takes each of the
   police's actions in turn, a short pause apart, through the same engine actions a player's clicks use. It sees only
   the police view (WC.rules.policeView), so Jack's secrets stay hidden from it and from the screen. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.autoPolice = function (game, police, options) {
	options = options || {};
	var delay = options.delay !== undefined ? options.delay : 700; // Milliseconds between actions, so the hunt can be followed
	var random = options.random || Math.random;
	var policePhases = [2, 5, 10, 11];
	var pending = false;
	var stopped = false;

	function ours() {
		return !game.state.over && _.contains(policePhases, game.state.phase);
	}

	function step() {
		pending = false;
		if (stopped || !ours()) {
			return;
		}
		var before = JSON.stringify([game.state.phase, game.state.turn, game.state.police.length]);
		police.turn(game, WC.rules.policeView(game.state), random);
		if (JSON.stringify([game.state.phase, game.state.turn, game.state.police.length]) === before && ours()) {
			stopped = true; // The police AI couldn't act: stop rather than loop
			return;
		}
		schedule();
	}

	function schedule() {
		if (!pending && !stopped && ours()) {
			pending = true;
			setTimeout(step, delay);
		}
	}

	game.on(function (type) {
		if (type === 'policeTurn' || type === 'phase' || type === 'started') {
			schedule();
		}
	});
	schedule();

	return {
		stop: function () { stopped = true; },
		running: function () { return !stopped; }
	};
};
