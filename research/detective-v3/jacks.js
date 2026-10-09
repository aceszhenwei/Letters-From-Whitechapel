// Short-return Jacks for the Detective AI v3 study (docs/detective-ai-v3.md), generalising the BoardGameGeek schemes
// (docs/human-strategy-literature.md) away from any one hideout, so the police are not validated against the very
// scheme they were developed on. Both choose, at random, a hideout one walk from a red circle, and play Jack AI v2
// whenever the scheme doesn't apply. Only Jack's view is used.
//   short-return      keeps one red circle next to home free of Wretched until night 4, then kills there at once and
//                     walks home (the "Night 4" scheme, anywhere on the board)
//   short-return-all  every night, kills at once on a red circle next to home when it can and walks home
const { WC, _ } = require('../detective-inference/lib');
const { helpers } = require('../human-strategy/policies');

const lastNight = WC.rules.config.nights - 1;
const red = WC.board.redCircles();
const nextToRed = (h) => red.filter((r) => WC.board.walk(h, []).includes(r));

function shortReturn(random, everyNight) {
	let base = null;
	let saved = null; // The red circle next to home kept for the last night
	const ai = {
		chooseHideout(choices) {
			const good = choices.filter((h) => nextToRed(h).length > 0);
			const home = good[random.int(0, good.length)];
			base = helpers.withHideout(home, random);
			base.chooseHideout(choices);
			const reds = nextToRed(home);
			saved = reds[random.int(0, reds.length)];
			return home;
		},
		placeWomen(view) {
			const near = nextToRed(view.hideout).filter((r) => view.targets.includes(r));
			if (view.night === lastNight) return helpers.placeWomen(base, view, near.includes(saved) ? [saved] : near.slice(0, 1), []);
			if (everyNight) return helpers.placeWomen(base, view, near.filter((r) => r !== saved).slice(0, view.women.marked), [saved]);
			return helpers.placeWomen(base, view, [], [saved]);
		},
		wantsToWait(view) {
			return this.target(view) ? false : base.wantsToWait(view);
		},
		target(view) {
			// The Wretched next to home he means to kill tonight, if any
			if (view.night !== lastNight && !everyNight) return null;
			const near = view.wretched.filter((w) => WC.board.walk(w, []).includes(view.hideout));
			return near.length ? near[0] : null;
		},
		chooseVictims(view) {
			const t = this.target(view);
			if (!t) return base.chooseVictims(view);
			return _.without(view.wretched, t).slice(0, view.victims - 1).concat([t]);
		},
		choosePatrolToReveal(view, hidden) { return base.choosePatrolToReveal(view, hidden); },
		chooseMove(view) {
			const scheme = view.night === lastNight || everyNight;
			return scheme ? helpers.walkHomeOr(base, view) : base.chooseMove(view);
		}
	};
	return ai;
}

module.exports = {
	'short-return': (random) => shortReturn(random, false),
	'short-return-all': (random) => shortReturn(random, true)
};
