// Feature probes for the selftest (contract section 10). Each probe throws a ProbeFailure naming what was wrong, or returns a short detail.
// runProbes(ctx) runs them against one built deck in one browser. Probes that only read the deck share one motion-on page and reset it first.
import { ProbeFailure, fail, loadDeck, reset, same, sleep, titleIndex, until } from './probe-kit.mjs';
import { presenter } from './probe-presenter.mjs';

const near = (actual, expected, tol, what) => {
  if (!(Math.abs(actual - expected) <= tol)) fail(`${what}: expected about ${expected}, got ${Math.round(actual)}`);
};

// Expected final text of the counters on the active slide, from the documented data attributes (contract 5.4).
const FINAL_NUMS = `[...document.querySelectorAll('.slide.active .num[data-count]')].map((e) => {
  const d = e.dataset;
  const dec = d.decimals !== undefined ? +d.decimals : (d.count.split('.')[1] || '').length;
  return (d.prefix || '') + new Intl.NumberFormat(Deck.info().lang, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(+d.count) + (d.suffix || '');
})`;
const NUMS_NOW = `[...document.querySelectorAll('.slide.active .num[data-count]')].map((e) => e.textContent)`;

async function map({ main }) {
  const p = await main();
  await reset(p, 1);
  await p.key('m');
  await until(p, `Deck.openMap() === true && !document.getElementById('map').hidden`, { what: 'M to open the map' });
  const items = await p.evaluate(`document.querySelectorAll('#map .map-item').length`);
  same(items, await p.evaluate('Deck.count'), 'map items against slide count');
  await p.key('Escape');
  await until(p, 'Deck.openMap() === false', { what: 'Esc to close the map' });
  await p.key('m');
  await until(p, 'Deck.openMap() === true', { what: 'M to reopen the map' });
  await p.evaluate(`document.querySelectorAll('#map .map-item')[7].click()`);
  await until(p, 'Deck.index === 7 && Deck.openMap() === false', { what: 'a map item click to go to slide 8 and close the map' });
  return `${items} items, Esc closes, click goes to slide 8`;
}

async function hash({ open }) {
  const out = [];
  for (const [h, want] of [['#3', (s) => s.i === 2 && s.s === 0], ['#2.1', (s) => s.i === 1 && s.s === 1], ['#A', (s) => s.i === s.firstBackup && s.s === 0]]) {
    const p = await open({ hash: h });
    try {
      const s = await p.evaluate(`({ i: Deck.index, s: Deck.step, firstBackup: Deck.info().slides.findIndex((x) => x.backup) })`);
      if (s.firstBackup < 0 && h === '#A') fail('the deck has no backup slide to test #A');
      if (!want(s)) fail(`${h} started on slide index ${s.i} step ${s.s}`);
      out.push(`${h} -> ${s.i}.${s.s}`);
    } finally {
      await p.closeTarget();
    }
  }
  return out.join(', ');
}

async function back({ main }) {
  const p = await main();
  const i = await p.evaluate(`Deck.info().slides.findIndex((s, k) => s.steps >= 2 && k + 1 < Deck.count)`);
  if (i < 0) fail('no slide with two or more steps');
  await reset(p, 0);
  await p.evaluate(`Deck.go(${i + 1}, { instant: true })`);
  await until(p, `Deck.index === ${i + 1}`, { what: 'the successor slide' });
  await p.key('ArrowLeft');
  await until(p, `Deck.index === ${i}`, { what: 'prev to reach the previous slide' });
  const s = await p.evaluate(`({ step: Deck.step, steps: Deck.steps(), all: [...document.querySelectorAll('.slide.active [data-step]')].every((e) => e.classList.contains('on')), n: document.querySelectorAll('.slide.active [data-step]').length })`);
  if (s.step !== s.steps) fail(`prev arrived at step ${s.step} instead of ${s.steps}`);
  if (!s.n || !s.all) fail('not every data-step element is on after prev');
  await p.key('ArrowLeft');
  await until(p, `Deck.index === ${i} && Deck.step === ${s.steps - 1}`, { what: 'a second prev to lower the step' });
  return `slide ${i + 1}: prev arrives at step ${s.steps}, next prev lowers it`;
}

async function stepOut({ main }) {
  const p = await main();
  await reset(p, await titleIndex(p, 'Swap in place'));
  const q = (sel) => `(() => { const e = document.querySelector('.slide.active ${sel}'); if (!e) return null; const c = getComputedStyle(e); return { cls: e.className, vis: c.visibility, op: +c.opacity }; })()`;
  const before0 = await p.evaluate(q('[data-step-out]'));
  const after0 = await p.evaluate(q('[data-step]'));
  if (!before0 || !after0) fail('the slide has no [data-step-out] card and [data-step] card');
  if (before0.vis !== 'visible' || /\boff\b/.test(before0.cls)) fail(`at step 0 the Before card is not visible (${before0.cls}, ${before0.vis})`);
  if (after0.vis !== 'hidden' && !(after0.op < 0.05)) fail(`at step 0 the After card is visible (${after0.cls}, ${after0.vis}, opacity ${after0.op})`);
  await p.evaluate('Deck.next()');
  await until(p, `document.querySelector('.slide.active [data-step-out]').classList.contains('off') && document.querySelector('.slide.active [data-step]').classList.contains('on')`, { what: 'Before to get class off and After class on' });
  await until(p, `(() => { const b = getComputedStyle(document.querySelector('.slide.active [data-step-out]')); const a = getComputedStyle(document.querySelector('.slide.active [data-step]')); return (b.visibility === 'hidden' || +b.opacity < 0.05) && a.visibility === 'visible' && +a.opacity > 0.95; })()`, { what: 'Before hidden and After shown after the swap', timeout: 3000 });
  return 'Before shown then hidden, After hidden then shown';
}

async function reducedMotion({ open }) {
  const p = await open({ reduced: true });
  try {
    if (!(await p.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`))) fail('the emulated media did not apply');
    const i = await titleIndex(p, 'By the numbers');
    await p.evaluate(`Deck.go(${i - 1}, { instant: true })`);
    await sleep(100);
    await p.evaluate(`Deck.go(${i})`);
    const now = await p.evaluate(`({ tr: document.getElementById('stage').dataset.tr || null, nums: ${NUMS_NOW}, final: ${FINAL_NUMS} })`);
    if (now.tr) fail(`#stage[data-tr="${now.tr}"] while reduced motion is on`);
    same(now.nums, now.final, 'counter texts right after navigation');
    await sleep(500);
    const running = await p.evaluate(`document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.transitionProperty || a.constructor.name)`);
    if (running.length) fail(`${running.length} animation(s) still running after a settle: ${running.slice(0, 3).join(', ')}`);
    return 'no data-tr, no running animation, counters final at once';
  } finally {
    await p.closeTarget();
  }
}

async function counters({ main }) {
  const p = await main();
  const i = await titleIndex(p, 'By the numbers');
  await reset(p, i - 1);
  await sleep(150);
  await p.evaluate(`Deck.go(${i})`);
  const final = await p.evaluate(FINAL_NUMS);
  const seen = final.map(() => new Set());
  const end = Date.now() + 5000;
  let now = [];
  for (;;) {
    now = await p.evaluate(NUMS_NOW);
    now.forEach((t, k) => seen[k].add(t));
    if (JSON.stringify(now) === JSON.stringify(final) && Date.now() > end - 4200) break;
    if (Date.now() > end) fail(`counters ended at ${JSON.stringify(now)} instead of ${JSON.stringify(final)}`);
    await sleep(40);
  }
  if (!seen.some((s) => s.size >= 2)) fail(`no counter changed over time (saw ${JSON.stringify(seen.map((s) => [...s]))})`);
  return `${final.length} counters changed over time and ended at ${final.join(' ')}`;
}

async function events({ main }) {
  const p = await main();
  await reset(p, 0);
  const i = await p.evaluate(`Deck.info().slides.findIndex((s) => s.steps >= 2)`);
  const got = await p.evaluate(`new Promise((resolve) => {
    const log = [];
    const a = (e) => log.push(['change', e.detail]);
    const b = (e) => log.push(['step', e.detail]);
    document.addEventListener('deck:change', a);
    document.addEventListener('deck:step', b);
    Deck.go(${i}); Deck.next(); Deck.prev(); Deck.go(0);
    setTimeout(() => { document.removeEventListener('deck:change', a); document.removeEventListener('deck:step', b); resolve({ log, tr: Deck.theme.defaultTransition || 'slide' }); }, 150);
  })`, { awaitPromise: true });
  const [c1, s1, s2, c2] = got.log;
  if (!c1 || c1[0] !== 'change') fail(`first event was ${c1 && c1[0]}, expected deck:change`);
  same([c1[1].index, c1[1].from, c1[1].step, c1[1].dir, c1[1].transition], [i, 0, 0, 'fwd', got.tr], 'deck:change detail (index, from, step, dir, transition) going forward');
  if (!s1 || s1[0] !== 'step') fail('no deck:step after next()');
  const steps = await p.evaluate(`Deck.steps(${i})`);
  same([s1[1].index, s1[1].step, s1[1].steps], [i, 1, steps], 'deck:step detail (index, step, steps) after next()');
  same([s2 && s2[1].step], [0], 'deck:step after prev()');
  if (!c2 || c2[0] !== 'change') fail('no deck:change when going back to slide 1');
  same([c2[1].index, c2[1].from, c2[1].dir], [0, i, 'back'], 'deck:change detail going back');
  return `${got.log.length} events with the documented detail`;
}

async function transitions({ main, themeJson }) {
  const p = await main();
  const names = [...new Set([...(themeJson.transitions || []), themeJson.defaultTransition].filter((n) => n && n !== 'none'))];
  same(await p.evaluate('Deck.theme.defaultTransition'), themeJson.defaultTransition, 'registered defaultTransition against theme.json');
  const script = (name) => `(async () => {
    const name = ${JSON.stringify(name)};
    const slides = [...document.querySelectorAll('#stage > .slide')];
    const stage = document.getElementById('stage');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const running = (el) => (el ? el.getAnimations().filter((a) => a.animationName && a.playState === 'running').map((a) => a.animationName) : null);
    const snap = () => ({ tr: stage.dataset.tr || null, dir: stage.dataset.dir || null, entering: running(document.querySelector('.slide.entering')), leaving: running(document.querySelector('.slide.leaving')) });
    const done = async () => { for (let k = 0; k < 60 && stage.dataset.tr; k++) await wait(30); };
    slides.forEach((s) => { s.dataset.transition = name; });
    Deck.go(2, { instant: true }); await done();
    Deck.go(3); await wait(100); const fwd = snap(); await done();
    Deck.go(2); await wait(100); const back = snap(); await done();
    slides.forEach((s) => { delete s.dataset.transition; });
    return { fwd, back };
  })()`;
  for (const name of names) {
    await reset(p, 0);
    const r = await p.evaluate(script(name), { awaitPromise: true });
    for (const [dir, s] of [['fwd', r.fwd], ['back', r.back]]) {
      if (s.tr !== name) fail(`${name} ${dir}: #stage data-tr is ${JSON.stringify(s.tr)} at 100 ms`);
      if (s.dir !== dir) fail(`${name} ${dir}: data-dir is ${JSON.stringify(s.dir)}`);
      if (!s.entering || !s.entering.length) fail(`${name} ${dir}: the entering slide has no running CSS animation`);
      if (!s.leaving || !s.leaving.length) fail(`${name} ${dir}: the leaving slide has no running CSS animation`);
    }
  }
  return `${names.join(', ')}: fwd and back animate both slides`;
}

async function ambient({ main, open }) {
  const SAMPLE = `(() => { const c = document.getElementById('ambient'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261, n = 0; for (let k = 0; k < d.length; k += 4) { if (d[k + 3]) n++; h = Math.imul(h ^ d[k] ^ (d[k + 1] << 8) ^ (d[k + 2] << 16) ^ (d[k + 3] << 24), 16777619); } return h + ':' + n; })()`;
  const still = async (p, what) => {
    await sleep(250);
    const a = await p.evaluate(SAMPLE);
    await sleep(300);
    const b = await p.evaluate(SAMPLE);
    if (a !== b) fail(`${what}: the canvas changed between two samples 300 ms apart`);
  };
  const cap = await open({ query: '?capture=1' });
  try { await still(cap, 'capture mode'); } finally { await cap.closeTarget(); }
  const red = await open({ reduced: true });
  try { await still(red, 'reduced motion'); } finally { await red.closeTarget(); }
  const p = await main();
  await reset(p, 0);
  let alive = false;
  for (let k = 0; k < 4 && !alive; k++) {
    const a = await p.evaluate(SAMPLE);
    await sleep(300);
    alive = a !== (await p.evaluate(SAMPLE));
  }
  if (!alive) fail('with motion allowed the canvas never changed between samples 300 ms apart');
  return 'still in capture and reduced motion, alive with motion';
}

async function morph({ main }) {
  const p = await main();
  const i = await titleIndex(p, 'Morph, before');
  if ((await titleIndex(p, 'Morph, after')) !== i + 1) fail('"Morph, after" does not follow "Morph, before"');
  await reset(p, i);
  const rect = `(() => { const r = document.querySelector('.slide.active [data-morph]').getBoundingClientRect(); return { x: r.left, w: r.width }; })()`;
  const b = await p.evaluate(rect);
  near(b.x, 120, 40, 'morph element x before'); near(b.w, 640, 40, 'morph element width before');
  await p.evaluate('Deck.next()');
  await until(p, `document.getAnimations().some((a) => a.effect && a.effect.pseudoElement === '::view-transition-group(md-m1)')`, { what: 'an animation on ::view-transition-group(md-m1)', timeout: 1500, every: 20 });
  await until(p, `Deck.index === ${i + 1} && !document.getAnimations().some((a) => a.effect && a.effect.pseudoElement && a.playState === 'running')`, { what: 'the morph to finish', timeout: 5000 });
  const a = await p.evaluate(rect);
  near(a.x, 1060, 40, 'morph element x after'); near(a.w, 420, 40, 'morph element width after');
  const named = await p.evaluate(`[...document.querySelectorAll('#stage *')].filter((e) => getComputedStyle(e).viewTransitionName !== 'none').length`);
  if (named) fail(`${named} element(s) keep a view-transition-name afterwards`);
  return `x ${Math.round(b.x)} -> ${Math.round(a.x)}, width ${Math.round(b.w)} -> ${Math.round(a.w)}, pseudo-element animation seen`;
}

async function diagram({ main }) {
  const p = await main();
  const out = [];
  for (const [title, steps] of [['Diagrams', 2], ['Charts', 1]]) {
    const i = await titleIndex(p, title);
    same(await p.evaluate(`Deck.steps(${i})`), steps, `Deck.steps of "${title}"`);
    await p.evaluate(`Deck.go(${i}, { instant: true, step: ${steps} })`);
    await until(p, `Deck.index === ${i} && Deck.step === ${steps}`, { what: `"${title}" at its last step` });
    const n = await until(p, `document.querySelectorAll('.slide.active svg[data-diagram] *:not(script)').length`, { what: `drawn content in "${title}"` });
    out.push(`${title} ${steps} steps, ${n} nodes`);
  }
  return out.join(', ');
}

// feature: the name in the final line of the selftest, when it is one of the contract's list.
export const PROBES = [
  { name: 'map', feature: 'map', run: map },
  { name: 'hash', feature: 'hash', run: hash },
  { name: 'back', feature: 'back', run: back },
  { name: 'step-out', feature: 'step-out', run: stepOut },
  { name: 'reduced-motion', feature: 'reduced-motion', run: reducedMotion },
  { name: 'counters', run: counters },
  { name: 'events', run: events },
  { name: 'transitions', run: transitions },
  { name: 'ambient', run: ambient },
  { name: 'presenter', feature: 'presenter', run: presenter, timeout: 60000 },
  { name: 'morph', feature: 'morph', run: morph },
  { name: 'diagram', run: diagram },
];

// ctx: { client, file, themeJson, onResult(result) }. Returns { results, errors } (errors: uncaught exceptions and console errors of the probe pages).
export async function runProbes({ client, file, themeJson, onResult = () => {} }) {
  const pages = [];
  const open = async (opts) => {
    const page = await loadDeck(client, file, opts);
    pages.push(page);
    return page;
  };
  let shared = null;
  const main = async () => (shared ??= open());
  const results = [];
  for (const probe of PROBES) {
    const t0 = Date.now();
    const result = { name: probe.name, feature: probe.feature, ok: false, detail: '', ms: 0 };
    let timer;
    try {
      const limit = new Promise((_, no) => { timer = setTimeout(() => no(new ProbeFailure(`probe exceeded ${(probe.timeout || 30000) / 1000} s`)), probe.timeout || 30000); });
      result.detail = (await Promise.race([probe.run({ client, file, themeJson, main, open }), limit])) || '';
      result.ok = true;
    } catch (err) {
      result.detail = err.message.split('\n')[0];
      if (!(err instanceof ProbeFailure)) shared = null; // a protocol failure may have broken the shared page
    } finally {
      clearTimeout(timer);
    }
    result.ms = Date.now() - t0;
    results.push(result);
    onResult(result);
  }
  const errors = pages.flatMap((p) => p.errors);
  await Promise.all(pages.map((p) => p.closeTarget()));
  return { results, errors };
}
