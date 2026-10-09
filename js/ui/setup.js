/* The setup dialog: choosing Jack's difficulty and starting the game.
   The choice only decides which Jack AI the engine asks (game.ai, through WC.difficulty); the rules, the police's
   side and what either AI may know are the same at every level. See WC.difficulty for where a choice can come from. */
var WC = WC || {};
WC.ui = WC.ui || {};

WC.ui.setup = function (game, options) {
	options = options || {};
	var search = options.search || '';
	var key = 'whitechapel.difficulty';
	var storage = options.storage !== undefined ? options.storage : (function () {
		try { return window.localStorage; } catch (e) { return null; }
	})();
	var saved = (function () {
		try { return storage ? storage.getItem(key) : null; } catch (e) { return null; }
	})();
	var initial = WC.difficulty.resolve({ search: search, saved: saved });
	var fixed = initial.source == 'address';

	// One option for each level, so a new level needs no change to the page
	var list = $('.difficulty-options').empty();
	_.each(WC.difficulty.levels, function (level) {
		var option = $('<label class="difficulty-option"></label>').append(
			$('<input type="radio" name="difficulty">').val(level.id).prop('checked', level.id == initial.id).prop('disabled', fixed),
			$('<span class="difficulty-label"></span>').text(level.label),
			$('<span class="difficulty-description"></span>').text(level.description + ' (' + level.ai + ')')
		);
		list.append(option);
	});
	$('.difficulty-note').text(fixed ? 'Set by the page address, for testing.' : '').toggle(fixed);

	function chosen() {
		return $('input[name=difficulty]:checked').val();
	}

	$('.start-game').off('click').on('click', function () {
		var level = WC.difficulty.resolve({ search: search, chosen: chosen(), saved: saved });
		game.ai = WC.difficulty.create(WC, level.id);
		if (!fixed) {
			try { if (storage) storage.setItem(key, level.id); } catch (e) { /* Not saved: the choice still applies */ }
		}
		$('.difficulty-badge').text('Jack: ' + WC.difficulty.level(level.id).label).prop('hidden', false);
		$('.intro').removeClass('open');
		game.start();
	});

	return { selected: chosen, initial: initial };
};
