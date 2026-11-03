#!/usr/bin/env node
// Selftest of the whole kit (contract section 10): builds the showcase once per theme, runs the check and the feature probes in every
// installed browser, and runs the negative fixtures. Exit 0 PASS, 1 a check or probe failed, 2 the tool or the browser failed.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BuildError, build } from './build.mjs';
import { runCheck } from './check.mjs';
import { findBrowser } from './lib/browser.mjs';
import { withBrowser } from './lib/probe-kit.mjs';
import { runProbes } from './lib/probes.mjs';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: selftest.mjs [--quick] [--out <dir>] [--browser auto|chrome|edge]';
const FIXTURES = join(SKILL, 'scripts', 'fixtures', 'check');
const THEMES_STUB = join(SKILL, 'examples', 'fixtures', 'themes-stub');
const FEATURE_ORDER = ['map', 'hash', 'back', 'step-out', 'reduced-motion', 'presenter', 'morph', 'pdf', 'offline'];

// Each negative fixture must make the check fail with a problem of this class (and message).
const NEGATIVES = [
  { name: 'overflow', cls: 'overflow', match: /outside-safe-area/ },
  { name: 'clipped', cls: 'overflow', match: /clipped/ },
  { name: 'missing-font', cls: 'fonts' },
  { name: 'exception', cls: 'ready' },
  { name: 'never-ready', cls: 'ready', timeout: 3000 },
  { name: 'console-error', cls: 'console' },
  { name: 'remote', cls: 'offline' },
  { name: 'bad-contrast', cls: 'tokens' },
];

function parseArgs(argv) {
  const o = { quick: false, out: 'tmp/reports/selftest', browser: 'auto' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--quick') o.quick = true;
    else if (a === '--out' || a === '--browser') {
      if (argv[i + 1] === undefined) throw new Error(`${a} needs a value (${USAGE})`);
      o[a.slice(2)] = argv[++i];
    } else throw new Error(`unexpected argument ${a} (${USAGE})`);
  }
  if (!['auto', 'chrome', 'edge'].includes(o.browser)) throw new Error(`--browser must be auto, chrome or edge (${USAGE})`);
  return o;
}

const short = (s, n = 150) => (s.length > n ? s.slice(0, n - 3) + '...' : s);

export async function runSelftest(opts, print = console.log) {
  const outDir = resolve(opts.out);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const logFile = join(outDir, 'selftest.log');
  writeFileSync(logFile, '');
  const log = (line) => appendFileSync(logFile, line + '\n');
  const stage = (line) => { print(line); log(line); };

  const names = opts.browser === 'auto' ? ['chrome', 'edge'] : [opts.browser];
  let browsers = names.filter((n) => findBrowser(n));
  if (opts.browser !== 'auto' && !browsers.length) throw new Error(`${opts.browser} not found (set CHROME_PATH or EDGE_PATH)`);
  if (!browsers.length) throw new Error('no Chrome or Edge found (set CHROME_PATH or EDGE_PATH)');
  if (opts.quick) browsers = browsers.slice(0, 1);
  let themes = readdirSync(join(SKILL, 'themes'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared' && existsSync(join(SKILL, 'themes', d.name, 'theme.json')))
    .map((d) => d.name).sort();
  if (!themes.length) throw new Error('no theme found under themes/');
  if (opts.quick) themes = themes.slice(0, 1);

  const problems = [];
  const problem = (where, message) => problems.push(`${where}: ${message}`);
  const totals = { states: 0, overflow: 0, console: 0, fonts: 0 };
  const features = new Set(FEATURE_ORDER);
  let slides = 0;

  // 1. build the showcase once per theme
  const builds = {};
  for (const theme of themes) {
    const file = join(outDir, `${theme}.html`);
    try {
      const r = await build({ src: join(SKILL, 'examples', 'showcase.src.html'), out: file, themeOverride: theme, log: (l) => log(`build ${theme}: ${l}`) });
      builds[theme] = file;
      slides ||= r.slides;
      stage(`ok build ${theme} ${Math.round(r.bytes / 1024)} KB, ${r.slides} slides`);
    } catch (err) {
      if (!(err instanceof BuildError)) throw err;
      problem(`build ${theme}`, `${err.code} ${err.message}`);
      stage(`fail build ${theme} ${err.code}`);
    }
  }

  for (const browser of browsers) {
    // 2. the check on every built theme
    for (const theme of Object.keys(builds)) {
      const checkOut = join(outDir, `check-${browser}`);
      const code = await runCheck({ file: builds[theme], out: checkOut, browser, shots: 'final', pdf: true, timeout: 20000, themes: join(SKILL, 'themes') }, log);
      const report = JSON.parse(readFileSync(join(checkOut, theme, 'report.json'), 'utf8'));
      const count = (cls) => report.problems.filter((p) => p.cls === cls).length;
      totals.states += report.states.length;
      totals.overflow += count('overflow');
      totals.console += count('console');
      totals.fonts += count('fonts');
      if (!report.pdf) features.delete('pdf');
      if (!report.offline || !report.offline.ready) features.delete('offline');
      for (const p of report.problems) problem(`check ${browser} ${theme} ${p.cls}`, p.message);
      stage(`${code === 0 ? 'ok' : 'fail'} check ${browser} ${theme}: ${report.slides} slides, ${report.states.length} states, pdf ${report.pdf ? report.pdf.pages : 'none'} pages, offline ${report.offline && report.offline.ready ? 'ready' : 'no'}`);
    }

    // 3. feature probes on every built theme
    for (const theme of Object.keys(builds)) {
      const themeJson = JSON.parse(readFileSync(join(SKILL, 'themes', theme, 'theme.json'), 'utf8'));
      const { results, errors } = await withBrowser({ which: browser }, ({ client }) => runProbes({
        client, file: builds[theme], themeJson,
        onResult: (r) => stage(`${r.ok ? 'ok' : 'fail'} probe ${browser} ${theme} ${r.name}: ${short(r.detail, 110)}`),
      }));
      for (const r of results) {
        if (!r.ok) {
          problem(`probe ${browser} ${theme} ${r.name}`, r.detail);
          if (r.feature) features.delete(r.feature);
        }
      }
      for (const e of errors) { totals.console++; problem(`probe pages ${browser} ${theme} console`, e); }
    }

    // 4. the check must fail on each negative fixture (four browsers at a time: each run is mostly start-up and shutdown)
    const outNeg = join(outDir, `negatives-${browser}`);
    const runNegative = async (n, attempt = 1) => {
      const code = await runCheck({ file: join(FIXTURES, `${n.name}.html`), out: outNeg, browser, shots: 'none', pdf: false, timeout: n.timeout || 20000, themes: THEMES_STUB }, log);
      const report = JSON.parse(readFileSync(join(outNeg, n.name, 'report.json'), 'utf8'));
      const hit = report.problems.some((p) => p.cls === n.cls && (!n.match || n.match.test(p.message)));
      // A protocol timeout on a loaded machine says nothing about the fixture: run it once more.
      if (!hit && attempt === 1 && n.name !== 'never-ready' && report.problems.some((p) => /^(Deck\.ready did not settle|timeout after)/.test(p.message))) return runNegative(n, 2);
      return { n, ok: code === 1 && hit, code };
    };
    for (let k = 0; k < NEGATIVES.length; k += 4) {
      for (const { n, ok, code } of await Promise.all(NEGATIVES.slice(k, k + 4).map(runNegative))) {
        if (!ok) problem(`negative ${browser} ${n.name}`, code === 0 ? 'the check PASSED a deck it must reject' : `exit ${code} without a ${n.cls} problem${n.match ? ` matching ${n.match}` : ''}`);
        stage(`${ok ? 'ok' : 'fail'} negative ${browser} ${n.name}: ${ok ? `rejected as ${n.cls}` : 'not rejected as expected'}`);
      }
    }
  }

  if (!problems.length) {
    const list = FEATURE_ORDER.filter((f) => features.has(f)).join('/');
    stage(`PASS selftest: ${browsers.join('+')}, ${themes.length} theme${themes.length === 1 ? '' : 's'}, ${slides} slides, ${totals.states} states, features ${list}, ${totals.overflow} overflow, ${totals.console} console errors, ${totals.fonts} missing fonts`);
    return 0;
  }
  stage(`log ${logFile}`);
  for (const line of problems.slice(0, 5)) stage(`  ${short(line)}`);
  stage(`FAIL selftest: ${problems.length} problem(s)`);
  return 1;
}

async function main() {
  let code = 2;
  try {
    code = await runSelftest(parseArgs(process.argv.slice(2)));
  } catch (err) {
    console.log(`FAIL selftest: tool error: ${err.message}`);
  }
  process.exit(code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
