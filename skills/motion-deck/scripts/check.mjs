#!/usr/bin/env node
// Headless check of a built deck (contract section 10). Exit 0 pass, 1 the deck failed a check, 2 the tool or the browser failed.
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';
import { openPage } from './lib/cdp.mjs';
import { MEASURE_FONTS, MEASURE_SLIDE, MEASURE_TOKENS, contrast, normHex } from './lib/measure.mjs';
import { printPdf } from './lib/pdf.mjs';
import { shotName, writeReport } from './lib/report.mjs';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: check.mjs <built.html> [--out <dir>] [--browser auto|chrome|edge] [--shots all|final|none] [--no-pdf] [--timeout <ms>] [--themes <dir>]';

class UsageError extends Error {}

function parseArgs(argv) {
  const o = { file: null, out: 'tmp/reports/check', browser: 'auto', shots: 'all', pdf: true, timeout: 20000, themes: join(SKILL, 'themes') };
  const takes = new Set(['--out', '--browser', '--shots', '--timeout', '--themes']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-pdf') o.pdf = false;
    else if (takes.has(a)) {
      if (argv[i + 1] === undefined) throw new UsageError(`${a} needs a value`);
      const v = argv[++i];
      if (a === '--timeout') o.timeout = Number(v);
      else o[a.slice(2)] = v;
    } else if (a.startsWith('--')) throw new UsageError(`unknown option ${a}`);
    else if (o.file === null) o.file = a;
    else throw new UsageError(`unexpected argument ${a}`);
  }
  if (!o.file) throw new UsageError('missing <built.html>');
  if (!['auto', 'chrome', 'edge'].includes(o.browser)) throw new UsageError('--browser must be auto, chrome or edge');
  if (!['all', 'final', 'none'].includes(o.shots)) throw new UsageError('--shots must be all, final or none');
  if (!(o.timeout > 0)) throw new UsageError('--timeout must be a positive number of milliseconds');
  return o;
}

const READY = `new Promise((resolve, reject) => {
  const tick = () => {
    if (window.Deck && window.Deck.ready) Promise.resolve(window.Deck.ready).then(() => resolve(true), reject);
    else if (document.readyState !== 'loading') reject(new Error('window.Deck is not defined'));
    else setTimeout(tick, 25);
  };
  tick();
})`;
const TWO_FRAMES = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const allowed = (url) => /^(data|file|blob):/i.test(url);
const short = (s, n = 90) => (String(s).length > n ? String(s).slice(0, n - 3) + '...' : String(s));

function describe(v) {
  const n = v.numbers;
  if (v.kind === 'outside-safe-area' || v.kind === 'outside-stage') {
    return `x ${n.left}..${n.right}, y ${n.top}..${n.bottom} outside ${n.limit.left}..${n.limit.right} x ${n.limit.top}..${n.limit.bottom}`;
  }
  if (v.kind === 'clipped') return `scroll ${n.scrollWidth}x${n.scrollHeight} > client ${n.clientWidth}x${n.clientHeight}`;
  if (v.kind === 'slide-height') return `scrollHeight ${n.scrollHeight} > clientHeight ${n.clientHeight}`;
  return JSON.stringify(n);
}

// At most `max` lines, one problem per class in turn so every class shows up.
function excerpt(problems, max = 5) {
  const groups = new Map();
  for (const p of problems) groups.set(p.cls, [...(groups.get(p.cls) || []), p]);
  const lines = [];
  for (let round = 0; lines.length < max && round < problems.length; round++) {
    for (const list of groups.values()) if (list[round] && lines.length < max) lines.push(`${list[round].cls}: ${short(list[round].message, 160)}`);
  }
  return lines;
}

export async function runCheck(opts, out = console.log) {
  const file = resolve(opts.file);
  if (!existsSync(file)) throw new Error(`file not found: ${file}`);
  const deck = basename(file, extname(file)) === 'index' ? basename(dirname(file)) : basename(file, extname(file));
  const problems = [];
  const add = (cls, message) => problems.push({ cls, message });
  const consoleLines = [];
  const requests = new Map();
  const remote = new Map();
  let phase = 'online';
  const report = { deck, file, browser: null, ok: false, slides: 0, states: [], problems, fonts: null, tokens: null, pdf: null, offline: null, remote: [] };
  const shots = new Map();
  let pdfBuffer = null;
  let browser = null;
  let page = null;

  const stage = (name, detail, bad) => out(`${bad ? 'fail' : 'ok'} ${name}${detail ? ' ' + detail : ''}`);
  const gotoReady = async (reload) => {
    const t0 = Date.now();
    try {
      // DOMContentLoaded, not load: a deck that waits on a remote image must still be measured and reported.
      const loaded = page.waitFor('Page.domContentEventFired', { timeout: opts.timeout });
      await page.send(reload ? 'Page.reload' : 'Page.navigate', reload ? { ignoreCache: true } : { url: pathToFileURL(file).href + '?capture=1' });
      await loaded;
      await page.evaluate(READY, { awaitPromise: true, timeout: opts.timeout });
      return { ok: true, ms: Date.now() - t0 };
    } catch (err) {
      const reason = /^timeout after/.test(err.message) ? `Deck.ready did not settle within ${opts.timeout} ms (${err.message})` : err.message;
      return { ok: false, reason };
    }
  };

  const onSignal = () => { (browser ? browser.close() : Promise.resolve()).finally(() => process.exit(2)); };
  process.once('SIGINT', onSignal);
  try {
    // A cold browser start can take longer than a short --timeout, so launch and plain protocol calls get at least 15 s; the ready wait uses --timeout as given.
    const limit = Math.max(opts.timeout, 15000);
    browser = await launchBrowser({ which: opts.browser, startTimeout: limit });
    report.browser = browser.name;
    stage('launch', browser.name);
    page = await openPage(browser.wsUrl, { timeout: limit });
    for (const d of ['Page', 'Runtime', 'Network', 'Log']) await page.send(`${d}.enable`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

    const text = (args) => args.map((a) => a.value ?? a.description ?? a.type).join(' ');
    page.on('Runtime.consoleAPICalled', (p) => {
      consoleLines.push(`[${phase}] console.${p.type}: ${text(p.args)}`);
      if (p.type === 'error') add('console', `console.error: ${short(text(p.args))}`);
    });
    page.on('Runtime.exceptionThrown', (p) => {
      const ex = p.exceptionDetails;
      const msg = String((ex.exception && (ex.exception.description || ex.exception.value)) || ex.text).split('\n')[0];
      consoleLines.push(`[${phase}] exception: ${msg}`);
      add('console', `uncaught: ${short(msg)}`);
    });
    page.on('Log.entryAdded', ({ entry }) => {
      consoleLines.push(`[${phase}] log.${entry.level} ${entry.source}: ${entry.text} ${entry.url || ''}`);
      // network failures, console.error calls and exceptions are counted from their own events
      if (entry.level === 'error' && !['network', 'console-api', 'javascript'].includes(entry.source)) add('console', `browser log: ${short(entry.text)}`);
    });
    page.on('Network.requestWillBeSent', ({ requestId, request }) => {
      requests.set(requestId, request.url);
      if (!allowed(request.url) && !remote.has(request.url)) remote.set(request.url, phase);
    });
    page.on('Network.loadingFailed', ({ requestId, canceled, errorText }) => {
      const url = requests.get(requestId) || '';
      consoleLines.push(`[${phase}] load failed: ${short(url, 200)} ${errorText}`);
      if (!canceled && allowed(url)) add('console', `resource failed: ${short(url, 60)} ${errorText}`);
    });

    // 1. readiness
    const first = await gotoReady(false);
    if (!first.ok) {
      add('ready', first.reason);
      stage('ready', short(first.reason, 100), true);
    } else {
      stage('ready', `${first.ms} ms`);
      const info = await page.evaluate(`(Deck.capture(true), { count: Deck.count, steps: Array.from({ length: Deck.count }, (_, i) => Deck.steps(i)) })`);
      report.slides = info.count;

      // 2. fonts
      const fonts = await page.evaluate(MEASURE_FONTS, { awaitPromise: true });
      report.fonts = fonts;
      let mark = problems.length;
      for (const f of fonts.faces) if (f.status !== 'loaded') add('fonts', `face "${f.family}" ${f.style} ${f.weight} status ${f.status}`);
      for (const [role, t] of Object.entries(fonts.tokens)) {
        if (!t.declared) add('fonts', `--f-${role} first family "${t.first}" is not a declared font`);
        else if (!t.loaded) add('fonts', `--f-${role} family "${t.first}" is declared but not loaded`);
      }
      stage('fonts', `${fonts.faces.length} faces`, problems.length > mark);

      // 3. walk every slide and step
      mark = problems.length;
      for (let i = 0; i < info.count; i++) {
        for (let s = 0; s <= info.steps[i]; s++) {
          const at = await page.evaluate(`(Deck.go(${i}, { step: ${s}, instant: true }), [Deck.index, Deck.step])`);
          await page.evaluate(TWO_FRAMES, { awaitPromise: true });
          if (at[0] !== i || at[1] !== s) add('walk', `s${i + 1}: Deck.go(${i}, step ${s}) landed on slide ${at[0] + 1} step ${at[1]}`);
          const violations = await page.evaluate(MEASURE_SLIDE);
          for (const v of violations) add('overflow', `s${i + 1} step ${s} ${v.selector} ${v.kind} ${describe(v)}`);
          const state = { slide: i + 1, step: s, steps: info.steps[i], shot: null, violations };
          if (opts.shots === 'all' || (opts.shots === 'final' && s === info.steps[i])) {
            const { data } = await page.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
            state.shot = shotName(i + 1, s);
            shots.set(state.shot, Buffer.from(data, 'base64'));
          }
          report.states.push(state);
        }
      }
      const walkBad = problems.slice(mark).length;
      stage('walk', `${info.count} slides, ${report.states.length} states, ${walkBad} problems`, walkBad > 0);

      // 7. tokens
      mark = problems.length;
      const tok = await page.evaluate(MEASURE_TOKENS);
      report.tokens = tok;
      const themeFile = join(resolve(opts.themes), String(tok.theme), 'theme.json');
      if (existsSync(themeFile)) {
        const want = JSON.parse(readFileSync(themeFile, 'utf8'));
        for (const name of ['bg', 'text', 'muted']) {
          if (tok.colors[name] !== normHex(want[name])) add('tokens', `--${name} is ${tok.colors[name]} but theme.json says ${want[name]}`);
        }
      } else {
        out(`warn tokens theme.json for "${tok.theme}" not found under ${opts.themes}, compare skipped`);
      }
      for (const name of ['text', 'muted']) {
        const c = tok.colors[name] && tok.colors.bg ? contrast(tok.colors[name], tok.colors.bg) : 0;
        if (c < 4.5) add('tokens', `contrast of --${name} (${tok.colors[name]}) on --bg (${tok.colors.bg}) is ${c.toFixed(2)}, needs 4.5`);
      }
      stage('tokens', String(tok.theme), problems.length > mark);

      // 6. pdf
      if (opts.pdf) {
        mark = problems.length;
        const pdf = await printPdf(page, Math.max(opts.timeout, 15000) * 2);
        pdfBuffer = pdf.buffer;
        report.pdf = { pages: pdf.pages, widthPx: pdf.widthPx, heightPx: pdf.heightPx };
        if (pdf.pages !== info.count) add('pdf', `${pdf.pages} pages but Deck.count is ${info.count}`);
        if (pdf.widthPx === null || Math.abs(pdf.widthPx - 1600) > 1 || Math.abs(pdf.heightPx - 900) > 1) {
          add('pdf', `page size is ${pdf.widthPx && pdf.widthPx.toFixed(1)} x ${pdf.heightPx && pdf.heightPx.toFixed(1)} px, expected 1600 x 900`);
        }
        stage('pdf', `${pdf.pages} pages`, problems.length > mark);
      }

      // 5. offline
      mark = problems.length;
      phase = 'offline';
      await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      const again = await gotoReady(true);
      report.offline = { ready: again.ok };
      if (!again.ok) add('offline', `deck did not reach ready offline: ${again.reason}`);
      stage('offline', again.ok ? 'ready' : 'not ready', !again.ok);
    }

    for (const [url, where] of remote) {
      report.remote.push({ url, phase: where });
      add('offline', `request to ${short(url, 120)} (${where}); decks must work offline`);
    }
  } finally {
    process.removeListener('SIGINT', onSignal);
    if (page && browser) {
      // Every process of this browser, so the kill cannot miss one (renderer, gpu, utility).
      const info = await page.send('SystemInfo.getProcessInfo', {}, { session: null, timeout: 3000 }).catch(() => null);
      if (info) browser.trackPids(info.processInfo.map((p) => p.id));
    }
    if (page && browser) await page.send('Browser.close', {}, { session: null, timeout: 3000 }).catch(() => {}); // clean shutdown first, the kill is the fallback
    if (page) page.close();
    if (browser) await browser.close({ grace: 6000 }).catch((err) => out(`warn cleanup: ${err.message}`));
  }

  const count = (cls) => problems.filter((p) => p.cls === cls).length;
  report.ok = problems.length === 0;
  const dir = await writeReport(resolve(opts.out), { report, shots, pdf: pdfBuffer, consoleLines });
  stage('console', `${count('console')} errors`, count('console') > 0);
  out(`${report.ok ? 'ok' : 'fail'} report ${dir}`);
  if (report.ok) {
    const pdf = report.pdf ? `pdf ${report.pdf.pages} pages` : 'pdf skipped';
    out(`PASS check: ${deck} [${report.browser}] ${report.slides} slides, ${report.states.length} states, ${count('overflow')} overflow, ${count('console')} console errors, ${count('fonts')} missing fonts, ${pdf}`);
  } else {
    for (const line of excerpt(problems)) out(`  ${line}`);
    out(`FAIL check: ${deck} ${problems.length} problem(s)`);
  }
  return report.ok ? 0 : 1;
}

async function main() {
  let code = 2;
  try {
    code = await runCheck(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.log(`FAIL check: ${err instanceof UsageError ? `${err.message} (${USAGE})` : `tool error: ${err.message}`}`);
  }
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
