// Feature probes for the live-presenter engine behaviour: ambient pause (contract 5.8) and live keys (contract 6). Registered in probes.mjs.
import { fail, reset, same, sleep, until } from './probe-kit.mjs';

const CANVAS_SAMPLE = `(() => { const c = document.getElementById('ambient'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let k = 0; k < d.length; k += 4) h = Math.imul(h ^ d[k] ^ (d[k + 1] << 8) ^ (d[k + 2] << 16) ^ (d[k + 3] << 24), 16777619); return h; })()`;
const ART_RUNNING = `document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.art')).length`;

// True when the canvas changes between two samples 300 ms apart, tried a few times.
async function moving(p) {
  for (let k = 0; k < 4; k++) {
    const a = await p.evaluate(CANVAS_SAMPLE);
    await sleep(300);
    if (a !== (await p.evaluate(CANVAS_SAMPLE))) return true;
  }
  return false;
}

export async function ambientPause({ main, open }) {
  const p = await main();
  await reset(p, 0);
  if (!(await p.evaluate('Deck.ambient()'))) fail('Deck.ambient() is false at load');
  if (!(await moving(p))) fail('the canvas does not move before the pause');
  const artBefore = await p.evaluate(ART_RUNNING);
  await p.key('.');
  await until(p, 'Deck.ambient() === false && document.documentElement.classList.contains("still")', { what: 'the . key to pause the ambient layer' });
  if (await moving(p)) fail('the canvas still changes after the . key');
  await sleep(150);
  const art = await p.evaluate(ART_RUNNING);
  if (art) fail(`${art} looping art animation(s) still run after the pause`);
  same(await p.evaluate(`document.getElementById('hud-amb').getAttribute('aria-pressed')`), 'false', 'aria-pressed of the HUD toggle while paused');
  await p.evaluate(`document.getElementById('hud-amb').click()`);
  await until(p, 'Deck.ambient() === true && !document.documentElement.classList.contains("still")', { what: 'the HUD toggle to resume the ambient layer' });
  if (!(await moving(p))) fail('the canvas does not move after the resume');
  same(await p.evaluate('Deck.ambient(false)'), false, 'Deck.ambient(false)');
  same(await p.evaluate('Deck.ambient(true)'), true, 'Deck.ambient(true)');
  const off = await open({ query: '?ambient=off' });
  try {
    same(await off.evaluate('Deck.ambient()'), false, 'Deck.ambient() with ?ambient=off');
    if (await moving(off)) fail('the canvas moves with ?ambient=off');
  } finally {
    await off.closeTarget();
  }
  return `key, HUD button, API and ?ambient=off pause the canvas${artBefore ? ` and ${artBefore} looping art animation(s)` : ''}`;
}

export async function liveKeys({ main }) {
  const p = await main();
  await reset(p, 0);
  await p.key('b');
  await until(p, 'Deck.blackout() === true && !document.getElementById("blackout").hidden', { what: 'B to black out' });
  await p.key('ArrowRight');
  same(await p.evaluate('Deck.index'), 0, 'slide index while blacked out (arrows are ignored)');
  await p.key('Escape');
  await until(p, 'Deck.blackout() === false && document.getElementById("blackout").hidden', { what: 'Esc to end the blackout' });
  await p.key('?');
  await until(p, 'Deck.help() === true && !document.getElementById("help").hidden', { what: '? to open the key help' });
  const rows = await p.evaluate('document.querySelectorAll("#help dt").length');
  if (rows < 8) fail(`the key help lists ${rows} keys, expected at least 8`);
  await p.key('Escape');
  await until(p, 'Deck.help() === false', { what: 'Esc to close the key help' });
  await p.key('g'); await p.key('5'); await p.key('Enter');
  await until(p, 'Deck.index === 4', { what: 'G 5 Enter to reach slide 5' });
  await p.key('g'); await p.key('1'); await p.key('2');
  await until(p, 'Deck.index === 11', { what: 'G 1 2 to reach slide 12 after a short pause', timeout: 4000 });
  await p.key('g'); await p.key('Escape');
  await p.key('ArrowLeft');
  await until(p, 'Deck.index === 10', { what: 'ArrowLeft after a cancelled G' });
  const roles = await p.evaluate(`[...document.querySelectorAll('#stage > .slide')].every((s) => s.getAttribute('aria-roledescription') === 'slide')`);
  if (!roles) fail('a slide lacks aria-roledescription="slide"');
  await p.evaluate('Deck.openMap(true)');
  const outline = await p.evaluate(`(() => { const e = document.querySelector('#map .map-item'); e.focus({ focusVisible: true }); return getComputedStyle(e).outlineStyle; })()`);
  await p.evaluate('Deck.openMap(false)');
  if (outline === 'none') fail('a focused map item has no outline');
  return 'B blackout, ? help, G jump, focus outline, slide roles';
}
