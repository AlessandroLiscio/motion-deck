// Helpers for the selftest feature probes: browser session, deck pages, bounded polling.
import { pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { openBrowser } from './cdp.mjs';
import { sleep } from './format.mjs';

export { sleep };

export class ProbeFailure extends Error {}
export const fail = (message) => { throw new ProbeFailure(message); };
export const same = (actual, expected, what) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

// Polls an expression in the page until it is truthy; returns the value. Bounded.
export async function until(page, expression, { what = expression, timeout = 4000, every = 30 } = {}) {
  const end = Date.now() + timeout;
  let last;
  for (;;) {
    last = await page.evaluate(expression);
    if (last) return last;
    if (Date.now() > end) fail(`timeout waiting for ${what} (last value ${JSON.stringify(last)})`);
    await sleep(every);
  }
}

// Same for a Node-side function.
export async function untilNode(fn, { what, timeout = 6000, every = 50 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) fail(`timeout waiting for ${what}`);
    await sleep(every);
  }
}

// Opens a browser for the probes (popups allowed), runs fn({ client, info }), always shuts it down.
export async function withBrowser({ which, timeout = 20000 }, fn) {
  const info = await launchBrowser({ which, startTimeout: Math.max(timeout, 30000), extraArgs: ['--disable-popup-blocking'] });
  let client = null;
  try {
    client = await openBrowser(info.wsUrl, { timeout: Math.max(timeout, 15000) });
    return await fn({ client, info });
  } finally {
    if (client) {
      const procs = await client.send('SystemInfo.getProcessInfo', {}, { timeout: 3000 }).catch(() => null);
      if (procs) info.trackPids(procs.processInfo.map((p) => p.id));
      await client.send('Browser.close', {}, { timeout: 3000 }).catch(() => {});
      client.close();
    }
    await info.close({ grace: 6000 }).catch(() => {});
  }
}

// Opens the built deck in a new page (1600x900, scale 1). Uncaught exceptions and console errors land in page.errors.
export async function loadDeck(client, file, { hash = '', query = '', reduced = false } = {}) {
  const page = await client.newPage();
  page.errors = [];
  const text = (args) => args.map((a) => a.value ?? a.description ?? a.type).join(' ');
  page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error') page.errors.push(`console.error: ${text(p.args).slice(0, 160)}`); });
  page.on('Runtime.exceptionThrown', (p) => page.errors.push(`uncaught: ${String(p.exceptionDetails.exception?.description || p.exceptionDetails.text).split('\n')[0].slice(0, 160)}`));
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  // Always set: a host with window animations switched off (a Windows server session such as GitHub's runners) reports reduce on its own.
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  const loaded = page.waitFor('Page.domContentEventFired');
  await page.send('Page.navigate', { url: pathToFileURL(file).href + query + hash });
  await loaded;
  await page.evaluate('new Promise((ok, no) => { const t = () => (window.Deck && window.Deck.ready ? Promise.resolve(Deck.ready).then(ok, no) : setTimeout(t, 25)); t(); })', { awaitPromise: true, timeout: 15000 });
  return page;
}

// Back to a known state: map closed, no transition running, slide i at step 0.
export async function reset(page, i = 0) {
  await page.send('Page.bringToFront'); // a page behind another one is hidden, and view transitions and frames stop
  await page.evaluate(`(Deck.openMap(false), Deck.go(${i}, { instant: true, step: 0 }), true)`);
  await until(page, `Deck.index === ${i} && Deck.step === 0 && !document.getElementById('stage').dataset.tr`, { what: `slide ${i + 1} at step 0` });
}

export async function titleIndex(page, title) {
  const i = await page.evaluate(`Deck.info().slides.findIndex((s) => s.title === ${JSON.stringify(title)})`);
  if (i < 0) fail(`no slide titled "${title}"`);
  return i;
}
