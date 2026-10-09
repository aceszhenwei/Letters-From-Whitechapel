// Police configurations for the Detective AI v3 study (docs/detective-ai-v3.md): options for WC.createPolice
// (js/ai/police.js). Each candidate adds one lever to Detective AI v2, so they can be compared and ablated.
const { WC } = require('../detective-inference/lib');
const v2 = WC.policeVariants.v2;

const A = { ...v2, contain: 1, containHideouts: 'top', containNeighbours: 0 }; // Defend the likeliest hideout's one-walk kill sites
const B = { ...v2, contain: 1 }; // Every possible hideout by its weight, kill sites and the circles next to them
const C = { ...B, containCoordinate: true }; // B, crediting each policeman only for what the earlier ones leave open

// Screening: the weight of containment against v2's chase and blocking terms (shares of the threat closed)
const screening = {
	'v3-A+patrols': { ...A, containPatrols: true },
	'v3-B+patrols': { ...B, containPatrols: true },
	'v3-C3+patrols': { ...C, contain: 3, containPatrols: true },
	'v3-B3+patrols': { ...B, contain: 3, containPatrols: true },
	// Candidate D: containment only as the night may be ending (by the police's belief), with the patrol choice
	'v3-D': { ...C, contain: 3, containPatrols: true, containTiming: 'ending' },
	'v3-D10': { ...C, contain: 10, containPatrols: true, containTiming: 'ending' },
	'v3-D-night3': { ...C, contain: 3, containEarly: 0, containPatrols: true, containTiming: 'ending' },
	'v3-E': { ...C, contain: 3, containPatrols: true, containTiming: 'concentrated' },
	'v3-E10': { ...C, contain: 10, containPatrols: true, containTiming: 'concentrated' },
	// Night 3 only (preparing the decisive night 4, whose kill sites are then exactly the red circles left)
	'v3-N3': { ...C, contain: 3, containEarly: 0, containPatrols: true },
	'v3-N3x10': { ...C, contain: 10, containEarly: 0, containPatrols: true },
	'v3-N3-ending10': { ...C, contain: 10, containEarly: 0, containPatrols: true, containTiming: 'ending' },
	'v3-N3-ending30': { ...C, contain: 30, containEarly: 0, containPatrols: true, containTiming: 'ending' },
	// ... by the threat's absolute weight, so it fades when no likely hideout is next to a red circle left
	'v3-N3a3': { ...C, contain: 3, containEarly: 0, containPatrols: true, containScale: 'absolute' },
	'v3-N3a10': { ...C, contain: 10, containEarly: 0, containPatrols: true, containScale: 'absolute' },
	'v3-N3a30': { ...C, contain: 30, containEarly: 0, containPatrols: true, containScale: 'absolute' }
};

// Detective AI v3 as selected (docs/detective-ai-v3.md), and its ablations: each removes one component
const V3 = { ...C, contain: 10, containEarly: 0, containPatrols: true, containScale: 'absolute' };
const ablations = {
	'v3-no-coordination': { ...V3, containCoordinate: false },
	'v3-no-patrols': { ...V3, containPatrols: false },
	'v3-no-neighbours': { ...V3, containNeighbours: 0 },
	'v3-top-hideout': { ...V3, containHideouts: 'top' },
	'v3-all-nights': { ...V3, containEarly: 0.5 }
};

module.exports = {
	...screening,
	...ablations,
	// Selected: the candidate chosen by the comparison's rule (coordinated). Without coordination it does better against
	// some short-return Jacks but costs more against Strategic Jack on both seed sets (docs/detective-ai-v3.md)
	v3: V3, // The same as WC.policeVariants.v3 (js/ai/police.js)
	'v3-uncoordinated': { ...V3, containCoordinate: false },
	v2,
	'v3-A': A,
	'v3-B': B,
	'v3-C': C,
	// The Hell-phase levers, alone and with C
	'v3-patrols': { ...v2, containPatrols: true },
	'v3-wretched': { ...v2, containWretched: true },
	'v3-C+patrols': { ...C, containPatrols: true },
	'v3-C+wretched': { ...C, containWretched: true },
	'v3-C+patrols+wretched': { ...C, containPatrols: true, containWretched: true },
	// Diagnostic only: told Jack's true hideout from night `oracle` (reads the referee's state; never a playable police)
	'v2-oracle': { ...v2, oracle: 1 },
	'v3-C-oracle': { ...C, oracle: 1 },
	'v3-C+patrols-oracle': { ...C, containPatrols: true, oracle: 1 },
	// ... told only from night 3: can they get into position for night 4 if they know in time?
	'v2-oracle3': { ...v2, oracle: 3 },
	'v3-C+patrols-oracle3': { ...C, containPatrols: true, oracle: 3 }
};
