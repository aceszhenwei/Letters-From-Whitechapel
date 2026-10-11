// Automatic playtest collection end to end (docs/automatic-playtest-collection.md#testing), with everything external
// replaced by a local stand-in: a person plays Jack in the page (jsdom), the game is kept in IndexedDB
// (fake-indexeddb), submitted automatically to the real Worker code (worker/src/app.js) on a local D1 (node:sqlite),
// imported by the real importer (tools/playtests/intake.js) with its full replay into a temporary copy of the
// collection, and counted by the research tools toward the five-game batch: once, and unanalysed. Opting out sends
// nothing. Nothing is sent to any real service.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { IDBFactory } = require('fake-indexeddb');
const { loadGame } = require('../helpers/game');
const { until, playJack } = require('../helpers/jack');
const { database, rateLimiter } = require('../helpers/d1');
const { tempCollection, firstRecord, humanJackRecord, loadStore } = require('../helpers/playtests');
const intake = require('../../tools/playtests/intake');
const dataset = require('../../tools/playtests/dataset');

const api = 'https://intake.example.workers.dev';
const token = 'e2e-import-token-0123456789abcdefghij';
let worker;

test.before(async () => {
	worker = await import('../../worker/src/app.js');
});

function intakeService() {
	const env = { DB: database(), RATE_LIMITER: rateLimiter(10000), ALLOWED_ORIGINS: 'https://aceszhenwei.github.io', ACCEPTED_RULESETS: loadStore().record.ruleset.id, IMPORT_TOKEN: token };
	const requests = [];
	const fetch = async (url, init = {}) => {
		// The browser's request, as the Worker receives it (the page's abort signal stays in the page)
		requests.push({ url, method: init.method || 'GET', body: init.body });
		const headers = Object.assign({ Origin: 'https://aceszhenwei.github.io' }, init.headers || {});
		return worker.handle(new Request(url, { method: init.method || 'GET', headers, body: init.body }), env);
	};
	return { env, fetch, requests };
}

function page({ service, browser = new IDBFactory(), storage = {}, seed = 5 }) {
	// The page wired as js/main.js wires it, with an intake address and the stand-in network
	const window = loadGame({ seed });
	const local = { getItem: (k) => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); } };
	window.WC.ui.setup(window.game, { search: '?role=jack&detectives=normal', storage: local, policeDelay: 0, jackAnimate: false, recorder: window.recorder, seed: 99 });
	const playtests = window.WC.playtests.open({ indexedDB: browser });
	const submitter = window.WC.submission.create({ store: playtests, endpoint: api, storage: local, navigator: {}, fetch: service.fetch, noEvents: true });
	const research = window.WC.ui.research(submitter);
	const results = [];
	window.WC.playtests.autoSave(window.game, window.recorder, playtests, (r) => {
		results.push(r);
		window.WC.ui.playtestSaved(r);
		research.showFor(r);
		submitter.kick();
	}, { submission: submitter.initial });
	return { window, playtests, submitter, research, results, browser, storage };
}

test('a Human Jack game: kept locally, submitted, stored privately, imported after replay, counted once and unanalysed', async () => {
	const service = intakeService();
	const p = page({ service });
	const $ = p.window.$;
	assert.ok(!$('.research-notice').prop('hidden'), 'the notice shows before the game starts');
	assert.ok($('.research-notice .research-toggle').prop('checked'), 'on by default');
	assert.ok(!$('.research-open').prop('hidden'), 'the setting is in the normal interface, not only Developer Mode');
	$('.start-game').click();
	await playJack(p.window, { seed: 5 });
	assert.ok(p.window.game.state.over);
	await until(() => p.results.length === 1);
	assert.strictEqual(p.results[0].status, 'saved');
	const id = p.results[0].entry.id;
	// Submitted automatically, once
	await p.submitter.idle();
	const store = await p.playtests;
	for (let i = 0; i < 400 && (await store.get(id)).submission.status !== 'submitted'; i++) await new Promise((r) => setTimeout(r, 5));
	assert.strictEqual((await store.get(id)).submission.status, 'submitted');
	const posts = service.requests.filter((r) => r.method === 'POST');
	assert.strictEqual(posts.length, 1);
	assert.strictEqual(posts[0].url, api + '/api/v1/playtests');
	assert.match($('.playtest-submitted').text(), /Submitted anonymously/);
	assert.match($('.playtest-submitted').text(), new RegExp(id));
	assert.match($('.playtest-saved').text(), /kept in this browser/);
	const kept = await store.get(id);
	assert.strictEqual(kept.exportedAt, null, 'still not exported: the statuses are independent');
	// Stored privately: exactly the record the browser kept
	const row = service.env.DB.sqlite.prepare('SELECT * FROM submissions').all();
	assert.strictEqual(row.length, 1);
	assert.strictEqual(row[0].body, p.window.WC.record.stringify(kept.record));
	// A second visit in the same browser sends nothing again
	const again = page({ service, browser: p.browser, storage: p.storage });
	await again.submitter.process();
	assert.strictEqual(service.requests.filter((r) => r.method === 'POST').length, 1);

	// The import workflow: replay, then the records the pull request would add, in a copy of the collection
	const dir = tempCollection([{ record: firstRecord() }]);
	const synthetic = [71, 72, 73].map((s) => humanJackRecord(s));
	for (const r of synthetic) await service.fetch(api + '/api/v1/playtests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: loadStore().record.stringify(r) });
	const log = [];
	const code = await intake.main(['--api', api, '--dir', dir], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: service.fetch, log: (l) => log.push(l) });
	assert.strictEqual(code, 0, log.join('\n'));
	assert.ok(fs.existsSync(path.join(dir, 'records', id + '.json')));
	assert.strictEqual(fs.readFileSync(path.join(dir, 'records', id + '.json'), 'utf8'), row[0].body);
	// The research collection: four new games awaiting review (Collecting: the batch is five), none analysed
	let scan = dataset.scan(dir);
	assert.deepStrictEqual(scan.problems.concat(scan.stateProblems), []);
	assert.strictEqual(scan.batch.outstanding.length, 5, 'the first record (unanalysed in this copy) plus four imported');
	assert.ok(scan.batch.outstanding.includes(id));
	assert.strictEqual(scan.batch.status, 'Ready for Review');
	assert.deepStrictEqual(dataset.readState(dir).analysed, {}, 'nothing marked as analysed');
	// The same game submitted again (another tab, a retry) and imported again: still counted once
	await service.fetch(api + '/api/v1/playtests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: row[0].body });
	await intake.main(['--api', api, '--dir', dir], { PLAYTEST_IMPORT_TOKEN: token }, { fetch: service.fetch, log: () => {} });
	scan = dataset.scan(dir);
	assert.strictEqual(scan.batch.outstanding.filter((g) => g === id).length, 1);
	assert.strictEqual(scan.valid.length, 5);
	assert.deepStrictEqual(p.window.errors, []);
});

test('opted out before playing: the game is kept and exportable, and nothing is transmitted', async () => {
	const service = intakeService();
	const p = page({ service, seed: 6 });
	const $ = p.window.$;
	$('.research-notice .research-toggle').prop('checked', false).change();
	assert.strictEqual(p.storage['whitechapel.research.submit'], 'off');
	assert.ok(!$('.research-dialog .research-toggle').prop('checked'), 'both switches agree');
	$('.start-game').click();
	await playJack(p.window, { seed: 6 });
	await until(() => p.results.length === 1);
	await p.submitter.idle();
	await new Promise((r) => setTimeout(r, 50));
	assert.strictEqual(service.requests.length, 0, 'nothing sent');
	const entry = await (await p.playtests).get(p.results[0].entry.id);
	assert.deepStrictEqual([entry.submission.status, entry.submission.reason], ['not-submitted', 'opted-out']);
	assert.match($('.playtest-submitted').text(), /Anonymous Gameplay Research is off/);
	assert.ok(p.window.recorder.exportFull().game.id === entry.id, 'the game log export still works');
	// The choice is remembered: a new visit doesn't ask again and sends nothing
	const later = page({ service, browser: p.browser, storage: p.storage });
	assert.ok(!later.window.$('.research-notice .research-toggle').prop('checked'));
	await later.submitter.process();
	assert.strictEqual(service.requests.length, 0);
	// The research dialog opens from the top bar, and closes
	later.window.$('.research-open').click();
	assert.ok(later.window.$('.research-dialog').hasClass('open'));
	assert.match(later.window.$('.research-dialog').text(), /Removal/);
	later.window.$('.research-close').click();
	assert.ok(!later.window.$('.research-dialog').hasClass('open'));
});

test('a site built without an intake address shows no research setting and sends nothing', async () => {
	const window = loadGame({ seed: 5 });
	const submitter = window.WC.submission.create({ store: window.WC.playtests.open({ indexedDB: new IDBFactory() }), endpoint: window.WC.config.playtestApiUrl, storage: null, noEvents: true,
		fetch: () => { throw new Error('nothing may be sent'); } });
	window.WC.ui.research(submitter);
	assert.strictEqual(window.WC.config.playtestApiUrl, '', 'committed empty: only the Pages build fills it in');
	assert.ok(window.$('.research-notice').prop('hidden'));
	assert.ok(window.$('.research-open').prop('hidden'));
	await submitter.process();
});
