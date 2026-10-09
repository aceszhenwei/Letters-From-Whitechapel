/* Difficulty: which of the existing Jack AIs plays, chosen by the player before a game.
   Each level names an AI that already exists and makes it through that AI's own constructor; nothing here plays.
   To add a level (say Hard), add an entry to `levels` with a `create` that returns an object with the six decision
   functions (see docs/jack-ai.md).

   Where the choice comes from, strongest first:
   1. the address: index.html?difficulty=easy|normal (for testing; ?jack=baseline|strategic is kept as an alias);
   2. the choice in the setup dialog when the game starts;
   3. the choice saved from the last game (it pre-selects the dialog);
   4. the default, Easy (the AI the game has always used). */
var WC = WC || {};

WC.difficulty = (function (_) {

	var levels = [
		{
			id: 'easy',
			label: 'Easy',
			ai: 'Baseline Jack',
			description: 'Jack follows simple rules of thumb.',
			create: function (WC) { return WC.jackAI; } // The same object as always, so recorded games replay exactly
		},
		{
			id: 'normal',
			label: 'Normal',
			ai: 'Strategic Jack',
			description: 'Jack weighs the risk of arrest and the time left before every move.',
			create: function (WC) { return WC.createStrategicJack(WC.board, WC.deduction, WC.random, _); }
		}
	];
	var defaultLevel = 'easy';
	var aliases = { baseline: 'easy', strategic: 'normal' }; // ?jack=... from before difficulty levels

	function level(id) {
		return _.findWhere(levels, { id: id });
	}

	function fromAddress(search) {
		// The level an address asks for, or null
		var match = /[?&]difficulty=([a-z]+)/.exec(search || '');
		if (match && level(match[1])) {
			return match[1];
		}
		var old = /[?&]jack=([a-z]+)/.exec(search || '');
		return old && aliases[old[1]] ? aliases[old[1]] : null;
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
		// Jack's AI for a level
		var chosen = level(id) || level(defaultLevel);
		return chosen.create(WC);
	}

	return {
		levels: levels,
		defaultLevel: defaultLevel,
		level: level,
		fromAddress: fromAddress,
		resolve: resolve,
		create: create
	};
})(_);
