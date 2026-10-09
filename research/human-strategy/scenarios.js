// Deterministic checks of the tactical claims in the BoardGameGeek threads reviewed in
// docs/human-strategy-literature.md: graph facts, move sequences and police counters, in the printed numbers the
// posts use. No simulation: each check is exact on the map in js/data/map.js and the rules in js/core/rules.js.
//   node research/human-strategy/scenarios.js            (prints the report; also written to results/scenarios.md)
const fs = require('fs');
const path = require('path');
const B = require('./board');
const { WC, _, board, id, n, ns, walks, coaches, distance, red, crossingName, crossingsNextTo } = B;

const out = [];
const say = (s = '') => out.push(s);
const list = (xs) => xs.join(', ');
const R = red();
const nonRed = board.numbered().map(n).filter((x) => !R.includes(x)).sort((a, b) => a - b);

// Every shortest walking route between two circles with policemen on `police`, as printed numbers
function shortestRoutes(from, to, police = []) {
	const d = distance(from, to, police);
	if (!isFinite(d)) return [];
	const routes = [];
	const extend = (route) => {
		const at = route[route.length - 1];
		if (route.length - 1 === d) { if (at === to) routes.push(route); return; }
		for (const next of walks(at, police)) if (distance(next, to, police) === d - route.length) extend(route.concat([next]));
	};
	extend([from]);
	return routes;
}
// Is this a legal sequence for Jack? steps: ['walk', x] | ['coach', via, x] | ['alley', x]; police: crossings occupied
function legal(start, steps, police = []) {
	let at = start;
	for (const step of steps) {
		if (step[0] === 'walk' && !walks(at, police).includes(step[1])) return `walk ${at}->${step[1]} not possible`;
		if (step[0] === 'coach') {
			if (!walks(at).includes(step[1]) || !walks(step[1]).includes(step[2]) || step[2] === at) return `coach ${at}->(${step[1]},${step[2]}) not possible`;
		}
		if (step[0] === 'alley' && !B.alleys(at).includes(step[1])) return `alley ${at}->${step[1]} not possible`;
		at = step[step.length - 1];
	}
	return null;
}
const moves = (steps) => steps.reduce((s, x) => s + (x[0] === 'coach' ? 2 : 1), 0);
// Crossings a policeman can reach from a crossing in one turn (0, 1 or 2 crossings)
const policeReach = (c) => _.uniq([c].concat(board.crossingsWithinTwo(c)));
// Crossings from which a policeman could act (search or arrest) on circle x
const actingOn = (x) => board.neighbours(id(x)).filter((c) => !board.isNumbered(c));

say('# Scenario checks of the BGG tactical claims');
say();
say('All numbers are the printed circle numbers. Crossings are named by the circles next to them (e.g. 29/30/50).');
say();

// ---------------------------------------------------------------------------------------------------------------
say('## Board facts quoted in the threads');
say();
const deg = board.numbered().map((m) => [n(m), board.walk(m, []).length]).sort((a, b) => a[1] - b[1]);
const mean = deg.reduce((s, d) => s + d[1], 0) / deg.length;
say(`- Walking neighbours per circle (Andrea Bampi: "minimum 2 (81 & 61) ... maximum 15 (space 125) ... average ... near 8"): minimum ${deg[0][1]} at ${list(deg.filter((d) => d[1] === deg[0][1]).map((d) => d[0]))}; maximum ${deg[deg.length - 1][1]} at ${list(deg.filter((d) => d[1] === deg[deg.length - 1][1]).map((d) => d[0]))}; mean ${mean.toFixed(2)}.`);
say(`- The area grey_wolf calls "dreadful for Jack" (70, 71, 72, 87, 88): ${list([70, 71, 72, 87, 88].map((x) => `${x} has ${walks(x).length}`))} walking neighbours (map mean ${mean.toFixed(1)}).`);
const adj2 = nonRed.filter((x) => walks(x).filter((y) => R.includes(y)).length >= 2);
say(`- Circles one walk from two red circles (Andrea Bampi: "from three, 51, 66, 67"): ${list(adj2)}, each next to ${list(_.uniq(_.flatten(adj2.map((x) => walks(x).filter((y) => R.includes(y))))))}.`);
const cmiExcluded = nonRed.filter((x) => walks(x).some((y) => R.includes(y)));
say(`- "Catch me if you can" (no hideout on or next to a red circle; Pieter: "excludes about a quarter"): excludes ${cmiExcluded.length} of ${nonRed.length} legal hideouts (${(100 * cmiExcluded.length / nonRed.length).toFixed(0)}%).`);
say();

// ---------------------------------------------------------------------------------------------------------------
say('## "An almost perfect winning scheme for Jack" (grey_wolf, 2 June 2011)');
say();
const plan = [
	{ night: 1, crime: [27], steps: [['coach', 29, 66], ['walk', 51]] },
	{ night: 2, crime: [149], steps: [['walk', 148], ['walk', 114], ['walk', 96], ['coach', 78, 80], ['coach', 82, 65], ['walk', 51]] },
	{ night: 3, crime: [3, 84], steps: [['walk', 51]] },
	{ night: 4, crime: [65], steps: [['walk', 51]] }
];
say('Hideout 51. Each night as posted, checked against the rules with no policemen in the way:');
say();
say('| Night | Crime scene(s) | Route | Legal on the empty board? | Moves | Coaches used (of held) |');
say('|---|---|---|---|---:|---|');
const held = WC.rules.config.carriages;
for (const p of plan) {
	const start = p.crime[p.crime.length - 1];
	const problem = legal(start, p.steps);
	const route = p.steps.map((s) => (s[0] === 'coach' ? `coach (${s[1]}, ${s[2]})` : s[0] === 'alley' ? `alley ${s[1]}` : `${s[1]}`)).join(' → ');
	say(`| ${p.night} | ${p.crime.join(' and ')} | ${start} → ${route} | ${problem ? 'No: ' + problem : 'Yes'} | ${moves(p.steps)} | ${p.steps.filter((s) => s[0] === 'coach').length} of ${held[p.night - 1]} |`);
}
say();
say('In the revised rules this engine implements, a single-victim night starts with Jack\'s move and the police move only after it; on the double event the police move first (rules: "the second crime scene uses his first move"). So:');
say('- Night 4 (kill at 65, walk to 51): the night ends on Jack\'s first move; the policemen never move. Only a policeman already standing where the walk passes, from the end of night 3, can stop it.');
say('- Night 3 (kill at 3 and 84, walk to 51): the police get one turn before Jack\'s walk.');
say('- Night 1 (coach, then walk): the police get one turn, after the coach.');
say();
// Night 1: what can the police at the 29/30/50 station do after the coach?
const st = WC.board.stations().find((c) => crossingName(c) === '29/30/50');
const arrestCrossings66 = actingOn(66);
const reachable = policeReach(st);
say(`**Night 1 counters.** The coach passes the station 29/30/50 legally (Coach: "can move through crossings containing Policeman pawns", rules page 12, quoted by grey_wolf; \`rules.canUseCarriage\`). After it the police have one turn:`);
say(`- A policeman on 29/30/50 can search 29 without moving (it is next to 29): a clue there shows a route through 29.`);
say(`- Pokey 64's counter ("moved my investigator from the yellow crossing near 30 two crossings south and arrested you at 66"): the crossings next to 66 are ${list(arrestCrossings66.map(crossingName))}; from 29/30/50 a policeman can reach ${list(arrestCrossings66.filter((c) => reachable.includes(c)).map(crossingName)) || 'none of them'} in one turn. ${arrestCrossings66.some((c) => reachable.includes(c)) ? 'So the arrest at 66 is possible.' : 'So the arrest at 66 is not possible.'}`);
const coachFrom27 = coaches(27);
const past29 = coachFrom27.filter((x) => walks(29).includes(x));
const pastPoliceman = past29.filter((x) => !walks(29, [st]).includes(x));
say(`- Georgios P.'s reading ("five possible spots Jack could have tried to reach when moving past 29. Namely: 30, 49, 50, 64 and 66"): coach destinations from 27 by way of 29 are ${list(past29)}; of these, the ones a walk from 29 could not reach past a policeman on 29/30/50 (so the coach was needed to pass him) are ${list(pastPoliceman)}.`);
const blocked51 = walks(51, [93]);
say();
say(`**The proposed standing counter** (Andrea Bampi: "positioning a bobby on the crossing adjacent to 65 and 66 ... increases BY TWO the minimum distance between two red circles"). That crossing is ${list(crossingsNextTo(65, 66).map(crossingName))}. With a policeman on it:`);
say(`- 51 can walk only to ${list(blocked51)} (without him: ${list(walks(51))}): 65 and 84 are no longer one walk from 51; walking distances 51→65 ${distance(65, 51, [93])}, 51→84 ${distance(84, 51, [93])} (without him: 1 and 1). The same holds for 66 and 67: ${list([66, 67].map((h) => `${h}: 65 at ${distance(65, h, [93])}, 84 at ${distance(84, h, [93])}`))}.`);
const redPairs = [];
for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) redPairs.push([R[i], R[j]]);
const minRed = (police) => _.min(redPairs.map(([a, b]) => distance(a, b, police)));
say(`- The shortest walk between two red circles goes from ${minRed([])} to ${minRed([93])} (the claim "BY TWO" holds).`);
const atMin = redPairs.filter(([a, b]) => distance(a, b, [93]) === minRed([93]));
say(`- The routes of that length (the forum lists "65-(83-99)-84 65-(83-100)-84 3-(2-28)-27 3-(2-26)-27"): ${atMin.map(([a, b]) => shortestRoutes(a, b, [93]).map((r) => r.join('-')).join(', ')).join('; ')}.`);
say();
// grey_wolf's enumeration of coach + step from 27
const posted = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 24, 25, 26, 27, 28, 29, 30, 31, 32, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 59, 60, 61, 62, 63, 64, 65, 66, 67, 78, 79, 80, 81, 82, 83, 84, 95, 96, 97, 98, 115, 116, 117];
const computed = _.uniq(_.flatten(coachFrom27.map((x) => walks(x)))).sort((a, b) => a - b);
say(`**"An exhaustive enumeration of ALL the spaces that can be reached by a coach and another step"** from 27 (grey_wolf, 13 June 2011; ${posted.length} spaces): this map gives ${computed.length}. In the post but not here: ${list(_.difference(posted, computed)) || 'none'}. Here but not in the post: ${list(_.difference(computed, posted)) || 'none'}.`);
say();

// ---------------------------------------------------------------------------------------------------------------
say('## "Near perfect play for Jack at 134" (ketigid, 4 June 2011)');
say();
say(`Hideout 134, the Wretched placed on 147 every night. 147 walks to ${list(walks(147))} (the post: "111, 133, 134 or 146"). From each, Jack's walking distance to 134: ${list(walks(147).map((x) => `${x}: ${distance(x, 134)}`))}; from 147 itself: ${distance(147, 134)}.`);
const st130 = WC.board.stations().find((c) => crossingName(c) === '130/145');
say(`- "The yellow crossing near 130 is an important initial position": that station is 130/145. In one police turn a policeman there reaches the crossings next to ${list(ns(_.uniq(_.flatten(policeReach(st130).map((c) => board.adjacentNumbers(c))))).filter((x) => [111, 133, 134, 146, 147].includes(x)))} of the scheme's circles (111, 133, 134, 146, 147).`);
const between = _.uniq(_.flatten(walks(147).filter((x) => x === 134).map(() => board.neighbours(id(147)).filter((c) => !board.isNumbered(c) && board.adjacentNumbers(c).includes(id(134))))));
say(`- The walk 147 → 134 passes the crossing(s) ${list(between.map(crossingName))}. A policeman standing there at the start of night 4 (he stays from night 3) stops the one-move escape: then 147 → 134 takes ${distance(147, 134, between)} walks.`);
say(`- Jason Lindahl's counter "why would a cop ever go anywhere besides the intersection of 131 and 146": crossings next to both 131 and 146 are ${list(crossingsNextTo(131, 146).map(crossingName))}${crossingsNextTo(131, 146).some((c) => between.includes(c)) ? ', which is on the 147 → 134 walk' : ''}.`);
say(`- Pas L's counter (move the Wretched away: 147 → 146 → 131 → 106 → 105): legal steps for a Wretched with no patrols near: ${[[147, 146], [146, 131], [131, 106], [106, 105]].map(([a, b]) => `${a}→${b} ${walks(a).includes(b) ? 'yes' : 'no'}`).join(', ')}; Jack's walking distance home from each: ${list([146, 131, 106, 105].map((x) => `${x}: ${distance(x, 134)}`))}.`);
say(`- Rules as implemented: a Wretched killed on the hideout doesn't end the night (Jack must move off and walk back on: \`rules.escapes\` needs a walk onto the hideout, and \`board.walk\` never returns the start), as the FAQ Pieter cites says. Women may not be placed on earlier crime scenes, but 147 itself is only a crime scene once the Wretched is killed there, so the scheme's repeated placement on 147 is legal (\`rules.targetCircles\`).`);
say();

// ---------------------------------------------------------------------------------------------------------------
say('## "Winning strategy for Jack? Is this game broken?" (mark_xiii, 9 September 2012)');
say();
say(`"Place his hideout right next to two of the crime scenes in the center area of the map (numbers 66, 51, 67 - possibly 82, 63, 83 etc. with 2 moves to the second crime scene)":`);
for (const h of [66, 51, 67, 82, 63, 83]) {
	say(`- ${h}: red circles at walking distance ${list(R.map((r) => [r, distance(r, h)]).filter(([, d]) => d <= 2).map(([r, d]) => `${r} (${d})`))}${R.includes(h) ? ' — itself red, not a legal hideout' : ''}.`);
}
say();

// ---------------------------------------------------------------------------------------------------------------
say('## Cordons (grey_wolf, 15 June 2011; Andrea Bampi)');
say();
const entries = (x) => board.neighbours(id(x)).filter((c) => !board.isNumbered(c));
const byEntries = _.countBy(nonRed, (x) => entries(x).length);
say(`"There are potential hideouts that can be cordoned off using merely two patrols, there are those requiring three and four ..., and there are those that have as many as five (tricky to find)". Crossings next to each legal hideout (policemen needed to close every walk onto it at close quarters): ${Object.entries(byEntries).map(([k, v]) => `${k} crossings: ${v} hideouts`).join('; ')}. With five: ${list(nonRed.filter((x) => entries(x).length === 5))}.`);
// "175 & 188 may be cordoned as a subgraph by just two patrols": any crossings a walk out of the pair passes
const group = [175, 188];
const exits = [];
const crawl = (c, seen) => {
	if (seen.has(c)) return;
	seen.add(c);
	if (board.isNumbered(c)) return;
	exits.push(c);
	for (const next of board.neighbours(c)) crawl(next, seen);
};
for (const x of group) { const seen = new Set([id(x)]); for (const c of board.neighbours(id(x))) crawl(c, seen); }
_.uniq(exits);
let best = null;
for (let size = 1; size <= 3 && !best; size++) {
	const combos = [];
	const pick = (start, chosen) => {
		if (chosen.length === size) { combos.push(chosen); return; }
		for (let i = start; i < exits.length; i++) pick(i + 1, chosen.concat([exits[i]]));
	};
	pick(0, []);
	for (const police of combos) {
		const out1 = _.uniq(_.flatten(group.map((x) => walks(x, police)))).filter((x) => !group.includes(x));
		if (!out1.length) { best = police; break; }
	}
}
say(`- Andrea Bampi: "175 & 188 may be cordoned as a subgraph by just two patrols". 175 and 188 are ${walks(175).includes(188) ? '' : 'not '}one walk apart; the fewest policemen, on any crossings a walk out of the pair passes, that stop every such walk: ${best ? `${best.length} (${list(best.map(crossingName))})` : 'more than 3'}.`);
say();

const file = path.join(__dirname, 'results', 'scenarios.md');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, out.join('\n') + '\n');
console.log(out.join('\n'));
