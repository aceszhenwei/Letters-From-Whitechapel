/* Random: the biased random choices Jack's AI uses.
   Every call reads Math.random when it runs, so tests can replace Math.random with a seeded generator. */
var WC = WC || {};

WC.random = (function () {

	function float(highest) {
		return Math.random() * highest;
	}

	function log() {
		var value = Math.log(Math.random() * 22026.4657948066);
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

	return { float: float, log: log, int: int, safe: safe, safeIndex: safeIndex };
})();
