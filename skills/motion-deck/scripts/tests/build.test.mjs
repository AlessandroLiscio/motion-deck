import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, BuildError } from '../build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIX = path.join(ROOT, 'examples', 'fixtures');
const OWN = path.join(ROOT, 'scripts', 'fixtures', 'build');
const STUBS = { engineDir: path.join(FIX, 'engine-stub'), themesDir: path.join(FIX, 'themes-stub'), fontsDir: path.join(ROOT, 'themes', '_shared', 'fonts') };
const MIN = path.join(FIX, 'decks', 'min.src.html');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const CONFIG = '<script type="application/json" id="deck-config">{ "title": "T", "theme": "test" }</script>\n';
const SLIDE = '<section class="slide"><h2>One</h2></section>\n';

const tmpDirs = [];
async function tmp() {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), 'md-build-'));
  tmpDirs.push(d);
  return d;
}
test.after(() => Promise.all(tmpDirs.map((d) => fs.rm(d, { recursive: true, force: true }))));

// Writes a source file (and any extra files, by relative path) into a fresh folder and builds it with the stubs.
async function buildText(source, { files = {}, ...extra } = {}) {
  const dir = await tmp();
  for (const [name, data] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await fs.writeFile(path.join(dir, name), data);
  }
  const src = path.join(dir, 'deck.src.html');
  await fs.writeFile(src, source);
  const out = path.join(dir, 'out.html');
  const result = await build({ src, out, ...STUBS, ...extra });
  return { ...result, html: await fs.readFile(out, 'utf8'), dir };
}

// Only the two families the stub theme uses, so the copy stays fast.
async function copyFonts(to) {
  for (const f of ['fonts.json', 'manrope', 'jetbrains-mono']) await fs.cp(path.join(STUBS.fontsDir, f), path.join(to, f), { recursive: true });
}

const fails = (code, pattern) => (e) => {
  assert.ok(e instanceof BuildError, `expected BuildError, got ${e}`);
  assert.equal(e.code, code, e.message);
  if (pattern) assert.match(e.message, pattern);
  return true;
};

// A copy of the stub themes folder in which the theme "test" is changed by `edit(dir)`.
async function themesWith(edit) {
  const themesDir = await tmp();
  await fs.cp(path.join(STUBS.themesDir, 'test'), path.join(themesDir, 'test'), { recursive: true });
  await edit(path.join(themesDir, 'test'));
  return themesDir;
}
const editJson = (file, fn) => async (dir) => {
  const p = path.join(dir, file);
  const json = JSON.parse(await fs.readFile(p, 'utf8'));
  fn(json);
  await fs.writeFile(p, JSON.stringify(json));
};

test('happy path: order, ids, fonts, license, escaping, determinism', async () => {
  const a = await buildText(await fs.readFile(MIN, 'utf8'));
  assert.equal(a.slides, 3);
  assert.equal(a.theme, 'test');
  assert.deepEqual(a.fonts, ['manrope', 'jetbrains-mono']);
  assert.deepEqual(a.warnings, []);
  const marks = ['<!doctype html>', '<html lang="en" data-theme="test">', '<meta charset', 'name="viewport"', 'name="generator"', '<title>Fixture deck</title>', 'name="description"',
    '<!--', 'id="deck-fonts"', 'id="deck-engine"', 'id="deck-theme"', 'id="deck-custom"', '<body class="deck">', '<canvas id="ambient" aria-hidden="true">',
    '<div id="viewport"><div id="stage">', 'id="s1"', 'id="s2"', 'id="s3"', 'id="deck-config"', 'id="deck-diagram"', 'id="deck-engine-js"', 'id="deck-theme-js"'];
  let last = -1;
  for (const m of marks) {
    const at = a.html.indexOf(m);
    assert.ok(at > last, `${m} should come after position ${last}, found at ${at}`);
    last = at;
  }
  assert.equal((a.html.match(/@font-face/g) || []).length, 2);
  assert.match(a.html, /<section class="slide" data-sec="a" id="s2" data-title="Two steps">/);
  const license = a.html.slice(a.html.indexOf('<!--'), a.html.indexOf('-->') + 3);
  assert.match(license, /Permission is hereby granted/);
  assert.match(license, /Copyright \(c\) 2026 Alessandro Liscio/);
  assert.match(license, /Copyright 2018 The Manrope Project Authors/);
  assert.match(license, /Source: https:\/\/github\.com\/google\/fonts\/tree\/main\/ofl\/jetbrainsmono/);
  assert.equal((license.match(/^SIL OPEN FONT LICENSE/gm) || []).length, 2, 'two different OFL texts, each once');
  assert.equal((a.html.match(/<\/script/gi) || []).length, (a.html.match(/<script/gi) || []).length);
  const b = await buildText(await fs.readFile(MIN, 'utf8'));
  assert.equal(a.html, b.html, 'two builds are byte-identical');
});

test('identical OFL text is printed once', async () => {
  const fontsDir = await tmp();
  await copyFonts(fontsDir);
  const text = await fs.readFile(path.join(fontsDir, 'manrope', 'OFL.txt'), 'utf8');
  await fs.writeFile(path.join(fontsDir, 'jetbrains-mono', 'OFL.txt'), text);
  const r = await buildText(await fs.readFile(MIN, 'utf8'), { fontsDir });
  assert.equal((r.html.match(/^SIL OPEN FONT LICENSE/gm) || []).length, 1);
  assert.match(r.html, /License text for Manrope, JetBrains Mono/);
});

test('normalization: defaults for id, data-sec and data-title', async () => {
  const r = await buildText(CONFIG + [
    '<section class="slide"><h1>First <b>big</b>\n  &amp; bold&nbsp;one</h1></section>',
    '<section class="slide" data-sec="x" data-title="Kept"><h2>Ignored</h2></section>',
    '<section class="slide" id="mine" data-sec=""><p>No heading</p></section>',
    '<section class="slide"><!-- <h2>not this</h2> --><h2 class="t">Second &lt;one&gt;</h2></section>',
  ].join('\n'));
  assert.match(r.html, /<section class="slide" id="s1" data-sec="main" data-title="First big &amp; bold one">/);
  assert.match(r.html, /<section class="slide" data-sec="x" data-title="Kept" id="s2">/);
  assert.match(r.html, /<section class="slide" id="mine" data-sec="x" data-title="Slide 3">/);
  assert.match(r.html, /id="s4" data-sec="x" data-title="Second &lt;one&gt;"/);
});

test('E_SOURCE in many forms, each with a line number', async () => {
  const cases = {
    'missing config': [SLIDE, /missing .*deck-config/],
    'second config': [CONFIG + CONFIG + SLIDE, /line 2: second script#deck-config/],
    'nested section': [CONFIG + '<section class="slide">\n<section class="slide"></section></section>', /line 3: nested <section> \(slide starting at line 2\)/],
    'no slides': [CONFIG + '<style>a{}</style>', /no <section class="slide">/],
    'foreign top-level element': [CONFIG + '<div>hi</div>\n' + SLIDE, /line 2: unexpected top-level <div>/],
    'section without the slide class': [CONFIG + '<section class="intro"></section>', /unexpected top-level <section>/],
    'stray text': [CONFIG + 'hello\n' + SLIDE, /line 2: text outside any element/],
    'unterminated slide': [CONFIG + '<section class="slide"><h2>x</h2>', /line 2: slide <section> is never closed/],
    'unterminated comment': [CONFIG + '<!-- oops\n' + SLIDE, /line 2: unterminated comment/],
    'style after a slide': [CONFIG + SLIDE + '<style>a{}</style>', /line 3: <style> must come before/],
    'duplicate slide id': [CONFIG + '<section class="slide" id="a"></section>\n<section class="slide" id="a"></section>', /duplicate slide id "a"/],
    'auto id collides': [CONFIG + SLIDE + '<section class="slide" id="s1"></section>', /duplicate slide id "s1"/],
  };
  for (const [name, [text, pattern]] of Object.entries(cases)) {
    await assert.rejects(buildText(text), fails('E_SOURCE', pattern), name);
  }
});

test('tricky source: markup-looking text in scripts, comments, styles and attributes', async () => {
  const r = await buildText(await fs.readFile(path.join(OWN, 'tricky.src.html'), 'utf8'));
  assert.equal(r.slides, 2);
  assert.doesNotMatch(r.html, /commented out/);
  assert.match(r.html, /<title>Tricky &lt;deck&gt; &amp; &quot;quotes&quot;<\/title>/);
  assert.match(r.html, /<meta name="description" content="less &lt; than &amp; greater &gt; than">/);
  assert.ok(r.html.includes('data-title="a > b and <i>"'), 'author attributes are untouched');
  assert.ok(r.html.includes('{ "nodes": [{ "id": "a", "label": "</section> <section class=\\"slide\\">", "step": 1 }] }'), 'json body is untouched');
  assert.match(r.html, /id="s2" data-sec="main" data-title="Slide 2"|data-title="Slide 2"/);
  assert.match(r.html, /<style id="deck-custom">\n\s*\.slide p::after \{ content: "<\/section>"; \}/);
});

test('E_CONFIG and W_CONFIG_KEY', async () => {
  const bad = (json) => `<script type="application/json" id="deck-config">${json}</script>\n${SLIDE}`;
  await assert.rejects(buildText(bad('{ "theme": "test" }')), fails('E_CONFIG', /"title" is required/));
  await assert.rejects(buildText(bad('{ "title": "  " }')), fails('E_CONFIG', /"title"/));
  await assert.rejects(buildText(bad('{ "title": "x", }')), fails('E_CONFIG', /not valid JSON/));
  await assert.rejects(buildText(bad('{ "title": "x", "accent": "blue" }')), fails('E_CONFIG', /"accent"/));
  await assert.rejects(buildText(bad('{ "title": "x", "lang": "english language" }')), fails('E_CONFIG', /"lang"/));
  await assert.rejects(buildText(bad('{ "title": "x", "sections": [{ "id": "a", "accent": 9 }] }')), fails('E_CONFIG', /accent/));
  const ok = await buildText(bad('{ "title": "x", "theme": "test", "accent": "#2a7", "colour": 1 }'));
  assert.deepEqual(ok.warnings.map((w) => w.code), ['W_CONFIG_KEY']);
  assert.match(ok.warnings[0].message, /"colour"/);
  assert.doesNotMatch(ok.html, /colour/);
  const dflt = await buildText(bad('{ "title": "x" }'), { themeOverride: 'test' });
  assert.match(dflt.html, /<html lang="en" data-theme="test">/);
});

test('theme defaults to space and --theme overrides the config', async () => {
  await assert.rejects(buildText(`<script type="application/json" id="deck-config">{ "title": "x" }</script>${SLIDE}`), fails('E_THEME', /unknown theme "space".*available: test/));
  const r = await buildText(`<script type="application/json" id="deck-config">{ "title": "x", "theme": "nope" }</script>${SLIDE}`, { themeOverride: 'test' });
  assert.equal(r.theme, 'test');
  assert.match(r.html, /"theme":"test"/);
});

test('E_THEME in several forms', async () => {
  const build1 = (themesDir) => buildText(CONFIG + SLIDE, { themesDir });
  const cases = [
    ['name differs from folder', editJson('theme.json', (j) => { j.name = 'other'; }), /"name" is "other" but the folder is "test"/],
    ['font id not in the registry', editJson('theme.json', (j) => { j.fonts[0].id = 'comic-sans'; }), /"comic-sans" is not in fonts\.json/],
    ['more than 4 font files', editJson('theme.json', (j) => { j.fonts = ['source-serif-4', 'eb-garamond', 'manrope'].map((id) => ({ id, role: 'body' })); }), /5 font files, at most 4/],
    ['theme.css missing', (d) => fs.rm(path.join(d, 'theme.css')), /theme\.css is missing/],
    ['theme.js missing', (d) => fs.rm(path.join(d, 'theme.js')), /theme\.js is missing/],
    ['five accents', editJson('theme.json', (j) => { j.accents.pop(); }), /exactly 6 hex colors/],
    ['bg not a color', editJson('theme.json', (j) => { j.bg = 'black'; }), /"bg" must be a hex color/],
    ['bad role', editJson('theme.json', (j) => { j.fonts[0].role = 'fancy'; }), /role must be/],
    ['broken json', (d) => fs.writeFile(path.join(d, 'theme.json'), '{ nope'), /not valid JSON/],
  ];
  for (const [name, edit, pattern] of cases) {
    await assert.rejects(build1(await themesWith(edit)), fails('E_THEME', pattern), name);
  }
});

test('E_REMOTE: src, stylesheet url(), @import, protocol-relative; anchors and fragments pass', async () => {
  const slide = (inner) => `${CONFIG}<section class="slide">${inner}</section>`;
  const cases = {
    'img src https': [slide('<img src="https://example.com/a.png">'), /remote reference "https:\/\/example\.com\/a\.png"/],
    'img src protocol-relative': [slide('<img src="//cdn.example.com/a.png">'), /remote reference/],
    'script src': [slide('<script src="http://example.com/x.js"></script>'), /remote reference/],
    'svg image href': [slide('<svg><image href="https://example.com/a.svg"/></svg>'), /remote reference/],
    'url() in a slide style attribute': [slide('<div style="background:url(https://example.com/a.png)"></div>'), /remote reference/],
    'url() in a deck style': [`${CONFIG}<style>\n.a { background: url("//cdn.example.com/a.png"); }</style>${SLIDE}`, /line 3: remote reference/],
    '@import url': [`${CONFIG}<style>@import url(https://fonts.example.com/f.css);</style>${SLIDE}`, /@import of "https:\/\/fonts\.example\.com\/f\.css"/],
    '@import string': [`${CONFIG}<style>@import "http://example.com/f.css";</style>${SLIDE}`, /@import of/],
  };
  for (const [name, [text, pattern]] of Object.entries(cases)) await assert.rejects(buildText(text), fails('E_REMOTE', pattern), name);
  const ok = await buildText(slide('<a href="https://example.com">link</a><svg><defs><linearGradient id="g"/></defs><use href="#g"/><rect style="fill:url(#g)"/></svg>'));
  assert.equal(ok.warnings.length, 0);
});

test('assets: missing file with the referencing line, size limits', async () => {
  const src = `${CONFIG}<section class="slide">\n<p>x</p>\n<img src="assets/nope.png">\n</section>`;
  await assert.rejects(buildText(src), fails('E_ASSET_MISSING', /line 4: "assets\/nope\.png" not found/));
  const img = `${CONFIG}<section class="slide"><img src="big.png"></section>`;
  await assert.rejects(buildText(img, { files: { 'big.png': Buffer.alloc(2 * 1024 * 1024 + 1) } }), fails('E_ASSET_SIZE', /over the 2 MB limit/));
  const warn = await buildText(img, { files: { 'big.png': Buffer.alloc(310 * 1024) } });
  assert.deepEqual(warn.warnings.map((w) => w.code), ['W_ASSET_SIZE']);
  assert.match(warn.warnings[0].message, /310 KB/);
  await assert.rejects(buildText(`${CONFIG}<section class="slide"><img src="a.bmp"></section>`, { files: { 'a.bmp': 'x' } }), fails('E_SOURCE', /cannot be inlined/));
});

test('assets: png and svg are inlined from img, image, style blocks and style attributes', async () => {
  const dir = await tmp();
  await fs.cp(path.join(OWN, 'images'), dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'assets', 'dot.png'), PNG);
  const out = path.join(dir, 'out.html');
  const r = await build({ src: path.join(dir, 'images.src.html'), out, ...STUBS });
  const html = await fs.readFile(out, 'utf8');
  const pngUri = `data:image/png;base64,${PNG.toString('base64')}`;
  const svgUri = `data:image/svg+xml;base64,${(await fs.readFile(path.join(dir, 'assets', 'dot.svg'))).toString('base64')}`;
  assert.ok(html.includes(`<img src="${pngUri}" alt="dot">`));
  assert.ok(html.includes(`<img src="${svgUri}" alt="svg dot">`));
  assert.ok(html.includes('src="data:image/gif;base64,R0lGODlhAQABAAAAACw="'), 'data: URIs pass through');
  assert.ok(html.includes(`style="background-image: url('${svgUri}')"`));
  assert.ok(html.includes(`<image href="${pngUri}" `) && html.includes(`<image xlink:href="${svgUri}" `));
  assert.ok(html.includes(`.hero { background: url(${pngUri}) center / cover; }`));
  assert.ok(html.includes('.grad { fill: url(#g); }'));
  assert.ok(html.includes('<a href="https://example.com/docs">'));
  assert.doesNotMatch(html, /assets\/dot/);
  assert.deepEqual(r.warnings, []);
});

test('E_LICENSE: no LICENSE up the tree, a text that cannot sit in a comment', async () => {
  const root = path.join(await tmp(), 'a', 'b', 'c', 'd', 'skill');
  await fs.mkdir(root, { recursive: true });
  await assert.rejects(buildText(CONFIG + SLIDE, { skillRoot: root }), fails('E_LICENSE', /no LICENSE file/));
  const fontsDir = await tmp();
  await copyFonts(fontsDir);
  const p = path.join(fontsDir, 'manrope', 'OFL.txt');
  await fs.writeFile(p, (await fs.readFile(p, 'utf8')) + '\nend --> of text\n');
  await assert.rejects(buildText(CONFIG + SLIDE, { fontsDir }), fails('E_LICENSE', /-->/));
  await fs.writeFile(p, 'Copyright 2018 nobody\n');
  await assert.rejects(buildText(CONFIG + SLIDE, { fontsDir }), fails('E_LICENSE', /SIL OPEN FONT LICENSE/));
});

test('CLI: exit codes and final lines', async () => {
  const dir = await tmp();
  const cli = path.join(ROOT, 'scripts', 'build.mjs');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  const flags = ['--engine', STUBS.engineDir, '--themes', STUBS.themesDir, '--fonts', STUBS.fontsDir];
  const ok = run(MIN, '--out', path.join(dir, 'min.html'), ...flags);
  assert.equal(ok.status, 0, ok.stdout);
  const lines = ok.stdout.trim().split('\n');
  assert.match(lines[0], /^ok parse 3 slides$/);
  assert.match(lines.at(-1), /^PASS build: .*min\.html \d+ KB, 3 slides, theme test, 0 warnings$/);
  await fs.access(path.join(dir, 'tmp', 'reports', 'build', 'build.log'));
  const badSrc = path.join(dir, 'bad.src.html');
  await fs.writeFile(badSrc, SLIDE);
  const bad = run(badSrc, ...flags);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout.trim().split('\n').at(-1), /^FAIL build: E_SOURCE line 1: missing /);
  assert.equal(run().status, 2);
  assert.equal(run(MIN, '--bogus').status, 2);
  assert.equal(run(path.join(dir, 'missing.html'), ...flags).status, 2);
});

const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
  .find((p) => existsSync(p));

test('smoke: the built deck boots in headless Chrome', { skip: CHROME ? false : 'Chrome not found, smoke test skipped' }, async () => {
  const r = await buildText(await fs.readFile(MIN, 'utf8'));
  const profile = await tmp();
  const res = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--virtual-time-budget=3000', '--dump-dom', pathToFileURL(path.join(r.dir, 'out.html')).href],
    { encoding: 'utf8', timeout: 150000, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(res.status, 0, `chrome: status ${res.status} signal ${res.signal} ${res.error ?? ''} ${res.stderr?.slice(0, 200)}`);
  assert.match(res.stdout, /<html[^>]*data-theme="test"/);
  assert.match(res.stdout, /<section class="slide[^"]*\bactive\b[^"]*"/);
});
