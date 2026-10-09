# Chain Length Calculator

How many links your chain needs, and how many to take out of a new one.

Derailleur bikes and single speed are genuinely different problems, so they get
different maths.

No dependencies, no build step, no framework.

**[Try the full version on Bikeshala →](https://bikeshala.com/tools/chain-length-calculator/)**

```
Derailleur · 430 mm chainstay · 34T ring · 52T sprocket

114 links          Remove 12
56.4 in            from a 126-link chain
4 rivets of slack
```

---

## Run it

```bash
git clone https://github.com/VishalSharmavj/chain-length-calculator.git
cd chain-length-calculator
python3 -m http.server 8000     # or: npm start
```

```bash
npm test        # 17 tests, no dependencies
```

---

## Use the maths on its own

```js
import { derailleurChain, singleSpeedChain, mmToInches } from './js/chain.js';

derailleurChain({
  chainstayInches: mmToInches(430), frontTeeth: 34, rearTeeth: 52,
  newChainLinks: 126
});
// { links: 114, inches: 56.4, rivets: 4, removeLinks: 12, bareInches: 55.5 }

singleSpeedChain({ chainstayInches: mmToInches(405), frontTeeth: 46, rearTeeth: 16 });
// exactLinks: 95.56
// options: [ { links: 94, deltaMm: -10.0 }, { links: 96, deltaMm: +2.8 } ]
```

---

## How it works

### Derailleur: an approximation is fine, and that is the point

A derailleur has a spring-loaded cage whose entire job is to swallow slack. So
the industry uses one equation — Sheldon Brown's, the same one in Park Tool's
manual:

```
L = 2C + F/4 + R/4 + 1        (inches)
```

`C` is the chainstay, `F` the largest chainring, `R` the largest sprocket. The
**+1** is slack for the cage.

That constant is not arbitrary, and the code checks it: compared against the
exact loop geometry below, the equation sits **0.7–1.2 inches** above a bare
big-big wrap, which is the allowance Park Tool tells you to add by hand. There
is a test on that range.

**It always rounds up.** A chain one link long is a minor annoyance. One link
short will not reach around big-big, and finding that out by shifting into it
can wreck a derailleur.

### Rivets: why full suspension needs *fewer*

```js
let rivets = rearTeeth >= 40 ? 4 : 2;
if (fullSuspension) rivets = 2;
```

Two rivets of slack for a cassette up to 36T, four once you are on a big 1x
cassette. SRAM's Eagle instructions say the same.

The exception looks backwards until you see why. A full suspension chainstay is
measured **with the shock bottomed out** — at the point where the chain is
stretched furthest. The extra length compression demands is therefore already
in your measurement, and adding four rivets on top would count it twice.

### Single speed: approximation is not an answer

Nothing takes up slack, so the loop has to be solved exactly:

```
r     = pitch / (2 sin(π/N))                      pitch radius
θ     = asin((r₁ − r₂) / C)                       angle of the straight runs
L     = 2C cos θ + r₁(π + 2θ) + r₂(π − 2θ)
```

Two straight tangent runs plus the wrap on each sprocket. When the sprockets
are the same size, θ is zero and the whole thing collapses to `2C + π(r₁ + r₂)`
— which is a test, because a general formula that does not reduce to the
obvious case is wrong.

**Pitch radius is not the sprocket's outside diameter.** The rollers sit on the
circumradius of a regular N-gon of side `pitch`. Using the outside diameter
instead puts you a few millimetres out, and a few millimetres is the entire
margin you have.

### Then inverting it, which is the question actually being asked

You cannot buy 95.56 links. So the useful question is the other way round:
**given a whole number of links, where does the axle have to sit?**

```js
centreFor(96, 46, 16)   // the chainstay length 96 links needs
```

There is no closed form, so it bisects. That is safe here precisely because
`loopLength` is strictly increasing in centre distance — which is itself a
test, not an assumption.

The answer decides whether a gear is a **"magic gear"** that lands inside your
dropout adjustment, or one that needs a tensioner:

```
46 × 16 on a 405 mm chainstay:
  94 links → axle 10.0 mm forward
  96 links → axle  2.8 mm back     ← magic gear
```

Horizontal dropouts give roughly 15 mm either way. A vertical-dropout frame
gives none, which is why single speed conversions of modern frames so often
need a tensioner.

---

## Layout

```
index.html         the UI
css/base.css       tokens, layout, inputs
css/calculator.css mode switch, cards, option list, shop steps
js/chain.js        the maths — pure functions, no DOM, no imports
js/app.js          the only file that knows a browser exists
test/chain.test.js 17 tests, node --test
```

---

## Measure the chainstay properly

Centre of the bottom bracket to centre of the rear axle. On full suspension,
**with the shock bottomed out** — see above for why that matters.

Then check it on the bike. The calculator gets you to the right length; the
shop method confirms it:

1. Shift onto the largest ring and largest sprocket, chain not through the
   derailleur.
2. Pull the ends together until they just meet, no slack.
3. Add the cage slack, join there.
4. Shift through everything. The cage should never go slack on small-small, nor
   bind on big-big.

---

## What this version leaves out

The full version on Bikeshala also offers inches or millimetres throughout, a
diagram of the chain path, and bike presets.

**[Chain Length Calculator on Bikeshala →](https://bikeshala.com/tools/chain-length-calculator/)**

---

## Licence

MIT — see [LICENSE](LICENSE).
