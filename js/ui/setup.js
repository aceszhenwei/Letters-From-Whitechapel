/* The setup dialog: Jack's difficulty, who leads the detectives, and starting the game.
   Jack's difficulty only decides which Jack AI the engine asks (game.ai, through WC.difficulty). Choosing computer
   police (WC.policeLevels) hands the police's actions to a police AI that the player watches (WC.ui.autoPolice).
   Neither choice changes the rules or what either side may know. Each choice comes from, strongest first: the page
   address, the dialog, the choice saved from the last game, and its default.

   An ordinary game offers only Jack's player levels (Normal, Hard), by name, and the player leads the detectives.
   Developer Mode (index.html?dev=1) offers every level, with the AI each plays, and who leads the detectives. Its
   choices are saved under their own keys, so they never carry into an ordinary game. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.setup = function (game, options) {
	options = options || {};
	var search = options.search || '';
	var storage = options.storage !== undefined ? options.storage : (function () {
		try { return window.localStorage; } catch (e) { return null; }
	})();
	var dev = /[?&]dev=1(&|$)/.test(search);
	$('body').toggleClass('developer-mode', dev);
	var load = function (key) {
		try { return storage ? storage.getItem(key) : null; } catch (e) { return null; }
	};

	function choice(spec) {
		// One group of radio buttons, one for each level, so a new level needs no change to the page
		var key = (dev ? 'whitechapel.dev.' : 'whitechapel.') + spec.key;
		var saved = load(key);
		var initial = spec.levels.resolve({ search: search, saved: saved, dev: dev });
		var fixed = initial.source == 'address';
		var list = $(spec.list).empty();
		_.each(spec.levels.offered(dev), function (level) {
			var option = $('<label class="difficulty-option"></label>').append(
				$('<input type="radio">').attr('name', spec.name).val(level.id).prop('checked', level.id == initial.id).prop('disabled', fixed),
				$('<span class="difficulty-label"></span>').text(level.label)
			);
			if (dev) { // Only developers are told which AI a level plays
				option.append($('<span class="difficulty-description"></span>').text(level.description + (level.ai ? ' (' + level.ai + ')' : '')));
			}
			list.append(option);
		});
		$(spec.note).text(fixed ? 'Set by the page address, for testing.' : '').toggle(fixed);
		return {
			initial: initial,
			selected: function () { return $('input[name=' + spec.name + ']:checked').val(); },
			apply: function () {
				var level = spec.levels.resolve({ search: search, chosen: this.selected(), saved: saved, dev: dev });
				if (!fixed) {
					try { if (storage) storage.setItem(key, level.id); } catch (e) { /* Not saved: the choice still applies */ }
				}
				return level.id;
			}
		};
	}

	var jack = choice({ levels: WC.difficulty, name: 'difficulty', key: 'difficulty', list: '.difficulty-options', note: '.difficulty-note' });
	var police = choice({ levels: WC.policeLevels, name: 'police', key: 'police', list: '.police-options', note: '.police-note' });
	$('.police-choice').prop('hidden', !dev); // The choice is only shown to developers; the address still applies
	if (!dev) {
		$('.police-options').empty(); // Nothing about the computer police in an ordinary game's page
	}
	var watching = null;

	$('.start-game').off('click').on('click', function () {
		var jackLevel = jack.apply();
		var policeLevel = police.apply();
		game.ai = WC.difficulty.create(WC, jackLevel);
		var computer = WC.policeLevels.create(WC, policeLevel);
		var badge = 'Jack: ' + WC.difficulty.level(jackLevel).label;
		if (computer) {
			game.settings.confirmPoliceMoves = false; // The computer police move and search without waiting for a click
			badge += ' · ' + WC.policeLevels.level(policeLevel).label;
			$('body').addClass('computer-police'); // The board can't be clicked while the computer leads the police
			$('.brand-subtitle').text('London, 1888 · You are watching the police');
		}
		$('.difficulty-badge').text(badge).prop('hidden', false);
		if (options.recorder) {
			// Who played, for the game log: the levels chosen, never anything about the player
			var jackInfo = WC.difficulty.level(jackLevel);
			var policeInfo = WC.policeLevels.level(policeLevel);
			options.recorder.describePlayers({
				jack: { type: 'ai', level: jackLevel, ai: jackInfo.ai },
				police: computer ? { type: 'ai', level: policeLevel, ai: policeInfo.ai } : { type: 'human' }
			});
		}
		$('.intro').removeClass('open');
		game.start();
		if (computer) {
			watching = WC.ui.autoPolice(game, computer, { delay: options.policeDelay });
		}
	});

	return {
		selected: jack.selected,
		initial: jack.initial,
		police: { selected: police.selected, initial: police.initial },
		dev: dev,
		watching: function () { return watching; }
	};
};
