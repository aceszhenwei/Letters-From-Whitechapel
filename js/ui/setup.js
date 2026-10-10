/* The setup dialog: Jack's difficulty, who leads the detectives, and starting the game.
   Jack's difficulty only decides which Jack AI the engine asks (game.ai, through WC.difficulty). Choosing computer
   police (WC.policeLevels) hands the police's actions to a police AI that the player watches (WC.ui.autoPolice).
   Neither choice changes the rules or what either side may know. Each choice comes from, strongest first: the page
   address, the dialog, the choice saved from the last game, and its default. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.setup = function (game, options) {
	options = options || {};
	var search = options.search || '';
	var storage = options.storage !== undefined ? options.storage : (function () {
		try { return window.localStorage; } catch (e) { return null; }
	})();
	var load = function (key) {
		try { return storage ? storage.getItem(key) : null; } catch (e) { return null; }
	};

	function choice(spec) {
		// One group of radio buttons, one for each level, so a new level needs no change to the page
		var saved = load(spec.key);
		var initial = spec.levels.resolve({ search: search, saved: saved });
		var fixed = initial.source == 'address';
		var list = $(spec.list).empty();
		_.each(spec.levels.levels, function (level) {
			list.append($('<label class="difficulty-option"></label>').append(
				$('<input type="radio">').attr('name', spec.name).val(level.id).prop('checked', level.id == initial.id).prop('disabled', fixed),
				$('<span class="difficulty-label"></span>').text(level.label),
				$('<span class="difficulty-description"></span>').text(level.description + (level.ai ? ' (' + level.ai + ')' : ''))
			));
		});
		$(spec.note).text(fixed ? 'Set by the page address, for testing.' : '').toggle(fixed);
		return {
			initial: initial,
			selected: function () { return $('input[name=' + spec.name + ']:checked').val(); },
			apply: function () {
				var level = spec.levels.resolve({ search: search, chosen: this.selected(), saved: saved });
				if (!fixed) {
					try { if (storage) storage.setItem(spec.key, level.id); } catch (e) { /* Not saved: the choice still applies */ }
				}
				return level.id;
			}
		};
	}

	var jack = choice({ levels: WC.difficulty, name: 'difficulty', key: 'whitechapel.difficulty', list: '.difficulty-options', note: '.difficulty-note' });
	var police = choice({ levels: WC.policeLevels, name: 'police', key: 'whitechapel.police', list: '.police-options', note: '.police-note' });
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
		watching: function () { return watching; }
	};
};
