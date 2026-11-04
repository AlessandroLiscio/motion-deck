// Content and legibility lints of the check (contract section 10, "Lints"). Pure functions over data the page measured, so they run in unit tests without a browser.
// Every lint is a warning { code, slide, message }; slide is 1-based or null for the whole deck. `check.mjs --strict` turns warnings into failures.
import { short } from './format.mjs';

export const LIMITS = {
  words: 30, listItems: 5, itemWords: 12, titleWords: 10, layoutRun: 3, notesMin: 40, notesMax: 90,
  // Font size floors in stage pixels (the stage is 1600 by 900, about 120 px per inch: 30 px is 18 pt). Below `warn` is a warning, below `error` a failure.
  type: { body: { warn: 30, error: 20 }, compact: { warn: 24, error: 20 }, label: { warn: 16, error: 14 } },
  contrast: 3,
};

// Slide data comes from MEASURE_CONTENT (measure.mjs): { index, layout, title, titleWords, words, lists: [{ items, maxWords }], imgsNoAlt, hasNotes, notesWords, hasSource }.
export function lintContent(slides, { lang = '' } = {}) {
  const out = [];
  const warn = (code, slide, message) => out.push({ code, slide, message });
  if (!String(lang).trim()) warn('W_LANG', null, 'the page has no lang attribute; set "lang" in the deck config');

  for (const s of slides) {
    const n = s.index + 1;
    if (s.words > LIMITS.words) warn('W_WORDS', n, `${s.words} words on the slide, keep it to ${LIMITS.words}; split it or move detail to the notes`);
    for (const l of s.lists) {
      if (l.items > LIMITS.listItems) warn('W_LIST_LEN', n, `a list of ${l.items} items, keep it to ${LIMITS.listItems}; use steps, cards or another slide`);
      if (l.maxWords > LIMITS.itemWords) warn('W_LIST_ITEM', n, `a list item of ${l.maxWords} words, keep items to ${LIMITS.itemWords}`);
    }
    if (s.titleWords > LIMITS.titleWords) warn('W_TITLE_LEN', n, `the title "${short(s.title, 40)}" has ${s.titleWords} words, keep it to ${LIMITS.titleWords}`);
    if (s.imgsNoAlt) warn('W_IMG_ALT', n, `${s.imgsNoAlt} image(s) without an alt attribute (use alt="" for decoration)`);
    if (s.layout === 'stats' && !s.hasSource) warn('W_STAT_SOURCE', n, 'a stats slide with no <p class="source"> naming where the figures come from');
    if (!s.hasNotes) warn('W_NOTES_MISSING', n, 'no speaker notes (aside.notes)');
    else if (s.notesWords < LIMITS.notesMin || s.notesWords > LIMITS.notesMax) warn('W_NOTES_LEN', n, `speaker notes have ${s.notesWords} words, aim for ${LIMITS.notesMin} to ${LIMITS.notesMax}`);
  }

  // The same layout three times in a row: one warning per run, at its first slide.
  for (let i = 0; i < slides.length;) {
    let j = i;
    while (j + 1 < slides.length && slides[j + 1].layout === slides[i].layout && !slides[j + 1].backup === !slides[i].backup) j++;
    if (j - i + 1 >= LIMITS.layoutRun) warn('W_LAYOUT_RUN', i + 1, `slides ${i + 1} to ${j + 1} all use the "${slides[i].layout}" layout; vary the rhythm`);
    i = j + 1;
  }
  return out;
}

// Words to minutes (check --wpm): the speaker notes of the normal slides against the planned duration, and against data-minutes where a slide has them.
export function lintPace(slides, { wpm, duration }) {
  if (!(wpm > 0)) return [];
  const out = [];
  const normal = slides.filter((s) => !s.backup);
  const est = normal.reduce((n, s) => n + s.notesWords, 0) / wpm;
  const min = (n) => (Math.round(n * 10) / 10).toString();
  if (duration > 0 && est > duration * 1.1) out.push({ code: 'W_PACE', slide: null, message: `the notes take about ${min(est)} min at ${wpm} words per minute, over the ${min(duration)} min plan` });
  else if (duration > 0 && est < duration * 0.6) out.push({ code: 'W_PACE', slide: null, message: `the notes take about ${min(est)} min at ${wpm} words per minute, well under the ${min(duration)} min plan` });
  for (const s of normal) {
    if (!s.minutes) continue;
    const need = s.notesWords / wpm;
    if (need > s.minutes * 1.5 && need - s.minutes > 0.5) out.push({ code: 'W_PACE', slide: s.index + 1, message: `the notes take about ${min(need)} min but the slide has ${min(s.minutes)} (data-minutes)` });
  }
  return out;
}

// Text samples come from MEASURE_TYPE: { selector, px, tier, slide }. Returns { warnings, errors }, one entry per selector and size with the slides it appears on.
export function lintType(samples) {
  const groups = new Map();
  for (const t of samples) {
    const key = `${t.tier} ${t.selector} ${t.px}`;
    if (!groups.has(key)) groups.set(key, { ...t, slides: new Set() });
    groups.get(key).slides.add(t.slide);
  }
  const warnings = [], errors = [];
  for (const g of groups.values()) {
    const floor = LIMITS.type[g.tier];
    const slides = [...g.slides].sort((a, b) => a - b);
    const where = slides.length > 3 ? `slides ${slides.slice(0, 3).join(', ')} and ${slides.length - 3} more` : `slide${slides.length > 1 ? 's' : ''} ${slides.join(', ')}`;
    if (g.px < floor.error) errors.push({ selector: g.selector, message: `${g.selector} is ${g.px} px on ${where}, under the ${floor.error} px floor for ${g.tier} text` });
    else if (g.px < floor.warn) warnings.push({ code: 'W_FONT_SIZE', slide: slides[0], message: `${g.selector} is ${g.px} px on ${where}, under ${floor.warn} px for ${g.tier} text` });
  }
  return { warnings, errors };
}

// accents: { a1: '#rrggbb', ... }, own: names whose value equals the theme's own accent (a theme bug, an error); the others were set by the deck (a warning).
export function lintAccents(accents, bg, contrast, own) {
  const warnings = [], errors = [];
  for (const [name, hex] of Object.entries(accents)) {
    if (!hex) continue;
    const c = contrast(hex, bg);
    if (c >= LIMITS.contrast) continue;
    const message = `--${name} (${hex}) on --bg (${bg}) is ${c.toFixed(2)}, needs ${LIMITS.contrast} for diagrams, chips and bars`;
    if (own.has(name)) errors.push({ message });
    else warnings.push({ code: 'W_ACCENT_CONTRAST', slide: null, message });
  }
  return { warnings, errors };
}


export function summarize(warnings) {
  const by = new Map();
  for (const w of warnings) by.set(w.code, (by.get(w.code) || 0) + 1);
  return [...by].map(([code, n]) => `${code} ${n}`).join(', ');
}
