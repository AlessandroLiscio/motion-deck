// Writes the check artefacts: report.json, console.log, deck.pdf, shots/ and the index.html contact sheet.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { escapeHtml as esc } from './compose.mjs';

const two = (n) => String(n).padStart(2, '0');

export const shotName = (slide, step) => `s${two(slide)}-${step}.png`;

function contactSheet(report) {
  const bySlide = new Map();
  for (const st of report.states) {
    if (!bySlide.has(st.slide)) bySlide.set(st.slide, []);
    bySlide.get(st.slide).push(st);
  }
  const sections = [...bySlide].map(([slide, states]) => {
    const figs = states.map((st) => {
      const bad = st.violations.map((v) => `<li>${esc(v.kind)} ${esc(v.selector)} ${esc(JSON.stringify(v.numbers))}</li>`).join('');
      const img = st.shot ? `<img src="shots/${esc(st.shot)}" alt="slide ${slide} step ${st.step}" loading="lazy">` : '<p>no screenshot</p>';
      return `<figure><figcaption>step ${st.step}</figcaption>${img}${bad ? `<ul class="bad">${bad}</ul>` : ''}</figure>`;
    });
    return `<section><h2>Slide ${slide}</h2><div class="row">${figs.join('')}</div></section>`;
  });
  const problems = report.problems.map((p) => `<li><b>${esc(p.cls)}</b> ${esc(p.message)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>check ${esc(report.deck)}</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;background:#fafafa;color:#111}.row{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:400px}img{width:400px;border:1px solid #ccc;display:block}.bad{color:#b00020;margin:4px 0;padding-left:18px}.fail{color:#b00020}.pass{color:#0a7d33}</style></head><body>
<h1>${esc(report.deck)} <span class="${report.ok ? 'pass' : 'fail'}">${report.ok ? 'PASS' : 'FAIL'}</span></h1>
<p>${esc(report.browser)}, ${report.slides} slides, ${report.states.length} states${report.pdf ? `, pdf ${report.pdf.pages} pages` : ''}</p>
${problems ? `<ul class="fail">${problems}</ul>` : ''}${sections.join('')}</body></html>
`;
}

// data: { report, shots: Map<name, Buffer>, pdf: Buffer|null, consoleLines: string[] }. Returns the deck's report directory.
export async function writeReport(outDir, data) {
  const dir = join(outDir, data.report.deck);
  await rm(join(dir, 'shots'), { recursive: true, force: true }); // drop shots of an earlier run
  await mkdir(join(dir, 'shots'), { recursive: true });
  for (const [name, buf] of data.shots) await writeFile(join(dir, 'shots', name), buf);
  if (data.pdf) await writeFile(join(dir, 'deck.pdf'), data.pdf);
  else await rm(join(dir, 'deck.pdf'), { force: true });
  await writeFile(join(dir, 'console.log'), data.consoleLines.join('\n') + (data.consoleLines.length ? '\n' : ''));
  await writeFile(join(dir, 'report.json'), JSON.stringify(data.report, null, 2) + '\n');
  await writeFile(join(dir, 'index.html'), contactSheet(data.report));
  return dir;
}
