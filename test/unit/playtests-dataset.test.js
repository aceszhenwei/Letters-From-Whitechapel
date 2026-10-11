// The human playtest collection (research/human-playtests/, tools/playtests/dataset.js): the first real Human Jack game
// counted once, with the research status analysis-state.json gives it; problems found (invalid, misnamed, ineligible, duplicate, conflict, incompatible);
// the five-game research batch; recording an analysis; methodology changes; cohorts kept apart; adding batch ZIPs;
// and the command line as GitHub Actions runs it. Synthetic games are made in temporary folders only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dataset = require('../../tools/playtests/dataset');
const { loadStore, firstRecord, firstFile, firstId, humanJackRecord, tempCollection, root } = require('../helpers/playtests');

const collection = path.join(root, 'research', 'human-playtests');
const records = {};
const synthetic = (seed) => (records[seed] = records[seed] || humanJackRecord(seed));

test('the first real Human Jack game is in the collection, counted once, against Detective AI v3, with the research status its state records', () => {
	const result = dataset.scan(collection);
	const games = result.valid.filter((f) => f.id === firstId);
	assert.strictEqual(games.length, 1);
	const game = games[0];
	assert.strictEqual(game.name, firstId + '.json');
	assert.strictEqual(game.verdict, 'valid');
	assert.strictEqual(game.cohort.role, 'jack');
	assert.strictEqual(game.cohort.opponent, 'Detective AI v3');
	assert.strictEqual(game.cohort.level, 'normal');
	assert.strictEqual(game.cohort.appVersion, '1.0.0');
	// Analysed only once a recorded report covers it (2026-10-11-investigation-arrests); awaiting review before that
	const report = result.state.analysed[firstId];
	assert.strictEqual(game.research, report ? 'analysed' : 'collected');
	assert.strictEqual(result.batch.outstanding.includes(firstId), !report);
	assert.strictEqual(result.batch.analysed.includes(firstId), !!report);
	if (report) assert.ok(result.state.reports.some((r) => r.id === report.report && r.games.includes(firstId) && fs.existsSync(path.join(collection, r.file))));
	assert.deepStrictEqual(result.problems, []);
	assert.deepStrictEqual(result.stateProblems, []);
	assert.ok(result.batch.snapshotCurrent, 'analysis-state.json\'s snapshot matches the collection');
	// The file is the original record, as exported by the game, unchanged
	assert.strictEqual(fs.readFileSync(firstFile, 'utf8').length, 94732);
	assert.strictEqual(require('crypto').createHash('sha256').update(fs.readFileSync(firstFile)).digest('hex'),
		'3d82eb56c998cc3000b29e34e4031ba0b981cea04524e3bb4a9b91d6d166150e');
	// The existing importer verifies it by a full replay
	const { validate } = require('../../tools/game-log/validate');
	assert.strictEqual(validate(fs.readFileSync(firstFile, 'utf8')).verdict, 'verified');
});

test('every file in the collection is a valid record named after its game id, and the statistics count each game once', () => {
	const result = dataset.scan(collection);
	assert.strictEqual(result.files.length, result.valid.length);
	const ids = result.valid.map((f) => f.id);
	assert.strictEqual(new Set(ids).size, ids.length);
	assert.strictEqual(result.stats.validGames, ids.length);
	assert.ok(result.stats.byRole.jack >= 1);
	const v3 = result.stats.winsByRoleAndOpponent['human jack vs Detective AI v3 (normal)'];
	assert.ok(v3.games >= 1 && v3.humanWins >= 1, 'the first game was a win for Jack');
});

test('problems are found: invalid, misnamed, ineligible, duplicate, conflicting; incompatible records are kept as history', () => {
	const first = firstRecord();
	const notFull = JSON.parse(JSON.stringify(first));
	notFull.game.id = 'gnotfull';
	notFull.disclosure = 'public';
	const computer = synthetic(11);
	computer.game.players = { jack: { type: 'ai', level: 'normal', ai: 'Strategic Jack' }, police: { type: 'ai', level: 'test', ai: 'Random police (test)' } };
	const incompatible = JSON.parse(JSON.stringify(synthetic(12)));
	incompatible.ruleset.id = 'whitechapel-000000000000';
	const conflicting = JSON.parse(JSON.stringify(first));
	conflicting.outcome.jackMove = 3;
	const dir = tempCollection([
		{ record: first },
		{ name: 'copy of first.json', record: Object.assign({}, first, { game: Object.assign({}, first.game, { exportedOn: '2027-01-01' }) }) },
		{ name: 'not-json.txt', text: 'hello' },
		{ name: 'broken.json', text: '{ broken' },
		{ name: 'gnotfull.json', record: notFull },
		{ name: computer.game.id + '.json', record: computer },
		{ record: incompatible },
		{ name: 'g-elsewhere.json', record: synthetic(13) }
	]);
	let result = dataset.scan(dir);
	const by = (name) => result.files.find((f) => f.name === name);
	assert.strictEqual(by(firstId + '.json').verdict, 'valid');
	assert.ok(by('copy of first.json').duplicate && by('copy of first.json').misnamed);
	assert.strictEqual(by('not-json.txt').verdict, 'invalid');
	assert.strictEqual(by('broken.json').verdict, 'invalid');
	assert.strictEqual(by('gnotfull.json').verdict, 'invalid', 'a full record relabelled public is malformed');
	assert.strictEqual(by(computer.game.id + '.json').verdict, 'ineligible');
	assert.strictEqual(by(incompatible.game.id + '.json').verdict, 'incompatible');
	assert.ok(!result.problems.includes(by(incompatible.game.id + '.json')), 'an old record is history, not a problem');
	assert.ok(by('g-elsewhere.json').misnamed);
	assert.deepStrictEqual(result.valid.map((f) => f.id), [firstId], 'only the one valid, well-named game counts');
	assert.deepStrictEqual(Object.assign({}, result.stats.problems), { invalid: 3, ineligible: 1, incompatible: 1, duplicate: 1, conflict: 0, misnamed: 2 });
	// Newly submitted, an incompatible record is a problem
	result = dataset.scan(dir, { changed: [path.join(dir, 'records', incompatible.game.id + '.json')] });
	assert.ok(result.problems.some((f) => f.name === incompatible.game.id + '.json'));
	// A different record with the same game id: both files conflict, and neither counts
	fs.writeFileSync(path.join(dir, 'records', 'conflict.json'), JSON.stringify(conflicting));
	result = dataset.scan(dir);
	assert.ok(by(firstId + '.json') && result.files.find((f) => f.name === firstId + '.json').conflict);
	assert.ok(result.files.find((f) => f.name === 'conflict.json').verdict === 'invalid' || result.files.find((f) => f.name === 'conflict.json').conflict);
});

test('a research batch is ready at five new valid games; recording a report marks exactly its games analysed', () => {
	const games = [firstRecord(), synthetic(21), synthetic(22), synthetic(23)];
	const dir = tempCollection(games.map((record) => ({ record })));
	let result = dataset.scan(dir);
	assert.strictEqual(result.batch.outstanding.length, 4);
	assert.strictEqual(result.batch.status, 'Collecting');
	fs.writeFileSync(path.join(dir, 'records', synthetic(24).game.id + '.json'), JSON.stringify(synthetic(24)));
	result = dataset.scan(dir);
	assert.strictEqual(result.batch.outstanding.length, 5);
	assert.strictEqual(result.batch.status, 'Ready for Review');
	// The state can't be marked before the report exists
	assert.throws(() => dataset.recordAnalysis(dir, { report: 'reports/2026-10-11-batch-1.md', outstanding: true }), /must exist/);
	fs.writeFileSync(path.join(dir, 'reports', '2026-10-11-batch-1.md'), '# Batch 1\n');
	const before = fs.readdirSync(path.join(dir, 'records')).map((f) => fs.readFileSync(path.join(dir, 'records', f), 'utf8'));
	result = dataset.recordAnalysis(dir, { report: 'reports/2026-10-11-batch-1.md', outstanding: true, date: '2026-10-11' });
	assert.strictEqual(result.batch.outstanding.length, 0);
	assert.strictEqual(result.batch.analysed.length, 5);
	assert.strictEqual(result.batch.status, 'Collecting');
	const state = dataset.readState(dir);
	assert.strictEqual(state.reports.length, 1);
	assert.deepStrictEqual(state.reports[0].games.slice().sort(), result.batch.analysed.slice().sort());
	assert.strictEqual(state.reports[0].file, 'reports/2026-10-11-batch-1.md');
	assert.strictEqual(state.snapshot.awaitingReview, 0);
	const after = fs.readdirSync(path.join(dir, 'records')).map((f) => fs.readFileSync(path.join(dir, 'records', f), 'utf8'));
	assert.deepStrictEqual(after, before, 'recording an analysis never touches the records');
	assert.throws(() => dataset.recordAnalysis(dir, { report: 'reports/2026-10-11-batch-1.md', outstanding: true }), /already recorded|no games/);
	// A new game after the report is the only one awaiting review
	fs.writeFileSync(path.join(dir, 'records', synthetic(25).game.id + '.json'), JSON.stringify(synthetic(25)));
	result = dataset.scan(dir);
	assert.deepStrictEqual(result.batch.outstanding, [synthetic(25).game.id]);
	// A change of methodology makes analysed games eligible again, without copying or changing them
	const changed = dataset.readState(dir);
	changed.methodologyVersion = 2;
	dataset.writeState(dir, changed);
	result = dataset.scan(dir);
	assert.strictEqual(result.batch.reanalysis.length, 5);
	assert.strictEqual(result.batch.outstanding.length, 1);
	assert.strictEqual(fs.readdirSync(path.join(dir, 'records')).length, 6);
	// An analysed game that disappeared from records/ is reported
	const missing = dataset.readState(dir);
	missing.analysed.gnosuchgame = { report: '2026-10-11-batch-1', methodologyVersion: 1 };
	dataset.writeState(dir, missing);
	assert.match(dataset.scan(dir).stateProblems[0], /gnosuchgame/);
});

test('cohorts keep app versions, opponents and difficulties apart in the statistics', () => {
	const older = JSON.parse(JSON.stringify(synthetic(31)));
	older.app.version = '0.9.0'; // Same rules and map, an older version of the game: valid, but its own cohort
	const dir = tempCollection([{ record: firstRecord() }, { record: synthetic(32) }, { record: older }]);
	const result = dataset.scan(dir);
	assert.strictEqual(result.valid.length, 3);
	const keys = Object.keys(result.stats.winsByCohort);
	assert.strictEqual(keys.length, 3);
	assert.ok(keys.some((k) => k.startsWith('0.9.0 ·')));
	assert.ok(keys.some((k) => k.includes('Detective AI v3 (normal)')));
	assert.ok(keys.some((k) => k.includes('Random police (test) (test)')));
	assert.deepStrictEqual(Object.assign({}, result.stats.byAppVersion), { '1.0.0': 2, '0.9.0': 1 });
	const total = Object.values(result.stats.winsByCohort).reduce((n, c) => n + c.games, 0);
	assert.strictEqual(total, 3, 'each game in exactly one cohort');
	assert.ok(result.stats.results.jackWins >= 1);
	assert.ok(result.stats.nightsPlayed['4'] >= 1);
	assert.ok(result.stats.actions.min <= result.stats.actions.median && result.stats.actions.median <= result.stats.actions.max);
});

test('adding exported records: a batch ZIP and JSON files are checked, new games written as <game id>.json, duplicates and conflicts never overwrite', async () => {
	const WC = loadStore();
	const entries = [WC.playtests.describe(firstRecord()), WC.playtests.describe(synthetic(41))];
	const zip = WC.playtests.batch(entries, new Date('2026-10-10T20:00:00Z'));
	const dir = tempCollection();
	const zipFile = path.join(dir, zip.name);
	fs.writeFileSync(zipFile, zip.bytes);
	const files = await WC.zip.read(zip.bytes, (b) => require('zlib').inflateRawSync(b));
	let report = dataset.addItems(dir, [{ input: zipFile, files }]);
	assert.deepStrictEqual(report.map((r) => r.outcome), ['added', 'added']);
	assert.ok(fs.existsSync(path.join(dir, 'records', firstId + '.json')));
	report = dataset.addItems(dir, [{ input: firstFile }]);
	assert.deepStrictEqual(report.map((r) => r.outcome), ['already there']);
	const clash = JSON.parse(JSON.stringify(synthetic(42)));
	clash.game.id = firstId;
	const clashFile = path.join(dir, 'clash.json');
	fs.writeFileSync(clashFile, JSON.stringify(clash));
	report = dataset.addItems(dir, [{ input: clashFile }]);
	assert.deepStrictEqual(report.map((r) => r.outcome), ['conflict']);
	const bad = JSON.parse(JSON.stringify(firstRecord()));
	bad.actions[5].args.mapid = 99999;
	const badFile = path.join(dir, 'bad.json');
	fs.writeFileSync(badFile, JSON.stringify(bad));
	assert.strictEqual(dataset.addItems(dir, [{ input: badFile }])[0].outcome, 'rejected');
	assert.strictEqual(dataset.scan(dir).valid.length, 2);
});

test('the command line as GitHub Actions runs it: pass with a summary, fail on a problem, and a notice when a batch is ready', () => {
	const run = (dir, extra = []) => {
		const summary = path.join(dir, 'summary.md');
		try {
			const out = execFileSync(process.execPath, [path.join(root, 'tools', 'playtests', 'dataset.js'), '--dir', dir, '--ci', ...extra],
				{ env: Object.assign({}, process.env, { GITHUB_STEP_SUMMARY: summary }), encoding: 'utf8' });
			return { code: 0, out, summary: fs.readFileSync(summary, 'utf8') };
		} catch (error) {
			return { code: error.status, out: error.stdout, summary: fs.existsSync(summary) ? fs.readFileSync(summary, 'utf8') : '' };
		}
	};
	const good = tempCollection([{ record: firstRecord() }]);
	let r = run(good, ['--changed', path.join(good, 'records', firstId + '.json')]);
	assert.strictEqual(r.code, 0);
	assert.match(r.out, /PASS/);
	assert.match(r.summary, /all records valid/);
	assert.match(r.summary, /Research batch: Collecting/);
	assert.match(r.summary, /Statistics were generated successfully/);
	const ready = tempCollection([firstRecord(), synthetic(21), synthetic(22), synthetic(23), synthetic(24)].map((record) => ({ record })));
	r = run(ready);
	assert.strictEqual(r.code, 0);
	assert.match(r.out, /::notice title=Research batch ready::5 new valid human games/);
	assert.match(r.summary, /Ready for Review/);
	const bad = tempCollection([{ record: firstRecord() }, { name: 'broken.json', text: '{' }]);
	r = run(bad);
	assert.strictEqual(r.code, 1);
	assert.match(r.out, /::error file=.*broken\.json::invalid/);
	assert.match(r.out, /FAIL/);
	assert.match(r.summary, /problems found/);
	// --json for scripts
	const json = JSON.parse(execFileSync(process.execPath, [path.join(root, 'tools', 'playtests', 'dataset.js'), '--dir', good, '--json'], { encoding: 'utf8' }));
	assert.strictEqual(json.stats.validGames, 1);
	assert.deepStrictEqual(json.batch.outstanding, [firstId]);
});
