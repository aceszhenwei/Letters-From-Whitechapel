// Coordination counterfactuals (docs/detective-study.md, section 2), from experiment.js's files. No game is played here.
//   node research/detective-study/coordination.js <seed set, e.g. 590001-30> <variants, comma-separated> [jacks, comma-separated]
// Every variant plays the same game as Detective AI v3 until the last night, so the police's FIRST move of the last
// night starts from the very same position in both. That move is compared, with the REFEREE's knowledge of Jack's
// circle and hideout (for the analysis only):
//   approaches   how many of the true hideout's approaches (the crossings beside it, through which the last step of
//                every walk home passes) a policeman stands on or can reach next turn
//   near home    policemen standing within one walk of the true hideout
//   overlap      the share of the circles the policemen can search or arrest at that two or more of them cover
//                (0: no overlap; it is not a fault in itself: two policemen may guard different approaches)
//   next to Jack whether a policeman stands next to Jack's true circle after the move
// and by the outcome of the night.
const fs = require('fs');
const path = require('path');
const { WC, _ } = require('../detective-inference/lib');

const board = WC.board;
const dir = path.join(__dirname, 'results');

function approaches(home) {
	return board.neighbours(home).filter((c) => !board.isNumbered(c));
}

function measure(positions, home, jack) {
	const entries = approaches(home);
	const reach = new Set(_.flatten(positions.map((c) => [c].concat(board.crossingsWithinTwo(c)))));
	const circles = positions.map((c) => board.adjacentNumbers(c));
	const counts = _.countBy(_.flatten(circles));
	const covered = Object.keys(counts);
	return {
		approaches: entries.filter((e) => reach.has(e)).length / entries.length,
		nearHome: positions.filter((c) => board.adjacentNumbers(c).some((n) => n === home || board.walk(n, []).includes(home))).length,
		overlap: covered.length ? covered.filter((c) => counts[c] > 1).length / covered.length : 0,
		nextToJack: circles.some((list) => list.includes(jack)) ? 1 : 0
	};
}

function main() {
	const [set = '590001-30', variantList = 'coordinate,cordon,block2', jackList = 'strategic,jack-v2,jack-v2-waiting,short-return'] = process.argv.slice(2);
	const load = (jack, variant) => {
		const file = path.join(dir, `${jack}__${variant}__${set}.json`);
		return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).games : null;
	};
	const lines = [`The police's first move of the last night, from identical positions (seeds ${set}). REFEREE's knowledge for the analysis only.`, '',
		'| Jack | Police | Last nights | Approaches to the true hideout within reach | Policemen within one walk of it | Overlap of coverage | Next to Jack | Police won the night |',
		'|---|---|---:|---:|---:|---:|---:|---:|'];
	for (const jack of jackList.split(',')) {
		for (const variant of ['v3'].concat(variantList.split(','))) {
			const games = load(jack, variant);
			if (!games) continue;
			const firsts = games.filter((g) => g.lastTurns && g.lastTurns.length && g.lastTurns[0].after);
			if (!firsts.length) continue;
			const m = firsts.map((g) => measure(g.lastTurns[0].after, g.home, g.lastTurns[0].position));
			const mean = (k) => m.reduce((s, x) => s + x[k], 0) / m.length;
			const won = firsts.filter((g) => g.result !== 'jackWins').length;
			lines.push(`| ${jack} | ${variant} | ${firsts.length} | ${(100 * mean('approaches')).toFixed(0)}% | ${mean('nearHome').toFixed(2)} | ${(100 * mean('overlap')).toFixed(0)}% | ${(100 * mean('nextToJack')).toFixed(0)}% | ${won} |`);
		}
	}
	const out = lines.join('\n') + '\n';
	fs.writeFileSync(path.join(dir, `coordination-${set}.md`), out);
	console.log(out);
}

if (require.main === module) main();

module.exports = { measure, approaches };
