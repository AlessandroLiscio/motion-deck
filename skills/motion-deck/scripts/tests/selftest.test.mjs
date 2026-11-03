// node --test scripts/tests/selftest.test.mjs
// Runs `selftest.mjs --quick` (Chrome or Edge, first theme) and asserts the PASS line. Skips when no browser is installed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../lib/browser.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'selftest.mjs');
const PREFIX = `md-check-profile-s${process.pid}-`; // unique to this test run, so other runs in parallel do not count
const profiles = () => new Set(readdirSync(tmpdir()).filter((n) => n.startsWith(PREFIX)));

test('selftest --quick passes and leaves no browser profile behind', { skip: findBrowser('auto') ? false : 'no Chrome or Edge installed' }, () => {
  const out = mkdtempSync(join(tmpdir(), 'md-selftest-test-out-'));
  const before = profiles();
  try {
    const res = spawnSync(process.execPath, [script, '--quick', '--out', out], { encoding: 'utf8', timeout: 540000, env: { ...process.env, MD_CHECK_PROFILE_PREFIX: PREFIX } });
    const last = res.stdout.trim().split('\n').pop();
    assert.equal(res.status, 0, res.stdout);
    assert.match(last, /^PASS selftest: (chrome|edge), 1 theme, \d+ slides, \d+ states, features map\/hash\/back\/step-out\/reduced-motion\/presenter\/morph\/pdf\/offline, 0 overflow, 0 console errors, 0 missing fonts$/);
    assert.deepEqual([...profiles()].filter((n) => !before.has(n)), [], 'browser profile directory left behind');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('selftest rejects bad arguments with exit 2', () => {
  const res = spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' });
  assert.equal(res.status, 2);
  assert.match(res.stdout.trim().split('\n').pop(), /^FAIL selftest: tool error: /);
});
