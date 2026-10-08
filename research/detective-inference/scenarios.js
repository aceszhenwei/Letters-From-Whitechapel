// Reproducible inference scenarios: the same public record given to
//   - this project's deduction (js/core/deduction.js),
//   - the exhaustive reference (lib.enumerate), and
//   - whitechapelR (https://github.com/bmewing/whitechapelR), run in R on this project's map,
// with the hidden route known only to this harness.
//   node research/detective-inference/scenarios.js [path to a whitechapelR clone]
// Without a clone (or without Rscript), the whitechapelR column is left out. Results: results/scenarios.md, .json
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { WC, _, play, seeded } = require('./lib');
const { enumerate } = require('./lib');

const clone = process.argv[2];
const results = path.join(__dirname, 'results');
const board = WC.board;

// A route chosen by the harness, step by step: each step is { move, to, via? }, with policemen standing at `police`
function record(scenes, start, steps, observations = []) {
	// Builds the public record of a hidden route, checking every move against the rules. observations: { after: step
	// index, type: 'search' | 'arrest', mapid } (a search's result comes from the hidden route, as in the engine)
	const log = [{ type: 'crime', scenes: scenes.slice().sort((a, b) => a - b) }];
	const route = [start];
	steps.forEach((step, i) => {
		const from = _.last(route);
		const police = step.police || [];
		if (step.move === 'walk' && !board.walk(from, police).includes(step.to)) throw new Error(`illegal walk ${from}->${step.to}`);
		if (step.move === 'alley' && !board.alleys(from).includes(step.to)) throw new Error(`illegal alley ${from}->${step.to}`);
		if (step.move === 'carriage') {
			if (!board.walk(from, []).includes(step.via) || !board.walk(step.via, []).includes(step.to) || step.to === from) throw new Error('illegal coach');
			route.push(step.via);
		}
		route.push(step.to);
		log.push({ type: 'move', move: step.move, police });
		observations.filter((o) => o.after === i).forEach((o) => {
			if (o.type === 'search') log.push({ type: 'search', mapid: o.mapid, clue: route.includes(o.mapid) });
			else if (o.mapid === _.last(route)) throw new Error('that arrest would succeed');
			else log.push({ type: 'arrest', mapid: o.mapid });
		});
	});
	return { log, route, truth: _.last(route) };
}

// A random legal route, from a seed (the harness's hidden choice)
function randomSteps(start, moves, seed, police = []) {
	const random = seeded(seed);
	const pick = (list) => list[Math.floor(random() * list.length)];
	let at = start;
	return moves.map((move) => {
		let step;
		if (move === 'walk') step = { move, to: pick(board.walk(at, police)), police };
		else if (move === 'alley') step = { move, to: pick(board.alleys(at)), police };
		else {
			const via = pick(board.walk(at, []));
			step = { move, via, to: pick(board.walk(via, []).filter((c) => c !== at)), police };
		}
		at = step.to;
		return step;
	});
}

const circles = board.numbered();
const crossingNear = (circle) => board.neighbours(circle).find((id) => !board.isNumbered(id));

const scenarios = [];
function add(name, description, built, extra = {}) {
	scenarios.push(Object.assign({ name, description }, built, extra));
}

// 1. Several walks, no police in the way
{
	const start = circles[40];
	add('1. Walks', 'Three walks from one crime scene, no policemen', record([start], start, randomSteps(start, ['walk', 'walk', 'walk'], 1)));
}
// 2. A coach
{
	const start = circles[60];
	add('2. Coach', 'A walk, then a coach (two steps, past policemen, not ending where it started)', record([start], start, randomSteps(start, ['walk', 'carriage'], 2)));
}
// 3. An alley
{
	const start = circles.find((c) => board.alleys(c).length >= 3);
	add('3. Alley', 'An alley, then a walk', record([start], start, randomSteps(start, ['alley', 'walk'], 3)));
}
// 4. A search that finds nothing
{
	const start = circles[90];
	const steps = randomSteps(start, ['walk', 'walk', 'walk'], 4);
	const route = [start].concat(steps.map((s) => s.to));
	const other = board.walk(start, []).find((c) => !route.includes(c)); // A first step Jack didn't take
	add('4. Search, nothing found', `Three walks; the police search ${other}, next to the crime scene, and find nothing`, record([start], start, steps, [{ after: 2, type: 'search', mapid: other }]));
}
// 5. A clue
{
	const start = circles[120];
	const steps = randomSteps(start, ['walk', 'walk', 'walk', 'walk'], 5);
	add('5. Clue', `Four walks; the police find a clue on his second circle (${steps[1].to})`, record([start], start, steps, [{ after: 3, type: 'search', mapid: steps[1].to }]));
}
// 6. Policemen blocking and a failed arrest
{
	const start = circles[150];
	const police = [crossingNear(board.walk(start, [])[0])].filter(Boolean);
	const steps = randomSteps(start, ['walk', 'walk', 'walk'], 6, police);
	const route = [start].concat(steps.map((s) => s.to));
	const wrong = board.walk(route[2], []).find((c) => c !== route[3]);
	add('6. Blocked walks and a failed arrest', `A policeman at ${police[0]} blocks some walks; an arrest at ${wrong} fails`, record([start], start, steps, [{ after: 2, type: 'arrest', mapid: wrong }]));
}
// 7. The double event: two crime scenes, the start unknown
{
	const a = circles[30]; const b = circles[33];
	add('7. Double event', 'Two crime scenes; Jack escapes from one of them, the police don\'t know which', record([a, b], b, randomSteps(b, ['walk', 'walk', 'walk'], 7)));
}
// 8. Strategic Jack's direct route home, and the hideout across nights, from a real game
{
	const seed = 52;
	const state = play({ jack: 'strategic', police: 'deductive', seed });
	const logs = state.police.map((n, i) => WC.rules.publicLog(state, i)).filter((log) => log.some((e) => e.type === 'escaped'));
	scenarios.push({ name: '8. Strategic Jack across nights', description: `Strategic Jack's escaped nights in seed ${seed} (deductive police): where could the hideout be?`, nights: logs, hideout: state.base });
}

/* Run each one */
const hasR = !!clone && (() => { try { execFileSync('Rscript', ['--version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
const graph = (neighbours) => _.uniq(_.flatten(circles.map((a) => neighbours(a).filter((b) => a < b).map((b) => `${a},${b}`)))).map((e) => e.split(',').map(Number));
const roads = graph((a) => board.walk(a, []));
const alleys = graph((a) => board.alleys(a));

function rScript(log, hideoutsFrom) {
	// The whitechapelR calls a police player would make for this record, on this project's map
	const lines = [];
	const crime = log.find((e) => e.type === 'crime');
	lines.push(`paths = start_round(c(${crime.scenes.join(',')}))`);
	for (const entry of log) {
		if (entry.type === 'move' && entry.move === 'walk') {
			// whitechapelR blocks pairs of circles; a policeman on a crossing blocks every pair whose walk passes it
			const blocked = entry.police.length ? _.flatten(circles.map((a) => _.difference(board.walk(a, []), board.walk(a, entry.police)).map((b) => `c(${a},${b})`))) : [];
			lines.push(blocked.length ? `paths = take_a_step(paths, roads, blocked = list(${blocked.join(',')}))` : 'paths = take_a_step(paths, roads)');
		} else if (entry.type === 'move' && entry.move === 'alley') lines.push('paths = take_a_step(paths, alley)');
		else if (entry.type === 'move') lines.push('paths = take_a_carriage(paths)');
		else if (entry.type === 'search') lines.push(`paths = inspect_space(paths, ${entry.mapid}, ${entry.clue ? 'TRUE' : 'FALSE'})`);
		else if (entry.type === 'arrest') lines.push(`paths = trim_possibilities(paths, ${entry.mapid})`);
	}
	return lines.join('\n');
}

function runR(body) {
	const prelude = [
		'suppressMessages(library(plyr)); library(jsonlite)',
		...['start_round', 'take_a_step', 'inspect_space', 'end_round'].map((f) => `source("${path.join(clone, 'R', f + '.R')}")`),
		`roads = as.data.frame(fromJSON('${JSON.stringify(roads)}')); names(roads) = c("x","y")`,
		`alley = as.data.frame(fromJSON('${JSON.stringify(alleys)}')); names(alley) = c("x","y")`,
		'data = function(...) invisible(NULL) # take_a_carriage loads the package\'s own map with data(roads); use this one',
		'started = Sys.time()'
	].join('\n');
	const file = path.join(results, '.scenario.R');
	fs.writeFileSync(file, prelude + '\n' + body + '\ncat(toJSON(list(result = result, paths = n, seconds = as.numeric(Sys.time() - started, units = "secs")), auto_unbox = TRUE))');
	const output = execFileSync('Rscript', [file], { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 600000 });
	fs.unlinkSync(file);
	return JSON.parse(output.slice(output.indexOf('{')));
}

const sorted = (list) => list.map(Number).sort((a, b) => a - b);
const rows = [];
for (const s of scenarios) {
	if (s.nights) {
		// Hideout inference across nights
		const ours = WC.deduction.hideouts(s.nights, WC.rules.hideoutChoices());
		const exact = s.nights.map((log) => { const e = enumerate(log, 5e6); return e ? Object.keys(e.circles).map(Number) : []; });
		const exactSet = exact.reduce((a, b) => a.filter((c) => b.includes(c)), WC.rules.hideoutChoices());
		const row = { name: s.name, description: s.description, truth: s.hideout, ours: sorted(Object.keys(ours)), oursTruthProbability: ours[s.hideout],
			reference: exact.every((e) => e.length) ? sorted(exactSet) : 'too many routes to list' };
		if (hasR) {
			const body = s.nights.map((log, i) => rScript(log) + `\nhideouts${i + 1} = end_round(paths${i ? `, hideouts${i}` : ''})`).join('\n') +
				`\nresult = hideouts${s.nights.length}; n = length(paths)`;
			try { const r = runR(body); row.whitechapelR = sorted([].concat(r.result)); row.rSeconds = r.seconds; } catch (e) { row.whitechapelR = 'did not finish in 10 minutes'; }
		}
		rows.push(row);
		continue;
	}
	const started = process.hrtime.bigint();
	const known = WC.deduction.track(s.log, {});
	const ms = Number(process.hrtime.bigint() - started) / 1e6;
	const reference = enumerate(s.log);
	const row = {
		name: s.name, description: s.description, route: s.route, truth: s.truth,
		publicRecord: s.log.map((e) => e.type === 'move' ? `${e.move}${e.police.length ? ' (police at ' + e.police.join(',') + ')' : ''}` : e.type === 'crime' ? `crime at ${e.scenes.join(' and ')}` : `${e.type} ${e.mapid}${e.type === 'search' ? (e.clue ? ': clue' : ': nothing') : ': failed'}`),
		reference: sorted(Object.keys(reference.circles)), referenceRoutes: reference.routes, routesToTruth: reference.circles[s.truth],
		ours: sorted(Object.keys(known.current)), oursMs: ms, oursTruthProbability: known.current[s.truth]
	};
	if (hasR) {
		const r = runR(rScript(s.log) + '\nresult = sort(unique(vapply(paths, function(p) p[length(p)], numeric(1)))); n = length(paths)');
		row.whitechapelR = sorted([].concat(r.result)); row.whitechapelRPaths = r.paths; row.rSeconds = r.seconds;
	}
	rows.push(row);
}

/* Report */
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
const md = ['| Scenario | Hidden route (truth) | Public record | Reference: possible circles | Deduction | whitechapelR | Agreement |', '|---|---|---|---|---|---|---|'];
for (const r of rows) {
	const extraOurs = Array.isArray(r.reference) ? _.difference(r.ours, r.reference) : [];
	const agree = [
		same(r.ours, r.reference) ? 'deduction = reference' : `deduction keeps ${extraOurs.length ? extraOurs.join(',') + ' extra' : 'a different set'}`,
		r.whitechapelR === undefined ? 'whitechapelR not run' : !Array.isArray(r.whitechapelR) ? 'whitechapelR did not finish' : same(r.whitechapelR, r.reference) ? 'whitechapelR = reference' : `whitechapelR differs`
	].join('; ');
	const list = (l) => Array.isArray(l) ? (l.length <= 13 ? `${l.length}: ${l.join(', ')}` : `${l.length} circles`) : l;
	md.push(`| ${r.name} | ${r.route ? r.route.join(' → ') + ` (**${r.truth}**)` : `hideout **${r.truth}**`} | ${r.publicRecord ? r.publicRecord.join('; ') : `${r.description}`} | ${list(r.reference)}${r.referenceRoutes ? ` (${r.referenceRoutes} routes; ${r.routesToTruth} end at the truth)` : ''} | ${list(r.ours)}; P(truth) ${(r.oursTruthProbability || 0).toFixed(3)} | ${r.whitechapelR === undefined ? '—' : list(r.whitechapelR)}${r.whitechapelRPaths ? ` (${r.whitechapelRPaths} paths)` : ''} | ${agree} |`);
}
fs.writeFileSync(path.join(results, 'scenarios.json'), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(results, 'scenarios.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
