/**
 * Bicycle chain length.
 *
 * Pure functions. No DOM, no dependencies — the same file runs in a browser,
 * in Node and in the test suite.
 *
 * Two jobs, because they are genuinely different problems:
 *
 * DERAILLEUR bikes have a spring-loaded cage that swallows slack, so an
 * approximate length is fine and the industry uses one equation for it.
 *
 * SINGLE SPEED and FIXED have nothing to take up slack, so "about right" is
 * not an answer. There the loop has to be solved exactly, and then INVERTED:
 * given a whole number of links, where does the axle have to sit?
 *
 * Everything inside is inches, because chain pitch is defined in them.
 */

/** Every bicycle chain ever made. Half an inch per link. */
export const PITCH = 0.5;
export const MM_PER_INCH = 25.4;

/**
 * The radius of the circle the chain's rollers sit on for an N-tooth sprocket.
 *
 * The rollers form a regular N-gon of side `pitch`, so the circumradius is
 *
 *     r = pitch / (2 sin(pi/N))
 *
 * This is not the sprocket's outside diameter, and using that instead is a
 * common way to get single-speed maths wrong by a few millimetres — which is
 * the whole margin you have.
 */
export function pitchRadius(teeth) {
	return teeth > 2 ? PITCH / (2 * Math.sin(Math.PI / teeth)) : 0;
}

/**
 * The exact chain loop: two straight runs plus the wrap on each sprocket.
 *
 *     theta = asin((r1 - r2) / C)
 *     L = 2C cos(theta) + r1(pi + 2theta) + r2(pi - 2theta)
 *
 * `theta` is the angle the straight runs make with the line between the two
 * axles. When the sprockets are the same size it is zero and the formula
 * collapses to the obvious `2C + pi(r1 + r2)`.
 *
 * @param {number} centreInches  axle to axle
 * @param {number} frontTeeth
 * @param {number} rearTeeth
 * @returns {number} chain length in inches, or 0 if the geometry is impossible
 */
export function loopLength(centreInches, frontTeeth, rearTeeth) {
	if (!(centreInches > 0) || !(frontTeeth > 2) || !(rearTeeth > 2)) return 0;
	const r1 = pitchRadius(frontTeeth);
	const r2 = pitchRadius(rearTeeth);
	const s = (r1 - r2) / centreInches;
	if (s >= 1 || s <= -1) return 0;         // sprockets overlap; no loop exists
	const th = Math.asin(s);
	return 2 * centreInches * Math.cos(th)
		+ r1 * (Math.PI + 2 * th)
		+ r2 * (Math.PI - 2 * th);
}

/**
 * Invert loopLength: what centre distance does a whole number of links need?
 *
 * There is no closed form, so this bisects. The function is strictly
 * increasing in centre distance, which is exactly the condition that makes
 * bisection safe and is why no cleverer method is needed.
 *
 * This is the question a single speed build actually asks, and the answer
 * decides whether a gear is a "magic gear" that lands on your dropouts or one
 * that needs a tensioner.
 */
export function centreFor(links, frontTeeth, rearTeeth) {
	const target = links * PITCH;
	let lo = 4, hi = 60;
	for (let i = 0; i < 90; i++) {
		const mid = (lo + hi) / 2;
		if (loopLength(mid, frontTeeth, rearTeeth) < target) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/**
 * Derailleur chain length, by the Sheldon Brown / Park Tool equation.
 *
 *     L = 2C + F/4 + R/4 + 1       (inches)
 *
 * C is the chainstay, F the largest chainring, R the largest sprocket. The +1
 * is slack for the derailleur cage: checked against the exact loop below it
 * lands within about an inch of a bare big-big wrap, which is the allowance
 * Park Tool's shop method tells you to add by hand.
 *
 * @param {object} o
 * @param {number} o.chainstayInches
 * @param {number} o.frontTeeth   largest chainring
 * @param {number} o.rearTeeth    largest sprocket
 * @param {boolean} [o.halfLink]  allow an odd link count
 * @param {boolean} [o.fullSuspension]
 * @param {number} [o.newChainLinks] links in the chain you are about to fit
 */
export function derailleurChain(o) {
	const c = o.chainstayInches;
	const inches = 2 * c + o.frontTeeth / 4 + o.rearTeeth / 4 + 1;
	const raw = inches / PITCH;

	/* A chain joins in whole inner-plus-outer pairs, so the count must be even
	   unless you are fitting a half link. Always round UP: a chain one link
	   long is a minor annoyance, one link short will not go on the big ring. */
	const links = o.halfLink ? Math.ceil(raw) : Math.ceil(raw / 2) * 2;

	/* Park Tool's shop method: two rivets of slack for cassettes up to 36T,
	   four once you are on a big 1x cassette. SRAM's Eagle instructions agree,
	   with one exception — full suspension is measured with the shock bottomed
	   out, so the extra length compression would demand is already in the
	   measurement, and it goes back to two. */
	let rivets = o.rearTeeth >= 40 ? 4 : 2;
	if (o.fullSuspension) rivets = 2;

	return {
		inches,
		links,
		raw,
		/* What a bare big-big wrap would be, with no cage slack at all. */
		bareInches: loopLength(c, o.frontTeeth, o.rearTeeth),
		rivets,
		removeLinks: o.newChainLinks > 0 ? o.newChainLinks - links : null
	};
}

/**
 * Single speed and fixed.
 *
 * Returns the two whole link counts either side of the exact answer, and for
 * each, the chainstay length it would need. Compare those against your
 * dropout adjustment range to see which — if either — will tension.
 */
export function singleSpeedChain(o) {
	const c = o.chainstayInches;
	const exact = loopLength(c, o.frontTeeth, o.rearTeeth) / PITCH;
	if (!(exact > 0)) return null;

	const step = o.halfLink ? 1 : 2;
	const lo = Math.floor(exact / step) * step;
	let hi = Math.ceil(exact / step) * step;
	if (hi === lo) hi = lo + step;

	const options = [lo, hi].map((links) => {
		const needed = centreFor(links, o.frontTeeth, o.rearTeeth);
		return {
			links,
			neededInches: needed,
			/* How far the axle has to move from where you measured. Negative
			   means forward in the dropout. */
			deltaMm: (needed - c) * MM_PER_INCH
		};
	});

	/* The one needing least movement is the one to try first. */
	const best = options.reduce((a, b) => (Math.abs(a.deltaMm) <= Math.abs(b.deltaMm) ? a : b));

	return { exactLinks: exact, options, best };
}

/**
 * Is this a "magic gear" — one that lands close enough to tension without a
 * tensioner? Horizontal dropouts give roughly 15 mm of play either way; a
 * vertical-dropout frame has none.
 */
export function isMagicGear(result, toleranceMm = 15) {
	return result ? Math.abs(result.best.deltaMm) <= toleranceMm : false;
}

export const mmToInches = (mm) => mm / MM_PER_INCH;
export const inchesToMm = (inches) => inches * MM_PER_INCH;
