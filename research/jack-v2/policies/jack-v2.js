// Jack AI v2 as the game plays it (js/ai/jack-v2.js), for the study's harness. The research core
// (tools/sim/run-game.js) doesn't load the file, so it is loaded into the same context here.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { core, WC, _ } = require('../../detective-inference/lib');

const file = 'js/ai/jack-v2.js';
if (!WC.createJackV2) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', file), 'utf8'), core, { filename: file });

module.exports = {
	files: [file],
	policies: {
		'jack-v2': (random) => WC.createJackV2(WC.board, WC.deduction, random, _),
		// Its ablation: the strategic Jack is jack-v2 with no detours; Detour Jack is jack-v2 with them on the last night too
		'jack-v2-all-nights': (random) => WC.createJackV2(WC.board, WC.deduction, random, _, { detourLastNight: true })
	}
};
