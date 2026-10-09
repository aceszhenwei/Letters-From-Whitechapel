// Police configurations compared in docs/detective-ai-v2.md: options for WC.createPolice (js/ai/police.js).
// 'original' is the original deductive police; the others switch on parts of Detective AI v2 one at a time.
// The hybrid's parameters come from research/detective-v2/hideout-models.js (fitted on calibration seeds).
// 'v2' is the final policy, as the game plays it (WC.policeVariants.v2 in js/ai/police.js).
const { WC } = require('../detective-inference/lib');
const hybrid = { hideoutWeighting: 'hybrid', hideoutW: 0.9, hideoutRho: 0.5 };
const uniform = { hideoutWeighting: 'uniform' };

module.exports = {
	original: {},
	uniform,
	hybrid,
	block: { blockWeight: 1 },
	'uniform+block': { ...uniform, blockWeight: 1 },
	'hybrid+block': { ...hybrid, blockWeight: 1 },
	'uniform+block+coordinate': { ...uniform, blockWeight: 1, coordinate: true },
	'uniform+block+live': { ...uniform, blockWeight: 1, liveHideouts: true },
	'uniform+block+cordon': { ...uniform, blockWeight: 1, cordon: true },
	'uniform+block+coordinate+live+cordon': { ...uniform, blockWeight: 1, coordinate: true, liveHideouts: true, cordon: true },
	'uniform+block0.5': { ...uniform, blockWeight: 0.5 },
	'uniform+block2': { ...uniform, blockWeight: 2 },
	'uniform+block+arrest0.15': { ...uniform, blockWeight: 1, arrestAt: 0.15 },
	'uniform+block+arrest0.1': { ...uniform, blockWeight: 1, arrestAt: 0.1 },
	// Second round of tuning, on the hybrid
	'hybrid+block0.5': { ...hybrid, blockWeight: 0.5 },
	'hybrid+block2': { ...hybrid, blockWeight: 2 },
	'hybrid+block+arrest0.15': { ...hybrid, blockWeight: 1, arrestAt: 0.15 },
	'hybrid+block+arrest0.1': { ...hybrid, blockWeight: 1, arrestAt: 0.1 },
	'hybrid+block+cordon': { ...hybrid, blockWeight: 1, cordon: true },
	// The final evaluation
	'hybrid+block+coordinate': { ...hybrid, blockWeight: 1, coordinate: true },
	v2: WC.policeVariants.v2
};
