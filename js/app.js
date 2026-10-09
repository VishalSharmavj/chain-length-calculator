/** DOM wiring. The only file here that knows a browser exists. */
import {
	derailleurChain, singleSpeedChain, isMagicGear,
	mmToInches, PITCH
} from './chain.js';

const $ = (id) => document.getElementById(id);
const num = (id) => parseFloat($(id).value);
let mode = 'derailleur';

const DERAILLEUR_STEPS = [
	'Shift onto the largest chainring and the largest sprocket, without running the chain through the derailleur.',
	'Pull the two ends together until they just meet, with no slack.',
	'Add the slack for the cage, then join the chain there.',
	'Shift through every gear. The cage should never go slack on small-small, nor bind on big-big.'
];

const SINGLE_STEPS = [
	'Fit the chain at the link count below and sit the axle in the middle of the dropout range.',
	'Pull the wheel back until the chain is just taut, then slacken a touch.',
	'Check the tension at several crank positions — sprockets are never perfectly round, and the tight spot is what matters.',
	'Aim for about 10 mm of up-and-down play at the midpoint of the top run.'
];

function validate(stay, front, rear) {
	const p = [];
	if (!(stay > 0)) p.push('Enter the chainstay length.');
	else if (stay < 250 || stay > 800) p.push(`A chainstay of ${stay} mm is outside what bikes are built with (roughly 380–500 mm). Measure bottom bracket centre to rear axle centre.`);
	if (!(front > 2)) p.push('Enter the chainring size.');
	if (!(rear > 2)) p.push('Enter the sprocket size.');
	if (mode === 'single' && rear > front) p.push('On a single speed the sprocket is normally smaller than the chainring. Check you have not swapped them.');
	return p;
}

function render() {
	const stayMm = num('stay'), front = num('front'), rear = num('rear');
	const problems = validate(stayMm, front, rear);

	$('problems').hidden = problems.length === 0;
	$('problems').innerHTML = problems.map((p) => `<li>${esc(p)}</li>`).join('');

	$('steps').innerHTML = (mode === 'derailleur' ? DERAILLEUR_STEPS : SINGLE_STEPS)
		.map((s) => `<li>${s}</li>`).join('');

	if (problems.length) { blank(); return; }

	const stayIn = mmToInches(stayMm);
	const halfLink = $('halflink').checked;

	if (mode === 'derailleur') {
		const r = derailleurChain({
			chainstayInches: stayIn, frontTeeth: front, rearTeeth: rear,
			halfLink, fullSuspension: $('fullsus').checked,
			newChainLinks: num('newchain') || 0
		});

		show('links', r.links, 'links');
		$('links-sub').innerHTML = `<b>${r.inches.toFixed(1)} in</b> — the equation gives ${r.raw.toFixed(1)}, rounded up to a whole pair`;
		$('links-meta').innerHTML = [
			`<li>${r.rivets} rivets of slack</li>`,
			`<li>bare wrap ${r.bareInches.toFixed(1)} in</li>`
		].join('');

		$('card-remove').hidden = r.removeLinks === null;
		if (r.removeLinks !== null) {
			show('remove', r.removeLinks, 'links');
			$('remove-sub').textContent = r.removeLinks >= 0
				? `from a ${num('newchain')}-link chain`
				: `that chain is ${Math.abs(r.removeLinks)} links too short`;
		}
		$('options').hidden = true;
		$('magic').hidden = true;
		$('warnings').hidden = true;
	} else {
		const r = singleSpeedChain({ chainstayInches: stayIn, frontTeeth: front, rearTeeth: rear, halfLink });
		if (!r) { blank(); return; }

		show('links', r.best.links, 'links');
		$('links-sub').innerHTML = `the exact loop wants <b>${r.exactLinks.toFixed(2)}</b>, and a chain only comes in whole ones`;
		$('links-meta').innerHTML = `<li>${(r.best.links * PITCH).toFixed(1)} in</li>`;
		$('card-remove').hidden = true;

		$('options').hidden = false;
		$('options').innerHTML = r.options.map((o) => {
			const dir = o.deltaMm >= 0 ? 'back' : 'forward';
			return `<li class="${o === r.best ? 'is-best' : ''}"><b>${o.links} links</b>`
				+ `<span>axle ${Math.abs(o.deltaMm).toFixed(1)} mm ${dir}</span>`
				+ `<span>chainstay ${(o.neededInches * 25.4).toFixed(1)} mm</span></li>`;
		}).join('');

		const magic = isMagicGear(r);
		$('magic').hidden = false;
		$('magic').style.background = magic ? '' : 'var(--warn-bg)';
		$('magic').style.color = magic ? '' : 'var(--warn)';
		$('magic').innerHTML = magic
			? `Magic gear — ${r.best.links} links lands within ${Math.abs(r.best.deltaMm).toFixed(1)} mm, which horizontal dropouts will absorb.`
			: `Nearest whole link needs the axle ${Math.abs(r.best.deltaMm).toFixed(1)} mm from where you measured. That is more than most dropouts give — change a sprocket by a tooth, or fit a tensioner.`;
		$('warnings').hidden = true;
	}
}

function show(id, v, _unit) {
	$(id).textContent = v;
	$(`card-${id === 'links' ? 'links' : 'remove'}`).classList.remove('is-empty');
}

function blank() {
	for (const id of ['links', 'remove']) {
		$(id).textContent = '—';
		$(`card-${id}`).classList.add('is-empty');
	}
	$('links-sub').textContent = ''; $('links-meta').innerHTML = '';
	$('remove-sub').textContent = '';
	$('options').hidden = true;
	$('magic').hidden = true;
	$('warnings').hidden = true;
}

function setMode(next) {
	mode = next;
	for (const b of document.querySelectorAll('#modes button')) {
		b.setAttribute('aria-pressed', b.dataset.mode === next ? 'true' : 'false');
	}
	const single = next === 'single';
	$('lab-front').innerHTML = single ? 'Chainring <small>teeth</small>' : 'Largest chainring <small>teeth</small>';
	$('lab-rear').innerHTML = single ? 'Sprocket <small>teeth</small>' : 'Largest sprocket <small>teeth</small>';
	$('row-new').hidden = single;
	$('row-susp').hidden = single;
	$('card-remove').hidden = single;
	if (single && num('rear') > num('front')) { $('front').value = 46; $('rear').value = 16; }
	if (!single && num('rear') < 20) { $('front').value = 34; $('rear').value = 52; }
	render();
}

function esc(s) {
	return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

for (const b of document.querySelectorAll('#modes button')) {
	b.addEventListener('click', () => setMode(b.dataset.mode));
}
$('form').addEventListener('input', render);
$('form').addEventListener('change', render);
$('form').addEventListener('submit', (e) => e.preventDefault());
setMode('derailleur');
