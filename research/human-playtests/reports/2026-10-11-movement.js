// Exploratory study 2026-10-11: how Human Jack moves, against Strategic Jack and Jack AI v2 (the report is
// 2026-10-11-movement.md). Every measure is taken from full game records, the same way for people and computer:
// each Jack move is replayed with the police positions recorded at that moment, and Detective AI v3's belief is the one
// it had from the police's view (rules.policeView) at that point.
//   node research/human-playtests/reports/2026-10-11-movement.js summary [--games 25]   -> results/movement-summary.json
//   node research/human-playtests/reports/2026-10-11-movement.js figures                -> figures/movement-*.svg
// AI games: Detective AI v3 against Strategic Jack ('normal') and Jack AI v2 ('hard'), played as the coach investigation
// played its control arm (2026-10-11-investigation-coaches.js, playOne with no habit), seeds 612001 on: the same games.
// Read-only: it changes no record and no AI.
const fs = require('fs');
const path = require('path');
const { loadWithAI } = require('../../../tools/game-log/core');
const { playOne } = require('./2026-10-11-investigation-coaches');
const { study } = require('./2026-10-11-investigation-arrests');

const humanGames = ['g91d4014f17ae09e6', 'ga36125530c4b4076']; // The two games the assignment names (the first two collected)
const records = path.join(__dirname, '..', 'records');
const firstSeed = 612001;

const ctx = loadWithAI(() => 0.5);
const W = ctx.WC;
const _ = ctx._;
const B = W.board;
const num = (c) => B.number(c);
const median = (xs) => { const s = xs.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const share = (xs) => (xs.length ? xs.filter(Boolean).length / xs.length : null);

/* Board measures (ignoring the police unless they are given) */
function policeWalks(circle, police) {
	// Walks from Jack's circle to the nearest circle a policeman stands next to (0: a policeman is next to him), as the
	// earlier investigation measured it
	return Math.min(...police.map((c) => Math.min(...B.adjacentNumbers(c).map((n) => B.distance(n, circle)))));
}
function inReach(circle, police) {
	// After the police's next move, could a policeman stand next to this circle (two crossings each)? Then he could be
	// searched or arrested there: the immediate threat
	return police.some((c) => B.crossingsWithinTwo(c).concat([c]).some((x) => B.adjacentNumbers(x).includes(circle)));
}
function fewestSpaces(from, home, coaches, alleys, police = []) {
	// The fewest move-track spaces home with the night's coaches and alleys left: a walk costs 1, an alley 1, a coach 2
	// (two steps, not ending where it began). The night ends only by a walk onto the hideout. With `police`, walks may not
	// pass those crossings (coaches and alleys may), the policemen standing still: where they stand when Jack moves
	const key = (p, c, a) => p + ':' + c + ':' + a;
	const best = { [key(from, coaches, alleys)]: 0 };
	const queue = [[0, from, coaches, alleys]];
	while (queue.length) {
		queue.sort((x, y) => x[0] - y[0]);
		const [d, p, c, a] = queue.shift();
		if (d > best[key(p, c, a)]) continue;
		if (B.walk(p, police).includes(home)) return d + 1;
		const push = (q, cc, aa, cost) => {
			if (q === home) return; // Only a walk onto the hideout ends the night
			const k = key(q, cc, aa);
			if (best[k] === undefined || d + cost < best[k]) { best[k] = d + cost; queue.push([d + cost, q, cc, aa]); }
		};
		B.walk(p, police).forEach((q) => push(q, c, a, 1));
		if (a > 0) B.alleys(p).forEach((q) => push(q, c, a - 1, 1));
		if (c > 0) _.uniq(_.flatten(B.walk(p, []).map((v) => B.walk(v, [])))).filter((q) => q !== p).forEach((q) => push(q, c - 1, a, 2));
	}
	return Infinity;
}

/* One game */
function movement(full, { belief = true } = {}) {
	const home = full.actions.find((a) => a.type === 'hideout').args.mapid;
	const police = W.createPolice(W.board, W.rules, W.deduction, _, W.policeVariants.v3);
	const tokens = W.rules.config;
	const nights = full.nights.map((n, i) => {
		const jack = n.jack;
		const moves = jack.moves || [];
		const scene = jack.murder[jack.murder.length - 1];
		// Police positions at each Jack move, from the record's police actions
		const now = n.police.policeRoutes.map((r) => r[0]);
		const atMove = [];
		const actions = full.actions.map((a, index) => Object.assign({ index }, a)).filter((a) => a.night === i);
		actions.forEach((a) => {
			if (a.type === 'policeman') now[a.args.index] = a.args.to;
			if (a.type === 'move') atMove.push({ police: now.slice(), index: a.index });
		});
		let at = scene;
		let coaches = tokens.carriages[i];
		let alleys = tokens.alleys[i];
		const steps = moves.map((m, k) => {
			const P = atMove[k].police;
			const cost = m.type === 'carriage' ? 2 : 1;
			const before = { walksHome: B.distance(at, home), spaces: fewestSpaces(at, home, coaches, alleys), spacesPolice: fewestSpaces(at, home, coaches, alleys, P), policeWalks: policeWalks(at, P), inReach: inReach(at, P) };
			if (m.type === 'carriage') coaches--;
			if (m.type === 'alley') alleys--;
			const to = m.mapid;
			const after = { walksHome: B.distance(to, home), spaces: to === home ? 0 : fewestSpaces(to, home, coaches, alleys), spacesPolice: to === home ? 0 : fewestSpaces(to, home, coaches, alleys, P), policeWalks: policeWalks(to, P), inReach: inReach(to, P) };
			const step = {
				k: k + 1, type: m.type, from: num(at), via: m.via !== undefined ? num(m.via) : undefined, to: num(to), cost, before, after,
				onFastestRoute: to === home || cost + after.spaces === before.spaces,
				// The same with the policemen where they stood (they move after Jack, so this is the route as it looked then)
				onFastestRoutePolice: to === home || cost + after.spacesPolice === before.spacesPolice,
				walkOptionsInReach: share(B.walk(at, P).filter((q) => q !== home).map((q) => inReach(q, P))) // Could a walk have left reach?
			};
			if (belief) {
				// How many circles v3's deduction allows just before and just after this move, from the police's view. A replay
				// can't stop between the police's last action and Jack's move (the engine asks Jack inside that action), so
				// both come from the state just after the move: its public log with and without the move's entry
				const view = W.rules.policeView(W.record.replay(full, { upto: atMove[k].index + 1 }).game.state);
				const homes = Object.keys(police.belief(view, false).hideouts).map(Number);
				const log = view.publicLog();
				const alleysLeft = view.jackTokens ? view.jackTokens.alleys : 0;
				const count = (l, remaining, a) => { const t = W.deduction.track(l, { remaining, hideouts: homes, alleysLeft: a, trail: true }); return t ? Object.keys(t.current).filter((c) => t.current[c] > 0).length : null; };
				step.possibleAfter = count(log, view.remainingMoves, alleysLeft);
				step.possibleBefore = count(log.slice(0, -1), view.remainingMoves + cost, alleysLeft + (m.type === 'alley' ? 1 : 0));
			}
			at = to;
			return step;
		});
		// Waiting: the waits tonight, and how far the victim the night started from was from home before the police moved her
		const waits = full.actions.filter((a) => a.night === i && a.type === 'wait').length;
		let origin = scene;
		full.actions.filter((a) => a.night === i && a.type === 'wretched').reverse().forEach((a) => { if (a.args.to === origin) origin = a.args.from; });
		const escaped = !!n.police.escaped;
		const used = steps.reduce((s, x) => s + x.cost, 0);
		const startSpaces = fewestSpaces(scene, home, tokens.carriages[i], tokens.alleys[i]);
		return {
			night: i + 1, scene: num(scene), hideout: num(home), escaped, ending: escaped ? 'escaped' : full.outcome.result,
			walksHome: B.distance(scene, home), fewestSpaces: startSpaces, turns: moves.length, spaces: used,
			extraSpaces: escaped ? used - startSpaces : null, extraOverWalk: escaped ? used - B.distance(scene, home) : null,
			waits, victimWalksBefore: waits ? B.distance(origin, home) : null,
			coaches: steps.filter((s) => s.type === 'carriage').length, alleys: steps.filter((s) => s.type === 'alley').length,
			startPolice: atMove.length ? atMove[0].police : n.police.policeRoutes.map((r) => r[0]),
			endPolice: atMove.length ? atMove[atMove.length - 1].police : null,
			steps
		};
	});
	// v3's belief at every clue decision (the earlier investigation's measure), with the kind of Jack's latest move
	const decisions = belief ? study(full.game.id, full).decisions.map((d) => {
		const last = (nights[d.night - 1].steps[d.jackMove - 1] || {}).type || null;
		return { night: d.night, jackMove: d.jackMove, lastMove: last, possible: d.possible, rank: d.rankOfJack, p: d.beliefAtJack, reach: d.reach };
	}) : [];
	return { id: full.game.id, result: full.outcome.winner, nights, decisions };
}

/* Summaries */
function summarise(games) {
	const nights = [].concat(...games.map((g) => g.nights));
	const escaped = nights.filter((n) => n.escaped);
	const steps = [].concat(...nights.map((n) => n.steps.map((s) => Object.assign({ turns: n.turns }, s))));
	const coaches = steps.filter((s) => s.type === 'carriage');
	const threatened = steps.filter((s) => s.before.inReach);
	const d = [].concat(...games.map((g) => g.decisions));
	const inference = (list) => ({
		decisions: list.length,
		medianPossible: median(list.map((x) => x.possible)),
		topTen: share(list.map((x) => x.rank > 0 && x.rank <= 10)),
		medianRankShare: median(list.map((x) => x.rank / x.possible)),
		medianBelief: median(list.map((x) => x.p))
	});
	return {
		games: games.length, jackWins: games.filter((g) => g.result === 'jack').length, nights: nights.length, escapedNights: escaped.length,
		walksHome: median(nights.map((n) => n.walksHome)),
		turns: median(escaped.map((n) => n.turns)), spaces: median(escaped.map((n) => n.spaces)),
		extraSpaces: median(escaped.map((n) => n.extraSpaces)), extraSpacesMean: mean(escaped.map((n) => n.extraSpaces)),
		extraOverWalk: median(escaped.map((n) => n.extraOverWalk)),
		fastestNights: share(escaped.map((n) => n.extraSpaces === 0)),
		movesTowardHome: share(steps.map((s) => s.after.walksHome < s.before.walksHome)),
		movesAwayFromHome: share(steps.map((s) => s.after.walksHome > s.before.walksHome)),
		onFastestRoute: share(steps.map((s) => s.onFastestRoute)),
		onFastestRoutePolice: share(steps.map((s) => s.onFastestRoutePolice)),
		coachesPerNight: [0, 1, 2, 3].map((i) => mean(games.filter((g) => g.nights[i]).map((g) => g.nights[i].coaches))),
		alleysPerNight: [0, 1, 2, 3].map((i) => mean(games.filter((g) => g.nights[i]).map((g) => g.nights[i].alleys))),
		coach: {
			count: coaches.length,
			firstMove: share(coaches.map((s) => s.k === 1)),
			relativeTiming: median(coaches.map((s) => (s.k - 1) / Math.max(1, s.turns - 1))), // 0 = first move, 1 = last
			onFastestRoute: share(coaches.map((s) => s.onFastestRoute)),
			onFastestRoutePolice: share(coaches.map((s) => s.onFastestRoutePolice)),
			// Walks nearer home for its two spaces: 2 is as good as two walks; less spends a space on something else
			walksGained: [2, 1, 0, -1].map((g) => ({ gained: g, share: share(coaches.map((s) => (g === -1 ? s.before.walksHome - s.after.walksHome < 0 : s.before.walksHome - s.after.walksHome === g))) })),
			closerHome: share(coaches.map((s) => s.after.walksHome < s.before.walksHome)),
			fartherFromPolice: share(coaches.map((s) => s.after.policeWalks > s.before.policeWalks)),
			fromThreat: coaches.filter((s) => s.before.inReach).length,
			leftThreat: coaches.filter((s) => s.before.inReach && !s.after.inReach).length,
			possibleGrowth: median(coaches.filter((s) => s.possibleBefore && s.possibleAfter).map((s) => s.possibleAfter / s.possibleBefore))
		},
		walkPossibleGrowth: median(steps.filter((s) => s.type === 'walk' && s.possibleBefore && s.possibleAfter).map((s) => s.possibleAfter / s.possibleBefore)),
		alleyPossibleGrowth: median(steps.filter((s) => s.type === 'alley' && s.possibleBefore && s.possibleAfter).map((s) => s.possibleAfter / s.possibleBefore)),
		police: {
			medianWalks: median(steps.map((s) => s.before.policeWalks)),
			minWalksPerNight: median(nights.filter((n) => n.steps.length).map((n) => Math.min(...n.steps.map((s) => s.before.policeWalks)))),
			inReachShare: share(steps.map((s) => s.before.inReach))
		},
		evasion: {
			threatenedMoves: threatened.length,
			leftReach: share(threatened.map((s) => !s.after.inReach)),
			fartherFromPolice: share(threatened.map((s) => s.after.policeWalks > s.before.policeWalks)),
			couldLeaveByWalk: share(threatened.map((s) => s.walkOptionsInReach !== null && s.walkOptionsInReach < 1)),
			unthreatenedFarther: share(steps.filter((s) => !s.before.inReach).map((s) => s.after.policeWalks > s.before.policeWalks))
		},
		waiting: {
			waitsPerNight: mean(nights.map((n) => n.waits)), nightsWithWait: share(nights.map((n) => n.waits > 0)),
			victimCloser: nights.filter((n) => n.waits > 0 && n.walksHome < n.victimWalksBefore).length,
			victimFarther: nights.filter((n) => n.waits > 0 && n.walksHome > n.victimWalksBefore).length
		},
		inference: inference(d),
		inferenceByNight: [1, 2, 3, 4].map((i) => Object.assign({ night: i }, inference(d.filter((x) => x.night === i)))),
		// Comparable states: the same night stage (Jack's moves so far tonight) and a similar number of possible circles
		inferenceByStage: [[0, 1], [2, 3], [4, 99]].map(([lo, hi]) => Object.assign({ jackMoves: lo + '-' + (hi === 99 ? '' : hi) }, inference(d.filter((x) => x.jackMove >= lo && x.jackMove <= hi)))),
		inferenceBySize: [[1, 20], [21, 50], [51, 100], [101, 999]].map(([lo, hi]) => Object.assign({ possible: lo + '-' + (hi === 999 ? '' : hi) }, inference(d.filter((x) => x.possible >= lo && x.possible <= hi)))),
		inferenceByLastMove: ['walk', 'carriage', 'alley'].map((t) => Object.assign({ lastMove: t }, inference(d.filter((x) => x.lastMove === t)))),
		// The same within one band of possible circles (21-100), so that set size doesn't drive the comparison
		inferenceByLastMoveMidSize: ['walk', 'carriage', 'alley'].map((t) => Object.assign({ lastMove: t }, inference(d.filter((x) => x.lastMove === t && x.possible >= 21 && x.possible <= 100)))),
		// Stratified by the murder's walks from home, where the routes differ most
		byDistance: [[1, 3], [4, 6], [7, 99]].map(([lo, hi]) => {
			const e = escaped.filter((n) => n.walksHome >= lo && n.walksHome <= hi);
			return { walksHome: lo + '-' + (hi === 99 ? '' : hi), nights: e.length, turns: median(e.map((n) => n.turns)), extraSpaces: median(e.map((n) => n.extraSpaces)) };
		})
	};
}

function aiGames(jack, count) {
	return Array.from({ length: count }, (x, i) => movement(playOne(jack, 'none', firstSeed + i)));
}

function summary(count) {
	const human = humanGames.map((id) => movement(require(path.join(records, id + '.json'))));
	const others = fs.readdirSync(records).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).filter((id) => !humanGames.includes(id)).sort()
		.map((id) => movement(require(path.join(records, id + '.json'))));
	const strategic = aiGames('normal', count);
	const v2 = aiGames('hard', count);
	return {
		seeds: `${firstSeed}-${firstSeed + count - 1}`,
		groups: { human: summarise(human), humanLater: summarise(others), strategic: summarise(strategic), v2: summarise(v2) },
		humanGames: human,
		humanLaterIds: others.map((g) => g.id),
		samples: { strategic: strategic.slice(0, 3).map((g) => Object.assign({ seed: firstSeed + strategic.indexOf(g) }, g)), v2: v2.slice(0, 3).map((g) => Object.assign({ seed: firstSeed + v2.indexOf(g) }, g)) }
	};
}

/* Figures: one SVG per game, a panel per night, cropped to the night's route */
const colors = { walk: '#2b2b2b', carriage: '#2a78d6', alley: '#eb6834', police: '#1baf7a', street: '#d9d6cf', surface: '#fcfcfb', text: '#0b0b0b', muted: '#52514e' };

function panel(night, title, x0, y0, size) {
	const ids = [];
	const byNumber = {};
	B.numbered().forEach((m) => { byNumber[num(m)] = m; });
	const scene = byNumber[night.scene];
	const home = byNumber[night.hideout];
	ids.push(scene, home);
	night.steps.forEach((s) => { ids.push(byNumber[s.to]); if (s.via) ids.push(byNumber[s.via]); });
	// Cropped to the route and the hideout; policemen outside the panel are not shown
	const xs = ids.map((m) => B.position(m)[0]);
	const ys = ids.map((m) => B.position(m)[1]);
	const pad = 60;
	let minX = Math.min(...xs) - pad;
	let maxX = Math.max(...xs) + pad;
	let minY = Math.min(...ys) - pad;
	let maxY = Math.max(...ys) + pad;
	const span = Math.max(maxX - minX, maxY - minY, 300);
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	minX = cx - span / 2; maxX = cx + span / 2; minY = cy - span / 2; maxY = cy + span / 2;
	const scale = size / span;
	const P = (m) => [x0 + (B.position(m)[0] - minX) * scale, y0 + 24 + (B.position(m)[1] - minY) * scale];
	const inside = (m) => { const [x, y] = B.position(m); return x >= minX && x <= maxX && y >= minY && y <= maxY; };
	const f = (v) => v.toFixed(1);
	let out = `<g><rect x="${x0}" y="${y0 + 24}" width="${size}" height="${size}" fill="${colors.surface}" stroke="${colors.street}"/>`;
	out += `<text x="${x0}" y="${y0 + 16}" font-size="13" font-weight="600" fill="${colors.text}">${title}</text>`;
	out += `<clipPath id="c${x0}_${y0}"><rect x="${x0}" y="${y0 + 24}" width="${size}" height="${size}"/></clipPath><g clip-path="url(#c${x0}_${y0})">`;
	// Streets and circles
	let d = '';
	for (let a = 0; a < B.size; a++) {
		B.neighbours(a).forEach((c) => {
			if (a < c && (inside(a) || inside(c))) d += `M${P(a).map(f).join(' ')}L${P(c).map(f).join(' ')}`;
		});
	}
	out += `<path d="${d}" stroke="${colors.street}" stroke-width="1.5" fill="none"/>`;
	B.numbered().filter(inside).forEach((m) => { const [x, y] = P(m); out += `<circle cx="${f(x)}" cy="${f(y)}" r="2.5" fill="${colors.street}"/>`; });
	// Police: hollow squares where they stood at Jack's first move, filled where they stood at his last
	const square = (m, filled) => { const [x, y] = P(m); return `<rect x="${f(x - 5)}" y="${f(y - 5)}" width="10" height="10" rx="2" fill="${filled ? colors.police : colors.surface}" stroke="${colors.police}" stroke-width="2"/>`; };
	if (night.startPolice) night.startPolice.forEach((m) => { out += square(m, false); });
	if (night.endPolice && night.steps.length > 1) night.endPolice.forEach((m) => { out += square(m, true); });
	// The route
	let at = scene;
	night.steps.forEach((s) => {
		const to = byNumber[s.to];
		const [x1, y1] = P(at);
		const [x2, y2] = P(to);
		if (s.type === 'carriage') {
			const [xv, yv] = P(byNumber[s.via]);
			out += `<path d="M${f(x1)} ${f(y1)}L${f(xv)} ${f(yv)}L${f(x2)} ${f(y2)}" stroke="${colors.carriage}" stroke-width="4" fill="none" stroke-linejoin="round"/>`;
			out += `<circle cx="${f(xv)}" cy="${f(yv)}" r="4" fill="${colors.surface}" stroke="${colors.carriage}" stroke-width="2"/>`;
		} else {
			out += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${s.type === 'alley' ? colors.alley : colors.walk}" stroke-width="${s.type === 'alley' ? 3 : 2}" ${s.type === 'alley' ? 'stroke-dasharray="6 4"' : ''}/>`;
		}
		const [lx, ly] = s.type === 'carriage' ? P(byNumber[s.via]).map((v, j) => v + (j ? -12 : 12)) : [(x1 + x2) / 2, (y1 + y2) / 2];
		out += `<circle cx="${f(lx)}" cy="${f(ly)}" r="8" fill="${colors.surface}" stroke="${colors.muted}"/><text x="${f(lx)}" y="${f(ly + 4)}" font-size="10" text-anchor="middle" fill="${colors.text}">${s.k}</text>`;
		at = to;
	});
	// Murder and hideout, labelled with their printed numbers
	const [sx, sy] = P(scene);
	out += `<circle cx="${f(sx)}" cy="${f(sy)}" r="8" fill="${colors.surface}" stroke="${colors.text}" stroke-width="2.5"/><text x="${f(sx)}" y="${f(sy + 4)}" font-size="10" font-weight="700" text-anchor="middle" fill="${colors.text}">K</text>`;
	out += `<text x="${f(sx + 11)}" y="${f(sy - 9)}" font-size="11" fill="${colors.text}">${night.scene}</text>`;
	const [hx, hy] = P(home);
	out += `<rect x="${f(hx - 8)}" y="${f(hy - 8)}" width="16" height="16" fill="${colors.text}"/><text x="${f(hx)}" y="${f(hy + 4)}" font-size="10" font-weight="700" text-anchor="middle" fill="${colors.surface}">H</text>`;
	out += `<text x="${f(hx + 11)}" y="${f(hy - 9)}" font-size="11" fill="${colors.text}">${night.hideout}</text>`;
	out += '</g></g>';
	return out;
}

function figure(game, label) {
	const size = 360;
	const gap = 24;
	const width = 2 * size + gap;
	const height = 2 * (size + 24) + gap + 80;
	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Helvetica, Arial, sans-serif">`;
	svg += `<rect width="${width}" height="${height}" fill="${colors.surface}"/>`;
	game.nights.forEach((n, i) => {
		const x = (i % 2) * (size + gap);
		const y = Math.floor(i / 2) * (size + 24 + gap);
		const kinds = n.steps.map((s) => s.type[0]).join('');
		const title = `Night ${n.night}: ${kinds || 'no move'} · ${n.walksHome} walks home · ${n.ending}${n.waits ? ` · ${n.waits} wait${n.waits > 1 ? 's' : ''}` : ''}`;
		svg += panel(n, title, x, y, size);
	});
	const ly = height - 50;
	const key = [
		['line', colors.walk, 'walk'], ['carriage', colors.carriage, 'coach (open dot: its stop)'], ['alley', colors.alley, 'alley'],
		['hollow', colors.police, 'policeman at Jack\'s first move'], ['filled', colors.police, 'at his last move']
	];
	let x = 0;
	key.forEach(([kind, c, text]) => {
		if (kind === 'line') svg += `<line x1="${x}" y1="${ly}" x2="${x + 24}" y2="${ly}" stroke="${c}" stroke-width="2"/>`;
		if (kind === 'carriage') svg += `<line x1="${x}" y1="${ly}" x2="${x + 24}" y2="${ly}" stroke="${c}" stroke-width="4"/>`;
		if (kind === 'alley') svg += `<line x1="${x}" y1="${ly}" x2="${x + 24}" y2="${ly}" stroke="${c}" stroke-width="3" stroke-dasharray="6 4"/>`;
		if (kind === 'hollow' || kind === 'filled') svg += `<rect x="${x + 7}" y="${ly - 5}" width="10" height="10" rx="2" fill="${kind === 'filled' ? c : colors.surface}" stroke="${c}" stroke-width="2"/>`;
		svg += `<text x="${x + 30}" y="${ly + 4}" font-size="12" fill="${colors.muted}">${text}</text>`;
		x += 34 + text.length * 6.2;
	});
	svg += `<text x="0" y="${ly + 24}" font-size="12" fill="${colors.muted}">${label}. K: the crime scene Jack started from; H: his hideout; numbers: move order.</text>`;
	svg += `<text x="0" y="${ly + 40}" font-size="12" fill="${colors.muted}">Titles: c coach, a alley, w walk. Printed circle numbers. Each panel is cropped to the route; policemen outside it are not shown.</text>`;
	return svg + '</svg>';
}

module.exports = { movement, summarise, fewestSpaces, figure };

if (require.main === module) {
	const [command] = process.argv.slice(2);
	const count = process.argv.includes('--games') ? Number(process.argv[process.argv.indexOf('--games') + 1]) : 25;
	const out = path.join(__dirname, 'results');
	if (command === 'summary') {
		const s = summary(count);
		fs.mkdirSync(out, { recursive: true });
		fs.writeFileSync(path.join(out, 'movement-summary.json'), JSON.stringify(s, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(3) : v), 1) + '\n');
		console.log(JSON.stringify(s.groups, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(3) : v), 1));
	} else if (command === 'figures') {
		const dir = path.join(__dirname, 'figures');
		fs.mkdirSync(dir, { recursive: true });
		for (const id of humanGames) {
			fs.writeFileSync(path.join(dir, `movement-${id}.svg`), figure(movement(require(path.join(records, id + '.json')), { belief: false }), `Human Jack, game ${id}`) + '\n');
		}
		for (const [jack, name] of [['normal', 'Strategic Jack'], ['hard', 'Jack AI v2']]) {
			const seed = firstSeed;
			fs.writeFileSync(path.join(dir, `movement-${jack}-${seed}.svg`), figure(movement(playOne(jack, 'none', seed), { belief: false }), `${name} against Detective AI v3, seed ${seed}`) + '\n');
		}
		console.log('Figures in ' + dir);
	} else {
		console.error('Usage: summary [--games 25] | figures');
		process.exitCode = 1;
	}
}
