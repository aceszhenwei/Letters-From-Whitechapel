// Importing submitted playtests (tools/playtests/intake.js, tools/playtests/import-pr.js; docs/automatic-playtest-
// collection.md#the-import-workflow): the real Worker (worker/src/app.js) on a local D1 as the source, temporary copies
// of the collection as the repository, and a fake git/gh for the pull request. Nothing leaves this machine.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { database, rateLimiter } = require('../helpers/d1');
const { loadStore, firstRecord, firstId, humanJackRecord, tempCollection } = require('../helpers/playtests');
const intake = require('../../tools/playtests/intake');
const importPr = require('../../tools/playtests/import-pr');
const dataset = require('../../tools/playtests/dataset');

const WC = loadStore();
const token = 'import-token-for-tests-0123456789abcdef';
const api = 'https://intake.example';
let worker;

test.before(async () => {
	worker = await import('../../worker/src/app.js');
});

function intakeService(overrides = {}) {
	// The Worker with its database, and a fetch that reaches it in-process (counting downloads)
	const env = Object.assign({ DB: database(), RATE_LIMITER: rateLimiter(10000), ACCEPTED_RULESETS: WC.record.ruleset.id, IMPORT_TOKEN: token }, overrides);
	const calls = { list: 0, body: 0 };
	const fetch = async (url, init = {}) => {
		if (/\/admin\/submissions\/g/.test(url)) calls.body++;
		else if (/\/admin\/submissions\?/.test(url)) calls.list++;
		return worker.handle(new Request(url, init), env);
	};
	const submit = async (record) => {
		const response = await worker.handle(new Request(api + '/api/v1/playtests', { method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: typeof record === 'string' ? record : WC.record.stringify(record) }), env);
		return response.status;
	};
	return { env, fetch, submit, calls };
}

const quiet = () => {};
async function runImport(service, dir, extra = [], envOverrides = {}) {
	const lines = [];
	const code = await intake.main(['--api', api, '--dir', dir, '--date', '2026-10-11', ...extra],
		Object.assign({ PLAYTEST_IMPORT_TOKEN: token }, envOverrides), { fetch: service.fetch, log: (l) => lines.push(l), wait: async () => {} });
	return { code, lines, out: lines.join('\n') };
}

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

test('no submissions: nothing is written and nothing is eligible', async () => {
	const s = intakeService();
	const dir = tempCollection([{ record: firstRecord() }]);
	const r = await runImport(s, dir);
	assert.strictEqual(r.code, 0);
	assert.match(r.out, /Examined 0 submissions/);
	assert.match(r.out, /Eligible for import: 0/);
	assert.ok(!fs.existsSync(path.join(dir, 'intake.json')));
	assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'records')), [firstId + '.json']);
});

test('new records are replay-verified and written byte for byte; games already in the collection are duplicates; they count once and stay unanalysed', async () => {
	const s = intakeService();
	const a = humanJackRecord(51);
	const b = humanJackRecord(52);
	for (const r of [firstRecord(), a, b]) assert.strictEqual(await s.submit(r), 201);
	const dir = tempCollection([{ record: firstRecord() }]);
	const state = dataset.readState(dir);
	state.analysed[firstId] = { report: 'earlier', methodologyVersion: 1 };
	dataset.writeState(dir, state);
	const summaryFile = path.join(dir, 'summary.md');
	const r = await runImport(s, dir, ['--summary', summaryFile]);
	assert.strictEqual(r.code, 0, r.out);
	for (const rec of [a, b]) {
		const file = path.join(dir, 'records', rec.game.id + '.json');
		assert.strictEqual(fs.readFileSync(file, 'utf8'), WC.record.stringify(rec), 'unchanged');
	}
	const ledger = intake.readLedger(dir);
	assert.deepStrictEqual([ledger.submissions[a.game.id].verdict, ledger.submissions[b.game.id].verdict, ledger.submissions[firstId].verdict], ['imported', 'imported', 'duplicate']);
	assert.strictEqual(ledger.submissions[a.game.id].sha256, sha(WC.record.stringify(a)));
	// The research pipeline: the new games are collected (awaiting review), the analysed one stays analysed
	const scan = dataset.scan(dir);
	assert.deepStrictEqual(scan.problems.concat(scan.stateProblems), []);
	assert.deepStrictEqual(scan.batch.outstanding.sort(), [a.game.id, b.game.id].sort());
	assert.deepStrictEqual(scan.batch.analysed, [firstId]);
	assert.strictEqual(Object.keys(dataset.readState(dir).analysed).length, 1, 'importing marks nothing as analysed');
	assert.deepStrictEqual(Object.assign({}, scan.stats.bySource), { 'online submission': 2, 'manual upload': 1 });
	// The snapshot of games awaiting review is refreshed with the import, so the collection stays consistent
	// (playtests-dataset.test.js requires it; the first import PR, #34, failed CI without it)
	assert.ok(scan.batch.snapshotCurrent, 'analysis-state.json\'s snapshot matches the collection');
	assert.deepStrictEqual(dataset.readState(dir).snapshot.outstanding.slice().sort(), [a.game.id, b.game.id].sort());
	const md = fs.readFileSync(summaryFile, 'utf8');
	assert.match(md, /\| 3 \| 3 \| 0 \| 1 \| 0 \| 2 \| 0 \| 0 \|/);
	assert.match(md, /does \*\*not\*\* prove a person played them/);
	assert.match(md, /human jack vs Random police \(test\) \(test\): 2/);

	// The next run, after the pull request was merged: nothing is downloaded again, nothing is eligible
	const before = s.calls.body;
	const again = await runImport(s, dir);
	assert.strictEqual(s.calls.body, before, 'no downloads');
	assert.match(again.out, /Eligible for import: 0/);
	assert.match(again.out, /3 previously/.test(again.out) ? /3 previously/ : /previously imported/);
	assert.strictEqual(dataset.scan(dir).batch.outstanding.length, 2, 'counted once');

	// A run while the pull request is still open (the branch is rebuilt from master): the same records again
	const fresh = tempCollection([{ record: firstRecord() }]);
	const rebuilt = await runImport(s, fresh);
	assert.match(rebuilt.out, /Eligible for import: 2/);
	assert.deepStrictEqual(fs.readdirSync(path.join(fresh, 'records')).sort(), fs.readdirSync(path.join(dir, 'records')).sort());
});

test('rejected: records that fail the replay, other rule sets, mismatched checksums; conflicts never overwrite', async () => {
	const other = 'whitechapel-000000000000';
	const s = intakeService({ ACCEPTED_RULESETS: WC.record.ruleset.id + ',' + other });
	const forged = humanJackRecord(53);
	forged.actions[1].args.marked[0] = forged.actions[1].args.marked[0] === 8 ? 9 : 8; // Structurally fine, but never played
	const incompatible = humanJackRecord(54);
	incompatible.ruleset.id = other;
	const conflicting = humanJackRecord(62); // Another valid game under an id the collection already has
	conflicting.game.id = firstId;
	for (const r of [forged, incompatible, conflicting]) assert.strictEqual(await s.submit(r), 201, 'the Worker only checks structure');
	const dir = tempCollection([{ record: firstRecord() }]);
	const original = fs.readFileSync(path.join(dir, 'records', firstId + '.json'), 'utf8');
	const r = await runImport(s, dir);
	assert.strictEqual(r.code, 0);
	const ledger = intake.readLedger(dir).submissions;
	assert.deepStrictEqual([ledger[forged.game.id].verdict, ledger[incompatible.game.id].verdict, ledger[firstId].verdict], ['invalid', 'incompatible', 'conflict']);
	assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'records')), [firstId + '.json'], 'nothing added');
	assert.strictEqual(fs.readFileSync(path.join(dir, 'records', firstId + '.json'), 'utf8'), original, 'never overwritten');
	assert.match(r.out, /Eligible for import: 0/);

	// A body that doesn't match its checksum (tampered in transit or storage)
	const t = intakeService();
	const rec = humanJackRecord(55);
	await t.submit(rec);
	const tampered = async (url, init) => {
		const response = await t.fetch(url, init);
		if (!/\/admin\/submissions\/g/.test(url)) return response;
		const text = (await response.text()).replace('"hideout"', '"hideout" ');
		return new Response(text, { status: 200, headers: response.headers });
	};
	const d2 = tempCollection();
	await intake.main(['--api', api, '--dir', d2], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: tampered, log: quiet, wait: async () => {} });
	assert.strictEqual(intake.readLedger(d2).submissions[rec.game.id].verdict, 'integrity');
	assert.deepStrictEqual(fs.readdirSync(path.join(d2, 'records')), []);
});

test('unsafe ids from the listing are never used as paths; summaries escape what they show', async () => {
	const s = intakeService();
	const evil = async (url) => {
		if (/\/admin\/submissions\?/.test(url)) {
			return new Response(JSON.stringify({ submissions: [{ seq: 1, game_id: '../../../.github/workflows/evil', body_sha256: 'x' }, { seq: 2, game_id: 'g0123456789abcdef|<b>' }], next: null }), { status: 200 });
		}
		throw new Error('should not download');
	};
	const dir = tempCollection();
	const lines = [];
	const code = await intake.main(['--api', api, '--dir', dir, '--summary', path.join(dir, 's.md')], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: evil, log: (l) => lines.push(l) });
	assert.strictEqual(code, 0);
	assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'records')), []);
	assert.ok(!fs.existsSync(path.join(dir, '..', '.github')));
	const md = fs.readFileSync(path.join(dir, 's.md'), 'utf8');
	assert.ok(!md.includes('<b>') && !md.includes('../'), md);
	assert.ok(s);
});

test('failures: invalid or missing credentials and a disabled intake are configuration errors; failed downloads are retried next run', async () => {
	const s = intakeService();
	const dir = tempCollection();
	assert.strictEqual((await runImport(s, dir, [], { PLAYTEST_IMPORT_TOKEN: 'wrong-token-wrong-token-wrong-token-wrong' })).code, 2);
	const missing = await runImport(s, dir, [], { PLAYTEST_IMPORT_TOKEN: '' });
	assert.strictEqual(missing.code, 2);
	assert.match(missing.out, /PLAYTEST_IMPORT_TOKEN/);
	const off = intakeService({ IMPORT_TOKEN: '' });
	assert.match((await runImport(off, dir)).out, /import endpoints are off/);
	const noUrl = await intake.main(['--dir', dir], { PLAYTEST_IMPORT_TOKEN: token }, { log: quiet });
	assert.strictEqual(noUrl, 2);
	// The intake down: an error, nothing written
	const down = await intake.main(['--api', api, '--dir', dir], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: async () => { throw new Error('ECONNREFUSED'); }, log: quiet, wait: async () => {} });
	assert.strictEqual(down, 1);
	assert.ok(!fs.existsSync(path.join(dir, 'intake.json')));

	// One download fails: the others are imported, the failed one is not recorded and comes back next run
	const rec1 = humanJackRecord(56);
	const rec2 = humanJackRecord(57);
	await s.submit(rec1);
	await s.submit(rec2);
	let failOnce = true;
	const flaky = async (url, init) => {
		if (failOnce && url.endsWith(rec1.game.id)) {
			failOnce = false;
			return new Response('{}', { status: 404 });
		}
		return s.fetch(url, init);
	};
	const lines = [];
	await intake.main(['--api', api, '--dir', dir], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: flaky, log: (l) => lines.push(l), wait: async () => {} });
	assert.match(lines.join('\n'), /failed — download failed/);
	assert.ok(!intake.readLedger(dir).submissions[rec1.game.id]);
	assert.strictEqual(intake.readLedger(dir).submissions[rec2.game.id].verdict, 'imported');
	await intake.main(['--api', api, '--dir', dir], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: flaky, log: quiet, wait: async () => {} });
	assert.strictEqual(intake.readLedger(dir).submissions[rec1.game.id].verdict, 'imported', 'recovered');
});

test('bounded runs, exclusions, and a warning for copied games', async () => {
	const s = intakeService();
	const recs = [58, 59, 60].map((seed) => humanJackRecord(seed));
	for (const r of recs) await s.submit(r);
	// A copy of one game's moves under another id: replays fine, so only a warning can flag it
	const copy = JSON.parse(JSON.stringify(recs[0]));
	copy.game.id = 'g' + 'c'.repeat(16);
	await s.submit(copy);
	const dir = tempCollection();
	const r = await runImport(s, dir, ['--max', '2']);
	assert.match(r.out, /2 imported/);
	assert.match(r.out, /2 deferred/);
	const next = await runImport(s, dir, ['--max', '2']);
	assert.match(next.out, /identical moves in different games/);
	assert.strictEqual(fs.readdirSync(path.join(dir, 'records')).length, 4);
	// The owner refuses one for good
	const d2 = tempCollection();
	assert.strictEqual(await intake.main(['--exclude', recs[1].game.id, '--reason', 'test refusal', '--dir', d2], {}, { log: quiet }), 0);
	await runImport(s, d2);
	assert.ok(!fs.existsSync(path.join(d2, 'records', recs[1].game.id + '.json')));
	assert.strictEqual(intake.readLedger(d2).submissions[recs[1].game.id].verdict, 'excluded');
	assert.strictEqual(await intake.main(['--exclude', '../x', '--reason', 'r', '--dir', d2], {}, { log: quiet }), 2);
});

test('the collection check catches an imported record that was edited afterwards', async () => {
	const s = intakeService();
	const rec = humanJackRecord(61);
	await s.submit(rec);
	const dir = tempCollection();
	await runImport(s, dir);
	assert.deepStrictEqual(dataset.scan(dir).stateProblems, []);
	const file = path.join(dir, 'records', rec.game.id + '.json');
	fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n$/, '\n\n'));
	assert.match(dataset.scan(dir).stateProblems.join('\n'), /not the record that was submitted/);
	fs.unlinkSync(file);
	assert.match(dataset.scan(dir).stateProblems.join('\n'), /lists .* as imported, but records\/ has no such game/);
});

/* The pull request
   ---------------- */
function fakeGit({ status = '', remote = '', remoteTree = '', tree = 'tree1', open = [] } = {}) {
	const calls = [];
	const exec = (cmd, args) => {
		calls.push([cmd, ...args].join(' '));
		const a = args.join(' ');
		if (cmd === 'git' && a.startsWith('status')) return status;
		if (cmd === 'git' && a.startsWith('rev-parse --verify')) { if (!remote) throw new Error('no ref'); return remote; }
		if (cmd === 'git' && a === 'rev-parse HEAD^{tree}') return tree;
		if (cmd === 'git' && a.startsWith('rev-parse')) return remoteTree;
		if (cmd === 'gh' && a.startsWith('pr list')) return JSON.stringify(open);
		if (cmd === 'gh' && a.startsWith('pr create')) return 'https://github.com/o/r/pull/9';
		return '';
	};
	return { exec, calls };
}
const rec = (id) => `?? research/human-playtests/records/${id}.json\0`;

test('the pull request: created once, then updated; no empty pull requests; no push when nothing changed; obsolete ones closed', () => {
	const run = (git) => importPr.main(['--summary', 's.md', '--date', '2026-10-11'], { exec: git.exec, log: quiet });
	// No new records, no open pull request: nothing happens
	const none = fakeGit();
	assert.strictEqual(run(none), 0);
	assert.ok(!none.calls.some((c) => /push|pr create|commit/.test(c)), none.calls.join('\n'));
	// New records: a commit on the import branch, a push, a new pull request, and the collection check started
	const first = fakeGit({ status: rec('g0123456789abcdef') + ' M research/human-playtests/intake.json\0' });
	assert.strictEqual(run(first), 0);
	assert.ok(first.calls.includes('git checkout -B playtest-import'));
	assert.ok(first.calls.some((c) => c.startsWith('git push --force-with-lease=refs/heads/playtest-import: origin HEAD:refs/heads/playtest-import')));
	assert.ok(first.calls.some((c) => c.startsWith('gh pr create --base master --head playtest-import --title Import human playtests — 2026-10-11 --body-file s.md')));
	assert.ok(first.calls.includes('gh workflow run playtests.yml --ref playtest-import'));
	// An open pull request: updated, never a second one
	const second = fakeGit({ status: rec('g0123456789abcdef'), remote: 'abc', remoteTree: 'old', open: [{ number: 7 }] });
	run(second);
	assert.ok(second.calls.some((c) => c.startsWith('gh pr edit 7 --title')));
	assert.ok(!second.calls.some((c) => c.startsWith('gh pr create')));
	assert.ok(second.calls.some((c) => c.startsWith('git push --force-with-lease=refs/heads/playtest-import:abc')));
	// Same content as the branch already has (a re-run after a failure, or two runs): no push
	const same = fakeGit({ status: rec('g0123456789abcdef'), remote: 'abc', remoteTree: 'tree1', tree: 'tree1', open: [{ number: 7 }] });
	run(same);
	assert.ok(!same.calls.some((c) => c.startsWith('git push')));
	// Nothing left to import while a pull request is open (its games reached master): it is closed
	const obsolete = fakeGit({ open: [{ number: 7 }] });
	run(obsolete);
	assert.ok(obsolete.calls.some((c) => c.startsWith('gh pr close 7')));
});

test('analysis-state.json may change in an import only in its snapshot: never which games are analysed', () => {
	const base = { format: 'whitechapel-playtest-analysis-state', analysed: { g1: { report: 'r' } }, reports: [], snapshot: { outstanding: [] } };
	const run = (after) => {
		const git = fakeGit({ status: rec('g0123456789abcdef') + ' M research/human-playtests/analysis-state.json\0' });
		const exec = (cmd, args) => (cmd === 'git' && args[0] === 'show' ? JSON.stringify(base) : git.exec(cmd, args));
		const code = importPr.main(['--summary', 's.md'], { exec, log: quiet, readFile: () => JSON.stringify(after) });
		return { code, calls: git.calls };
	};
	const snapshotOnly = run(Object.assign({}, base, { snapshot: { outstanding: ['g0123456789abcdef'] } }));
	assert.strictEqual(snapshotOnly.code, 0);
	assert.ok(snapshotOnly.calls.some((c) => c.startsWith('git add -- ') && c.includes('analysis-state.json')));
	const marked = run(Object.assign({}, base, { analysed: { g1: { report: 'r' }, g0123456789abcdef: { report: 'x' } } }));
	assert.strictEqual(marked.code, 1);
	assert.ok(!marked.calls.some((c) => /commit|push/.test(c)));
	assert.ok(!importPr.onlySnapshot('not json', '{}'));
});

test('the pull request step refuses to commit anything outside the records and the ledger', () => {
	for (const bad of ['?? .github/workflows/evil.yml\0', '?? research/human-playtests/records/../x.json\0', ' M js/main.js\0',
		'?? research/human-playtests/analysis-state.json\0', '?? research/human-playtests/records/G0123456789ABCDEF.json\0']) {
		const git = fakeGit({ status: rec('g0123456789abcdef') + bad });
		assert.strictEqual(importPr.main(['--summary', 's.md'], { exec: git.exec, log: quiet, readFile: () => '{"analysed":{"gx":{}}}' }), 1, bad);
		assert.ok(!git.calls.some((c) => /commit|push|pr create/.test(c)), bad);
	}
});

test('changed paths are read intact from a real git repository, modified files included (the leading space of " M")', () => {
	// The second import run failed: trimming git's output turned " M research/…" into "esearch/…"
	const { execFileSync } = require('child_process');
	const os = require('os');
	const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'import-pr-'));
	const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
	git('init', '-q');
	fs.mkdirSync(path.join(repo, 'research', 'human-playtests', 'records'), { recursive: true });
	fs.writeFileSync(path.join(repo, 'research', 'human-playtests', 'analysis-state.json'), '{}\n');
	git('add', '.');
	git('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'base');
	fs.writeFileSync(path.join(repo, 'research', 'human-playtests', 'analysis-state.json'), '{"snapshot":{}}\n');
	fs.writeFileSync(path.join(repo, 'research', 'human-playtests', 'records', 'g0123456789abcdef.json'), '{}\n');
	const cwd = process.cwd();
	process.chdir(repo);
	try {
		assert.deepStrictEqual(importPr.changedPaths(importPr.defaultExec).sort(), [
			'research/human-playtests/analysis-state.json', 'research/human-playtests/records/g0123456789abcdef.json']);
	} finally {
		process.chdir(cwd);
	}
});
