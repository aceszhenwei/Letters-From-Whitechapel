/* Computer police in the page: when the player chooses to watch, a police AI (js/ai/police.js) takes each of the
   police's actions in turn, a short pause apart, through the same engine actions a player's clicks use. It is handed
   only the police's methods (game.policeActions(), not the game or its state) and the police view
   (WC.rules.policeView), so Jack's secrets stay hidden from it, whether the computer plays Jack or a person does.
   Each step is one call to the police AI; a step never starts while another runs, twice, or after the game ends.
   The pause between steps is only presentation: setDelay(0) hurries the hunt without changing any decision. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.autoPolice = function (game, police, options) {
	options = options || {};
	var delay = options.delay !== undefined ? options.delay : 700; // Milliseconds between actions, so the hunt can be followed
	var random = options.random || Math.random;
	var policePhases = [2, 5, 10, 11];
	var pending = false;
	var stopped = false;
	var acting = false;
	var timer = null;
	var actions = game.policeActions();

	function ours() {
		return !game.state.over && _.contains(policePhases, game.state.phase);
	}

	function step() {
		pending = false;
		if (stopped || acting || !ours()) {
			return;
		}
		var before = JSON.stringify([game.state.phase, game.state.turn, game.state.police.length]);
		acting = true;
		try {
			police.turn(actions, WC.rules.policeView(game.state), random);
		} finally {
			acting = false;
		}
		if (JSON.stringify([game.state.phase, game.state.turn, game.state.police.length]) === before && ours()) {
			stopped = true; // The police AI couldn't act: stop rather than loop
			return;
		}
		schedule();
	}

	function schedule() {
		if (!pending && !stopped && !acting && ours()) {
			pending = true;
			timer = setTimeout(step, typeof delay == 'function' ? delay(game.state.phase) : delay); // A function of the phase about to be played
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
		running: function () { return !stopped; },
		setDelay: function (ms) { delay = ms; },
		nudge: function () {
			// Take the next step now instead of after its pause (the decisions are the same)
			if (pending) {
				clearTimeout(timer);
				pending = false;
				schedule();
			}
		},
		delay: function () { return delay; },
		busy: function () { return !stopped && ours(); } // The police are still to act
	};
};
