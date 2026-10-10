/* Random: the biased random choices Jack's AI uses.
   WC.random reads Math.random each time, so tests can replace Math.random with a seeded generator.
   WC.random.create(source) makes one that reads another source (a function returning 0 to 1), so an AI
   can have its own random numbers that nothing else in the page draws from. WC.random.seeded(seed) is such a source,
   from a whole-number seed. */
var WC = WC || {};

WC.random = (function () {

	function create(source) {

		function float(highest) {
			return source() * highest;
		}

		function log() {
			var value = Math.log(source() * 22026.4657948066);
			if (value < 0) { // Prevent the very rare occassions when this is negative
				value = 0;
			}
			return value; // A float between 0 and 9.9999999999
		}

		function int(lowest, highest) { // An integer from lowest up to (but not including) highest
			return Math.floor(float(highest - lowest)) + lowest;
		}

		function safe(percentage) { // For example safe(0.5) would be 50% safe
			return float(10) * (1 - percentage) + log() * percentage;
		}

		function safeIndex(percentage, length) {
			// An index into an array of the given length, more likely to be near the start
			var index = Math.floor(Math.abs((safe(percentage) / 10) - 1) * length);
			return Math.max(0, Math.min(index, length - 1));
		}

		return { float: float, log: log, int: int, safe: safe, safeIndex: safeIndex, create: create };
	}

	function seeded(seed) {
		// A source of its own from a whole-number seed (mulberry32), so a recorded seed gives the same numbers again
		var state = seed | 0;
		return function () {
			state = (state + 0x6D2B79F5) | 0;
			var t = Math.imul(state ^ (state >>> 15), 1 | state);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	var random = create(function () { return Math.random(); });
	random.seeded = seeded;
	return random;
})();
