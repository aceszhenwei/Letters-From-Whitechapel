// The ceiling of containment against the short-return Jacks (docs/detective-ai-v3.md, "Why containment can't
// generalise"): at the start of each night 4, if five policemen could stand on ANY crossings (ignoring how far they could
// move), chosen greedily by the police's own belief to close the most weight of one-walk escapes from the women on
// the board to the possible hideouts, how often would they close Jack's actual escape? And with the true hideout known?
//   node research/detective-v3/ceiling.js [jack, default short-return] [games, default 30] [first seed, default 460001]
const lib = require('../detective-inference/lib');
const { WC, _ } = lib;
const local = Object.assign({}, require('../human-strategy/policies'), require('./jacks'));
const configs = require('./configs');

const [jack = 'short-return', gamesText = '30', fromText = '460001'] = process.argv.slice(2);
lib.registerJack('__ceiling', (random) => local[jack](random));
const C = WC.containment;
const allCrossings = Object.keys(lib.core.map).map(Number).filter((id) => lib.core.map[id] && !WC.board.isNumbered(id) && WC.board.neighbours(id).length);


let reached = 0; let closedBelief = 0; let closedTrue = 0; let shareSum = 0;
for (let seed = Number(fromText); seed < Number(fromText) + Number(gamesText); seed++) {
	let snapshot = null;
	const police = WC.createPolice(WC.board, WC.rules, WC.deduction, _, configs.v2);
	lib.play({
		jack: '__ceiling', police: 'deductive', seed, policeOptions: configs.v2,
		onPolice: (state, view) => {
			if (view.phase === 2 && view.night === 3 && !snapshot) {
				snapshot = { women: view.women.slice(), crime: view.crimeScenes.slice(), homes: police.belief(view, false).hideouts, base: state.base, state };
			}
		}
	});
	if (!snapshot) continue;
	const scene = _.last(snapshot.state.jack[3].murder);
	if (!scene || !WC.board.walk(scene, []).includes(snapshot.base)) continue; // Not a one-walk night 4
	reached++;
	// Exact closure only: score with blockers as the only closing crossings
	const list = C.threats(snapshot.homes, snapshot.crime, { neighbourWeight: 0, sites: snapshot.women });
	const total = list.reduce((s, t) => s + t.weight, 0);
	const exactValue = (c, chosen) => list.reduce((s, t) => (t.blockers.includes(c) && C.open(t, chosen) ? s + t.weight : s), 0);
	const chosen = [];
	while (chosen.length < 5) chosen.push(_.max(allCrossings, (c) => (chosen.includes(c) ? -1 : exactValue(c, chosen))));
	shareSum += total ? list.filter((t) => !C.open(t, chosen)).reduce((s, t) => s + t.weight, 0) / total : 0;
	const actual = C.walkBlockers(scene, snapshot.base);
	if (actual.some((c) => chosen.includes(c))) closedBelief++;
	const trueList = C.threats(_.object([snapshot.base], [1]), snapshot.crime, { neighbourWeight: 0, sites: snapshot.women });
	const chosenTrue = [];
	const trueValue = (c, ch) => trueList.reduce((s, t) => (t.blockers.includes(c) && C.open(t, ch) ? s + t.weight : s), 0);
	while (chosenTrue.length < 5) chosenTrue.push(_.max(allCrossings, (c) => (chosenTrue.includes(c) ? -1 : trueValue(c, chosenTrue))));
	if (actual.some((c) => chosenTrue.includes(c))) closedTrue++;
}
console.log(JSON.stringify({ jack, oneWalkNight4: reached, beliefShareClosed: +(shareSum / Math.max(1, reached)).toFixed(3), actualEscapeClosedByBelief: closedBelief, actualEscapeClosedKnowingHideout: closedTrue }));
