// Police configurations for the waiting-against-containment study (docs/waiting-containment.md): Detective AI v3 and
// single-lever variants of it, as options for WC.createPolice (js/ai/police.js).
const { WC } = require('../detective-inference/lib');
const v3 = WC.policeVariants.v3;

module.exports = {
	original: WC.policeVariants.original,
	v2: WC.policeVariants.v2,
	v3,
	// The existing Wretched lever (left out of v3 after one scenario, against Jacks that never waited)
	'v3-wretched': Object.assign({}, v3, { containWretched: true })
};
