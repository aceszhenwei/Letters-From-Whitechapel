// Diagnostic Jack policies for testing the police's robustness (docs/detective-ai-v2.md, "Robustness"). They are
// fixed, rule-following policies for research only: not a Deceptive Jack, and not part of the game.
//
// Detour Jack: the strategic Jack, except that early in each night, while he has time to spare, he walks away from
// his hideout. It tests whether police that guard likely hideouts depend on Jack heading straight home.
const { registerJack, WC, _ } = require('../detective-inference/lib');

const detourMoves = 3; // Walk away from home on the first 3 moves of a night...
const spareNeeded = 6; // ...while at least this many moves would be left to spare after it (2 per move away, and 0 left)

function createDetourJack(random) {
	const strategic = WC.createStrategicJack(WC.board, WC.deduction, random, _);
	return Object.assign({}, strategic, {
		chooseMove(view) {
			const movesSoFar = view.route.length - 1; // His sheet starts with the crime scene
			const walks = view.walks();
			const home = (mapid) => view.distanceToHideout(mapid);
			const spare = view.remainingMoves - home(view.position);
			if (movesSoFar <= detourMoves && spare - 2 >= spareNeeded && walks.length) {
				const away = _.filter(walks, (mapid) => mapid !== view.hideout && home(mapid) > home(view.position));
				if (away.length) return { mapid: away[random.int(0, away.length)], type: 'walk' };
			}
			return strategic.chooseMove(view);
		}
	});
}

registerJack('detour', createDetourJack);
module.exports = { createDetourJack };
