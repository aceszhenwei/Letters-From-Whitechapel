// Police for the Detective AI v3 study (docs/detective-study.md). Every variant plays exactly as Detective AI v3 on nights
// 1-3 and changes only on the last night, so it plays the same games as v3 until the last night begins: any difference
// in results is caused by the last night's play.
//   v3                         Detective AI v3 (WC.policeVariants.v3)
//   coordinate, cordon, live   v3 plus Detective AI v2's rejected options on the last night
//   block0, block2             v3 with the hideout-blocking weight off, or doubled, on the last night
//   uniform, conservative      the last night's hideout belief uniform, or hybrid with half v2's weight (w = 0.45)
//   gentle                     the last night's hybrid belief with a slower decline (rho 0.75), the calibration's best fixed
//                              weighting against detouring Jacks
//   oracle-hideout             ORACLE, NOT A POLICY: the last night's hideout belief is Jack's true hideout
//   oracle-position            ORACLE, NOT A POLICY: the last night's belief about where Jack is, is his true circle
//   oracle-both                ORACLE, NOT A POLICY: both
// The oracles use what the police can't know. They measure how much better the police could do with perfect
// information, never a detective that could exist.
const { WC } = require('../detective-inference/lib');
const v3 = WC.policeVariants.v3;
const last = Object.assign({}, v3);

const variants = {
	v3: null,
	coordinate: { coordinate: true },
	cordon: { cordon: true },
	live: { liveHideouts: true },
	block0: { blockWeight: 0 },
	block2: { blockWeight: 2 },
	uniform: { hideoutWeighting: 'uniform' },
	conservative: { hideoutW: 0.45 },
	gentle: { hideoutRho: 0.75 },
	'oracle-hideout': { oracle: 'hideout' },
	'oracle-position': { oracle: 'position' },
	'oracle-both': { oracle: 'both' }
};

module.exports = { v3, last, variants };
