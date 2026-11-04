#!/usr/bin/env node
// Image-based .pptx export of a built deck (contract section 13). Exit 0 pass, 1 the export failed its own verification, 2 the tool or the browser failed.
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './lib/browser.mjs';
import { openPage } from './lib/cdp.mjs';
import { short } from './lib/format.mjs';
import { buildPackage, clip } from './lib/pptx.mjs';
import { browserXml, imageInfo, validatePackage } from './lib/pptx-validate.mjs';
import { zipToBuffer } from './lib/zip.mjs';

const USAGE = 'usage: export.mjs <built.html> [--out file.pptx] [--steps all|final] [--scale 2] [--format jpeg|png] [--quality 90] [--transition fade|none] [--no-notes] [--browser auto|chrome|edge] [--timeout <ms>] [--report <dir>]';
export const DEFAULT_FORMAT = 'jpeg'; // measured on the showcase in six themes: PNG 435 MB in total (two themes over 100 MB), JPEG at 90 67.6 MB
const WARN_BYTES = 100 * 1024 * 1024;
const ALT_MAX = 250;

class UsageError extends Error {}

export function parseArgs(argv) {
  const o = { file: null, out: null, steps: 'all', scale: 2, format: DEFAULT_FORMAT, quality: 90, transition: 'fade', notes: true, browser: 'auto', timeout: 20000, report: 'tmp/reports/export' };
  const takes = new Set(['--out', '--steps', '--scale', '--format', '--quality', '--transition', '--browser', '--timeout', '--report']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-notes') o.notes = false;
    else if (takes.has(a)) {
      if (argv[i + 1] === undefined) throw new UsageError(`${a} needs a value`);
      const v = argv[++i];
      if (['--scale', '--quality', '--timeout'].includes(a)) o[a.slice(2)] = Number(v);
      else o[a.slice(2)] = v;
    } else if (a.startsWith('--')) throw new UsageError(`unknown option ${a}`);
    else if (o.file === null) o.file = a;
    else throw new UsageError(`unexpected argument ${a}`);
  }
  if (!o.file) throw new UsageError('missing <built.html>');
  if (o.format === 'jpg') o.format = 'jpeg';
  if (!['all', 'final'].includes(o.steps)) throw new UsageError('--steps must be all or final');
  if (!['png', 'jpeg'].includes(o.format)) throw new UsageError('--format must be png or jpeg');
  if (!['fade', 'none'].includes(o.transition)) throw new UsageError('--transition must be fade or none');
  if (!['auto', 'chrome', 'edge'].includes(o.browser)) throw new UsageError('--browser must be auto, chrome or edge');
  if (!(o.scale >= 1 && o.scale <= 4) || !Number.isInteger(1600 * o.scale) || !Number.isInteger(900 * o.scale)) throw new UsageError('--scale must be from 1 to 4 and give whole pixel sizes (1, 1.5, 2, 2.5, 3, 4)');
  if (!(o.quality >= 1 && o.quality <= 100)) throw new UsageError('--quality must be from 1 to 100');
  if (!(o.timeout > 0)) throw new UsageError('--timeout must be a positive number of milliseconds');
  if (o.out !== null && extname(o.out).toLowerCase() !== '.pptx') throw new UsageError('--out must end in .pptx');
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
// The HUD, track and map belong to the browser view; the picture of a slide shows the slide only.
const HIDE_CHROME = '(() => { const s = document.createElement("style"); s.id = "md-export"; s.textContent = "#chrome{display:none !important}"; document.head.append(s); return true; })()';

// Runs in the page. Slide facts and the notes as plain paragraphs.
function deckFacts() {
  const BLOCK = /^(P|DIV|LI|UL|OL|H[1-6]|BLOCKQUOTE|PRE|TR|SECTION|ASIDE)$/;
  const paragraphs = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html'); // inert: nothing in the notes runs or loads
    const out = [];
    let cur = '';
    const flush = () => { const t = cur.replace(/\s+/g, ' ').trim(); if (t && t !== '•') out.push(t); cur = ''; }; // an empty list item leaves no bare bullet
    const walk = (node) => {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) cur += c.nodeValue;
        else if (c.nodeType === 1) {
          if (c.tagName === 'BR') { flush(); continue; }
          const block = BLOCK.test(c.tagName);
          if (block) { flush(); if (c.tagName === 'LI') cur = '• '; }
          walk(c);
          if (block) flush();
        }
      }
    };
    walk(doc.body);
    flush();
    return out;
  };
  const cfg = Deck.config || {};
  return {
    count: Deck.count,
    meta: { title: cfg.title || Deck.info().title, subtitle: cfg.subtitle || '', author: cfg.author || '', lang: cfg.lang || 'en' },
    slides: Deck.info().slides.map((s) => ({ index: s.index, title: s.title, backup: s.backup, steps: Deck.steps(s.index), notes: paragraphs(s.notes) })),
  };
}

// Runs in the page. The text a viewer sees on slide i in its current state (hidden steps and the notes are left out).
function visibleText(i) {
  const root = document.querySelectorAll('#stage > .slide')[i];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!t || !el || el.closest('.notes, script, style')) continue;
    if (el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) out.push(t);
  }
  return out.join(' ');
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

export async function runExport(opts, out = console.log) {
  const file = resolve(opts.file);
  if (!existsSync(file)) throw new Error(`file not found: ${file}`);
  const deck = basename(file, extname(file)) === 'index' ? basename(dirname(file)) : basename(file, extname(file));
  const target = resolve(opts.out || join(dirname(file), `${deck}.pptx`));
  const reportDir = join(resolve(opts.report), deck);
  mkdirSync(reportDir, { recursive: true });
  const lines = [];
  const stage = (name, detail, bad) => { const line = `${bad ? 'fail' : 'ok'} ${name}${detail ? ' ' + detail : ''}`; lines.push(line); out(line); };
  const note = (line) => lines.push(line); // log only
  const problems = [];
  const px = { w: Math.round(1600 * opts.scale), h: Math.round(900 * opts.scale) };
  const report = { deck, file, out: target, browser: null, format: opts.format, scale: opts.scale, steps: opts.steps, transition: opts.transition, notes: opts.notes, width: px.w, height: px.h, deckSlides: 0, states: [], exported: 0, dropped: 0, bytes: 0, verify: null, ok: false };
  const wantSlides = [];
  const slides = [];
  let zip = null;
  let browser = null;
  let page = null;
  const onSignal = () => { (browser ? browser.close() : Promise.resolve()).finally(() => process.exit(2)); };
  process.once('SIGINT', onSignal);
  try {
    const limit = Math.max(opts.timeout, 30000); // a cold browser start can take longer than a short --timeout
    browser = await launchBrowser({ which: opts.browser, startTimeout: limit });
    report.browser = browser.name;
    stage('launch', browser.name);
    page = await openPage(browser.wsUrl, { timeout: limit });
    for (const d of ['Page', 'Runtime']) await page.send(`${d}.enable`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: opts.scale, mobile: false });
    const t0 = Date.now();
    const loaded = page.waitFor('Page.domContentEventFired', { timeout: opts.timeout });
    await page.send('Page.navigate', { url: pathToFileURL(file).href + '?capture=1' });
    await loaded;
    try {
      await page.evaluate(READY, { awaitPromise: true, timeout: opts.timeout });
    } catch (err) {
      throw new Error(`Deck.ready did not settle: ${err.message}`);
    }
    await page.evaluate('(Deck.capture(true), true)');
    await page.evaluate(HIDE_CHROME);
    stage('ready', `${Date.now() - t0} ms`);

    const facts = await page.evaluate(`(${deckFacts.toString()})()`);
    report.deckSlides = facts.count;
    // Backup slides go after the main ones, each group in deck order.
    const order = [...facts.slides.filter((s) => !s.backup), ...facts.slides.filter((s) => s.backup)];
    const fmt = opts.format === 'jpeg' ? { format: 'jpeg', quality: Math.round(opts.quality) } : { format: 'png' };
    for (const s of order) {
      let prev = null;
      for (let step = opts.steps === 'final' ? s.steps : 0; step <= s.steps; step++) {
        const at = await page.evaluate(`(Deck.go(${s.index}, { step: ${step}, instant: true }), [Deck.index, Deck.step])`);
        await page.evaluate(TWO_FRAMES, { awaitPromise: true });
        if (at[0] !== s.index || at[1] !== step) problems.push(`s${s.index + 1}: Deck.go(${s.index}, step ${step}) landed on slide ${at[0] + 1} step ${at[1]}`);
        const { data } = await page.send('Page.captureScreenshot', { ...fmt, fromSurface: true }, { timeout: Math.max(opts.timeout * 3, 60000) }); // a 4800 px picture of a busy slide can take a while
        const image = Buffer.from(data, 'base64');
        const info = imageInfo(image);
        if (!info || info.width !== px.w || info.height !== px.h) problems.push(`s${s.index + 1} step ${step}: picture is ${info ? `${info.width} x ${info.height}` : 'not an image'}, expected ${px.w} x ${px.h}`);
        const text = await page.evaluate(`(${visibleText.toString()})(${s.index})`);
        const same = prev !== null && prev.equals(image);
        report.states.push({ slide: s.index + 1, step, bytes: image.length, kept: !same });
        note(`state s${s.index + 1} step ${step}/${s.steps} ${image.length} bytes ${same ? 'dropped (same picture as the step before)' : 'kept'}`);
        if (same) { report.dropped++; continue; }
        prev = image;
        const hit = text.toLowerCase().indexOf(s.title.toLowerCase()); // the alt text opens with the title, so it is not said twice
        const rest = (hit >= 0 ? `${text.slice(0, hit)} ${text.slice(hit + s.title.length)}` : text).replace(/\s+/g, ' ').trim();
        slides.push({ title: s.title, alt: clip(rest ? `${s.title}. ${rest}` : s.title, ALT_MAX), notes: opts.notes ? s.notes : [], image: { data: image, ext: opts.format } });
        wantSlides.push({ title: s.title, notes: opts.notes && s.notes.length ? s.notes : null, ext: opts.format });
      }
    }
    report.exported = slides.length;
    const imageBytes = slides.reduce((n, s) => n + s.image.data.length, 0);
    stage('capture', `${facts.count} deck slides, ${report.states.length} states, ${slides.length} pictures (${report.dropped} repeats dropped), ${px.w}x${px.h} ${opts.format}, ${mb(imageBytes)}`, problems.length > 0);

    const entries = buildPackage(slides, facts.meta, { transition: opts.transition === 'fade', notes: opts.notes });
    zip = zipToBuffer(entries);
    report.bytes = zip.length;
    stage('package', `${entries.length} parts, ${slides.length} slides, ${mb(zip.length)}`);

    // Verification: the browser parses every XML part; the rest runs in Node.
    const verdict = await validatePackage(zip, { slides: wantSlides, width: px.w, height: px.h, transition: opts.transition === 'fade', meta: facts.meta }, browserXml(page));
    report.verify = { level: 'structure, xml (DOMParser), images; not opened in PowerPoint', errors: verdict.errors, stats: verdict.stats };
    for (const e of verdict.errors) problems.push(`verify: ${e}`);
    stage('verify', `${verdict.stats.parts ?? 0} parts, ${verdict.errors.length} errors`, verdict.errors.length > 0);
  } finally {
    process.removeListener('SIGINT', onSignal);
    if (page && browser) {
      const info = await page.send('SystemInfo.getProcessInfo', {}, { session: null, timeout: 3000 }).catch(() => null);
      if (info) browser.trackPids(info.processInfo.map((p) => p.id));
      await page.send('Browser.close', {}, { session: null, timeout: 3000 }).catch(() => {});
    }
    if (page) page.close();
    if (browser) await browser.close({ grace: 6000 }).catch((err) => out(`warn cleanup: ${err.message}`));
  }

  report.ok = problems.length === 0;
  if (report.ok) {
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.part`;
    try {
      writeFileSync(tmp, zip);
      renameSync(tmp, target);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw new Error(`cannot write ${target}: ${err.message} (is the file open in PowerPoint?)`);
    }
    stage('write', `${mb(zip.length)} ${target}`);
    if (zip.length > WARN_BYTES) out(`warn size ${mb(zip.length)} is over 100 MB; some mail systems refuse it. Try --scale 1, --format jpeg or --steps final`);
  }
  writeFileSync(join(reportDir, 'export.log'), lines.concat(problems.map((p) => `problem ${p}`)).join('\n') + '\n');
  writeFileSync(join(reportDir, 'report.json'), JSON.stringify({ ...report, problems }, null, 2) + '\n');
  out(`${report.ok ? 'ok' : 'fail'} report ${reportDir}`);
  if (report.ok) {
    out(`PASS export: ${deck} [${report.browser}] ${report.exported} slides from ${report.deckSlides} deck slides, ${opts.steps} steps, ${opts.format} ${px.w}x${px.h}, ${mb(report.bytes)} -> ${target}`);
    return 0;
  }
  for (const p of problems.slice(0, 5)) out(`  ${short(p, 160)}`);
  out(`FAIL export: ${deck} ${problems.length} problem(s)`);
  return 1;
}

async function main() {
  let code = 2;
  try {
    code = await runExport(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.log(`FAIL export: ${err instanceof UsageError ? `${err.message} (${USAGE})` : `tool error: ${err.message}`}`);
  }
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
