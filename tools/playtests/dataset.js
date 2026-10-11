// The human playtest collection (research/human-playtests/, docs/playtests.md): checks every record in it, keeps track
// of which games a research report has covered, and gives cumulative statistics.
//
//   npm run playtests                                 inventory, problems, research batch status and statistics
//   npm run playtests -- --json                       the same, as JSON
//   npm run playtests -- --ci [--changed <file> ...]  for GitHub Actions: a summary, annotations, exit 1 on a problem
//   npm run playtests -- --update-state               refresh analysis-state.json's snapshot of games awaiting review
//   npm run playtests -- --record-analysis --report <reports/file.md> (--games <id,id,...> | --outstanding) [--date YYYY-MM-DD]
//                                                     after a report is written: mark its games as analysed
//   npm run playtests:add -- <exported .json or batch .zip> ...
//                                                     check exported records and copy the new ones into records/
//
// Each file in records/ must be the full record of one completed game a person played, named <game id>.json, that
// replays exactly (tools/game-log/validate.js: 'verified'). Problems: invalid, misnamed, ineligible (not full, not
// completed or no person played), duplicate (the same game twice), conflict (different records with one game id).
// Incompatible records (another schema version or rule set) are historical evidence: they are kept, reported and left
// out of current statistics; a newly submitted one (--changed) is a problem. Records are data: nothing in them is run.
// Games imported from online submissions (tools/playtests/intake.js) are listed in intake.json with the SHA-256 of
// the record received; each such file must still match it, and the statistics count games by source.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { validate } = require('../game-log/validate');
const { loadCore } = require('../game-log/core');

const root = path.join(__dirname, '..', '..');
const defaultDir = path.join(root, 'research', 'human-playtests');
const stateFormat = 'whitechapel-playtest-analysis-state';
const statuses = { collecting: 'Collecting', ready: 'Ready for Review' };

let coreCache = null;
function core() {
	if (!coreCache) coreCache = loadCore();
	return coreCache;
}

/* Reading the collection
   ---------------------- */
function role(record) {
	const p = (record.game && record.game.players) || {};
	if (p.jack && p.jack.type === 'human') return 'jack';
	if (p.police && p.police.type === 'human') return 'detectives';
	return null;
}

function opponent(record) {
	const p = (record.game && record.game.players) || {};
	const ai = (role(record) === 'jack' ? p.police : p.jack) || {};
	return { ai: ai.ai || 'unknown', level: ai.level || null };
}

function cohortOf(record) {
	// Games are only pooled within one cohort: the same app version, rule set, role, opponent AI and difficulty
	const who = opponent(record);
	const c = {
		appVersion: (record.app && record.app.version) || 'unknown',
		ruleset: (record.ruleset && record.ruleset.id) || 'unknown',
		role: role(record),
		opponent: who.ai,
		level: who.level
	};
	c.key = `${c.appVersion} · ${c.ruleset} · human ${c.role} vs ${c.opponent}${c.level ? ' (' + c.level + ')' : ''}`;
	return c;
}

function fingerprint(record) {
	// As in the browser (js/ui/playtest-store.js): the record without its export date and the player's note
	const { WC } = core();
	const copy = JSON.parse(JSON.stringify(record));
	if (copy.game) delete copy.game.exportedOn;
	delete copy.feedback;
	return WC.record.hash(JSON.stringify(WC.record.normalise(copy)));
}

function humanWon(record) {
	const r = role(record);
	const winner = record.outcome && record.outcome.winner;
	return r === 'jack' ? winner === 'jack' : r === 'detectives' ? winner === 'police' : false;
}

function checkRecord(text) {
	// One record's text -> { verdict, problems, warnings, record }. verdict: 'valid', 'invalid', 'incompatible', 'ineligible'
	const r = validate(text, { core: core() });
	const out = { verdict: r.verdict, problems: r.errors.slice(), warnings: r.warnings.slice(), record: r.record };
	if (r.verdict === 'invalid' || r.verdict === 'incompatible') return out;
	const record = r.record;
	if (r.verdict !== 'verified' || record.disclosure !== 'full') {
		out.verdict = 'ineligible';
		out.problems.push('not a full record: export the full record (it replays; the public one does not)');
	} else if (record.game.status !== 'completed') {
		out.verdict = 'ineligible';
		out.problems.push(`the game is ${record.game.status}, not completed`);
	} else if (!role(record)) {
		out.verdict = 'ineligible';
		out.problems.push('no person played in this game (the computer played both sides)');
	} else {
		out.verdict = 'valid';
	}
	return out;
}

function emptyState() {
	return { format: stateFormat, version: 1, methodologyVersion: 1, batchThreshold: 5, methodology: {}, reports: [], analysed: {}, aiChanges: [], snapshot: null };
}

function readIntake(dir) {
	// intake.json (tools/playtests/intake.js): { submissions: { <game id>: { verdict, sha256, ... } } }, or nothing
	const file = path.join(dir, 'intake.json');
	if (!fs.existsSync(file)) return {};
	const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
	return ledger && typeof ledger.submissions === 'object' ? ledger.submissions : {};
}

function readState(dir) {
	const file = path.join(dir, 'analysis-state.json');
	if (!fs.existsSync(file)) return emptyState();
	const state = JSON.parse(fs.readFileSync(file, 'utf8'));
	if (state.format !== stateFormat) throw new Error(`${file} is not a playtest analysis state`);
	return state;
}

function writeState(dir, state) {
	fs.writeFileSync(path.join(dir, 'analysis-state.json'), JSON.stringify(state, null, '\t') + '\n');
}

function scan(dir, options = {}) {
	// -> { files, valid, state, problems, batch, stats }
	const recordsDir = path.join(dir, 'records');
	const state = options.state || readState(dir);
	const changed = new Set((options.changed || []).map((f) => path.resolve(f)));
	const names = fs.existsSync(recordsDir) ? fs.readdirSync(recordsDir).filter((n) => !n.startsWith('.')).sort() : [];
	const files = names.map((name) => {
		const file = path.join(recordsDir, name);
		const entry = { file: path.relative(root, file), name, changed: changed.has(path.resolve(file)) };
		if (!name.endsWith('.json') || !fs.statSync(file).isFile()) {
			return Object.assign(entry, { verdict: 'invalid', problems: ['not a .json file: records/ holds only game records'], warnings: [] });
		}
		const checked = checkRecord(fs.readFileSync(file, 'utf8'));
		Object.assign(entry, { verdict: checked.verdict, problems: checked.problems, warnings: checked.warnings });
		const record = checked.record;
		if (record && record.game && typeof record.game.id === 'string') {
			entry.id = record.game.id;
			entry.record = record;
			if (checked.verdict === 'valid' || checked.verdict === 'incompatible') {
				entry.cohort = cohortOf(record);
				entry.fingerprint = fingerprint(record);
			}
			if (name !== record.game.id + '.json' && checked.verdict !== 'invalid') {
				entry.misnamed = true;
				entry.problems.push(`named ${name}; a record is named after its game id: ${record.game.id}.json`);
			}
		}
		if (checked.verdict === 'incompatible' && entry.changed) {
			entry.problems.push('a new submission must be made with the current version of the game');
		}
		return entry;
	});

	// The same game more than once: identical copies are duplicates; different records with one id are a conflict
	const byId = {};
	for (const f of files) if (f.id) (byId[f.id] = byId[f.id] || []).push(f);
	for (const [id, group] of Object.entries(byId)) {
		if (group.length < 2) continue;
		const prints = new Set(group.map((f) => f.fingerprint || f.name));
		if (prints.size > 1) {
			for (const f of group) {
				f.conflict = true;
				f.problems.push(`conflicts with ${group.filter((g) => g !== f).map((g) => g.name).join(', ')}: different records of game ${id}`);
			}
		} else {
			const keep = group.find((f) => f.name === id + '.json') || group[0];
			for (const f of group) {
				if (f !== keep) {
					f.duplicate = true;
					f.problems.push(`a duplicate of ${keep.name}: remove it`);
				}
			}
		}
	}

	// What each valid game is for research: new, analysed, or eligible again after a change of methodology
	const valid = files.filter((f) => f.verdict === 'valid' && !f.duplicate && !f.conflict && !f.misnamed);
	for (const f of valid) {
		const done = state.analysed[f.id];
		f.research = !done ? 'collected' : (done.methodologyVersion || 1) < state.methodologyVersion ? 'reanalysis' : 'analysed';
	}
	const problems = files.filter((f) => f.verdict === 'invalid' || f.verdict === 'ineligible' || f.misnamed || f.duplicate || f.conflict ||
		(f.verdict === 'incompatible' && f.changed));
	const stateProblems = Object.keys(state.analysed).filter((id) => !byId[id]).map((id) => `analysis-state.json marks ${id} as analysed, but records/ has no such game`);
	// Provenance: games imported from online submissions, which must still be exactly what was received
	const intake = readIntake(dir);
	for (const [id, entry] of Object.entries(intake)) {
		if (entry.verdict !== 'imported') continue;
		const f = files.find((x) => x.name === id + '.json');
		if (!f) {
			stateProblems.push(`intake.json lists ${id} as imported, but records/ has no such game`);
		} else if (entry.sha256 && crypto.createHash('sha256').update(fs.readFileSync(path.join(recordsDir, f.name))).digest('hex') !== entry.sha256) {
			stateProblems.push(`records/${f.name} is not the record that was submitted (its SHA-256 differs from intake.json): records are never edited`);
		}
	}
	for (const f of valid) f.source = intake[f.id] && intake[f.id].verdict === 'imported' ? 'online submission' : 'manual upload';
	const outstanding = valid.filter((f) => f.research === 'collected');
	const batch = {
		threshold: state.batchThreshold || 5,
		outstanding: outstanding.map((f) => f.id),
		reanalysis: valid.filter((f) => f.research === 'reanalysis').map((f) => f.id),
		analysed: valid.filter((f) => f.research === 'analysed').map((f) => f.id),
		byCohort: count(outstanding.map((f) => f.cohort.key))
	};
	batch.status = batch.outstanding.length >= batch.threshold ? statuses.ready : statuses.collecting;
	const snapshot = state.snapshot;
	batch.snapshotCurrent = !!snapshot && JSON.stringify(snapshot.outstanding) === JSON.stringify(batch.outstanding) && snapshot.status === batch.status;
	return { files, valid, state, problems, stateProblems, batch, stats: statistics(files, valid) };
}

/* Statistics
   ---------- */
function count(list) {
	const out = {};
	for (const k of list) out[k] = (out[k] || 0) + 1;
	return out;
}

function spread(values) {
	if (!values.length) return null;
	const s = values.slice().sort((a, b) => a - b);
	const mid = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
	return { min: s[0], median: mid, max: s[s.length - 1] };
}

function statistics(files, valid) {
	const rate = (games) => ({ games: games.length, humanWins: games.filter((f) => humanWon(f.record)).length });
	const group = (key) => {
		const out = {};
		for (const f of valid) {
			const k = key(f);
			(out[k] = out[k] || []).push(f);
		}
		return Object.fromEntries(Object.entries(out).map(([k, games]) => [k, rate(games)]));
	};
	const jackMoves = (r) => r.actions.filter((a) => a.type === 'move').length;
	return {
		files: files.length,
		validGames: valid.length,
		byRole: count(valid.map((f) => f.cohort.role)),
		winsByRoleAndOpponent: group((f) => `human ${f.cohort.role} vs ${f.cohort.opponent}${f.cohort.level ? ' (' + f.cohort.level + ')' : ''}`),
		winsByCohort: group((f) => f.cohort.key),
		results: count(valid.map((f) => f.record.outcome.result)),
		nightsPlayed: count(valid.map((f) => String(f.record.outcome.night))),
		actions: spread(valid.map((f) => f.record.actions.length)),
		jackMoves: spread(valid.map((f) => jackMoves(f.record))),
		byLevel: count(valid.map((f) => f.cohort.level || 'none')),
		byOpponent: count(valid.map((f) => f.cohort.opponent)),
		byAppVersion: count(valid.map((f) => f.cohort.appVersion)),
		byRuleset: count(valid.map((f) => f.cohort.ruleset)),
		research: count(valid.map((f) => f.research)),
		bySource: count(valid.map((f) => f.source || 'manual upload')),
		problems: {
			invalid: files.filter((f) => f.verdict === 'invalid').length,
			ineligible: files.filter((f) => f.verdict === 'ineligible').length,
			incompatible: files.filter((f) => f.verdict === 'incompatible').length,
			duplicate: files.filter((f) => f.duplicate).length,
			conflict: files.filter((f) => f.conflict).length,
			misnamed: files.filter((f) => f.misnamed).length
		}
	};
}

/* Reports
   ------- */
function pct(won, games) {
	return games ? `${won} of ${games} (${Math.round(100 * won / games)}%)` : '–';
}

function lines(result) {
	const { files, batch, stats, problems, stateProblems } = result;
	const out = [];
	out.push(`Human playtests: ${files.length} file${files.length === 1 ? '' : 's'}, ${stats.validGames} valid game${stats.validGames === 1 ? '' : 's'}.`);
	out.push(`Research batch: ${batch.status}. ${batch.outstanding.length} new game${batch.outstanding.length === 1 ? '' : 's'} awaiting review (a batch is ${batch.threshold}); ` +
		`${batch.analysed.length} analysed; ${batch.reanalysis.length} eligible for reanalysis after a change of methodology.`);
	if (batch.outstanding.length) out.push(`Awaiting review: ${batch.outstanding.join(', ')}`);
	for (const [k, n] of Object.entries(batch.byCohort)) out.push(`  ${n} in ${k}`);
	out.push('');
	out.push(`Problems: ${stats.problems.invalid} invalid, ${stats.problems.ineligible} ineligible, ${stats.problems.duplicate} duplicate, ` +
		`${stats.problems.conflict} conflicting, ${stats.problems.misnamed} misnamed, ${stats.problems.incompatible} incompatible (kept as historical evidence).`);
	for (const f of problems) out.push(`  ${f.file}: ${f.verdict}${f.duplicate ? ', duplicate' : ''}${f.conflict ? ', conflict' : ''}: ${f.problems.slice(0, 5).join('; ')}`);
	for (const f of files.filter((x) => x.verdict === 'incompatible' && !x.changed)) out.push(`  ${f.file}: incompatible, historical: ${f.problems.join('; ')}`);
	for (const p of stateProblems) out.push(`  ${p}`);
	out.push('');
	out.push('Statistics (valid games only; a small, uncontrolled sample of players of unknown experience: describe, do not generalise):');
	out.push(`  By role: ${fmt(stats.byRole)}`);
	for (const [k, v] of Object.entries(stats.winsByRoleAndOpponent)) out.push(`  ${k}: the person won ${pct(v.humanWins, v.games)}`);
	out.push('  By cohort (app version · rule set · matchup):');
	for (const [k, v] of Object.entries(stats.winsByCohort)) out.push(`    ${k}: ${pct(v.humanWins, v.games)} won by the person`);
	out.push(`  How games ended: ${fmt(stats.results)}`);
	out.push(`  Nights played: ${fmt(stats.nightsPlayed)}`);
	if (stats.actions) out.push(`  Actions per game: min ${stats.actions.min}, median ${stats.actions.median}, max ${stats.actions.max}; Jack's moves: min ${stats.jackMoves.min}, median ${stats.jackMoves.median}, max ${stats.jackMoves.max}`);
	out.push(`  Difficulty: ${fmt(stats.byLevel)}; opponent: ${fmt(stats.byOpponent)}; app version: ${fmt(stats.byAppVersion)}; rule set: ${fmt(stats.byRuleset)}`);
	out.push(`  Research status: ${fmt(stats.research)}`);
	out.push(`  Source: ${fmt(stats.bySource)}`);
	return out;
}

function fmt(map) {
	const e = Object.entries(map);
	return e.length ? e.map(([k, v]) => `${k} ${v}`).join(', ') : 'none';
}

function markdown(result) {
	const { batch, stats, problems, files } = result;
	const ok = !problems.length && !result.stateProblems.length;
	const md = [];
	md.push(`## Human playtests: ${ok ? '✅ all records valid' : '❌ problems found'}`);
	md.push('');
	md.push(`| Valid | Invalid | Ineligible | Duplicate | Conflicting | Misnamed | Incompatible (historical) |`);
	md.push(`|---:|---:|---:|---:|---:|---:|---:|`);
	md.push(`| ${stats.validGames} | ${stats.problems.invalid} | ${stats.problems.ineligible} | ${stats.problems.duplicate} | ${stats.problems.conflict} | ${stats.problems.misnamed} | ${stats.problems.incompatible} |`);
	md.push('');
	md.push(`**Research batch: ${batch.status}.** ${batch.outstanding.length} new valid game${batch.outstanding.length === 1 ? '' : 's'} awaiting review; a batch is ${batch.threshold}. ` +
		`${batch.analysed.length} analysed, ${batch.reanalysis.length} eligible for reanalysis.`);
	if (batch.status === statuses.ready) md.push('', `> A research batch is ready. Commission the analysis by hand (docs/playtests.md#commissioning-an-analysis); nothing runs automatically.`);
	if (problems.length) {
		md.push('', '| File | Problem |', '|---|---|');
		for (const f of problems) md.push(`| \`${f.file}\` | ${f.verdict}${f.duplicate ? ' (duplicate)' : ''}${f.conflict ? ' (conflict)' : ''}: ${f.problems.slice(0, 3).join('; ').replace(/\|/g, '\\|')} |`);
	}
	const changed = files.filter((f) => f.changed);
	if (changed.length) md.push('', `Files in this change: ${changed.map((f) => `\`${f.name}\` (${f.verdict})`).join(', ')}`);
	md.push('', 'Statistics were generated successfully: `npm run playtests` shows them.');
	return md.join('\n') + '\n';
}

/* Changing the collection and its state
   ------------------------------------- */
function updateSnapshot(result, date) {
	const { state, batch } = result;
	state.snapshot = {
		updated: date || new Date().toISOString().slice(0, 10),
		validGames: result.valid.length,
		outstanding: batch.outstanding,
		awaitingReview: batch.outstanding.length,
		status: batch.status,
		reanalysis: batch.reanalysis
	};
	return state;
}

function recordAnalysis(dir, { report, games, outstanding, date }) {
	// After a report is complete: its games become analysed under the current methodology
	const reportPath = path.resolve(dir, report);
	if (!reportPath.startsWith(path.join(path.resolve(dir), 'reports') + path.sep) || !fs.existsSync(reportPath)) {
		throw new Error(`the report must exist in ${path.join(dir, 'reports')} before its games are marked as analysed: ${report}`);
	}
	const result = scan(dir);
	const pool = new Map(result.valid.map((f) => [f.id, f]));
	const ids = outstanding ? result.batch.outstanding.concat(result.batch.reanalysis) : games;
	if (!ids || !ids.length) throw new Error('no games to mark as analysed');
	for (const id of ids) if (!pool.has(id)) throw new Error(`${id} is not a valid game in the collection`);
	const state = result.state;
	const id = path.basename(reportPath).replace(/\.[^.]+$/, '');
	if (state.reports.some((r) => r.id === id)) throw new Error(`report ${id} is already recorded`);
	state.reports.push({
		id,
		date: date || new Date().toISOString().slice(0, 10),
		file: path.relative(dir, reportPath).split(path.sep).join('/'),
		methodologyVersion: state.methodologyVersion,
		games: ids.slice(),
		cohorts: [...new Set(ids.map((g) => pool.get(g).cohort.key))]
	});
	for (const g of ids) state.analysed[g] = { report: id, methodologyVersion: state.methodologyVersion };
	writeState(dir, state);
	const after = scan(dir);
	writeState(dir, updateSnapshot(after, date));
	return after;
}

/* Command line
   ------------ */
function option(args, name) {
	const i = args.indexOf(name);
	return i === -1 ? null : args[i + 1];
}

async function main(argv) {
	const args = argv.slice();
	const dir = option(args, '--dir') ? path.resolve(option(args, '--dir')) : defaultDir;
	if (args.includes('--add')) {
		const inputs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--dir');
		if (!inputs.length) {
			console.error('Usage: npm run playtests:add -- <exported record .json or batch .zip> ...');
			return 2;
		}
		const zip = require('../../js/ui/zip.js');
		const expanded = [];
		for (const input of inputs) {
			if (/\.zip$/i.test(input)) {
				const files = await zip.read(new Uint8Array(fs.readFileSync(input)), (b) => zlib.inflateRawSync(b));
				expanded.push({ input, files });
			} else {
				expanded.push({ input });
			}
		}
		const report = addItems(dir, expanded);
		for (const r of report) console.log(`${r.from}: ${r.outcome}${r.file ? ' -> ' + r.file : ''}${r.reason ? ' (' + r.reason + ')' : ''}`);
		console.log('');
		const result = scan(dir);
		console.log(lines(result).join('\n'));
		return report.some((r) => r.outcome === 'rejected' || r.outcome === 'conflict') ? 1 : 0;
	}
	if (args.includes('--record-analysis')) {
		const report = option(args, '--report');
		const games = option(args, '--games');
		const result = recordAnalysis(dir, { report, games: games ? games.split(',').map((s) => s.trim()).filter(Boolean) : null, outstanding: args.includes('--outstanding'), date: option(args, '--date') });
		console.log(`Recorded ${report}: its games are now analysed.`);
		console.log(lines(result).join('\n'));
		return 0;
	}
	const changedAt = args.indexOf('--changed');
	const changed = changedAt === -1 ? [] : args.slice(changedAt + 1).filter((a) => !a.startsWith('--'));
	const result = scan(dir, { changed });
	if (args.includes('--update-state')) {
		writeState(dir, updateSnapshot(result, option(args, '--date')));
		result.batch.snapshotCurrent = true;
		console.log('Updated analysis-state.json.');
	}
	const failed = result.problems.length > 0 || result.stateProblems.length > 0;
	if (args.includes('--json')) {
		const strip = (f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'record'));
		console.log(JSON.stringify({ files: result.files.map(strip), batch: result.batch, stats: result.stats, stateProblems: result.stateProblems }, null, 2));
	} else {
		console.log(lines(result).join('\n'));
	}
	if (args.includes('--ci')) {
		for (const f of result.problems) console.log(`::error file=${f.file}::${f.verdict}: ${f.problems.slice(0, 3).join('; ').replace(/\n/g, ' ')}`);
		for (const p of result.stateProblems) console.log(`::error file=research/human-playtests/analysis-state.json::${p}`);
		for (const f of result.files.filter((x) => x.verdict === 'incompatible' && !x.changed)) console.log(`::warning file=${f.file}::incompatible with this version (kept as historical evidence)`);
		if (result.batch.status === statuses.ready) {
			console.log(`::notice title=Research batch ready::${result.batch.outstanding.length} new valid human games await review (threshold ${result.batch.threshold}). Commission the analysis by hand: docs/playtests.md`);
		}
		if (!result.batch.snapshotCurrent) {
			console.log('::notice title=Analysis state snapshot::analysis-state.json\'s snapshot is out of date; refresh it with npm run playtests -- --update-state (informational)');
		}
		if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown(result));
		console.log(failed ? '\nFAIL: the playtest collection has problems (above).' : '\nPASS: every playtest record is valid.');
	}
	return failed ? 1 : 0;
}

function addItems(dir, expanded) {
	// expanded: [{ input, files? }] (files: a ZIP's entries, already read)
	const recordsDir = path.join(dir, 'records');
	fs.mkdirSync(recordsDir, { recursive: true });
	const items = [];
	for (const e of expanded) {
		if (e.files) {
			for (const f of e.files) {
				if (/\.json$/i.test(f.name) && !/(^|\/)manifest\.json$/i.test(f.name) && !/(^|\/)(__MACOSX|\.)/.test(f.name)) items.push({ from: `${e.input}: ${f.name}`, text: f.text });
			}
		} else {
			items.push({ from: e.input, text: fs.readFileSync(e.input, 'utf8') });
		}
	}
	const report = [];
	for (const item of items) {
		const checked = checkRecord(item.text);
		if (checked.verdict !== 'valid') {
			report.push({ from: item.from, outcome: 'rejected', reason: `${checked.verdict}: ${checked.problems.slice(0, 3).join('; ')}` });
			continue;
		}
		const id = checked.record.game.id;
		const target = path.join(recordsDir, id + '.json');
		if (fs.existsSync(target)) {
			const existing = checkRecord(fs.readFileSync(target, 'utf8'));
			const same = existing.record && fingerprint(existing.record) === fingerprint(checked.record);
			report.push({ from: item.from, id, outcome: same ? 'already there' : 'conflict', reason: same ? '' : `records/${id}.json holds a different record of this game: not overwritten` });
			continue;
		}
		fs.writeFileSync(target, item.text, { flag: 'wx' });
		report.push({ from: item.from, id, outcome: 'added', file: path.relative(root, target) });
	}
	return report;
}

if (require.main === module) {
	main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
		console.error(error.message);
		process.exitCode = 2;
	});
}

module.exports = { main, scan, statistics, checkRecord, cohortOf, fingerprint, role, humanWon, readState, writeState, updateSnapshot, recordAnalysis, addItems, markdown, lines, statuses };
