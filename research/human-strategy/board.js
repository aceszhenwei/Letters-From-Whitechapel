// The board in the printed numbers players use (the forum posts name circles by the number printed on them, while
// js/data/map.js keys places by map id). Crossings have no printed number, so they are named by the printed numbers
// of the circles next to them, as players do ("the crossing between 29 and 30").
const { WC, _ } = require('../detective-inference/lib');

const board = WC.board;
const byNumber = {};
for (const id of board.numbered()) byNumber[board.number(id)] = id;

const id = (n) => {
	if (byNumber[n] === undefined) throw new Error('No circle numbered ' + n);
	return byNumber[n];
};
const n = (mapid) => board.number(mapid);
// Plain arrays of this realm (the core runs in a vm context, whose arrays fail deepStrictEqual against ours)
const ns = (mapids) => Array.from(mapids, n).sort((a, b) => a - b);

// A crossing's name: the printed numbers of the circles joined to it
// (a crossing next to a single circle, or to none, also gets its map id to keep names distinct)
const crossingName = (c) => {
	const next = ns(board.adjacentNumbers(c));
	return next.length >= 2 ? next.join('/') : `crossing ${c}${next.length ? ' (by ' + next[0] + ')' : ''}`;
};
// Crossings next to every one of these printed numbers
function crossingsNextTo(...numbers) {
	const candidates = _.uniq(_.flatten(numbers.map((x) => board.neighbours(id(x)).filter((c) => !board.isNumbered(c)))));
	return candidates.filter((c) => numbers.every((x) => board.adjacentNumbers(c).includes(id(x))));
}

// Walking moves (Jack can't pass a crossing with a policeman), as printed numbers
const walks = (x, police = []) => ns(board.walk(id(x), police));
// Coach destinations: two walks ignoring policemen, not back to the start
function coaches(x) {
	const out = new Set();
	for (const via of board.walk(id(x), [])) for (const to of board.walk(via, [])) if (to !== id(x)) out.add(n(to));
	return [...out].sort((a, b) => a - b);
}
const alleys = (x) => ns(board.alleys(id(x)));
// Fewest walking moves between two circles, with policemen standing on `police`
function distance(from, to, police = []) {
	const target = id(to);
	const seen = { [id(from)]: 0 };
	const queue = [id(from)];
	while (queue.length) {
		const at = queue.shift();
		if (at === target) return seen[at];
		for (const next of board.walk(at, police)) if (seen[next] === undefined) { seen[next] = seen[at] + 1; queue.push(next); }
	}
	return Infinity;
}
const red = () => ns(board.redCircles());
const stations = () => board.stations();

module.exports = { WC, _, board, id, n, ns, crossingName, crossingsNextTo, walks, coaches, alleys, distance, red, stations };
