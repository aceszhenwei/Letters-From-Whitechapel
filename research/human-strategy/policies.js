// Jack policies built from the BoardGameGeek threads (docs/human-strategy-literature.md), for experiments only.
// Each one plays the forum's idea where it applies and falls back to Jack AI v2 (js/ai/jack-v2.js) everywhere else,
// so a comparison with Jack AI v2 isolates the idea. They use only Jack's view; the hideout is the forum's.
//
//   jack-v2@51, jack-v2@134  Jack AI v2 with the forum's hideout forced (controls: the hideout without the scheme)
//   bgg-51     grey_wolf / mark_xiii: hideout 51, next to red circles 65 and 84. Nights 1-2 as Jack AI v2, keeping
//              65 and 84 free; night 3 (the double event) kills at 84 last, night 4 at 65, both straight away, then
//              walks home in one move when he can
//   bgg-51-night4  only that scheme's last night (65 kept for night 4); nights 1-3 as Jack AI v2
//   bgg-134    ketigid: hideout 134, a Wretched on 147 every night (147 is one walk from 134). Nights 1-3: wait once
//              so the police move the Wretched off 147, then kill the Wretched nearest home; night 4: kill at 147
//              straight away and walk home
//   coach-first  Jack AI v2, except that on nights 1-3 his first move is a coach (when one leaves 6 moves to spare),
//              as several posters advise ("rapidly expand their footprint")
const { WC, _ } = require('../detective-inference/lib');
require('../jack-v2/policies/jack-v2'); // Loads js/ai/jack-v2.js into the research core

const lastNight = WC.rules.config.nights - 1;

function jackV2(random) {
	return WC.createJackV2(WC.board, WC.deduction, random, _);
}

// Jack AI v2 with a fixed hideout (it still sees every legal choice, so its model of the police is unchanged)
function withHideout(home, random, base = jackV2(random)) {
	return Object.assign({}, base, {
		chooseHideout(choices) {
			base.chooseHideout(choices);
			return choices.includes(home) ? home : choices[0];
		}
	});
}

// Walk home if a walk reaches it now, else Jack AI v2's move
function walkHomeOr(base, view) {
	return view.walks().includes(view.hideout) ? { mapid: view.hideout, type: 'walk' } : base.chooseMove(view);
}

// Women as Jack AI v2 places them, then swapped so that the circles in `want` are marked (while there are marked
// women to place) and none in `keep` (saved for later nights) is marked. Night 1 puts a woman on every red circle,
// so a circle can be kept free of Wretched, not free of women: unmarked women are removed before the killing
function placeWomen(base, view, want, keep) {
	const placed = base.placeWomen(view);
	let marked = placed.marked.slice();
	let unmarked = placed.unmarked.slice();
	const all = marked.concat(unmarked);
	for (const w of want.filter((x) => view.targets.includes(x))) {
		if (marked.includes(w)) continue;
		if (!all.includes(w)) unmarked.push(w); // Not placed at all: place it (dropping another below)
		const out = marked.find((x) => !want.includes(x)) || marked[marked.length - 1];
		marked = marked.map((x) => (x === out ? w : x));
		unmarked = unmarked.filter((x) => x !== w).concat(all.includes(out) ? [out] : []);
	}
	for (const k of keep) {
		if (!marked.includes(k)) continue;
		const swap = unmarked.find((x) => !keep.includes(x));
		if (swap === undefined) continue;
		marked = marked.map((x) => (x === k ? swap : x));
		unmarked = unmarked.map((x) => (x === swap ? k : x));
	}
	unmarked = unmarked.slice(0, view.women.women - marked.length);
	return { marked, unmarked };
}

function bgg51(random) {
	const id = (x) => WC.board.numbered().find((m) => WC.board.number(m) === x);
	const [c65, c84] = [id(65), id(84)];
	const base = withHideout(id(51), random);
	return Object.assign({}, base, {
		placeWomen(view) {
			if (view.night === 2) return placeWomen(base, view, [c84], [c65]);
			if (view.night === lastNight) return placeWomen(base, view, [c65], []);
			return placeWomen(base, view, [], [c65, c84]);
		},
		wantsToWait(view) {
			return view.night >= 2 ? false : base.wantsToWait(view);
		},
		chooseVictims(view) {
			const scheme = view.night === 2 ? c84 : view.night === lastNight ? c65 : null;
			if (scheme && view.wretched.includes(scheme)) {
				const others = _.without(view.wretched, scheme);
				return others.slice(0, view.victims - 1).concat([scheme]); // The last victim is where he starts
			}
			return base.chooseVictims(view);
		},
		chooseMove(view) {
			return view.night >= 2 ? walkHomeOr(base, view) : base.chooseMove(view);
		}
	});
}

// Only the scheme's last night: 65 is kept free of Wretched on nights 1-3, then killed at once on night 4 and
// home is one walk away. Nights 1-3, the double event included, are Jack AI v2's
function bgg51Night4(random) {
	const id = (x) => WC.board.numbered().find((m) => WC.board.number(m) === x);
	const c65 = id(65);
	const base = withHideout(id(51), random);
	return Object.assign({}, base, {
		placeWomen(view) {
			return view.night === lastNight ? placeWomen(base, view, [c65], []) : placeWomen(base, view, [], [c65]);
		},
		wantsToWait(view) {
			return view.night === lastNight ? false : base.wantsToWait(view);
		},
		chooseVictims(view) {
			return view.night === lastNight && view.wretched.includes(c65) ? [c65] : base.chooseVictims(view);
		},
		chooseMove(view) {
			return view.night === lastNight ? walkHomeOr(base, view) : base.chooseMove(view);
		}
	});
}

function bgg134(random) {
	const id = (x) => WC.board.numbered().find((m) => WC.board.number(m) === x);
	const c147 = id(147);
	const home = id(134);
	const base = withHideout(home, random);
	let waited = null; // The night he has waited on
	return Object.assign({}, base, {
		placeWomen(view) {
			return placeWomen(base, view, [c147], []);
		},
		wantsToWait(view) {
			if (view.night === lastNight || waited === view.night) return false;
			waited = view.night;
			return true;
		},
		chooseVictims(view) {
			// The Wretched nearest home is killed last, so the hunt starts there
			const sorted = _.sortBy(view.wretched, (w) => WC.board.distance(w, home));
			const last = sorted[0];
			return sorted.slice(1, view.victims).concat([last]);
		},
		chooseMove(view) {
			return walkHomeOr(base, view);
		}
	});
}

function coachFirst(random) {
	const base = jackV2(random);
	return Object.assign({}, base, {
		chooseMove(view) {
			const first = view.route.length === view.victims; // No move yet tonight (the double event's second scene counts as one)
			if (first && view.night < lastNight && view.tokens.carriages > 0) {
				const options = view.specialMoves().filter((o) => o.type === 'carriage' && view.remainingMoves - 2 - view.distanceToHideout(o.mapid) >= 6);
				if (options.length) {
					const pick = options[random.int(0, options.length)];
					return { mapid: pick.mapid, type: 'carriage', via: pick.via };
				}
			}
			return base.chooseMove(view);
		}
	});
}

module.exports = {
	'jack-v2@51': (random) => withHideout(WC.board.numbered().find((m) => WC.board.number(m) === 51), random),
	'jack-v2@134': (random) => withHideout(WC.board.numbered().find((m) => WC.board.number(m) === 134), random),
	'bgg-51': bgg51,
	'bgg-51-night4': bgg51Night4,
	'bgg-134': bgg134,
	'coach-first': coachFirst
};
