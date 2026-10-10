// Plays Jack through the page (js/ui/jack-player.js), as a person would: tapping the choices drawn on the board and
// the buttons in the phase card. Used by the Human Jack tests.
const { loadGame, seededRandom } = require('./game');

function setupJack({ seed = 5, search = '?role=jack', saved = {}, policeSeed = 77, animate = false } = {}) {
	const window = loadGame({ seed });
	const store = Object.assign({}, saved);
	const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
	const setup = window.WC.ui.setup(window.game, { search, storage, policeDelay: 0, seed: policeSeed, jackAnimate: animate });
	return { window, setup, store };
}

const until = (check, ms = 120000) => new Promise((resolve, reject) => {
	const started = Date.now();
	const poll = () => {
		let done;
		try { done = check(); } catch (error) { return reject(error); }
		if (done) return resolve();
		if (Date.now() - started > ms) return reject(new Error('timed out'));
		setTimeout(poll, 5);
	};
	poll();
});

// One decision as Jack through the page. strategy(window, decision) may return a plan; otherwise random legal choices
function jackDecision(window, random, options = {}) {
	const $ = window.$;
	const game = window.game;
	const q = (selector) => $('.map').find(selector);
	const pick = (elements) => elements.eq(Math.floor(random() * elements.length));
	const decision = game.jackTurn();
	if (!decision) return null;
	const confirm = () => $('.state.jack-turn .jack-confirm').click();
	switch (decision) {
		case 'hideout': {
			const target = options.hideout !== undefined ? q('.jv-hideout-choice').filter(function () { return $(this).data('mapid') === options.hideout; }) : pick(q('.jv-hideout-choice'));
			target.click();
			confirm();
			return 'hideout';
		}
		case 'women': {
			for (let i = 0; i < 40 && $('.state.jack-turn .jack-confirm').prop('disabled'); i++) {
				pick(q('.jv-woman-choice.jv-empty')).click();
			}
			confirm();
			return 'women';
		}
		case 'murder': {
			if (!$('.state.jack-turn .jack-wait').prop('disabled') && random() < (options.waitChance !== undefined ? options.waitChance : 0.3)) {
				$('.state.jack-turn .jack-wait').click();
				return 'wait';
			}
			for (let i = 0; i < 5 && $('.state.jack-turn .jack-confirm').prop('disabled'); i++) {
				pick(q('.jv-victim-choice').not('.jv-picked')).click();
			}
			confirm();
			return 'kill';
		}
		case 'reveal':
			pick(q('.jv-reveal-choice')).click();
			confirm();
			return 'reveal';
		case 'move': {
			const home = q('.jv-dest-home.jv-dest-walk');
			if (home.length) {
				home.click();
			} else {
				const kinds = $('.state.jack-turn .jack-kind').filter(function () { return !$(this).prop('disabled'); });
				const kind = random() < 0.85 && kinds.filter('.jack-kind-walk').length ? kinds.filter('.jack-kind-walk') : pick(kinds);
				kind.click();
				const toward = options.toward !== false;
				let dests = q('.jv-dest');
				if (toward && dests.length) {
					// Head home: the destination nearest the hideout, most of the time
					const base = game.state.base;
					const sorted = dests.toArray().sort((a, b) => window.WC.board.distance($(a).data('mapid'), base) - window.WC.board.distance($(b).data('mapid'), base));
					dests = random() < 0.8 ? $(sorted[0]) : pick(dests);
				} else {
					dests = pick(dests);
				}
				dests.click();
				if (q('.jv-via').length) pick(q('.jv-via')).click();
			}
			confirm();
			return 'move';
		}
	}
	return 'stuck';
}

// Play a whole game as Jack: decide whenever the engine waits for Jack, and let the computer detectives play
async function playJack(window, options = {}) {
	const random = seededRandom(options.seed !== undefined ? options.seed + 500 : 3);
	const decisions = [];
	await until(() => {
		if (window.game.state.over) return true;
		if (window.game.jackTurn()) {
			const made = jackDecision(window, random, options);
			decisions.push(made);
			if (options.check) options.check(window, made);
		}
		return window.game.state.over || decisions.length > 2000;
	}, options.ms || 240000);
	return decisions;
}

module.exports = { setupJack, until, jackDecision, playJack };
