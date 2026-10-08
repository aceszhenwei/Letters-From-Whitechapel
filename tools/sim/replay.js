// Replays one seeded game and prints it move by move, to study a game (docs/jack-ai.md, "Interesting games").
// The same seed always gives the same game, for any Jack: the police's dice depend only on the seed.
//
//   node tools/sim/replay.js <seed> [jack strategy, default strategic] [police, default deductive]
const { loadCore, runGame } = require('./run-game');

const seed = Number(process.argv[2]);
const jack = process.argv[3] || 'strategic';
const police = process.argv[4] || 'deductive';
if (!seed) {
	console.error('Usage: node tools/sim/replay.js <seed> [jack] [police]');
	process.exit(1);
}

const core = loadCore();
const game = runGame(core, { jack, police, seed });
console.log(`seed ${seed}: ${jack} Jack against ${police} police, hideout ${game.hideout}: ${game.result} on night ${game.nights}`);
game.nightDetails.forEach((night, index) => {
	const scenes = game.crimeScenes[index] || [];
	console.log(`\nnight ${index + 1}: crime at ${scenes.join(' and ')} (time of crime ${night.timeOfCrime}), ` +
		`${night.movesAvailable} moves to get home ${night.startDistance} circles away` +
		(night.escaped ? `; home in ${night.moves} moves` : ''));
	game.decisions.filter((d) => d.night === index + 1).forEach((d, i) => {
		console.log(`  ${String(i + 1).padStart(2)}. ${d.type.padEnd(8)} to ${String(d.mapid).padStart(3)}: ` +
			`${d.distance} from home, ${d.remaining} moves left (${d.slack} to spare)` +
			`${d.chosenDanger ? ', in police reach' : ''}${d.forcedDanger ? ' (every option was)' : ''}; ` +
			`police see ${d.candidates} possible circles`);
	});
});
if (game.result === 'arrested') {
	console.log(`\narrested; the police were ${(100 * game.arrestCertainty).toFixed(0)}% sure of his circle`);
}
console.log(`possible hideouts for the police at the end: ${game.hideoutCandidates}`);
