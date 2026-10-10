/* Police levels: who leads the detectives. The player, or one of the computer police (js/ai/police.js), whom the
   player then watches hunt Jack. Each computer level names an existing police configuration; nothing here plays.
   It has the same shape as WC.difficulty (Jack's levels), so the setup dialog handles both the same way.

   Only Developer Mode (index.html?dev=1) shows the choice; otherwise the player leads the detectives, unless the
   address says otherwise. Where the choice comes from, strongest first: the address (index.html?police=you|easy|normal|
   hard, for testing and research, with or without Developer Mode), the choice in the setup dialog, the choice saved
   from the last game in Developer Mode, and the default: the player leads them. */
var WC = WC || {};

WC.policeLevels = (function (_) {

	var levels = [
		{
			id: 'you',
			label: 'You',
			ai: null,
			player: true,
			description: 'You lead the detectives.',
			create: function () { return null; }
		},
		{
			id: 'easy',
			label: 'Easy police',
			ai: 'Original detective AI',
			player: false,
			description: 'Watch the computer police hunt Jack: they chase where he most likely is.',
			create: function (WC) { return WC.createPolice(WC.board, WC.rules, WC.deduction, _); }
		},
		{
			id: 'normal',
			label: 'Normal police',
			ai: 'Detective AI v2',
			player: false,
			description: 'Watch the computer police hunt Jack: they also guard the places he could be making for.',
			create: function (WC) { return WC.createPolice(WC.board, WC.rules, WC.deduction, _, WC.policeVariants.v2); }
		},
		{
			id: 'hard',
			label: 'Hard police',
			ai: 'Detective AI v3',
			player: false,
			description: 'Watch the computer police hunt Jack: they also prepare for his last night, before he strikes.',
			create: function (WC) { return WC.createPolice(WC.board, WC.rules, WC.deduction, _, WC.policeVariants.v3); }
		}
	];
	var defaultLevel = 'you';

	function level(id) {
		return _.findWhere(levels, { id: id });
	}

	function fromAddress(search) {
		var match = /[?&]police=([a-z]+)/.exec(search || '');
		return match && level(match[1]) ? match[1] : null;
	}

	function offered(dev) {
		// Developer Mode offers every level; an ordinary game only the player
		return _.filter(levels, function (l) { return dev || l.player; });
	}

	function resolve(sources) {
		// sources: { search, chosen, saved, dev }. Returns { id, source: 'address' | 'chosen' | 'saved' | 'default' }
		sources = sources || {};
		var address = fromAddress(sources.search);
		if (address) {
			return { id: address, source: 'address' };
		}
		var ok = function (id) { return _.findWhere(offered(sources.dev), { id: id }); };
		if (ok(sources.chosen)) {
			return { id: sources.chosen, source: 'chosen' };
		}
		if (ok(sources.saved)) {
			return { id: sources.saved, source: 'saved' };
		}
		return { id: defaultLevel, source: 'default' };
	}

	function create(WC, id) {
		// The computer police for a level, or null when the player leads the detectives
		return (level(id) || level(defaultLevel)).create(WC);
	}

	return { levels: levels, offered: offered, defaultLevel: defaultLevel, level: level, fromAddress: fromAddress, resolve: resolve, create: create };
})(_);
