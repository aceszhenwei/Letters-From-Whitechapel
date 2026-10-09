// Compares this project's map with whitechapelR's: walking connections and alleys between numbered circles.
//   node research/detective-inference/compare-maps.js
// Needs fixtures/whitechapelR-*.json (export-whitechapelR-data.R). Prints counts and every difference.
const fs = require('fs');
const path = require('path');
const resultsDir = require('./results-dir');
const { loadCore } = require('../../tools/sim/run-game');

const { WC, map } = loadCore();
const fixtures = path.join(__dirname, 'fixtures');
const theirs = (name) => new Set(JSON.parse(fs.readFileSync(path.join(fixtures, `whitechapelR-${name}.json`))).map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));

const circles = Array.from(WC.board.numbered());
const number = (id) => map[id].number;
const edges = (neighbours) => {
	const set = new Set();
	for (const id of circles) for (const other of neighbours(id)) {
		const a = number(id); const b = number(other);
		set.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
	}
	return set;
};
function compare(label, ours, them) {
	const onlyOurs = [...ours].filter((e) => !them.has(e)).sort();
	const onlyTheirs = [...them].filter((e) => !ours.has(e)).sort();
	console.log(`${label}: ours ${ours.size}, whitechapelR ${them.size}, shared ${ours.size - onlyOurs.length}`);
	console.log(`  only ours (${onlyOurs.length}): ${onlyOurs.join(' ')}`);
	console.log(`  only whitechapelR (${onlyTheirs.length}): ${onlyTheirs.join(' ')}`);
	return { onlyOurs, onlyTheirs };
}
console.log(`numbered circles: ${circles.length}`);
const walks = compare('walking connections', edges((id) => WC.board.walk(id, [])), theirs('roads'));
const alleys = compare('alleys', edges((id) => WC.board.alleys(id)), theirs('alley'));
// Are their extra alleys our walking connections (or the other way round)?
const ourWalks = edges((id) => WC.board.walk(id, []));
console.log(`  of whitechapelR-only alleys, also walking connections here: ${alleys.onlyTheirs.filter((e) => ourWalks.has(e)).length}`);
fs.writeFileSync(path.join(resultsDir, 'map-differences.json'), JSON.stringify({ walks, alleys }, null, 1));
