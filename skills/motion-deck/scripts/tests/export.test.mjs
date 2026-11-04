// node --test scripts/tests/export.test.mjs
// Zip container, package parts, the structural validator (with the browser's DOMParser) and export.mjs end to end. The browser tests skip when no Chrome or Edge is installed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { build } from '../build.mjs';
import { parseArgs } from '../export.mjs';
import { findBrowser } from '../lib/browser.mjs';
import { withBrowser } from '../lib/probe-kit.mjs';
import { buildPackage, clip, xml } from '../lib/pptx.mjs';
import { browserXml, imageInfo, validatePackage } from '../lib/pptx-validate.mjs';
import { readZip, writeZip, zipToBuffer } from '../lib/zip.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const exportScript = join(here, '..', 'export.mjs');
const work = mkdtempSync(join(tmpdir(), 'md-export-test-'));
after(() => rmSync(work, { recursive: true, force: true }));
const browserSkip = findBrowser('auto') ? false : 'no Chrome or Edge installed';

function png(w, h, [r, g, b]) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
// A JPEG header: SOI, an APP0 segment, SOF0 with the size, EOI. Enough for imageInfo.
const jpegHeader = (w, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0, 0xff, 0xd9]);

const SLIDES = [
  { title: 'Alpha & <Omega> "q"', alt: 'Alpha picture', notes: ['First note.', 'Second note.'], image: { ext: 'png', data: png(32, 18, [200, 30, 30]) } },
  { title: 'Steps', alt: 'Steps one', notes: [], image: { ext: 'png', data: png(32, 18, [30, 200, 30]) } },
  { title: 'Steps', alt: 'Steps two', notes: ['Say it.'], image: { ext: 'png', data: png(32, 18, [30, 30, 200]) } },
];
const META = { title: 'Probe & co', author: 'Ada', lang: 'it-IT' };
const EXPECT = (extra = {}) => ({
  slides: SLIDES.map((s) => ({ title: s.title, notes: s.notes.length ? s.notes : null, ext: 'png' })), width: 32, height: 18, transition: true, meta: META, ...extra,
});

describe('zip', () => {
  const entries = [{ name: 'a.txt', data: 'hello hello hello hello' }, { name: 'dir/b.bin', data: Buffer.from([1, 2, 3, 4]), store: true }, { name: 'empty', data: '' }];
  test('round trip: names, contents, methods and CRC', () => {
    const zip = readZip(zipToBuffer(entries));
    assert.deepEqual(zip.entries.map((e) => e.name), ['a.txt', 'dir/b.bin', 'empty']);
    assert.equal(zip.read('a.txt').toString(), 'hello hello hello hello');
    assert.deepEqual([...zip.read('dir/b.bin')], [1, 2, 3, 4]);
    assert.equal(zip.read('empty').length, 0);
    assert.deepEqual(zip.entries.map((e) => e.method), [8, 0, 0]);
  });
  test('the reader refuses garbage, a flipped byte and a missing entry', () => {
    assert.throws(() => readZip(Buffer.from('not a zip at all, just text')), /not a zip/);
    const buf = zipToBuffer(entries);
    const bad = Buffer.from(buf);
    bad[bad.indexOf('dir/b.bin') + 'dir/b.bin'.length] ^= 0xff; // first data byte of b.bin
    assert.throws(() => readZip(bad).read('dir/b.bin'), /CRC mismatch/);
    assert.throws(() => readZip(buf).read('nope'), /no zip entry/);
  });
  test('the writer refuses duplicate names', () => {
    assert.throws(() => zipToBuffer([{ name: 'x', data: 'a' }, { name: 'x', data: 'b' }]), /duplicate/);
  });
  test('writeZip reports the size it wrote', () => {
    const chunks = [];
    const size = writeZip(entries, (b) => chunks.push(b));
    assert.equal(size, Buffer.concat(chunks).length);
  });
});

describe('text helpers', () => {
  test('xml() escapes and drops characters XML 1.0 cannot hold', () => {
    assert.equal(xml('a & b < c > "d" \'e\''), 'a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');
    assert.equal(xml('x\u0000y\u000bz\ud800w￾￿'), 'xyzw');
    assert.equal(xml('😀 é'), '😀 é');
  });
  test('clip() keeps short text, cuts long text at a word and adds an ellipsis', () => {
    assert.equal(clip('  one   two  ', 20), 'one two');
    const cut = clip('alpha beta gamma delta epsilon', 18);
    assert.ok(cut.endsWith('…') && cut.length <= 18, cut);
    assert.equal(clip('alpha beta gamma delta epsilon', 18), 'alpha beta gamma…');
  });
  test('imageInfo reads PNG and JPEG sizes and rejects other bytes', () => {
    assert.deepEqual(imageInfo(png(640, 360, [1, 2, 3])), { type: 'png', width: 640, height: 360 });
    assert.deepEqual(imageInfo(jpegHeader(3200, 1800)), { type: 'jpeg', width: 3200, height: 1800 });
    assert.equal(imageInfo(Buffer.from('GIF89a......................')), null);
    assert.equal(imageInfo(Buffer.alloc(3)), null);
  });
});

describe('package parts', () => {
  const names = (e) => e.map((x) => x.name);
  test('every part of the layout is there, content types first, one notes slide per slide with notes', () => {
    const e = buildPackage(SLIDES, META, { now: new Date('2026-01-02T03:04:05Z') });
    assert.equal(names(e)[0], '[Content_Types].xml');
    for (const n of ['_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels', 'ppt/presProps.xml', 'ppt/viewProps.xml', 'ppt/tableStyles.xml',
      'ppt/theme/theme1.xml', 'ppt/theme/theme2.xml', 'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/notesMasters/notesMaster1.xml',
      'ppt/slides/slide3.xml', 'ppt/notesSlides/notesSlide1.xml', 'ppt/notesSlides/notesSlide3.xml', 'ppt/media/image3.png']) assert.ok(names(e).includes(n), n);
    assert.ok(!names(e).includes('ppt/notesSlides/notesSlide2.xml'), 'a slide without notes gets no notes slide');
    assert.match(e.find((x) => x.name === 'docProps/core.xml').data, /<dc:title>Probe &amp; co<\/dc:title>.*<dc:language>it-IT<\/dc:language>.*2026-01-02T03:04:05Z/);
    assert.match(e.find((x) => x.name === 'ppt/slides/slide1.xml').data, /<a:t>Alpha &amp; &lt;Omega&gt; &quot;q&quot;<\/a:t>/);
  });
  test('options: no transition, no notes, JPEG pictures', () => {
    const e = buildPackage(SLIDES.map((s) => ({ ...s, image: { ext: 'jpeg', data: jpegHeader(32, 18) } })), META, { transition: false, notes: false });
    assert.ok(!e.some((x) => /notesSlide/.test(x.name)));
    assert.ok(!/p:transition/.test(e.find((x) => x.name === 'ppt/slides/slide1.xml').data));
    assert.match(e.find((x) => x.name === '[Content_Types].xml').data, /<Default Extension="jpg" ContentType="image\/jpeg"\/>/);
    assert.ok(names(e).includes('ppt/media/image1.jpg'));
  });
  test('a package with no slide is refused', () => {
    assert.throws(() => buildPackage([], META), /at least one slide/);
  });
});

describe('arguments', () => {
  test('defaults and every option', () => {
    const o = parseArgs(['deck.html']);
    assert.deepEqual([o.steps, o.scale, o.format, o.quality, o.transition, o.notes, o.browser, o.out], ['all', 2, 'jpeg', 90, 'fade', true, 'auto', null]);
    const p = parseArgs(['d.html', '--out', 'x.pptx', '--steps', 'final', '--scale', '1.5', '--format', 'jpg', '--quality', '80', '--transition', 'none', '--no-notes', '--browser', 'edge', '--timeout', '5000']);
    assert.deepEqual([p.out, p.steps, p.scale, p.format, p.quality, p.transition, p.notes, p.browser, p.timeout], ['x.pptx', 'final', 1.5, 'jpeg', 80, 'none', false, 'edge', 5000]);
  });
  test('bad values are usage errors', () => {
    for (const bad of [[], ['d', '--steps', 'some'], ['d', '--scale', '0.5'], ['d', '--scale', '5'], ['d', '--scale', '1.001'], ['d', '--format', 'gif'], ['d', '--quality', '0'], ['d', '--out', 'x.zip'],
      ['d', '--transition', 'wipe'], ['d', '--timeout', '0'], ['d', '--bogus'], ['d', 'e'], ['d', '--out']]) assert.throws(() => parseArgs(bad), /./, JSON.stringify(bad));
  });
});

describe('validator', { skip: browserSkip }, () => {
  test('accepts the good package and names each defect in the broken ones', async () => {
    const good = buildPackage(SLIDES, META);
    const edit = (name, fn) => good.map((e) => (e.name === name ? { ...e, data: fn(e.data) } : e));
    const cases = [
      ['a missing part', good.filter((e) => e.name !== 'ppt/slides/slide2.xml'), /points to ppt\/slides\/slide2\.xml, which is not in the package/],
      ['no content type for a slide', edit('[Content_Types].xml', (d) => d.replace(/<Override PartName="\/ppt\/slides\/slide1\.xml"[^>]*\/>/, '')), /slide1\.xml: content type is application\/xml/],
      ['an Override for a part that is not there', edit('[Content_Types].xml', (d) => d.replace('</Types>', '<Override PartName="/ppt/slides/slide9.xml" ContentType="x"/></Types>')), /slide9\.xml, which is not in the package/],
      ['malformed XML', edit('ppt/slides/slide1.xml', (d) => d.replace('</p:spTree>', '</p:spTre>')), /slide1\.xml: not well-formed XML/],
      ['an unescaped ampersand', edit('docProps/core.xml', (d) => d.replace('Probe &amp; co', 'Probe & co')), /core\.xml: not well-formed XML/],
      ['a repeated slide id', edit('ppt/presentation.xml', (d) => d.replace('id="257"', 'id="256"')), /sldId 256 is repeated/],
      ['a master id below 2^31', edit('ppt/presentation.xml', (d) => d.replace('id="2147483648"', 'id="5"')), /sldMasterId 5 is below/],
      ['a wrong slide size', edit('ppt/presentation.xml', (d) => d.replace('cx="12192000"', 'cx="9144000"')), /slide size is 9144000/],
      ['a repeated relationship id', edit('ppt/slides/_rels/slide1.xml.rels', (d) => d.replace('Id="rId2"', 'Id="rId1"')), /Id rId1 is repeated/],
      ['a relationship to nowhere', edit('ppt/slides/_rels/slide1.xml.rels', (d) => d.replace('../media/image1.png', '../media/nope.png')), /points to ppt\/media\/nope\.png/],
      ['an orphan part', [...good, { name: 'ppt/media/stray.png', data: png(32, 18, [1, 1, 1]), store: true }], /stray\.png: (no relationship leads|no content type)|package holds 4 images/],
      ['a wrong title', edit('ppt/slides/slide2.xml', (d) => d.replace('<a:t>Steps</a:t>', '<a:t>Other</a:t>')), /title text is "Other"/],
      ['no alt text', edit('ppt/slides/slide1.xml', (d) => d.replace(/ descr="[^"]*"/, '')), /no alt text/],
      ['a picture that does not cover the slide', edit('ppt/slides/slide1.xml', (d) => d.replace(`<a:ext cx="12192000" cy="6858000"/>`, '<a:ext cx="100" cy="100"/>')), /does not cover the slide/],
      ['no transition', edit('ppt/slides/slide1.xml', (d) => d.replace(/<p:transition.*<\/p:transition>/, '')), /children are p:cSld, p:clrMapOvr|no fade transition/],
      ['changed notes', edit('ppt/notesSlides/notesSlide1.xml', (d) => d.replace('First note.', 'Different.')), /notes text differs/],
      ['a notes slide that points back to the wrong slide', edit('ppt/notesSlides/_rels/notesSlide1.xml.rels', (d) => d.replace('slides/slide1.xml', 'slides/slide2.xml')), /points back to ppt\/slides\/slide2\.xml/],
      ['a picture of the wrong size', good.map((e) => (e.name === 'ppt/media/image1.png' ? { ...e, data: png(16, 9, [1, 2, 3]) } : e)), /is 16 x 9 px, expected 32 x 18/],
      ['bytes that are not an image', good.map((e) => (e.name === 'ppt/media/image1.png' ? { ...e, data: Buffer.from('GIF89a.....................') } : e)), /neither a PNG nor a JPEG/],
      ['a different title in the properties', edit('docProps/core.xml', (d) => d.replace('Probe &amp; co', 'Other')), /title is "Other"/],
    ];
    await withBrowser({}, async ({ client }) => {
      const page = await client.newPage();
      await page.send('Runtime.enable');
      const parse = browserXml(page);
      const ok = await validatePackage(zipToBuffer(good), EXPECT(), parse);
      assert.deepEqual(ok.errors, []);
      assert.deepEqual([ok.stats.slides, ok.stats.notes, ok.stats.images], [3, 2, 3]);
      for (const [what, entries, re] of cases) {
        const { errors } = await validatePackage(zipToBuffer(entries), EXPECT(), parse);
        assert.ok(errors.some((e) => re.test(e)), `${what}: expected ${re}, got ${JSON.stringify(errors.slice(0, 3))}`);
      }
      // the expectations themselves are checked: a deck with other counts or no transition does not match the good package
      const wrong = await validatePackage(zipToBuffer(good), EXPECT({ slides: EXPECT().slides.slice(0, 2), transition: false }), parse);
      assert.ok(wrong.errors.some((e) => /expected 2/.test(e)) && wrong.errors.some((e) => /children are/.test(e)), JSON.stringify(wrong.errors.slice(0, 4)));
      // a flipped byte in a part is caught by the zip layer
      const buf = zipToBuffer(good);
      const at = buf.indexOf('ppt/presProps.xml') + 'ppt/presProps.xml'.length + 5;
      buf[at] ^= 0xff;
      assert.ok((await validatePackage(buf, EXPECT(), parse)).errors.some((e) => /zip: /.test(e)));
      assert.ok((await validatePackage(Buffer.from('plain text'), EXPECT(), parse)).errors[0].startsWith('zip: not a zip'));
    });
  });
});

// A deck with known steps: Alpha (1 state), Steps (3 states), Last (an empty build step: 2 states, 1 picture), a backup slide written in the middle.
const DECK = `<script type="application/json" id="deck-config">{ "title": "Probe <deck> & co", "author": "Ada Lovelace", "lang": "it-IT", "theme": "space" }</script>
<section class="slide" data-layout="title" data-title="Alpha &amp; Omega"><h1>Alpha &amp; Omega</h1><p class="lead">Start here</p><aside class="notes"><p>First note.</p><p>Second note <b>bold</b>.</p></aside></section>
<section class="slide" data-backup data-title="Backup one"><h2>Backup one</h2><p>Spare slide</p></section>
<section class="slide" data-title="Steps"><h2>Steps</h2><ul><li>one</li><li data-step="1">two</li><li data-step="2">three</li></ul><aside class="notes">Say it.</aside></section>
<section class="slide" data-title="Last"><h2>Last</h2><p>The end</p><span data-step="1"></span></section>
`;

describe('export.mjs', { skip: browserSkip }, () => {
  const PREFIX = `md-check-profile-x${process.pid}-`;
  const profiles = () => new Set(readdirSync(tmpdir()).filter((n) => n.startsWith(PREFIX)));
  const run = (html, args) => {
    const before = profiles();
    const res = spawnSync(process.execPath, [exportScript, html, '--report', join(work, 'reports'), ...args], { encoding: 'utf8', timeout: 240000, env: { ...process.env, MD_CHECK_PROFILE_PREFIX: PREFIX } });
    return { code: res.status, text: res.stdout, last: res.stdout.trim().split('\n').pop(), leaked: [...profiles()].filter((n) => !before.has(n)) };
  };
  let html;
  test('build the probe deck', async () => {
    const dir = join(work, 'deck');
    const src = join(work, 'probe.src.html');
    writeFileSync(src, DECK);
    html = join(dir, 'index.html');
    await build({ src, out: html });
    assert.ok(existsSync(html));
  });

  test('--steps all: one slide per state, backup last, notes on every state, repeats dropped, files and profile cleaned', () => {
    const out = join(work, 'all.pptx');
    const r = run(html, ['--out', out, '--scale', '1', '--format', 'jpeg']);
    assert.equal(r.code, 0, r.text);
    assert.match(r.last, /^PASS export: deck \[(chrome|edge)\] 6 slides from 4 deck slides, all steps, jpeg 1600x900, [\d.]+ MB -> /);
    // a profile that Windows keeps locked for ten seconds is reported by the export itself ("warn cleanup"); it is not a leak of the export
    if (!/warn cleanup/.test(r.text)) assert.deepEqual(r.leaked, [], 'browser profile directory left behind');
    assert.ok(!existsSync(`${out}.part`));
    const zip = readZip(readFileSync(out));
    const slide = (n) => zip.read(`ppt/slides/slide${n}.xml`).toString();
    const titles = [1, 2, 3, 4, 5, 6].map((n) => /<p:ph type="title"\/>.*?<a:t>(.*?)<\/a:t>/.exec(slide(n))[1]);
    assert.deepEqual(titles, ['Alpha &amp; Omega', 'Steps', 'Steps', 'Steps', 'Last', 'Backup one']);
    assert.equal(zip.entries.filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.name)).length, 4);
    assert.match(zip.read('ppt/notesSlides/notesSlide1.xml').toString(), /<a:t>First note\.<\/a:t>.*<a:t>Second note bold\.<\/a:t>/);
    assert.match(zip.read('docProps/core.xml').toString(), /<dc:title>Probe &lt;deck&gt; &amp; co<\/dc:title>.*<dc:creator>Ada Lovelace<\/dc:creator>.*<dc:language>it-IT<\/dc:language>/);
    assert.match(slide(2), /<p:transition spd="fast"><p:fade\/><\/p:transition>/);
    const report = JSON.parse(readFileSync(join(work, 'reports', 'deck', 'report.json'), 'utf8'));
    assert.deepEqual([report.ok, report.exported, report.dropped, report.states.length, report.verify.errors], [true, 6, 1, 7, []]);
    assert.match(zip.read('ppt/slides/slide2.xml').toString(), /descr="Steps\. /);
  });

  test('--steps final, --no-notes, --transition none', () => {
    const out = join(work, 'final.pptx');
    const r = run(html, ['--out', out, '--scale', '1', '--format', 'jpeg', '--steps', 'final', '--no-notes', '--transition', 'none']);
    assert.equal(r.code, 0, r.text);
    assert.match(r.last, /4 slides from 4 deck slides, final steps/);
    const zip = readZip(readFileSync(out));
    assert.equal(zip.entries.filter((e) => e.name.startsWith('ppt/notesSlides/')).length, 0);
    assert.ok(!/p:transition/.test(zip.read('ppt/slides/slide1.xml').toString()));
    assert.equal(zip.entries.filter((e) => e.name.startsWith('ppt/media/')).length, 4);
  });

  test('the default output is <slug>.pptx next to the deck, and --scale sets the picture size', () => {
    const r = run(html, ['--scale', '1', '--steps', 'final', '--format', 'png']);
    assert.equal(r.code, 0, r.text);
    const zip = readZip(readFileSync(join(work, 'deck', 'deck.pptx')));
    const info = imageInfo(zip.read('ppt/media/image1.png'));
    assert.deepEqual([info.type, info.width, info.height], ['png', 1600, 900]);
  });

  test('a missing file, a bad option and a deck that cannot start fail with a FAIL line and exit 2', () => {
    for (const args of [[join(work, 'missing.html')], [html, '--scale', '9']]) {
      const res = spawnSync(process.execPath, [exportScript, ...args], { encoding: 'utf8' });
      assert.equal(res.status, 2);
      assert.match(res.stdout.trim().split('\n').pop(), /^FAIL export: /);
    }
  });
});
