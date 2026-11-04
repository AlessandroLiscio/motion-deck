// Selftest probe for the .pptx export (contract section 13): exports a built deck with --steps all and --steps final, then checks the files
// against what the deck itself reports (Deck.count, the steps of each slide, which slides have notes), with the structural validator.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { runExport } from '../export.mjs';
import { browserXml, validatePackage } from './pptx-validate.mjs';
import { fail, loadDeck, same, withBrowser } from './probe-kit.mjs';
import { readZip } from './zip.mjs';

const FACTS = `(() => {
  const text = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent.trim();
  const cfg = Deck.config || {};
  return {
    meta: { title: cfg.title || Deck.info().title, author: cfg.author || '', lang: cfg.lang || 'en' },
    slides: Deck.info().slides.map((s) => ({ title: s.title, backup: s.backup, steps: Deck.steps(s.index), hasNotes: text(s.notes) !== '' })),
  };
})()`;

// file: a built deck. Returns a one-line summary, or throws ProbeFailure.
export async function probeExport({ file, browser, outDir }, log = () => {}) {
  const slug = basename(file, '.html');
  const runs = {};
  for (const steps of ['all', 'final']) {
    const out = join(outDir, `export-${steps}.pptx`);
    const report = join(outDir, 'reports', steps);
    const code = await runExport({ file, out, steps, scale: 1, format: 'jpeg', quality: 80, transition: 'fade', notes: true, browser, timeout: 20000, report }, log);
    if (code !== 0) fail(`export --steps ${steps} exited ${code}`);
    runs[steps] = { out, report: JSON.parse(readFileSync(join(report, slug, 'report.json'), 'utf8')) };
  }
  return withBrowser({ which: browser }, async ({ client }) => {
    const page = await loadDeck(client, file);
    const facts = await page.evaluate(FACTS);
    const deckSlides = facts.slides.length;
    // export order: the main slides, then the backup slides, each in deck order
    const indexed = facts.slides.map((s, i) => [s, i]);
    const order = [...indexed.filter(([s]) => !s.backup), ...indexed.filter(([s]) => s.backup)];
    const states = (steps) => order.flatMap(([s, i]) => (steps === 'all' ? Array.from({ length: s.steps + 1 }, (_, k) => [i + 1, k]) : [[i + 1, s.steps]]));
    const parse = browserXml(page);
    const parts = [];
    for (const steps of ['all', 'final']) {
      const { out, report } = runs[steps];
      same(report.states.map((st) => [st.slide, st.step]), states(steps), `--steps ${steps}: the states the export walked`);
      if (steps === 'final') same(report.states.length, deckSlides, '--steps final: one state per Deck.count slide');
      const kept = report.states.filter((st) => st.kept);
      if (kept.length + report.dropped !== report.states.length) fail(`--steps ${steps}: ${kept.length} kept and ${report.dropped} dropped is not ${report.states.length} states`);
      const expected = {
        slides: kept.map((st) => ({ title: facts.slides[st.slide - 1].title, notes: facts.slides[st.slide - 1].hasNotes ? true : null, ext: 'jpeg' })),
        width: 1600, height: 900, transition: true, meta: facts.meta,
      };
      const bytes = readFileSync(out);
      let zip;
      try { zip = readZip(bytes); } catch (err) { fail(`--steps ${steps}: the file is not a zip (${err.message})`); }
      const noteSlides = zip.entries.filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.name)).length;
      same(noteSlides, expected.slides.filter((s) => s.notes).length, `--steps ${steps}: notes slides`);
      if (!noteSlides) fail(`--steps ${steps}: the deck has speaker notes but the file has no notes slide`);
      const verdict = await validatePackage(bytes, expected, parse);
      if (verdict.errors.length) fail(`--steps ${steps}: ${verdict.errors.length} structural errors, first: ${verdict.errors[0]}`);
      parts.push(`${steps} ${kept.length} slides (${report.dropped} repeats dropped, ${noteSlides} with notes)`);
    }
    return parts.join(', ');
  });
}
