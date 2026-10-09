// Screenshots of the page at chosen moments of a seeded game, for documentation and pull requests.
//   NODE_PATH=$(npm root -g) node tools/screenshots/capture.js <output dir> [seed] [width]
// Plays the police through the page's own `game` object (the same engine actions clicks use), choosing simply: the
// first patrol positions, Wretched kept where they are, policemen staying put, searches at the first circle.
// Saves: women.png (Patrolling the streets), women-highlight.png (with Highlight on, where the page has it),
// hunting.png (Hunting the monster, a policeman chosen), moved.png (one policeman moved), undone.png (that move undone,
// where the page can), clues.png (Clues and suspicion), after-escape.png (just after Jack reaches his hideout),
// distances.png (walking distances from the crime scene, where the page has them) and history.png (the first night
// reviewed during the second).
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const out = path.resolve(process.argv[2] || 'screenshots');
const seed = Number(process.argv[3] || 7);
const width = Number(process.argv[4] || 1280);
fs.mkdirSync(out, { recursive: true });

(async () => {
	const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined });
	const page = await browser.newPage({ viewport: { width, height: width < 700 ? 1400 : 900 }, deviceScaleFactor: 1 });
	page.on('pageerror', (e) => console.error('page error:', e.message));
	page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
	await page.addInitScript((s) => {
		let seed = s;
		Math.random = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	}, seed);
	await page.goto('file://' + path.resolve(__dirname, '../../index.html') + '?difficulty=easy&police=you');
	await page.click('.start-game');
	const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') });
	const phase = () => page.evaluate(() => game.state.phase);
	// One police action of the simple strategy, through the engine
	const act = () => page.evaluate(() => {
		const s = game.state;
		const R = WC.rules;
		if (s.phase === 2) {
			const p = R.patrolPositions(s);
			const night = R.policeNight(s);
			const spots = p.required.concat(p.all.filter((c) => !p.required.includes(c)).slice(0, p.others));
			const next = spots.find((c) => !night.start.includes(c) && !night.fake.includes(c));
			game.togglePatrol(next, night.start.length < R.config.police ? 'real' : 'fake');
		} else if (s.phase === 5) {
			const index = s.turn.pending[0];
			game.keepWretched(s.womenMarked[index]);
		} else if (s.phase === 10) {
			const night = R.policeNight(s);
			const index = night.now.findIndex((c, i) => !s.turn.moved.includes(i));
			if (index === -1 && game.finishPoliceMoves) game.finishPoliceMoves();
			else game.movePoliceman(index, night.now[index]);
		} else if (s.phase === 11) {
			const night = R.policeNight(s);
			const index = night.now.findIndex((c, i) => !s.turn.done.includes(i) && (night.search[i].length || night.arrest[i].length));
			if (!s.turn.choice[index]) game.chooseAction(index, night.search[index].length ? 'search' : 'arrest');
			if (s.turn.choice[index] === 'search') game.search(index, night.search[index].find((c) => c !== undefined));
			else game.arrest(index, night.arrest[index][0]);
		} else if (s.phase === 12 && game.beginNextNight) {
			game.beginNextNight();
		}
		return s.phase;
	});
	if (await phase() === 2) {
		await shot('women');
		if (await page.$('.highlight-pieces:not([hidden])')) {
			await page.click('.highlight-pieces');
			await shot('women-highlight');
			await page.click('.highlight-pieces');
		}
	}
	let night = 1;
	let tookHunt = false;
	for (let i = 0; i < 3000 && !(await page.evaluate(() => game.state.over)); i++) {
		const p = await phase();
		if (p === 10 && !tookHunt) {
			// Choose the first policeman, to show his choices
			await page.click('.token-police.selectable >> nth=0');
			await shot('hunting');
			await page.evaluate(() => { const n = WC.rules.policeNight(game.state); const d = WC.rules.policeDestinations(game.state, 0).find((c) => c !== n.now[0]); game.movePoliceman(0, d); });
			await shot('moved');
			if (await page.$('.undo-move:not([disabled])')) {
				await page.click('.undo-move');
				await shot('undone');
			}
			tookHunt = true;
			continue;
		}
		if (p === 11 && !(await page.evaluate(() => window.__clueShot))) {
			await shot('clues');
			await page.evaluate(() => { window.__clueShot = true; });
		}
		const nights = await page.evaluate(() => game.state.jack.length);
		if (nights > night || p === 12) {
			await shot('after-escape');
			await page.screenshot({ path: path.join(out, 'after-escape-full.png'), fullPage: true });
			if (p === 12) {
				await page.click('.map .review-crime:not(.review-earlier) >> nth=0');
				await shot('distances');
				await page.click('.state.the-night-is-over .begin-next-night');
				for (let k = 0; k < 50 && (await phase()) !== 2; k++) await act();
				await page.click('.review-night >> nth=0');
				await shot('history');
			}
			break;
		}
		await act();
	}
	await browser.close();
})();
