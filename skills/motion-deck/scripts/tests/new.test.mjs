import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NEW = path.join(ROOT, 'scripts', 'new.mjs');
const FIX = path.join(ROOT, 'examples', 'fixtures');

const dirs = [];
async function tmp() {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'md-new-'));
  dirs.push(d);
  return d;
}
test.after(() => Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true }))));

const run = (cwd, ...args) => spawnSync(process.execPath, [NEW, ...args], { cwd, encoding: 'utf8' });
const last = (r) => r.stdout.trim().split('\n').at(-1);

test('creates deck.src.html with the config filled in and an empty assets folder', async () => {
  const cwd = await tmp();
  const r = run(cwd, 'my-talk', '--theme', 'editorial', '--title', 'Say "hi" <now>', '--lang', 'it');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const file = path.join(cwd, 'decks', 'my-talk', 'deck.src.html');
  const text = await fs.readFile(file, 'utf8');
  assert.doesNotMatch(text, /\{\{/);
  const config = JSON.parse(/<script type="application\/json" id="deck-config">([\s\S]*?)<\/script>/.exec(text)[1]);
  assert.equal(config.title, 'Say "hi" <now>');
  assert.equal(config.theme, 'editorial');
  assert.equal(config.lang, 'it');
  assert.deepEqual(await fs.readdir(path.join(cwd, 'decks', 'my-talk', 'assets')), []);
  assert.match(r.stdout, /^PASS new: my-talk \(theme editorial, lang it\)$/m);
});

test('defaults: theme space, title from the slug, folder decks', async () => {
  const cwd = await tmp();
  assert.equal(run(cwd, 'q3-review-2026').status, 0);
  const text = await fs.readFile(path.join(cwd, 'decks', 'q3-review-2026', 'deck.src.html'), 'utf8');
  assert.match(text, /"title": "Q3 review 2026"/);
  assert.match(text, /"theme": "space"/);
  assert.match(text, /"lang": "en"/);
});

test('the last printed line is the exact build command, and it builds the deck', async () => {
  const cwd = await tmp();
  const r = run(cwd, 'starter', '--theme', 'test', '--dir', 'out/decks');
  assert.equal(r.status, 0);
  const cmd = last(r);
  const buildScript = path.join(ROOT, 'scripts', 'build.mjs').split(path.sep).join('/');
  const deck = path.join(cwd, 'out', 'decks', 'starter', 'deck.src.html').split(path.sep).join('/');
  assert.equal(cmd, `node ${buildScript.includes(' ') ? `"${buildScript}"` : buildScript} ${deck.includes(' ') ? `"${deck}"` : deck}`);
  const result = await build({
    src: deck, engineDir: path.join(FIX, 'engine-stub'), themesDir: path.join(FIX, 'themes-stub'), fontsDir: path.join(ROOT, 'themes', '_shared', 'fonts'),
  });
  assert.equal(result.slides, 3);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.out, path.join(cwd, 'out', 'decks', 'starter', 'index.html'));
});

test('refuses to overwrite an existing deck', async () => {
  const cwd = await tmp();
  assert.equal(run(cwd, 'again').status, 0);
  const file = path.join(cwd, 'decks', 'again', 'deck.src.html');
  await fs.writeFile(file, 'mine');
  const r = run(cwd, 'again');
  assert.equal(r.status, 1);
  assert.match(last(r), /^FAIL new: .*already exists, nothing was written$/);
  assert.equal(await fs.readFile(file, 'utf8'), 'mine');
});

test('usage errors exit 2 and write nothing', async () => {
  const cwd = await tmp();
  for (const args of [[], ['Bad_Slug'], ['-x'], ['a b'], ['ok', '--theme'], ['ok', '--theme', '../up'], ['ok', '--lang', 'english'], ['ok', '--nope', '1'], ['one', 'two']]) {
    const r = run(cwd, ...args);
    assert.equal(r.status, 2, `args ${JSON.stringify(args)}: ${r.stdout}`);
    assert.match(last(r), /^FAIL new: /);
  }
  assert.equal((await fs.readdir(cwd)).filter((n) => n !== 'tmp').length, 0);
});

test('--template copies a starter deck, builds, and keeps its own title, theme and language unless told otherwise', async () => {
  const { TEMPLATE_KINDS } = await import('../lib/templates.mjs');
  assert.ok(TEMPLATE_KINDS.length >= 6);
  for (const kind of TEMPLATE_KINDS) {
    const cwd = await tmp();
    const r = run(cwd, 'x', '--template', kind);
    assert.equal(r.status, 0, kind + ': ' + r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`^PASS new: x \\(template ${kind}, theme from the template, lang from the template\\)$`, 'm'));
    const file = path.join(cwd, 'decks', 'x', 'deck.src.html');
    const built = await build({ src: file, out: path.join(cwd, 'out.html'), log: () => {} });
    assert.deepEqual(built.warnings, [], kind);
    assert.ok(built.slides >= 9, kind);
  }
  const cwd = await tmp();
  const r = run(cwd, 'y', '--template', 'pitch', '--theme', 'neon', '--title', 'Say "hi" <now>', '--lang', 'it');
  assert.equal(r.status, 0, r.stdout);
  const text = await fs.readFile(path.join(cwd, 'decks', 'y', 'deck.src.html'), 'utf8');
  const config = JSON.parse(/<script type="application\/json" id="deck-config">([\s\S]*?)<\/script>/.exec(text)[1]);
  assert.deepEqual([config.title, config.theme, config.lang], ['Say "hi" <now>', 'neon', 'it']);
  assert.equal(config.author, 'Mara Okafor');
});

test('--template with an unknown kind exits 2 and lists the kinds', async () => {
  const cwd = await tmp();
  const r = run(cwd, 'z', '--template', 'nope');
  assert.equal(r.status, 2);
  assert.match(last(r), /^FAIL new: unknown template "nope"; choose one of pitch, quarterly-review, tech-talk, workshop, lesson, keynote$/);
});

test('--list-layouts prints every layout of the contract', async () => {
  const cwd = await tmp();
  const r = run(cwd, '--list-layouts');
  assert.equal(r.status, 0, r.stdout);
  const names = r.stdout.split('\n').map((l) => l.split(/\s+/)[0]).filter(Boolean);
  assert.deepEqual(names.slice(0, 14), ['title', 'chapter', 'statement', 'content', 'split', 'diagram', 'stats', 'quote', 'code', 'cards', 'timeline', 'image', 'closing', 'blank']);
  assert.match(last(r), /^PASS new: layouts$/);
});
