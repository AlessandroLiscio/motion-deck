// Browser-side measurements (contract section 10, items 2, 3 and 7) as strings for Runtime.evaluate, plus the small color helpers the check needs.

// Overflow and clipping of the active slide. Self-contained: it is serialised with toString and runs in the page.
function measureSlide() {
  const TOL = 1;
  const round = (n) => Math.round(n * 10) / 10;
  const stage = document.getElementById('stage');
  const slide = stage && stage.querySelector('.slide.active');
  if (!slide) return [{ selector: '#stage', kind: 'no-active-slide', numbers: {} }];

  const root = getComputedStyle(document.documentElement);
  const px = (name, fallback) => parseFloat(root.getPropertyValue(name)) || fallback;
  const padX = px('--pad-x', 120), padY = px('--pad-y', 84), padB = px('--pad-b', 96);
  const sr = stage.getBoundingClientRect();
  const sc = sr.width / 1600 || parseFloat(stage.style.getPropertyValue('--s')) || 1;
  const safe = { l: padX, r: 1600 - padX, t: padY, b: 900 - padB };
  const whole = { l: 0, r: 1600, t: 0, b: 900 };

  const part = (e) => {
    if (e.id) return `${e.localName}#${e.id}`;
    const cls = [...e.classList].filter((c) => !/^(active|play|instant|entering|leaving|on|off|a|a-[a-z]+)$/.test(c)).slice(0, 2).join('.'); // runtime state is noise
    const kin = e.parentElement ? [...e.parentElement.children] : [];
    return `${e.localName}${cls ? '.' + cls : ''}${kin.length > 1 ? `:nth-child(${kin.indexOf(e) + 1})` : ''}`;
  };
  const selector = (e) => {
    const chain = [];
    for (let n = e; n && n !== slide.parentElement && chain.length < 4; n = n.parentElement) chain.unshift(part(n));
    return chain.join(' > ');
  };

  // Extent of the element in stage pixels. Horizontally the element box united with its own text boxes (a nowrap line can run out of a box that fits);
  // vertically the box grown to scrollHeight (text boxes are not used there: glyph boxes poke out of tight line heights).
  const extent = (e) => {
    const own = e.getBoundingClientRect();
    const rects = [own];
    for (const n of e.childNodes) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      rects.push(...range.getClientRects());
    }
    const real = rects.filter((r) => r.width > 0 && r.height > 0);
    if (!real.length) return null; // zero size
    return {
      l: (Math.min(...real.map((r) => r.left)) - sr.left) / sc, r: (Math.max(...real.map((r) => r.right)) - sr.left) / sc,
      t: (own.top - sr.top) / sc, b: (own.top - sr.top) / sc + Math.max(own.height / sc, e.scrollHeight),
    };
  };

  const out = [];
  for (const e of slide.querySelectorAll('*')) {
    if (e.closest('.notes, [data-bleed]')) continue;
    const owner = e.closest('svg');
    if (owner && owner !== e) continue; // svg internals: only the svg box is measured
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const box = extent(e);
    if (!box) continue; // zero size
    const art = e.closest('[data-art]');
    if (art && art !== e) continue;
    const limit = art ? whole : safe;
    if (box.l < limit.l - TOL || box.r > limit.r + TOL || box.t < limit.t - TOL || box.b > limit.b + TOL) {
      out.push({
        selector: selector(e), kind: art ? 'outside-stage' : 'outside-safe-area',
        numbers: { left: round(box.l), right: round(box.r), top: round(box.t), bottom: round(box.b), limit: { left: limit.l, right: limit.r, top: limit.t, bottom: limit.b } },
      });
    }
    if (e.localName !== 'svg' && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) {
      const dw = e.scrollWidth - e.clientWidth, dh = e.scrollHeight - e.clientHeight;
      if (dw > TOL || dh > TOL) {
        out.push({ selector: selector(e), kind: 'clipped', numbers: { scrollWidth: e.scrollWidth, clientWidth: e.clientWidth, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight } });
      }
    }
  }
  if (slide.scrollHeight - slide.clientHeight > TOL) {
    out.push({ selector: selector(slide), kind: 'slide-height', numbers: { scrollHeight: slide.scrollHeight, clientHeight: slide.clientHeight } });
  }
  return out;
}

// Content facts of every slide, for the lints (lint.mjs). Needs no particular slide state: it reads the markup.
function measureContent() {
  const words = (t) => (String(t).match(/\S+/g) || []).length;
  const info = window.Deck && typeof window.Deck.info === 'function' ? window.Deck.info() : { slides: [] };
  const slides = [...document.querySelectorAll('#stage > .slide')].map((s, index) => {
    const notes = s.querySelector('.notes');
    const text = s.cloneNode(true);
    text.querySelectorAll('.notes, svg, pre.code, [data-art], .source, script, style').forEach((e) => e.remove());
    const head = s.querySelector('h1, h2');
    const lists = [...s.querySelectorAll('ul, ol')].filter((l) => !l.matches('.timeline, .links') && !l.closest('.notes, svg')).map((l) => {
      const items = [...l.children].filter((c) => c.localName === 'li');
      return { items: items.length, maxWords: Math.max(0, ...items.map((li) => words(li.textContent))) };
    });
    const meta = info.slides[index] || {};
    return {
      index, layout: s.dataset.layout || 'content', backup: !!meta.backup, minutes: meta.minutes || null,
      title: head ? head.textContent.trim() : '', titleWords: head ? words(head.textContent) : 0,
      words: words(text.textContent), lists,
      imgsNoAlt: [...s.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      hasNotes: !!(notes && notes.textContent.trim()), notesWords: notes ? words(notes.textContent) : 0,
      hasSource: !!s.querySelector('.source'),
    };
  });
  return { lang: document.documentElement.getAttribute('lang') || '', duration: info.duration || 0, slides };
}

// Computed font size of every visible text run on the active slide, in stage pixels, with its tier: label (kicker, caption, table head, svg text, code), compact (cards, timeline, tables, stats) or body.
function measureType() {
  const stage = document.getElementById('stage');
  const slide = stage && stage.querySelector('.slide.active');
  if (!slide) return [];
  const sc = stage.getBoundingClientRect().width / 1600 || 1;
  const LABEL = '.kicker, .label, th, cite, .attrib, .meta, figcaption, .chip, .note, .source, .small, code, pre, .links, .hint';
  const COMPACT = '.card, .timeline, table.data, .stat';
  const seen = new Map();
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.nodeValue.trim()) continue;
    const e = t.parentElement;
    if (!e || e.closest('.notes, [data-art], script, style')) continue;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const svg = e.closest('svg');
    let px = parseFloat(cs.fontSize);
    if (svg) {
      const m = svg.getScreenCTM();
      px = (px * (m ? m.a : 1)) / sc;
    }
    px = Math.round(px * 10) / 10;
    const tier = svg || e.closest(LABEL) ? 'label' : e.closest(COMPACT) ? 'compact' : 'body';
    const cls = [...e.classList].filter((c) => !/^(active|play|instant|entering|leaving|on|off|a|a-[a-z]+|tk-.+|ln|hl)$/.test(c)).slice(0, 2).join('.');
    const selector = (svg ? 'svg ' : '') + e.localName + (cls ? '.' + cls : '');
    seen.set(tier + ' ' + selector + ' ' + px, { selector, px, tier });
  }
  return [...seen.values()];
}

// Loads every declared face, then reports face statuses and the first family of each font token.
async function measureFonts() {
  const faces = [...document.fonts];
  await Promise.all(faces.map((f) => f.load().catch(() => null)));
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');
  const declared = faces.map((f) => ({ family: unquote(f.family), style: f.style, weight: f.weight, status: f.status }));
  const root = getComputedStyle(document.documentElement);
  const tokens = {};
  for (const role of ['display', 'body', 'mono']) {
    const raw = root.getPropertyValue(`--f-${role}`).trim();
    const first = unquote(raw.split(',')[0] || '');
    const match = declared.filter((d) => d.family.toLowerCase() === first.toLowerCase());
    tokens[role] = { raw, first, declared: match.length > 0, loaded: match.length > 0 && match.every((d) => d.status === 'loaded') };
  }
  return { faces: declared, tokens };
}

// Computed color tokens as #rrggbb (through a canvas, so any CSS color syntax resolves) and the registered theme name.
function measureTokens() {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const hex = (value) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#010203';
    ctx.fillStyle = value;
    if (!value || (ctx.fillStyle === '#010203' && value.toLowerCase() !== '#010203')) return null; // invalid colors leave the sentinel
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return a === 255 ? '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('') : null;
  };
  const root = getComputedStyle(document.documentElement);
  const out = { theme: window.Deck && window.Deck.theme && window.Deck.theme.name, colors: {} };
  for (const name of ['bg', 'text', 'muted', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']) out.colors[name] = hex(root.getPropertyValue(`--${name}`).trim());
  return out;
}

export const MEASURE_SLIDE = `(${measureSlide})()`;
export const MEASURE_FONTS = `(${measureFonts})()`;
export const MEASURE_TOKENS = `(${measureTokens})()`;
export const MEASURE_CONTENT = `(${measureContent})()`;
export const MEASURE_TYPE = `(${measureType})()`;

export function normHex(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return '#' + h.toLowerCase();
}

function luminance(hex) {
  const lin = (i) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(0) + 0.7152 * lin(1) + 0.0722 * lin(2);
}

// WCAG 2 contrast ratio of two #rrggbb colors.
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
