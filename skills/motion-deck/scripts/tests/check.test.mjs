// node --test scripts/tests/check.test.mjs
// Runs check.mjs against the fixtures in scripts/fixtures/check and proves each check fails on its negative fixture.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../lib/browser.mjs';
import { contrast, normHex } from '../lib/measure.mjs';
import { inspectPdf } from '../lib/pdf.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..', '..');
const checkScript = join(skill, 'scripts', 'check.mjs');
const fixtures = join(skill, 'scripts', 'fixtures', 'check');
const themesStub = join(skill, 'examples', 'fixtures', 'themes-stub');
const outRoot = mkdtempSync(join(tmpdir(), 'md-check-test-out-'));
after(() => rmSync(outRoot, { recursive: true, force: true }));

const PREFIX = `md-check-profile-t${process.pid}-`; // unique to this test run, so other runs in parallel do not count
const profiles = () => new Set(readdirSync(tmpdir()).filter((n) => n.startsWith(PREFIX)));

function run(fixture, browser, extra = []) {
  const before = profiles();
  const out = join(outRoot, `${browser}-${fixture}-${extra.length}`);
  const res = spawnSync(process.execPath, [checkScript, join(fixtures, `${fixture}.html`), '--out', out, '--browser', browser, '--themes', themesStub, ...extra], { encoding: 'utf8', timeout: 120000, env: { ...process.env, MD_CHECK_PROFILE_PREFIX: PREFIX } });
  const lines = res.stdout.trim().split('\n');
  const leaked = [...profiles()].filter((n) => !before.has(n));
  return { code: res.status, text: res.stdout, last: lines[lines.length - 1], out, leaked };
}
const reportOf = (r, fixture) => JSON.parse(readFileSync(join(r.out, fixture, 'report.json'), 'utf8'));

const negatives = [
  { fixture: 'overflow', show: /overflow: s1 step 0 .*p\.wide.*outside-safe-area/, kinds: ['outside-safe-area'] },
  { fixture: 'clipped', show: /overflow: s1 step 0 .*clipped/, kinds: ['clipped', 'slide-height'] },
  { fixture: 'missing-font', show: /fonts: face "Broken Sans".*status error/, also: /fonts: --f-body first family "Ghost Sans" is not a declared font/ },
  { fixture: 'exception', show: /ready: .*boot failed in fixture/ },
  { fixture: 'never-ready', show: /ready: Deck\.ready did not settle within 3000 ms/, extra: ['--timeout', '3000'] },
  { fixture: 'console-error', show: /console: console\.error: fixture console error/ },
  { fixture: 'remote', show: /offline: request to https:\/\/example\.invalid\/pixel\.png/ },
  { fixture: 'bad-contrast', show: /tokens: contrast of --text .* is 1\.00, needs 4\.5/ },
];

describe('helpers', () => {
  test('contrast and color normalising', () => {
    assert.equal(normHex('#ABC'), '#aabbcc');
    assert.equal(normHex('red'), null);
    assert.ok(contrast('#000000', '#ffffff') > 20.9);
    assert.ok(contrast('#101418', '#101418') === 1);
  });
  test('inspectPdf counts Page but not Pages and converts points to px', () => {
    const pdf = Buffer.from('<< /Type /Pages /Count 2 >> << /Type /Page /MediaBox [0 0 1200 675] >> << /Type /Page /MediaBox [0 0 1200 675] >>', 'latin1');
    assert.deepEqual(inspectPdf(pdf), { pages: 2, widthPx: 1600, heightPx: 900 });
  });
});

describe('tool errors exit 2', () => {
  test('missing file, missing argument, unknown option', () => {
    for (const args of [[join(fixtures, 'nope.html')], [], [join(fixtures, 'ok.html'), '--bogus']]) {
      const res = spawnSync(process.execPath, [checkScript, ...args], { encoding: 'utf8' });
      assert.equal(res.status, 2, args.join(' '));
      assert.match(res.stdout.trim().split('\n').pop(), /^FAIL check: /);
    }
  });
});

const browsers = ['chrome', 'edge'].filter((name) => {
  const found = findBrowser(name);
  if (!found) console.log(`# skip ${name}: not installed`);
  return found;
});

for (const browser of browsers) {
  describe(`check.mjs on ${browser}`, () => {
    test('ok.html passes with every artefact', () => {
      const r = run('ok', browser);
      assert.equal(r.code, 0, r.text);
      assert.equal(r.last, `PASS check: ok [${browser}] 3 slides, 5 states, 0 overflow, 0 console errors, 0 missing fonts, pdf 3 pages`);
      assert.deepEqual(r.leaked, [], 'browser profile directory left behind');
      const dir = join(r.out, 'ok');
      for (const f of ['report.json', 'console.log', 'deck.pdf', 'index.html', 'shots/s01-0.png', 'shots/s02-0.png', 'shots/s02-1.png', 'shots/s02-2.png', 'shots/s03-0.png']) {
        assert.ok(existsSync(join(dir, f)), `missing ${f}`);
      }
      const rep = reportOf(r, 'ok');
      assert.equal(rep.ok, true);
      assert.equal(rep.pdf.pages, 3);
      assert.match(readFileSync(join(dir, 'index.html'), 'utf8'), /shots\/s02-2\.png/);
    });

    for (const n of negatives) {
      test(`${n.fixture}.html fails with exit 1`, () => {
        const r = run(n.fixture, browser, n.extra);
        assert.equal(r.code, 1, r.text);
        assert.match(r.last, new RegExp(`^FAIL check: ${n.fixture} \\d+ problem\\(s\\)$`));
        assert.match(r.text, n.show);
        if (n.also) assert.match(r.text, n.also);
        const shown = r.text.split('\n').filter((l) => /^ {2}\S/.test(l));
        assert.ok(shown.length >= 1 && shown.length <= 5, `${shown.length} excerpt lines`);
        for (const kind of n.kinds || []) {
          assert.ok(reportOf(r, n.fixture).states.some((s) => s.violations.some((v) => v.kind === kind)), `report has no ${kind} violation`);
        }
        assert.deepEqual(r.leaked, [], 'browser profile directory left behind');
      });
    }
  });
}

if (browsers.includes('chrome')) {
  describe('options', () => {
    test('--shots final --no-pdf', () => {
      const r = run('ok', 'chrome', ['--shots', 'final', '--no-pdf']);
      assert.equal(r.code, 0, r.text);
      assert.match(r.last, /, pdf skipped$/);
      const shots = readdirSync(join(r.out, 'ok', 'shots')).sort();
      assert.deepEqual(shots, ['s01-0.png', 's02-2.png', 's03-0.png']);
      assert.ok(!existsSync(join(r.out, 'ok', 'deck.pdf')));
      assert.deepEqual(r.leaked, []);
    });
    test('theme.json not found: warns, skips the compare, still checks contrast', () => {
      const res = run('bad-contrast', 'chrome', ['--themes', join(outRoot, 'no-themes')]);
      assert.equal(res.code, 1, res.text);
      assert.match(res.text, /^warn tokens theme\.json for "test" not found/m);
      assert.match(res.text, /tokens: contrast of --text/);
      assert.doesNotMatch(res.text, /theme\.json says/);
      assert.deepEqual(res.leaked, []);
    });
  });
}
