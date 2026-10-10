/* Difficulty: which of the existing Jack AIs plays, chosen by the player before a game.
   Each level names an AI that already exists and makes it through that AI's own constructor; nothing here plays.
   To add a level, add an entry to `levels` with a `create` that returns an object with the six decision functions
   (see docs/jack-ai.md). `player: true` offers it to every player; the others only in Developer Mode (?dev=1).

   Where the choice comes from, strongest first:
   1. the address: index.html?difficulty=easy|normal|hard|hard-waiting, any level, with or without Developer Mode (for
      testing and research; ?jack=baseline|strategic is kept as an alias);
   2. the choice in the setup dialog when the game starts;
   3. the choice saved from the last game (it pre-selects the dialog), if the dialog offers it;
   4. the default, Normal. */
var WC = WC || {};

WC.difficulty = (function (_) {

	var levels = [
		{
			id: 'easy',
			label: 'Easy',
			ai: 'Baseline Jack',
			player: false,
			description: 'Jack follows simple rules of thumb.',
			create: function (WC) { return WC.jackAI; } // The same object as always, so recorded games replay exactly
		},
		{
			id: 'normal',
			label: 'Normal',
			ai: 'Strategic Jack',
			player: true,
			description: 'Jack weighs the risk of arrest and the time left before every move.',
			create: function (WC) { return WC.createStrategicJack(WC.board, WC.deduction, WC.random, _); }
		},
		{
			id: 'hard',
			label: 'Hard',
			ai: 'Deceptive Jack v2, Jack AI v2',
			player: true,
			description: 'Jack also hides the way to his hideout, so the police find it hard to guess where he lives.',
			create: function (WC) { return WC.createJackV2(WC.board, WC.deduction, WC.random, _); }
		},
		{
			id: 'hard-waiting',
			label: 'Hard, waiting',
			ai: 'Jack AI v2 with strategic waiting, experimental',
			player: false,
			description: 'Jack AI v2, who also waits before killing when the measured escape chances favour it.',
			create: function (WC) { return WC.createWaitingJack(WC.board, WC.createJackV2(WC.board, WC.deduction, WC.random, _), _, { table: 'jack-v2' }); }
		}
	];
	var defaultLevel = 'normal';
	var aliases = { baseline: 'easy', strategic: 'normal' }; // ?jack=... from before difficulty levels

	function level(id) {
		return _.findWhere(levels, { id: id });
	}

	function fromAddress(search) {
		// The level an address asks for, or null
		var match = /[?&]difficulty=([a-z-]+)/.exec(search || '');
		if (match && level(match[1])) {
			return match[1];
		}
		var old = /[?&]jack=([a-z]+)/.exec(search || '');
		return old && aliases[old[1]] ? aliases[old[1]] : null;
	}

	function offered(dev) {
		// The levels the setup dialog shows: Normal and Hard, or every level in Developer Mode
		return _.filter(levels, function (l) { return dev || l.player; });
	}

	function resolve(sources) {
		// sources: { search, chosen, saved, dev }. Returns { id, source: 'address' | 'chosen' | 'saved' | 'default' }.
		// A choice or a saved level the dialog doesn't offer is ignored, so a developer's choice never carries into an
		// ordinary game
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
		// Jack's AI for a level
		var chosen = level(id) || level(defaultLevel);
		return chosen.create(WC);
	}

	return {
		levels: levels,
		offered: offered,
		defaultLevel: defaultLevel,
		level: level,
		fromAddress: fromAddress,
		resolve: resolve,
		create: create
	};
})(_);
