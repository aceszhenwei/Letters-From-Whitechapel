/* The setup dialog: who the player plays, the opponent's difficulty, and starting the game.
   - Playing the detectives (the default): Jack's difficulty decides which Jack AI the engine asks (game.ai, through
     WC.difficulty). In Developer Mode, choosing computer police (WC.policeLevels) hands the police's actions to a
     police AI that the player watches (WC.ui.autoPolice).
   - Playing Jack: the engine waits for the player's decisions (game.settings.humanJack), and the detectives'
     difficulty decides which police AI hunts him (WC.detectiveLevels: Easy is Detective AI v2, Normal Detective AI v3),
     played through WC.ui.autoPolice and shown through WC.ui.jackPlayer.
   No choice changes the rules or what either side may know. Each choice comes from, strongest first: the page address,
   the dialog, the choice saved from the last game, and its default. Each role keeps its own saved difficulty, so
   switching role never carries one role's difficulty into the other.

   An ordinary game offers each role's player levels by name. Developer Mode (index.html?dev=1) also shows the AI each
   level plays, Jack's developer-only levels, and who leads the detectives. Its choices are saved under their own
   keys, so they never carry into an ordinary game. */
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
	var prefix = dev ? 'whitechapel.dev.' : 'whitechapel.';
	var load = function (key) {
		try { return storage ? storage.getItem(prefix + key) : null; } catch (e) { return null; }
	};
	var save = function (key, value) {
		try { if (storage) storage.setItem(prefix + key, value); } catch (e) { /* Not saved: the choice still applies */ }
	};

	function choice(spec) {
		// One group of radio buttons, one for each level, so a new level needs no change to the page
		var saved = load(spec.key);
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
					save(spec.key, level.id);
				}
				return level.id;
			}
		};
	}

	var specs = {
		detectives: { levels: WC.difficulty, name: 'difficulty', key: 'difficulty', list: '.difficulty-options', note: '.difficulty-note:not(.role-note):not(.police-note)', legend: 'Jack\'s difficulty' },
		jack: { levels: WC.detectiveLevels, name: 'difficulty', key: 'detectives', list: '.difficulty-options', note: '.difficulty-note:not(.role-note):not(.police-note)', legend: 'The detectives\' difficulty' }
	};

	// Who the player plays
	var roleInitial = WC.roles.resolve({ search: search, saved: load('role') });
	var roleFixed = roleInitial.source == 'address';
	var roleList = $('.role-options').empty();
	_.each(WC.roles.roles, function (role) {
		roleList.append($('<label class="difficulty-option role-option"></label>').append(
			$('<input type="radio">').attr('name', 'role').val(role.id).prop('checked', role.id == roleInitial.id).prop('disabled', roleFixed),
			$('<span class="difficulty-label"></span>').text(role.label),
			$('<span class="difficulty-description"></span>').text(role.description)
		));
	});
	$('.role-note').text(roleFixed ? 'Set by the page address, for testing.' : '').toggle(roleFixed);

	function selectedRole() {
		return $('input[name=role]:checked').val() || roleInitial.id;
	}

	var level = null; // The difficulty choice for the selected role
	var police = null; // Developer Mode's choice of who leads the detectives, when the player plays them

	function showRole(role) {
		// The difficulties offered depend on the role: each role's own levels, saved choice and default
		level = choice(specs[role]);
		$('.difficulty-legend').text(specs[role].legend);
		$('.intro-detectives').prop('hidden', role != 'detectives');
		$('.intro-jack').prop('hidden', role != 'jack');
		$('.police-choice').prop('hidden', !dev || role != 'detectives'); // Only developers, and only as the detectives
		$('.start-game').text(role == 'jack' ? 'Begin the killing' : 'Begin the investigation');
	}

	police = choice({ levels: WC.policeLevels, name: 'police', key: 'police', list: '.police-options', note: '.police-note' });
	if (!dev) {
		$('.police-options').empty(); // Nothing about the computer police in an ordinary game's page
	}
	showRole(roleInitial.id);
	$('input[name=role]').off('change').on('change', function () {
		showRole(selectedRole());
	});
	var watching = null;

	function startAsDetectives() {
		var jackLevel = level.apply();
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
	}

	function startAsJack() {
		var detectivesLevel = level.apply();
		var info = WC.detectiveLevels.level(detectivesLevel);
		var computer = WC.detectiveLevels.create(WC, detectivesLevel);
		// The engine waits for the player's decisions; there is no Jack AI. The detectives don't wait for clicks, and
		// each night follows the last without the police's review
		game.ai = null;
		game.settings.humanJack = true;
		game.settings.confirmPoliceMoves = false;
		game.settings.reviewNights = false;
		// The detectives' own random numbers (they only break ties), from a seed kept in the game's record
		var seed = options.seed !== undefined ? options.seed : newSeed();
		$('body').addClass('human-jack');
		$('.brand-subtitle').text('London, 1888 · You are Jack the Ripper');
		$('.difficulty-badge').text('Detectives: ' + info.label).prop('hidden', false);
		if (options.recorder) {
			options.recorder.describePlayers({
				jack: { type: 'human' },
				police: { type: 'ai', level: detectivesLevel, ai: info.ai }
			});
			options.recorder.setRandomness({ source: 'seeded', seed: seed, uses: 'the detectives\' tie-breaks' });
		}
		var presenter = WC.ui.jackPlayer.attach(game, { animate: options.jackAnimate });
		$('.intro').removeClass('open');
		watching = WC.ui.autoPolice(game, computer, { delay: options.policeDelay !== undefined ? options.policeDelay : presenter.delay(), random: WC.random.seeded(seed) });
		presenter.pace(watching);
		game.start();
	}

	function newSeed() {
		// A whole number for the detectives' random numbers. Never drawn from Math.random, which Jack's AIs share
		if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
			return crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647;
		}
		return Date.now() % 2147483647;
	}

	$('.start-game').off('click').on('click', function () {
		if ($('.intro').hasClass('started')) {
			return; // Started already: a second click does nothing
		}
		$('.intro').addClass('started');
		var role = WC.roles.resolve({ search: search, chosen: selectedRole() }).id;
		if (!roleFixed) {
			save('role', role);
		}
		if (role == 'jack') {
			startAsJack();
		} else {
			startAsDetectives();
		}
	});

	return {
		selected: function () { return level.selected(); },
		initial: level.initial,
		role: selectedRole,
		police: { selected: police.selected, initial: police.initial },
		dev: dev,
		watching: function () { return watching; }
	};
};
