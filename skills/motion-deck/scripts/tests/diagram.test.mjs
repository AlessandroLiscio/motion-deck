// Tests for engine/diagram.js. Run: node --test skills/motion-deck/scripts/tests/diagram.test.mjs
// Each fixture is loaded in headless Chrome (examples/diagram-lab.html?selftest=1#<name>) and must report PASS in #result.
// The lab embeds the fixtures (file:// pages cannot fetch); `node diagram.test.mjs --sync` rewrites that block, the first test checks it is current.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, '..', '..');
const labFile = path.join(skill, 'examples', 'diagram-lab.html');
const fixDir = path.join(skill, 'examples', 'fixtures', 'diagrams');
const BEGIN = '/*SPECS-BEGIN*/', END = '/*SPECS-END*/';

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const names = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
function embedBlock() {
  const specs = {}, invalid = {};
  names(fixDir).forEach((n) => { specs[n] = readJson(path.join(fixDir, n + '.json')); });
  names(path.join(fixDir, 'invalid')).forEach((n) => { invalid['invalid-' + n] = readJson(path.join(fixDir, 'invalid', n + '.json')); });
  return BEGIN + 'const SPECS = ' + JSON.stringify(specs) + ';\nconst INVALID = ' + JSON.stringify(invalid) + ';' + END;
}
function sync() {
  const html = fs.readFileSync(labFile, 'utf8'), a = html.indexOf(BEGIN), b = html.indexOf(END);
  if (a < 0 || b < 0) throw new Error('markers missing in diagram-lab.html');
  const next = html.slice(0, a) + embedBlock() + html.slice(b + END.length);
  if (next !== html) fs.writeFileSync(labFile, next);
  return next !== html;
}
if (process.argv.includes('--sync')) {
  console.log(sync() ? 'synced diagram-lab.html' : 'diagram-lab.html already current');
  process.exit(0);
}

function findChrome() {
  const c = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return c.find((p) => fs.existsSync(p)) || null;
}
const chrome = findChrome();
const skipMsg = chrome ? false : 'no Chrome or Edge found on this machine; install one to run the diagram tests';

function dumpDom(url) {
  return new Promise((resolve, reject) => {
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'md-diagram-'));
    const p = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1600,900', '--user-data-dir=' + prof, '--disable-extensions', '--disable-background-networking', '--virtual-time-budget=3000', '--dump-dom', url], { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    const timer = setTimeout(() => p.kill(), 60000);
    p.stdout.on('data', (d) => { out += d; });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', () => { clearTimeout(timer); try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} resolve(out); });
  });
}
const result = (dom) => { const m = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/); return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : 'no #result in DOM'; };
const labUrl = (name, query = '?selftest=1') => pathToFileURL(labFile).href + query + '#' + name;

test('lab embeds the current fixtures', () => {
  const html = fs.readFileSync(labFile, 'utf8');
  assert.ok(html.includes(embedBlock()), 'diagram-lab.html is out of date: run node skills/motion-deck/scripts/tests/diagram.test.mjs --sync');
});
test('at least 12 valid fixtures and 4 invalid ones', () => {
  assert.ok(names(fixDir).length >= 12, 'valid fixtures: ' + names(fixDir).length);
  assert.ok(names(path.join(fixDir, 'invalid')).length >= 4);
});

describe('headless Chrome', { concurrency: 4, skip: skipMsg }, () => {
  for (const n of names(fixDir)) {
    test('fixture ' + n + ' mounts, steps, captures and measures clean', async () => {
      const r = result(await dumpDom(labUrl(n)));
      assert.match(r, /^PASS /, r);
    });
  }
  for (const n of names(path.join(fixDir, 'invalid'))) {
    test('invalid ' + n + ' throws the recorded error', async () => {
      const expect = readJson(path.join(fixDir, 'invalid', n + '.json')).expect;
      const r = result(await dumpDom(labUrl('invalid-' + n)));
      assert.match(r, /^PASS threw /, r);
      assert.ok(r.includes(expect), 'message should contain: ' + expect + '\ngot: ' + r);
    });
  }
  for (const [label, q] of [['light theme', '?selftest=1&theme=light'], ['serif fonts', '?selftest=1&font=serif'], ['light serif', '?selftest=1&theme=light&font=serif']]) {
    for (const n of ['layered', 'human-loop']) {
      test(label + ' passes for ' + n, async () => {
        const r = result(await dumpDom(labUrl(n, q)));
        assert.match(r, /^PASS /, q + ' ' + r);
      });
    }
  }
});
