// How the work grows with the length of a night: whitechapelR keeps every possible route as a separate path, this
// project's deduction keeps (circle, clues passed) states. One hidden route of walks with no policemen, measured
// after each step.  node research/detective-inference/growth.js <path to a whitechapelR clone> [steps, default 9]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { WC, _, seeded } = require('./lib');

const clone = process.argv[2];
const steps = Number(process.argv[3] || 9);
const board = WC.board;
const circles = board.numbered();
const random = seeded(11);
let at = circles[100];
const log = [{ type: 'crime', scenes: [at] }];
for (let i = 0; i < steps; i++) {
	log.push({ type: 'move', move: 'walk', police: [] });
	const next = board.walk(at, []);
	at = next[Math.floor(random() * next.length)];
}
const roads = _.uniq(_.flatten(circles.map((a) => board.walk(a, []).filter((b) => a < b).map((b) => `${a},${b}`)))).map((e) => e.split(',').map(Number));
const rows = [];
let r = null;
if (clone) {
	const script = [
		'suppressMessages(library(plyr)); library(jsonlite)',
		...['start_round', 'take_a_step'].map((f) => `source("${path.join(clone, 'R', f + '.R')}")`),
		`roads = as.data.frame(fromJSON('${JSON.stringify(roads)}')); names(roads) = c("x","y")`,
		`paths = start_round(${log[0].scenes[0]}); out = list()`,
		`for (i in 1:${steps}) { t = Sys.time(); paths = take_a_step(paths, roads); out[[i]] = list(paths = length(paths), seconds = as.numeric(Sys.time() - t, units = "secs")); cat(toJSON(out[[i]], auto_unbox = TRUE), "\\n") }`
	].join('\n');
	const file = path.join(__dirname, 'results', '.growth.R');
	fs.writeFileSync(file, script);
	try {
		r = execFileSync('Rscript', [file], { encoding: 'utf8', timeout: 900000 }).trim().split('\n').map((line) => JSON.parse(line));
	} catch (e) {
		r = String(e.stdout || '').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
	}
	fs.unlinkSync(file);
}
for (let i = 1; i <= steps; i++) {
	const prefix = log.slice(0, i + 1);
	const t = process.hrtime.bigint();
	const known = WC.deduction.track(prefix, {});
	const ms = Number(process.hrtime.bigint() - t) / 1e6;
	rows.push({ steps: i, circles: known.size, deductionMs: +ms.toFixed(2), whitechapelRPaths: r && r[i - 1] ? r[i - 1].paths : null, whitechapelRStepSeconds: r && r[i - 1] ? +r[i - 1].seconds.toFixed(2) : null });
}
console.table(rows);
fs.writeFileSync(path.join(__dirname, 'results', 'growth.json'), JSON.stringify(rows, null, 1));
