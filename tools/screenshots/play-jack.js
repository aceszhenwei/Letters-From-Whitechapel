// Plays a whole game as Jack in Chromium, by real clicks (desktop, 1280 x 900) or real taps (an emulated iPhone 13),
// against the computer's detectives, saving screenshots of each kind of decision. The playtest of Playing Jack
// (docs/playing-jack.md#7-tests-and-playtesting).
//   NODE_PATH=$(npm root -g) node tools/screenshots/play-jack.js <output dir> [easy|normal] [seed] [mobile: 0|1]
// The player is simple and cautious: a random hideout and women, sometimes waiting, heading home most of the time, one
// coach on the way. Math.random is seeded (the detectives' AIs have their own seeded source in Jack's role). Prints
// the result and any page errors as JSON.
const path = require('path'); const fs = require('fs');
const { chromium, devices } = require('playwright');
const [out, level = 'normal', seedArg = '3', mobileArg = '0'] = process.argv.slice(2);
const seed = Number(seedArg); const mobile = mobileArg === '1'; const K = mobile ? '.jack-board-actions ' : '.state.jack-turn ';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => { let seed = s; Math.random = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, seed);
  await page.goto('file://' + path.resolve(__dirname, '../../index.html'));
  const shots = new Set();
  const shot = async (name) => { if (shots.has(name)) return; shots.add(name); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: !mobile }); };
  const tap = async (selector) => { if (mobile && selector.startsWith('.jack-board-actions')) await page.waitForSelector(selector + ':not([disabled])', { timeout: 5000 }).catch(() => {}); const l = page.locator(selector).first(); await l.scrollIntoViewIfNeeded(); if (mobile) await l.tap(); else await l.click(); };
  await page.click('input[name=role][value=jack]');
  await page.click(`input[name=difficulty][value=${level}]`);
  await shot('01-setup');
  await tap('.start-game');
  let r = seed * 99991 % 2147483647; const rnd = () => (r = r * 48271 % 2147483647) / 2147483647;
  const mark = async (sel, idx) => page.evaluate(([sel, idx]) => { document.querySelectorAll('.pw').forEach(e => e.classList.remove('pw')); const els = document.querySelectorAll(sel); if (!els.length) return false; els[idx % els.length].classList.add('pw'); return true; }, [sel, idx]);
  let moves = 0; let coachShot = false;
  const t0 = Date.now(); while (Date.now() - t0 < 600000) {
    const st = await page.evaluate(() => ({ over: game.state.over, d: game.jackTurn(), phase: game.state.phase, night: game.state.jack.length }));
    if (st.over) break;
    if (!st.d) {
      if (st.phase === 10 || st.phase === 11) await shot('06-detectives-turn');
      await page.waitForTimeout(150); continue;
    }
    // wait for the prompt to be drawn
    await page.waitForSelector('.state.jack-turn:visible .jack-confirm', { timeout: 10000 });
    if (st.d === 'hideout') {
      await mark('.map .jv-hideout-choice', Math.floor(rnd() * 999)); await tap('.pw'); await shot('02-hideout'); await tap(mobile ? '.jack-board-actions .jack-confirm' : '.state.jack-turn .jack-confirm');
    } else if (st.d === 'women') {
      for (let k = 0; k < 30; k++) { if (!(await page.locator('.state.jack-turn .jack-confirm').isDisabled())) break; await mark('.map .jv-woman-choice.jv-empty', Math.floor(rnd() * 99)); await tap('.pw'); }
      await shot('03-women-night' + st.night); await tap(mobile ? '.jack-board-actions .jack-confirm' : '.state.jack-turn .jack-confirm');
    } else if (st.d === 'murder') {
      if (!(await page.locator('.state.jack-turn .jack-wait').isDisabled()) && rnd() < 0.35) { await shot('04-kill-or-wait'); await tap(mobile ? '.jack-board-actions .jack-wait' : '.state.jack-turn .jack-wait'); continue; }
      for (let k = 0; k < 4; k++) { if (!(await page.locator('.state.jack-turn .jack-confirm').isDisabled())) break; const ok = await mark('.map .jv-victim-choice:not(.jv-picked)', Math.floor(rnd() * 99)); await tap('.pw'); }
      await shot('04-kill-night' + st.night); await tap(mobile ? '.jack-board-actions .jack-confirm' : '.state.jack-turn .jack-confirm');
    } else if (st.d === 'reveal') {
      await mark('.map .jv-reveal-choice', Math.floor(rnd() * 99)); await tap('.pw'); await shot('05-reveal'); await tap(mobile ? '.jack-board-actions .jack-confirm' : '.state.jack-turn .jack-confirm');
    } else if (st.d === 'move') {
      moves++;
      const home = await page.locator('.map .jv-dest-home.jv-dest-walk').count();
      if (home) { await tap('.map .jv-dest-home.jv-dest-walk'); await shot('08-walk-home'); }
      else {
        const coachOk = !(await page.locator(K + '.jack-kind-carriage').isDisabled());
        if (coachOk && !coachShot && moves > 2) {
          await tap(K + '.jack-kind-carriage'); coachShot = true;
          await page.evaluate(() => { const b = game.state.base; const d = [...document.querySelectorAll('.map .jv-dest')]; d.sort((x, y) => WC.board.distance(+x.dataset.mapid, b) - WC.board.distance(+y.dataset.mapid, b)); d[0].classList.add('pw'); });
          await tap('.pw');
          if (await page.locator('.map .jv-via').count()) { await shot('07-coach-via'); await tap('.map .jv-via'); }
          await shot('07-coach-confirm');
        } else {
          const walkOk = !(await page.locator(K + '.jack-kind-walk').isDisabled());
          await tap(walkOk ? K + '.jack-kind-walk' : '.jack-kind-alley:not([disabled]), .jack-kind-carriage:not([disabled])');
          await page.evaluate((x) => { const b = game.state.base; const d = [...document.querySelectorAll('.map .jv-dest')]; d.sort((p, q) => WC.board.distance(+p.dataset.mapid, b) - WC.board.distance(+q.dataset.mapid, b)); (x < 0.8 ? d[0] : d[Math.floor(x * 10) % d.length]).classList.add('pw'); }, rnd());
          await tap('.pw');
          if (await page.locator('.map .jv-via').count()) await tap('.map .jv-via');
          if (moves === 1) await shot('06b-move-chosen');
        }
      }
      await tap(mobile ? '.jack-board-actions .jack-confirm' : '.state.jack-turn .jack-confirm');
    }
  }
  await page.waitForSelector('.ending.open', { timeout: 20000 });
  await shot('09-ending');
  const res = await page.evaluate(() => ({ r: game.state.result, n: game.state.jack.length, text: document.querySelector('.game-over').textContent }));
  console.log(JSON.stringify({ level, seed, mobile, res, errors }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
