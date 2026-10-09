// Checks the deduction (js/core/deduction.js) against the exhaustive reference (lib.enumerate) on every prefix of
// every night's public record in seeded games:
// - sound: Jack's true circle is never ruled out (with and without the time and hideout pruning the police use);
// - complete: circles the deduction keeps but no legal route reaches (kept impossible positions).
//   node research/detective-inference/soundness.js [games per Jack, default 60] [first seed, default 700001]
const fs = require('fs');
const path = require('path');
const resultsDir = require('./results-dir');
const { WC, play, publicPrefixes, enumerate, policeContext } = require('./lib');

const games = Number(process.argv[2] || 60);
const from = Number(process.argv[3] || 700001);
const out = { games, from, byJack: {} };
for (const jack of ['baseline', 'strategic']) {
	const s = { prefixes: 0, truthLostPlain: 0, truthLostPruned: 0, enumerated: 0, truthLostReference: 0, notSuperset: 0,
		exact: 0, extraCircles: 0, extraByMove: {}, pruneShrink: 0, examples: [] };
	for (let seed = from; seed < from + games; seed++) {
		const state = play({ jack, police: 'deductive', seed });
		for (const item of publicPrefixes(state)) {
			s.prefixes++;
			const plain = WC.deduction.track(item.prefix, {});
			const pruned = WC.deduction.track(item.prefix, policeContext(state, item));
			if (!(plain.current[item.truth] > 0)) { s.truthLostPlain++; s.examples.push({ seed, night: item.night, steps: item.steps, kind: 'lost-plain' }); }
			if (!(pruned.current[item.truth] > 0)) { s.truthLostPruned++; s.examples.push({ seed, night: item.night, steps: item.steps, kind: 'lost-pruned' }); }
			s.pruneShrink += plain.size - pruned.size;
			if (item.steps > 7) continue; // The reference lists routes one by one: short records only
			const reference = enumerate(item.prefix, 3e5);
			if (!reference) continue;
			s.enumerated++;
			if (!reference.circles[item.truth]) s.truthLostReference++;
			const ours = Object.keys(plain.current).map(Number);
			const exact = Object.keys(reference.circles).map(Number);
			if (!exact.every((c) => plain.current[c] > 0)) { s.notSuperset++; s.examples.push({ seed, night: item.night, steps: item.steps, kind: 'not-superset' }); }
			const extra = ours.filter((c) => !reference.circles[c]);
			if (extra.length === 0) s.exact++;
			else {
				s.extraCircles += extra.length;
				const kinds = [...new Set(item.prefix.filter((e) => e.type === 'move').map((e) => e.move))].sort().join('+');
				s.extraByMove[kinds] = (s.extraByMove[kinds] || 0) + 1;
				if (s.examples.filter((e) => e.kind === 'extra').length < 5) s.examples.push({ seed, night: item.night, steps: item.steps, kind: 'extra', extra, moves: kinds });
			}
		}
	}
	out.byJack[jack] = s;
	console.log(`${jack}: ${s.prefixes} prefixes from ${games} games; true circle ruled out: ${s.truthLostPlain} (plain), ${s.truthLostPruned} (with time and hideout pruning)`);
	console.log(`  compared with the exhaustive reference on ${s.enumerated} short prefixes: reference lost the truth ${s.truthLostReference}, deduction not a superset ${s.notSuperset}, identical ${s.exact}, with extra circles ${s.enumerated - s.exact} (${s.extraCircles} circles), by moves so far ${JSON.stringify(s.extraByMove)}`);
	console.log(`  pruning removed ${(s.pruneShrink / s.prefixes).toFixed(1)} circles per prefix on average`);
}
fs.writeFileSync(path.join(resultsDir, 'soundness.json'), JSON.stringify(out, null, 1));
