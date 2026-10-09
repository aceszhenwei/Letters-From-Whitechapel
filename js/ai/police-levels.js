/* Police levels: who leads the detectives. The player, or one of the computer police (js/ai/police.js), whom the
   player then watches hunt Jack. Each computer level names an existing police configuration; nothing here plays.
   It has the same shape as WC.difficulty (Jack's levels), so the setup dialog handles both the same way.

   Where the choice comes from, strongest first: the address (index.html?police=you|easy|normal, for testing), the
   choice in the setup dialog, the choice saved from the last game, and the default: the player leads them. */
var WC = WC || {};

WC.policeLevels = (function (_) {

	var levels = [
		{
			id: 'you',
			label: 'You',
			ai: null,
			description: 'You lead the detectives.',
			create: function () { return null; }
		},
		{
			id: 'easy',
			label: 'Easy police',
			ai: 'Original detective AI',
			description: 'Watch the computer police hunt Jack: they chase where he most likely is.',
			create: function (WC) { return WC.createPolice(WC.board, WC.rules, WC.deduction, _); }
		},
		{
			id: 'normal',
			label: 'Normal police',
			ai: 'Detective AI v2',
			description: 'Watch the computer police hunt Jack: they also guard the places he could be making for.',
			create: function (WC) { return WC.createPolice(WC.board, WC.rules, WC.deduction, _, WC.policeVariants.v2); }
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

	function resolve(sources) {
		// sources: { search, chosen, saved }. Returns { id, source: 'address' | 'chosen' | 'saved' | 'default' }
		sources = sources || {};
		var address = fromAddress(sources.search);
		if (address) {
			return { id: address, source: 'address' };
		}
		if (level(sources.chosen)) {
			return { id: sources.chosen, source: 'chosen' };
		}
		if (level(sources.saved)) {
			return { id: sources.saved, source: 'saved' };
		}
		return { id: defaultLevel, source: 'default' };
	}

	function create(WC, id) {
		// The computer police for a level, or null when the player leads the detectives
		return (level(id) || level(defaultLevel)).create(WC);
	}

	return { levels: levels, defaultLevel: defaultLevel, level: level, fromAddress: fromAddress, resolve: resolve, create: create };
})(_);
