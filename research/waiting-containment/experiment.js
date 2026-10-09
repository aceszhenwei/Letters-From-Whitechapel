// Seeded games for the waiting-against-containment study (docs/waiting-containment.md), on every core.
//   node research/waiting-containment/experiment.js <jack> <police> <games> <first seed>
// Jacks: research/waiting-containment/jacks.js. Police: research/waiting-containment/configs.js.
// Measured per night by the referee (who may see everything; the players never do):
//   the Wretched when the victims were chosen and where the police moved them, the crime scene and how many steps it
//   was from a red circle, whether it was one walk from Jack's hideout and whether a policeman already blocked that walk
//   when the night began (Detective AI v3's own measure), the weight v3's threat model gave the crime scene (1 for a red
//   circle with a woman on it, containNeighbours for a circle next to one, else 0), the one-walk Wretched left open
//   before and after the police moved them, the moves Jack had and used, and how the night ended.
// Writes results/<jack>__<police>__<first seed>-<games>.json (reused if present) and prints one JSON line.
const fs = require('fs');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
	const lib = require('../detective-inference/lib');
	const { WC, _, seeded } = lib;
	const jacks = require('./jacks');
	const configs = require('./configs');
	const { rules, board } = WC;

	function play(seed) {
		const ai = jacks.create(workerData.jack, seed);
		const options = configs[workerData.police];
		const police = WC.createPolice(board, rules, WC.deduction, _, options);
		const policeRandom = seeded(seed * 104729 + 2);
		const game = WC.engine.create({ ai });
		const nights = [];
		const current = () => nights[game.state.police.length - 1];
		game.on((type, data) => {
			const s = game.state;
			if (type === 'nightStarted') nights.push({ moved: [] });
			if (type === 'phase' && data.phase === 2) current().women = s.womenMarked.concat(s.womenUnmarked);
			if (type === 'timeOfCrime') current().wretched = s.womenMarked.slice(); // The victims are chosen
			if (type === 'wretchedMoved') current().moved.push([data.from, data.to]);
		});
		game.start();
		for (let actions = 0; !game.state.over && actions < 20000; actions++) {
			police.turn(game, rules.policeView(game.state), policeRandom);
		}
		const state = game.state;
		const home = state.base;
		const oneWalk = (site, blocked) => _.contains(board.walk(site, blocked), home);
		const records = state.jack.map((night, i) => {
			const n = nights[i];
			if (!n || night.murder.length === 0) return null;
			const p = state.police[i];
			const scene = _.last(night.murder);
			// Follow the victim back to where she was when the victims were chosen
			let origin = scene;
			let steps = 0;
			for (let k = n.moved.length - 1; k >= 0; k--) {
				if (n.moved[k][1] === origin) { origin = n.moved[k][0]; steps++; }
			}
			const nextToRed = _.uniq(_.flatten(n.women.map((w) => board.walk(w, []))));
			const modelWeight = _.contains(n.women, scene) ? 1 : _.contains(nextToRed, scene) ? (options.containNeighbours !== undefined ? options.containNeighbours : 0.5) : 0;
			const openBefore = n.wretched.filter((w) => oneWalk(w, []) && oneWalk(w, p.start)).length;
			let at = n.wretched.slice();
			n.moved.forEach(([from, to]) => { at = at.map((w) => (w === from ? to : w)); });
			const openAfter = at.filter((w) => oneWalk(w, []) && oneWalk(w, p.start)).length;
			const escaped = !!_.findWhere(p.log || [], { type: 'escaped' });
			return {
				waits: 5 - night.murderMove[0],
				scene, origin, steps,
				red: _.contains(board.redCircles(), scene),
				oneWalk: oneWalk(scene, []),
				closedAtStart: oneWalk(scene, []) && !oneWalk(scene, p.start),
				modelWeight,
				distance: board.distance(scene, home),
				moves: rules.config.trackLength - _.last(night.murderMove),
				used: night.route.length - night.murder.length,
				wretchedBefore: n.wretched, wretchedAtMurder: at,
				oneWalkWretchedBefore: n.wretched.filter((w) => oneWalk(w, [])).length,
				oneWalkWretchedAfter: at.filter((w) => oneWalk(w, [])).length,
				openBefore, openAfter,
				policeStart: p.start.slice(),
				end: escaped ? 'escaped' : (state.result ? state.result.type : 'unfinished'),
				firstMove: escaped && night.moves.length === 1
			};
		});
		return { seed, result: state.result ? state.result.type : 'unfinished', nights: records.filter(Boolean), nightsPlayed: state.jack.length };
	}

	parentPort.postMessage(workerData.seeds.map(play));
} else {
	const [jack, police, games, first] = process.argv.slice(2);
	const seeds = Array.from({ length: Number(games) }, (_, i) => Number(first) + i);
	const dir = path.join(__dirname, 'results');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${jack}__${police}__${first}-${games}.json`);
	const report = (all) => console.log(JSON.stringify({ jack, police, games: all.length, jackWins: all.filter((g) => g.result === 'jackWins').length }));
	if (fs.existsSync(file)) {
		report(JSON.parse(fs.readFileSync(file, 'utf8')).games);
	} else {
		const workers = Math.min(require('os').cpus().length, seeds.length);
		const chunks = Array.from({ length: workers }, (_, w) => seeds.filter((s, i) => i % workers === w));
		Promise.all(chunks.map((chunk) => new Promise((resolve, reject) => {
			const worker = new Worker(__filename, { workerData: { jack, police, seeds: chunk } });
			worker.on('message', resolve);
			worker.on('error', reject);
		}))).then((parts) => {
			const all = [].concat(...parts).sort((a, b) => a.seed - b.seed);
			fs.writeFileSync(file, JSON.stringify({ jack, police, seeds: [seeds[0], seeds[seeds.length - 1]], games: all }));
			report(all);
		});
	}
}
