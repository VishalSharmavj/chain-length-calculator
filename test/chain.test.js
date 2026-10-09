import test from 'node:test';
import assert from 'node:assert/strict';
import {
	PITCH, pitchRadius, loopLength, centreFor,
	derailleurChain, singleSpeedChain, isMagicGear, mmToInches
} from '../js/chain.js';

const near = (a, b, tol = 0.01) =>
	assert.ok(Math.abs(a - b) < tol, `expected ${a} to be within ${tol} of ${b}`);

test('pitchRadius: rollers sit on the circumradius of a regular polygon', () => {
	/* Not the sprocket's outside diameter — using that is a common way to be
	   a few millimetres out, which is the entire margin on a single speed. */
	near(pitchRadius(16), PITCH / (2 * Math.sin(Math.PI / 16)));
	near(pitchRadius(16), 1.2814, 0.0005);
	assert.equal(pitchRadius(2), 0);
});

test('loopLength: equal sprockets collapse to 2C + pi(r1+r2)', () => {
	/* With r1 === r2 the straight runs are parallel, theta is 0, and the
	   general formula has to reduce to the obvious one. */
	const c = 16;
	const r = pitchRadius(20);
	near(loopLength(c, 20, 20), 2 * c + Math.PI * 2 * r, 1e-9);
});

test('loopLength: grows with centre distance, strictly', () => {
	/* This is what makes bisection in centreFor() safe. */
	let last = 0;
	for (let c = 10; c <= 25; c += 0.25) {
		const L = loopLength(c, 46, 16);
		assert.ok(L > last);
		last = L;
	}
});

test('loopLength: refuses impossible geometry', () => {
	assert.equal(loopLength(0.1, 60, 9), 0);   // sprockets would overlap
	assert.equal(loopLength(16, 2, 16), 0);
});

test('centreFor: exactly inverts loopLength', () => {
	for (const links of [94, 96, 98, 112]) {
		const c = centreFor(links, 46, 16);
		near(loopLength(c, 46, 16), links * PITCH, 1e-6);
	}
});

test('derailleurChain: the Sheldon Brown equation', () => {
	const r = derailleurChain({
		chainstayInches: mmToInches(430), frontTeeth: 34, rearTeeth: 52
	});
	/* L = 2C + F/4 + R/4 + 1 */
	const c = mmToInches(430);
	near(r.inches, 2 * c + 34 / 4 + 52 / 4 + 1);
	assert.equal(r.links, 114);
	assert.equal(r.links % 2, 0, 'must be an even number of links');
});

test('derailleurChain: always rounds UP', () => {
	/* A chain one link long is an annoyance; one link short will not reach
	   around big-big and can wreck a derailleur. */
	const r = derailleurChain({ chainstayInches: 16.0, frontTeeth: 34, rearTeeth: 52 });
	assert.ok(r.links >= r.raw);
	assert.ok(r.links - r.raw < 2);
});

test('derailleurChain: half link allows an odd count', () => {
	const even = derailleurChain({ chainstayInches: 16.9, frontTeeth: 34, rearTeeth: 52 });
	const odd = derailleurChain({ chainstayInches: 16.9, frontTeeth: 34, rearTeeth: 52, halfLink: true });
	assert.equal(even.links % 2, 0);
	assert.ok(odd.links <= even.links);
});

test('derailleurChain: four rivets on a big cassette, two on a small one', () => {
	const small = derailleurChain({ chainstayInches: 17, frontTeeth: 34, rearTeeth: 34 });
	const big = derailleurChain({ chainstayInches: 17, frontTeeth: 34, rearTeeth: 52 });
	assert.equal(small.rivets, 2);
	assert.equal(big.rivets, 4);
});

test('derailleurChain: full suspension goes back to two rivets', () => {
	/* Counter-intuitive but correct: the chainstay is measured with the shock
	   bottomed out, so the length compression demands is already in the
	   measurement. Adding four would double-count it. */
	const r = derailleurChain({ chainstayInches: 17, frontTeeth: 34, rearTeeth: 52, fullSuspension: true });
	assert.equal(r.rivets, 2);
});

test('derailleurChain: the +1 inch is close to a real cage allowance', () => {
	/* Sanity check on the constant: the equation should sit about an inch
	   above a bare big-big wrap, which is what Park Tool asks you to add. */
	const r = derailleurChain({ chainstayInches: mmToInches(430), frontTeeth: 34, rearTeeth: 52 });
	const slack = r.inches - r.bareInches;
	assert.ok(slack > 0.7 && slack < 1.2, `cage slack was ${slack.toFixed(2)} in`);
});

test('derailleurChain: how many links to remove', () => {
	const r = derailleurChain({
		chainstayInches: mmToInches(430), frontTeeth: 34, rearTeeth: 52, newChainLinks: 126
	});
	assert.equal(r.removeLinks, 12);
	assert.equal(derailleurChain({ chainstayInches: 17, frontTeeth: 34, rearTeeth: 52 }).removeLinks, null);
});

test('singleSpeedChain: brackets the exact answer with whole links', () => {
	const r = singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16 });
	near(r.exactLinks, 95.56, 0.02);
	assert.deepEqual(r.options.map((o) => o.links), [94, 96]);
	/* Fewer links must mean a shorter chainstay. */
	assert.ok(r.options[0].deltaMm < r.options[1].deltaMm);
});

test('singleSpeedChain: each option needs the centre distance it claims', () => {
	const r = singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16 });
	for (const o of r.options) {
		near(loopLength(o.neededInches, 46, 16), o.links * PITCH, 1e-6);
	}
});

test('singleSpeedChain: best is whichever moves the axle least', () => {
	const r = singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16 });
	const smallest = Math.min(...r.options.map((o) => Math.abs(o.deltaMm)));
	near(Math.abs(r.best.deltaMm), smallest, 1e-9);
});

test('isMagicGear: within dropout range or not', () => {
	const good = singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16 });
	assert.equal(isMagicGear(good), true);
	/* Tighten the tolerance to a vertical dropout and almost nothing passes. */
	assert.equal(isMagicGear(good, 1), false);
	assert.equal(isMagicGear(null), false);
});

test('a half link halves the worst case you can be stranded at', () => {
	/* Without one you can be a full link (12.7 mm of chain, ~6 mm of axle)
	   from tensioning; with one, half that. */
	const whole = singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16 });
	const half = singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16, halfLink: true });
	assert.ok(Math.abs(half.best.deltaMm) <= Math.abs(whole.best.deltaMm) + 1e-9);
});
