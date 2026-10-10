// Playtest records in the page (js/ui/playtest-store.js, js/ui/playtests.js), with fake-indexeddb as the browser's
// storage: whole games a person plays are kept when they finish (as Jack and as the detectives), they are still there in
// a new session, and Developer Mode's manager exports them (new, selected, all, one JSON), marks them exported, imports
// them back, deletes and clears them.
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const { IDBFactory } = require('fake-indexeddb');
const { loadGame, playGame } = require('../helpers/game');
const { until, playJack } = require('../helpers/jack');

const plain = (value) => JSON.parse(JSON.stringify(value));

function page({ seed = 5, search = '', browser = new IDBFactory(), dev = true, saved = [] } = {}) {
	// A page wired as js/main.js wires it, with this browser's storage, and downloads caught
	const window = loadGame({ seed });
	const store = {};
	const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
	const setup = window.WC.ui.setup(window.game, { search, storage, policeDelay: 0, jackAnimate: false, recorder: window.recorder, seed: 99 });
	const playtests = window.WC.playtests.open({ indexedDB: browser });
	const results = [];
	window.WC.playtests.autoSave(window.game, window.recorder, playtests, (r) => { results.push(r); window.WC.ui.playtestSaved(r); });
	const manager = window.WC.ui.playtests(playtests, { dev, save: (name, data) => saved.push({ name, data }), now: () => new Date('2026-10-10T21:00:00Z') });
	return { window, setup, playtests, manager, results, browser, saved };
}

const fileLike = (name, bytes) => ({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test('a Human Jack game is kept when it finishes, once, and is still there in a new session', async () => {
	const p = page({ search: '?role=jack&detectives=normal' });
	const $ = p.window.$;
	$('.start-game').click();
	await playJack(p.window, { seed: 5 });
	assert.ok(p.window.game.state.over);
	await until(() => p.results.length === 1);
	assert.strictEqual(p.results[0].status, 'saved');
	assert.match($('.playtest-saved').text(), /kept in this browser/);
	const store = await p.playtests;
	const kept = await store.list();
	assert.strictEqual(kept.length, 1);
	assert.strictEqual(kept[0].role, 'jack');
	assert.strictEqual(kept[0].opponent, 'Detective AI v3');
	assert.strictEqual(kept[0].level, 'normal');
	assert.strictEqual(kept[0].result, p.window.game.state.result.type);
	assert.strictEqual(kept[0].id, p.window.recorder.exportFull().game.id);
	assert.deepStrictEqual(plain(p.window.WC.playtests.check(kept[0].record)).verdict, 'verified');
	// The individual export of the game log still works as before
	assert.strictEqual(p.window.recorder.exportFull().game.id, kept[0].id);
	// A new session in the same browser
	const again = page({ browser: p.browser });
	const manager = await again.manager;
	await manager.refresh();
	assert.strictEqual(again.window.$('.playtests-rows tr').length, 1);
	assert.match(again.window.$('.playtests-rows tr').text(), /Jack/);
	assert.deepStrictEqual(again.window.errors, []);
	assert.deepStrictEqual(p.window.errors, []);
});

test('a Human Detectives game is kept too; a game the computer plays alone, and one ended by hand, are not', async () => {
	const p = page({ seed: 7 });
	const $ = p.window.$;
	$('.start-game').click();
	assert.strictEqual(playGame(p.window, { seed: 7 }), 'over');
	await until(() => p.results.length === 1);
	const store = await p.playtests;
	const kept = await store.list();
	assert.deepStrictEqual([kept.length, kept[0].role, kept[0].opponent, kept[0].level], [1, 'detectives', 'Strategic Jack', 'normal']);
	// The computer police watching the computer's Jack (Developer Mode): not a playtest
	const watch = page({ seed: 8, search: '?dev=1&police=hard&difficulty=normal' });
	watch.window.$('.start-game').click();
	await until(() => {
		if (watch.window.game.state.phase === 12) watch.window.$('.state.the-night-is-over .begin-next-night').click();
		return watch.window.game.state.over;
	});
	await new Promise((resolve) => setTimeout(resolve, 100));
	assert.strictEqual((await (await watch.playtests).list()).length, 0);
	// Ended by hand before the end: not kept
	const ended = page({ seed: 9 });
	ended.window.$('.start-game').click();
	assert.ok(ended.window.recorder.abandon({ confirmed: true }));
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.strictEqual((await (await ended.playtests).list()).length, 0);
});

test('the manager: Developer Mode only; export new, mark exported, re-export, one JSON, import a batch back, conflicts reported, delete and clear', async () => {
	const first = require('../helpers/playtests').firstRecord();
	const p = page({ dev: true });
	const $ = p.window.$;
	const store = await p.playtests;
	await store.add(first);
	const manager = await p.manager;
	manager.open();
	await manager.refresh();
	assert.ok($('.playtests-dialog').hasClass('open'));
	assert.ok(!$('.playtests-open').prop('hidden'));
	const row = $('.playtests-rows tr');
	assert.strictEqual(row.length, 1);
	assert.deepStrictEqual(plain(row.find('td').map(function () { return $(this).text(); }).get().slice(1, 8)),
		['2026-10-10', 'Jack', 'Detective AI v3', 'normal', 'Jack escaped (player won)', 'g91d4014f17ae09e6', 'No']);
	assert.match($('.playtests-dialog').text(), /does not upload|not\s+upload/);
	assert.strictEqual($('.playtests-export-new').text(), 'Export new playtests (1)');
	// Export new: one ZIP, then the record is marked exported and nothing is new
	$('.playtests-export-new').click();
	await until(() => p.saved.length === 1 && $('.playtests-export-new').prop('disabled'));
	assert.strictEqual(p.saved[0].name, 'whitechapel-playtests-20261010-2100.zip');
	assert.match($('.playtests-status').text(), /Nothing has been uploaded/);
	assert.strictEqual((await store.get(first.game.id)).exportedAt, '2026-10-10T21:00:00.000Z');
	assert.strictEqual($('.playtests-rows tr td').eq(7).text(), '2026-10-10');
	// Re-export everything, or a selection
	$('.playtests-export-all').click();
	await until(() => p.saved.length === 2);
	$('.playtests-select').prop('checked', true).trigger('change');
	assert.strictEqual($('.playtests-export-selected').text(), 'Export selected (1)');
	$('.playtests-export-selected').click();
	await until(() => p.saved.length === 3);
	assert.strictEqual((await store.get(first.game.id)).exportCount, 3);
	// One record as JSON: named after its game id, the record itself
	$('.playtests-download').click();
	assert.strictEqual(p.saved[3].name, first.game.id + '.json');
	assert.strictEqual(JSON.stringify(JSON.parse(p.saved[3].data)), JSON.stringify(first));
	// The batch restores into another browser; importing it again adds nothing
	const other = page({ dev: true });
	const otherManager = await other.manager;
	await otherManager.importFiles([fileLike('batch.zip', p.saved[0].data)]);
	assert.match(other.window.$('.playtests-status').text(), /Imported 1 new game/);
	await otherManager.importFiles([fileLike('batch.zip', p.saved[0].data), fileLike('again.json', new TextEncoder().encode(p.saved[3].data))]);
	assert.match(other.window.$('.playtests-status').text(), /Imported 0 new games\. 2 already here/);
	assert.strictEqual((await (await other.playtests).list()).length, 1);
	// A different record with the same id is reported, not imported
	const clash = require('../helpers/playtests').humanJackRecord(51);
	clash.game.id = first.game.id;
	await otherManager.importFiles([fileLike('clash.json', new TextEncoder().encode(JSON.stringify(clash)))]);
	assert.match(other.window.$('.playtests-status').text(), /Conflicts, not imported.*g91d4014f17ae09e6/);
	await otherManager.importFiles([fileLike('junk.zip', new Uint8Array([1, 2, 3]))]);
	assert.match(other.window.$('.playtests-status').text(), /Not imported: junk\.zip/);
	// Delete one, and clear all only after confirming
	p.window.confirm = () => true;
	$('.playtests-delete').click();
	await until(() => $('.playtests-rows tr').length === 0);
	await store.add(first);
	await manager.refresh();
	assert.ok($('.playtests-clear').prop('disabled'));
	$('.playtests-clear-confirm').prop('checked', true).trigger('change');
	$('.playtests-clear').click();
	await until(() => $('.playtests-empty').prop('hidden') === false);
	assert.strictEqual((await store.list()).length, 0);
	assert.deepStrictEqual(p.window.errors, []);
});

test('outside Developer Mode the manager is hidden; without storage, games still play and the manager explains', async () => {
	const p = page({ dev: false });
	assert.ok(p.window.$('.playtests-open').prop('hidden'));
	const noStorage = page({ browser: null, search: '?role=jack&detectives=easy' });
	const $ = noStorage.window.$;
	const manager = await noStorage.manager;
	manager.open();
	await manager.refresh();
	assert.match($('.playtests-status').text(), /not available/);
	assert.ok($('.playtests-export-new').prop('disabled') && $('.playtests-import').prop('disabled'));
	$('.start-game').click();
	await playJack(noStorage.window, { seed: 6 });
	await until(() => noStorage.results.length === 1);
	assert.strictEqual(noStorage.results[0].status, 'failed');
	assert.match($('.playtest-saved').text(), /could not be kept/);
	assert.deepStrictEqual(noStorage.window.errors, []);
	assert.ok(zlib, 'zlib available for inflating');
});
