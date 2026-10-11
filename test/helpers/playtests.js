// Helpers for the playtest tests: the browser modules in a bare context, the first real human game, and synthetic
// records of completed human games (made here, in temporary folders: never added to the research collection).
const vm = require('vm');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadWithAI } = require('../../tools/game-log/core');
const { seededRandom } = require('./game');

const root = path.join(__dirname, '..', '..');
const firstFile = path.join(root, 'research', 'human-playtests', 'records', 'g91d4014f17ae09e6.json');
const firstId = 'g91d4014f17ae09e6';

function loadStore() {
	// The core, the record, the ZIP, the playtest store and its submission queue, as the page loads them, without a page
	const context = vm.createContext({ console, TextEncoder, TextDecoder, Promise, setTimeout, clearTimeout, AbortController });
	for (const f of ['js/vendor/underscore-min.js', 'js/data/map.js', 'js/core/random.js', 'js/core/board.js', 'js/core/rules.js',
		'js/core/engine.js', 'js/core/record.js', 'js/core/deduction.js', 'js/ui/zip.js', 'js/ui/playtest-store.js', 'js/ui/submission.js']) {
		vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context, { filename: f });
	}
	return context.WC;
}

function firstRecord() {
	return JSON.parse(fs.readFileSync(firstFile, 'utf8'));
}

function humanJackRecord(seed, { police = 'random', players } = {}) {
	// A completed game: a person's decisions made at random (as Human Jack), against the given police; its full record
	const core = loadWithAI(seededRandom(seed));
	const WC = core.WC;
	const random = seededRandom(seed + 7);
	const pick = (list) => list[Math.floor(random() * list.length)];
	const game = WC.engine.create({ humanJack: true });
	const recorder = WC.record.attach(game, { players: players || { jack: { type: 'human' }, police: { type: 'ai', level: 'test', ai: 'Random police (test)' } } });
	const ai = police === 'random' ? WC.randomPolice : WC.createPolice(WC.board, WC.rules, WC.deduction, core._, WC.policeVariants.v3);
	game.start();
	for (let i = 0; i < 4000 && !game.state.over; i++) {
		const s = game.state;
		const turn = game.jackTurn();
		if (!turn) { ai.turn(game.policeActions(), WC.rules.policeView(s), random); continue; }
		if (turn === 'hideout') game.jackHideout(pick(WC.rules.hideoutChoices()));
		else if (turn === 'women') {
			const t = WC.rules.targetCircles(s);
			const c = WC.rules.womenTonight(s);
			const m = Math.min(c.marked, t.length);
			game.jackWomen(t.slice(0, m), t.slice(m, Math.min(c.women, t.length)));
		} else if (turn === 'murder') game.jackVictims(s.womenMarked.slice(0, WC.rules.victimsTonight(s)));
		else if (turn === 'reveal') game.jackReveal(WC.rules.hiddenPatrols(s)[0]);
		else if (turn === 'move') {
			const from = WC.rules.jackPosition(s);
			const walks = WC.rules.jackWalks(s, from).slice().sort((a, b) => WC.board.distance(a, s.base) - WC.board.distance(b, s.base));
			if (walks.length) game.jackMove({ type: 'walk', mapid: random() < 0.8 ? walks[0] : pick(walks) });
			else game.jackMove(WC.rules.jackSpecialMoves(s, from)[0]);
		}
	}
	if (!game.state.over) throw new Error('the synthetic game did not end');
	return JSON.parse(JSON.stringify(recorder.exportFull({ date: '2026-10-10' })));
}

function tempCollection(records = []) {
	// A temporary copy of the collection's layout: records/, reports/ and a fresh analysis state
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'playtests-'));
	fs.mkdirSync(path.join(dir, 'records'));
	fs.mkdirSync(path.join(dir, 'reports'));
	const state = JSON.parse(fs.readFileSync(path.join(root, 'research', 'human-playtests', 'analysis-state.json'), 'utf8'));
	Object.assign(state, { reports: [], analysed: {}, snapshot: null });
	fs.writeFileSync(path.join(dir, 'analysis-state.json'), JSON.stringify(state, null, '\t'));
	for (const r of records) {
		const name = r.name || r.record.game.id + '.json';
		fs.writeFileSync(path.join(dir, 'records', name), r.text || JSON.stringify(r.record));
	}
	return dir;
}

module.exports = { loadStore, firstRecord, firstFile, firstId, humanJackRecord, tempCollection, root };
