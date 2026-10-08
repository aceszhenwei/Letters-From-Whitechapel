// Plays the police without a page: it only asks the rules for legal choices and calls the engine's actions.
// This is what any non-browser player (a test, a simulation, a future AI evaluation) would do.
const { seededRandom } = require('./game');

function policeTurn(WC, game, random) {
	const { rules } = WC;
	const state = game.state;
	const pick = (list) => list[Math.floor(random() * list.length)];
	switch (state.phase) {
		case 2: {
			const positions = rules.patrolPositions(state);
			const real = positions.required.length > 0 ? Array.from(positions.required) : positions.all.slice(0, 5);
			real.forEach((id) => game.togglePatrol(id, 'real'));
			positions.all.filter((id) => !real.includes(id)).slice(0, 2).forEach((id) => game.togglePatrol(id, 'fake'));
			return 'patrols';
		}
		case 5: {
			const from = state.womenMarked[state.turn.pending[0]];
			const moves = rules.wretchedMoves(state, from);
			return moves.length > 0 ? game.moveWretched(from, pick(moves)) && 'wretched' : game.keepWretched(from) && 'stays';
		}
		case 10: {
			const now = rules.policeNight(state).now;
			const index = now.findIndex((id, i) => !state.turn.moved.includes(i));
			return game.movePoliceman(index, pick(rules.policeDestinations(state, index).concat([now[index]]))) && 'police';
		}
		case 11: {
			const police = rules.policeNight(state);
			const index = police.now.findIndex((id, i) => !state.turn.done.includes(i) && (police.search[i].length > 0 || police.arrest[i].length > 0));
			if (police.search[index].length > 0 && (random() >= 0.2 || police.arrest[index].length == 0)) {
				game.chooseAction(index, 'search');
				for (const circle of Array.from(police.search[index])) {
					if (circle !== undefined && game.search(index, circle) !== 'miss') break;
				}
				return 'search';
			}
			game.chooseAction(index, 'arrest');
			return game.arrest(index, pick(police.arrest[index]));
		}
		default:
			return 'stuck';
	}
}

function playHeadless(WC, game, { seed = 1, check, maxActions = 5000 } = {}) {
	const random = seededRandom(seed + 2000);
	game.start();
	for (let i = 0; i < maxActions && !game.state.over; i++) {
		const action = policeTurn(WC, game, random);
		if (check) check(game, action);
		if (action === 'stuck') return 'stuck';
	}
	return game.state.over ? 'over' : 'too long';
}

module.exports = { policeTurn, playHeadless };
