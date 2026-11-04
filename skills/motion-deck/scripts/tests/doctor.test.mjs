// node --test scripts/tests/doctor.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { diagnose } from '../doctor.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const work = mkdtempSync(join(tmpdir(), 'md-doctor-'));
after(() => rmSync(work, { recursive: true, force: true }));
const found = { name: 'chrome', path: '/x/chrome' };

test('a complete install passes', async () => {
  const r = await diagnose({ find: (n) => (n === 'chrome' ? found : null) });
  assert.equal(r.problems, 0, r.lines.join('\n'));
  assert.ok(r.lines.some((l) => /^ok fonts \d+ faces of \d+ families/.test(l)));
  assert.ok(r.lines.some((l) => /^ok browser chrome \(\/x\/chrome\)$/.test(l)));
});

test('an old Node and a missing browser fail with the reason', async () => {
  const r = await diagnose({ nodeVersion: '20.1.0', find: () => null });
  assert.equal(r.problems, 2);
  assert.ok(r.lines.some((l) => /^fail node 20\.1\.0 is too old/.test(l)));
  assert.ok(r.lines.some((l) => /^fail browser no Chrome or Edge found/.test(l)));
});

test('a deck built by another generator version only warns; a missing stamp warns too; a missing file fails', async () => {
  const old = join(work, 'old.html');
  writeFileSync(old, '<!doctype html><html><head><meta name="generator" content="motion-deck 0"></head><body></body></html>');
  const bare = join(work, 'bare.html');
  writeFileSync(bare, '<!doctype html><html><head></head><body></body></html>');
  const a = await diagnose({ deck: old, find: () => found });
  assert.equal(a.problems, 0);
  assert.ok(a.lines.some((l) => /^warn deck built by generator 0, this skill is 1; rebuild the deck$/.test(l)));
  const b = await diagnose({ deck: bare, find: () => found });
  assert.ok(b.lines.some((l) => /^warn deck .* has no motion-deck generator stamp/.test(l)));
  assert.equal((await diagnose({ deck: join(work, 'nope.html'), find: () => found })).problems, 1);
});

test('CLI: final line, exit codes, usage error', () => {
  const run = (...args) => spawnSync(process.execPath, [join(skill, 'scripts', 'doctor.mjs'), ...args], { encoding: 'utf8', cwd: work });
  const ok = run();
  assert.match(ok.stdout.trim().split('\n').at(-1), /^(PASS doctor: \d+ warning\(s\)|FAIL doctor: \d+ problem\(s\), \d+ warning\(s\))$/);
  assert.equal(run('--nope').status, 2);
  assert.equal(run('a.html', 'b.html').status, 2);
});
