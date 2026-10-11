// Anonymous Gameplay Research in the browser (js/ui/submission.js), without a page: the setting (on by default, a
// persistent opt-out, off for Global Privacy Control), the queue in IndexedDB (fake-indexeddb), sending, duplicate
// prevention, bounded retries with backoff and Retry-After, recovery after a closed page, offline, opting out mid-way,
// and the independence of submission and export statuses. fetch is a fake: no request leaves this machine.
const test = require('node:test');
const assert = require('node:assert');
const { IDBFactory } = require('fake-indexeddb');
const { loadStore, firstRecord, firstId } = require('../helpers/playtests');

const plain = (value) => JSON.parse(JSON.stringify(value));
const endpoint = 'https://intake.example.workers.dev';

function memoryStorage(initial = {}) {
	const data = Object.assign({}, initial);
	return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

function responder(script) {
	// A fake fetch: each call takes the next step (a status, an error, or a function), and records the request
	const calls = [];
	const fetch = async (url, init) => {
		calls.push({ url, init });
		const step = script.length > 1 ? script.shift() : script[0];
		if (typeof step === 'function') return step(url, init);
		if (step instanceof Error) throw step;
		const [status, body, headers = {}] = step;
		return { status, headers: { get: (k) => headers[k] !== undefined ? headers[k] : null }, text: async () => JSON.stringify(body) };
	};
	return { fetch, calls };
}

async function setup({ script = [[201, { ok: true, status: 'accepted' }]], storage = memoryStorage(), nav = {}, clock = { t: Date.parse('2026-10-11T10:00:00Z') }, browser = new IDBFactory(), url = endpoint, maxAttempts } = {}) {
	const WC = loadStore();
	const store = await WC.playtests.open({ indexedDB: browser });
	const net = responder(script);
	const timers = [];
	const submitter = WC.submission.create({
		store, endpoint: url, storage, navigator: nav, fetch: net.fetch, now: () => clock.t, noEvents: true, maxAttempts,
		setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {}
	});
	return { WC, store, submitter, net, clock, storage, timers, browser };
}

async function keep(s, record = firstRecord()) {
	// A game kept as autoSave keeps it, with the submission status the setting gives
	return s.store.add(record, { source: 'auto', submission: s.submitter.initial() });
}

test('the setting: on by default, a persistent opt-out, off for Global Privacy Control or Do Not Track, inactive without an intake address', async () => {
	const s = await setup();
	assert.ok(s.submitter.configured());
	assert.ok(s.submitter.enabled());
	assert.deepStrictEqual(plain(s.submitter.initial()), { status: 'pending', attempts: 0, nextAttemptAt: null });
	await s.submitter.setEnabled(false);
	assert.strictEqual(s.storage.data['whitechapel.research.submit'], 'off');
	const later = await setup({ storage: s.storage });
	assert.ok(!later.submitter.enabled(), 'remembered in a new session');
	assert.strictEqual(later.submitter.initial().reason, 'opted-out');
	const gpc = await setup({ nav: { globalPrivacyControl: true } });
	assert.ok(!gpc.submitter.enabled());
	assert.ok(gpc.submitter.privacySignal());
	await gpc.submitter.setEnabled(true);
	assert.ok(gpc.submitter.enabled(), 'the player may still choose it');
	assert.ok(!(await setup({ nav: { doNotTrack: '1' } })).submitter.enabled());
	const none = await setup({ url: '' });
	assert.ok(!none.submitter.configured());
	assert.ok(!none.submitter.enabled());
	assert.strictEqual(none.submitter.initial().reason, 'not-configured');
	await keep(none);
	await none.submitter.process();
	assert.strictEqual(none.net.calls.length, 0, 'nothing is sent without an intake address');
	const WC = loadStore();
	assert.strictEqual(WC.submission.endpointOf('https://x.example.workers.dev/'), 'https://x.example.workers.dev/api/v1/playtests');
	for (const bad of ['http://x.example', 'javascript:alert(1)', 'https://x.example/"onload', 'ftp://x', 'https://user@x.example']) {
		assert.strictEqual(WC.submission.endpointOf(bad), null, bad);
	}
	assert.strictEqual(WC.submission.endpointOf('http://localhost:8787'), 'http://localhost:8787/api/v1/playtests', 'local testing');
});

test('a kept game is sent once, exactly as kept, with no cookie or referrer; an acknowledged game is never sent again', async () => {
	const s = await setup();
	await keep(s);
	await s.submitter.process();
	assert.strictEqual(s.net.calls.length, 1);
	const { url, init } = s.net.calls[0];
	assert.strictEqual(url, endpoint + '/api/v1/playtests');
	assert.deepStrictEqual([init.method, init.headers['Content-Type'], init.credentials, init.referrerPolicy], ['POST', 'application/json', 'omit', 'no-referrer']);
	assert.strictEqual(init.body, s.WC.record.stringify(firstRecord()));
	const entry = await s.store.get(firstId);
	assert.deepStrictEqual([entry.submission.status, entry.submission.attempts, entry.submission.result], ['submitted', 1, 'accepted']);
	assert.strictEqual(entry.exportedAt, null, 'submitting is not exporting');
	await s.submitter.process();
	await s.submitter.process();
	assert.strictEqual(s.net.calls.length, 1, 'not sent again');
	// A duplicate acknowledgement (sent before, from another tab) also counts as submitted
	const d = await setup({ script: [[200, { ok: true, status: 'duplicate' }]] });
	await keep(d);
	await d.submitter.process();
	assert.strictEqual((await d.store.get(firstId)).submission.status, 'submitted');
});

test('offline or failing: kept locally, retried with growing delays, Retry-After honoured, and bounded', async () => {
	const s = await setup({ script: [new TypeError('Failed to fetch')], maxAttempts: 4 });
	await keep(s);
	await s.submitter.process();
	let entry = await s.store.get(firstId);
	assert.deepStrictEqual([entry.submission.status, entry.submission.attempts, entry.submission.lastError], ['retry', 1, 'network']);
	const first = Date.parse(entry.submission.nextAttemptAt) - s.clock.t;
	assert.ok(first >= 60000 && first <= 72000, String(first));
	assert.ok(s.timers.length >= 1, 'a retry is scheduled while the page is open');
	await s.submitter.process();
	assert.strictEqual(s.net.calls.length, 1, 'not before it is due');
	const delays = [first];
	for (let i = 0; i < 3; i++) {
		s.clock.t = Date.parse((await s.store.get(firstId)).submission.nextAttemptAt);
		await s.submitter.process();
		entry = await s.store.get(firstId);
		if (entry.submission.nextAttemptAt) delays.push(Date.parse(entry.submission.nextAttemptAt) - s.clock.t);
	}
	assert.strictEqual(s.net.calls.length, 4);
	assert.ok(delays[1] > delays[0] && delays[2] > delays[1], 'exponential: ' + delays.join(', '));
	assert.deepStrictEqual([entry.submission.status, entry.submission.nextAttemptAt, entry.submission.attempts], ['retry', null, 4]);
	assert.strictEqual(s.WC.submission.label(entry.submission), 'Retry required');
	s.clock.t += 365 * 86400000;
	await s.submitter.process();
	assert.strictEqual(s.net.calls.length, 4, 'no more automatic tries');
	// The player asks for it: one more round
	s.net.calls.length = 0;
	const ok = await setup({ browser: s.browser, script: [[201, { ok: true, status: 'accepted' }]] });
	await ok.submitter.submitNow(firstId);
	assert.strictEqual((await ok.store.get(firstId)).submission.status, 'submitted');

	const limited = await setup({ script: [[429, { status: 'rate_limited' }, { 'Retry-After': '120' }]] });
	await keep(limited);
	await limited.submitter.process();
	entry = await limited.store.get(firstId);
	assert.ok(Date.parse(entry.submission.nextAttemptAt) - limited.clock.t >= 120000, 'Retry-After');
	const paused = await setup({ script: [[503, { status: 'paused' }, { 'Retry-After': '21600' }]] });
	await keep(paused);
	await paused.submitter.process();
	entry = await paused.store.get(firstId);
	assert.deepStrictEqual([entry.submission.status, entry.submission.lastError], ['retry', 'paused']);
	assert.ok(Date.parse(entry.submission.nextAttemptAt) - paused.clock.t >= 21600000);
	const WC = loadStore();
	assert.strictEqual(WC.submission.retryAfter('30', 0), 30000);
	assert.strictEqual(WC.submission.retryAfter('99999999', 0), 7 * 86400000, 'at most a week');
	assert.strictEqual(WC.submission.retryAfter('soon', 0), null);
});

test('refused for good (invalid, conflict): marked permanently rejected and never sent again', async () => {
	for (const [status, code] of [[422, 'not_completed'], [409, 'conflict'], [400, 'invalid_json'], [413, 'too_large']]) {
		const s = await setup({ script: [[status, { ok: false, status: code }]] });
		await keep(s);
		await s.submitter.process();
		const entry = await s.store.get(firstId);
		assert.deepStrictEqual([entry.submission.status, entry.submission.lastError], ['rejected', code]);
		s.clock.t += 30 * 86400000;
		await s.submitter.process();
		await s.submitter.submitNow(firstId);
		assert.strictEqual(s.net.calls.length, 1, code);
	}
});

test('opting out: waiting games are cancelled, a request in flight is stopped, games kept while off are never sent later', async () => {
	let release;
	const hanging = (url, init) => new Promise((resolve, reject) => {
		release = resolve;
		init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
	});
	const s = await setup({ script: [hanging] });
	await keep(s);
	const running = s.submitter.process();
	await new Promise((r) => setTimeout(r, 20));
	assert.strictEqual(s.net.calls.length, 1);
	assert.strictEqual((await s.store.get(firstId)).submission.status, 'submitting');
	await s.submitter.setEnabled(false);
	await running;
	let entry = await s.store.get(firstId);
	assert.strictEqual(entry.submission.status, 'not-submitted');
	assert.ok(['cancelled', 'opted-out'].includes(entry.submission.reason), entry.submission.reason);
	// A second game kept while off, then the setting is turned on again: neither is sent
	const second = require('../helpers/playtests').humanJackRecord(31);
	await keep(s, second);
	assert.strictEqual((await s.store.get(second.game.id)).submission.reason, 'opted-out');
	s.net.calls.length = 0;
	await s.submitter.setEnabled(true);
	await s.submitter.idle();
	assert.strictEqual(s.net.calls.length, 0, 'nothing retroactive');
	// Local records are untouched by all of this
	assert.strictEqual((await s.store.list()).length, 2);
	assert.ok(release);

	// Pending and retrying games are cancelled too
	const q = await setup({ script: [new TypeError('offline')] });
	await keep(q);
	await q.submitter.process();
	assert.strictEqual((await q.store.get(firstId)).submission.status, 'retry');
	await q.submitter.setEnabled(false);
	entry = await q.store.get(firstId);
	assert.deepStrictEqual([entry.submission.status, entry.submission.reason], ['not-submitted', 'opted-out']);
	q.clock.t += 86400000;
	await q.submitter.process();
	assert.strictEqual(q.net.calls.length, 1);
});

test('the player may send one game on purpose, also one kept while the setting was off', async () => {
	const s = await setup({ storage: memoryStorage({ 'whitechapel.research.submit': 'off' }) });
	await keep(s);
	await s.submitter.process();
	assert.strictEqual(s.net.calls.length, 0);
	await s.submitter.submitNow(firstId);
	assert.strictEqual(s.net.calls.length, 1);
	assert.strictEqual((await s.store.get(firstId)).submission.status, 'submitted');
	await assert.rejects(s.submitter.submitNow('g0000000000000000'), /no such game/);
});

test('queue recovery: a game left "submitting" or "pending" by a closed page is sent at the next visit', async () => {
	const browser = new IDBFactory();
	const first = await setup({ browser, script: [new TypeError('page closed')] });
	await keep(first);
	await first.store.setSubmission(firstId, { status: 'submitting', attempts: 1, lastAttemptAt: '2026-10-11T09:59:00Z' });
	const next = await setup({ browser });
	await next.submitter.process();
	const entry = await next.store.get(firstId);
	assert.deepStrictEqual([entry.submission.status, entry.submission.attempts], ['submitted', 2]);
	assert.strictEqual(next.net.calls.length, 1);
});

test('submission and export statuses are independent; unavailable storage never throws', async () => {
	const s = await setup();
	await keep(s);
	await s.store.markExported([firstId], new Date('2026-10-11T11:00:00Z'));
	let entry = await s.store.get(firstId);
	assert.deepStrictEqual([entry.exportedAt, entry.submission.status], ['2026-10-11T11:00:00.000Z', 'pending']);
	await s.submitter.process();
	entry = await s.store.get(firstId);
	assert.deepStrictEqual([entry.exportedAt, entry.exportCount, entry.submission.status], ['2026-10-11T11:00:00.000Z', 1, 'submitted']);
	// Games kept before this feature have no submission status: never sent automatically
	await s.store.add(require('../helpers/playtests').humanJackRecord(32), { source: 'import' });
	s.net.calls.length = 0;
	await s.submitter.process();
	assert.strictEqual(s.net.calls.length, 0);
	const WC = loadStore();
	const broken = WC.submission.create({ store: await WC.playtests.open({ indexedDB: null }), endpoint, storage: memoryStorage(), fetch: async () => { throw new Error('x'); }, noEvents: true });
	await broken.process();
	await broken.setEnabled(false);
});
