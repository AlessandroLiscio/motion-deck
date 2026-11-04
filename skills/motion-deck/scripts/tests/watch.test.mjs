// node --test scripts/tests/watch.test.mjs
// build.mjs --watch (contract 7): the dev server rebuilds on save, tells open pages through server-sent events, shows a broken source as an error and keeps the last good page.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { startWatch } from '../lib/watch.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const work = [];
after(() => Promise.all(work.map((d) => rm(d, { recursive: true, force: true }))));

const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
  }).on('error', reject);
});

// A server-sent events client: next(name) resolves with the next event of that name.
function events(url) {
  const seen = [];
  const req = http.get(url, (res) => {
    res.setEncoding('utf8');
    let buf = '';
    res.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const name = /^event: (.*)$/m.exec(block)?.[1];
        if (!name) continue;
        seen.push({ name, data: /^data: (.*)$/m.exec(block)?.[1] || '' });
      }
    });
  });
  req.on('error', () => {});
  const next = (name, ms = 8000) => new Promise((resolve, reject) => {
    const end = Date.now() + ms;
    const look = () => {
      const k = seen.findIndex((e) => e.name === name);
      if (k >= 0) return resolve(seen.splice(k, 1)[0]);
      if (Date.now() > end) return reject(new Error(`no "${name}" event within ${ms} ms (saw ${seen.map((e) => e.name).join(', ') || 'none'})`));
      setTimeout(look, 50);
    };
    look();
  });
  return { next, close: () => req.destroy() };
}

async function starter(title) {
  const dir = await mkdtemp(join(tmpdir(), 'md-watch-'));
  work.push(dir);
  const template = await readFile(join(skill, 'templates', 'deck.src.html'), 'utf8');
  const text = (t) => template.replace(/\{\{title\}\}/g, t).replace(/\{\{theme\}\}/g, 'space').replace(/\{\{lang\}\}/g, 'en');
  const src = join(dir, 'deck.src.html');
  await writeFile(src, text(title));
  return { dir, src, out: join(dir, 'index.html'), text };
}

test('serves the deck with the reload client, rebuilds on save, reports a broken source and recovers', async () => {
  const d = await starter('Watch me');
  const lines = [];
  const w = await startWatch({ src: d.src, out: d.out, build: () => build({ src: d.src, out: d.out, log: () => {} }), log: (l) => lines.push(l), debounce: 40 });
  try {
    assert.match(w.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    const page = await get(w.url);
    assert.equal(page.status, 200);
    assert.match(page.type, /^text\/html/);
    assert.match(page.body, /EventSource\('\/__md_events'\)/);
    assert.match(page.body, /Your title here/);
    assert.doesNotMatch(await readFile(d.out, 'utf8'), /__md_events/, 'the file on disk stays clean');
    assert.equal((await get(`${w.url}nope`)).status, 404);

    const sse = events(`${w.url}__md_events`);
    try {
      await writeFile(d.src, (await readFile(d.src, 'utf8')).replace('Your title here', 'A changed title'));
      await sse.next('reload');
      assert.match((await get(w.url)).body, /A changed title/);
      assert.ok(w.rebuilds() >= 2);

      await writeFile(d.src, '<div>not a deck</div>');
      const problem = await sse.next('problem');
      assert.match(problem.data, /E_SOURCE|E_CONFIG/);
      assert.match((await get(w.url)).body, /A changed title/, 'the last good page is still served');

      await writeFile(d.src, d.text('Fixed'));
      await sse.next('reload');
      assert.match((await get(w.url)).body, /Fixed/);
    } finally {
      sse.close();
    }
    assert.ok(lines.some((l) => /^fail rebuild: /.test(l)) && lines.some((l) => /^ok rebuild /.test(l)), lines.join('\n'));
  } finally {
    await w.close();
  }
});

test('its own output file does not trigger a rebuild loop', async () => {
  const d = await starter('Quiet');
  const w = await startWatch({ src: d.src, out: d.out, build: () => build({ src: d.src, out: d.out, log: () => {} }), debounce: 30 });
  try {
    const before = w.rebuilds();
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(w.rebuilds(), before);
  } finally {
    await w.close();
  }
});

test('CLI: build.mjs --watch prints the address, serves the deck and stops on SIGINT; --check without --watch is a usage error', async () => {
  const { spawn, spawnSync } = await import('node:child_process');
  const d = await starter('Cli');
  const bad = spawnSync(process.execPath, [join(skill, 'scripts', 'build.mjs'), d.src, '--check'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stdout, /FAIL build: --check and --port only go with --watch/);
  const child = spawn(process.execPath, [join(skill, 'scripts', 'build.mjs'), d.src, '--watch', '--port', '0'], { cwd: d.dir });
  const closed = new Promise((r) => child.once('close', r));
  try {
    const url = await new Promise((resolve, reject) => {
      let out = '';
      const t = setTimeout(() => reject(new Error(`no PASS watch line within 10 s: ${out}`)), 10000);
      child.stdout.on('data', (c) => {
        out += c;
        const m = /^PASS watch: (http:\/\/127\.0\.0\.1:\d+\/)/m.exec(out);
        if (m) { clearTimeout(t); resolve(m[1]); }
      });
      child.on('exit', (code) => { clearTimeout(t); reject(new Error(`exited with ${code}: ${out}`)); });
    });
    assert.match((await get(url)).body, /EventSource/);
  } finally {
    child.kill('SIGINT');
    await closed; // the folder is its working directory, Windows cannot remove it before the process is gone
  }
});
