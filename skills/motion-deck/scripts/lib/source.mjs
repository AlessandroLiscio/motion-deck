// Tolerant scanner for deck.src.html (contract section 2). It finds the top-level pieces without a DOM and is not fooled by
// comments, script and style bodies or quoted attribute values, so `>` or the text `<section` inside them cannot confuse it.
import { BuildError } from './errors.mjs';

const RAW = new Set(['script', 'style']);
const CLOSE = /<\/([A-Za-z][^\s/>]*)\s*>/y;
const NAME = /<([A-Za-z][^\s/>]*)/y;

export const normalizeEol = (s) => s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

export function lineAt(text, offset) {
  let n = 1;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) n++;
  return n;
}

const fail = (text, offset, message) => {
  throw new BuildError('E_SOURCE', `line ${lineAt(text, offset)}: ${message}`);
};

// Reads one start tag at text[i] === '<' and returns it, or null when the closing `>` is missing. `>` inside quotes does not end it.
function readTag(text, i) {
  NAME.lastIndex = i;
  const m = NAME.exec(text);
  let j = NAME.lastIndex;
  let quote = null;
  for (; j < text.length; j++) {
    const c = text[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') break;
  }
  if (j >= text.length) return null;
  return { name: m[1].toLowerCase(), start: i, end: j + 1, raw: text.slice(i, j + 1), nameEnd: NAME.lastIndex - i };
}

// Yields comments, start tags and end tags in order. A script or style start tag also carries bodyStart, bodyEnd and next:
// the body is skipped, so nothing inside it is ever read as markup.
export function* walk(text, from = 0) {
  let i = from;
  while ((i = text.indexOf('<', i)) !== -1) {
    if (text.startsWith('<!--', i)) {
      const e = text.indexOf('-->', i + 4);
      if (e < 0) fail(text, i, 'unterminated comment');
      yield { type: 'comment', start: i, end: e + 3 };
      i = e + 3;
    } else if (text[i + 1] === '/') {
      CLOSE.lastIndex = i;
      const m = CLOSE.exec(text);
      if (m) yield { type: 'close', name: m[1].toLowerCase(), start: i, end: CLOSE.lastIndex };
      i = m ? CLOSE.lastIndex : i + 1;
    } else if (/[A-Za-z]/.test(text[i + 1] ?? '')) {
      const tag = readTag(text, i);
      if (!tag) fail(text, i, 'unterminated tag');
      tag.type = 'open';
      tag.next = tag.end;
      if (RAW.has(tag.name) && !tag.raw.endsWith('/>')) {
        const re = new RegExp(`</${tag.name}(?=[\\s/>])`, 'gi');
        re.lastIndex = tag.end;
        const m = re.exec(text);
        if (!m) fail(text, i, `unterminated <${tag.name}>`);
        tag.bodyStart = tag.end;
        tag.bodyEnd = m.index;
        tag.next = text.indexOf('>', m.index) + 1;
      }
      yield tag;
      i = tag.next;
    } else i++;
  }
}

// Attributes of a start tag with the span of each value inside tag.raw (vStart, vEnd) and the end of the whole attribute.
export function attrsOf(tag) {
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/dg;
  re.lastIndex = tag.nameEnd;
  const out = [];
  for (let m; (m = re.exec(tag.raw)); ) {
    const span = m.indices[2] || m.indices[3] || m.indices[4];
    out.push({ name: m[1].toLowerCase(), value: span ? (m[2] ?? m[3] ?? m[4]) : null, vStart: span?.[0], vEnd: span?.[1], end: re.lastIndex });
  }
  return out;
}

const attr = (tag, name) => attrsOf(tag).find((a) => a.name === name)?.value ?? null;

export function parseSource(text) {
  let config = null;
  const styles = [];
  const slides = [];
  let cursor = 0;
  let open = null;
  const gapCheck = (upTo) => {
    const gap = text.slice(cursor, upTo);
    if (gap.trim()) fail(text, cursor + gap.search(/\S/), 'text outside any element');
  };
  for (const tok of walk(text)) {
    if (open) {
      if (tok.type === 'open' && tok.name === 'section') fail(text, tok.start, `nested <section> (slide starting at line ${lineAt(text, open.start)})`);
      if (tok.type === 'close' && tok.name === 'section') {
        slides.push({ html: text.slice(open.start, tok.end), line: lineAt(text, open.start) });
        cursor = tok.end;
        open = null;
      }
      continue;
    }
    gapCheck(tok.start);
    if (tok.type === 'comment') {
      cursor = tok.end;
      continue;
    }
    if (tok.type === 'close') fail(text, tok.start, `unexpected </${tok.name}> at the top level`);
    if (tok.name === 'script' && attr(tok, 'id') === 'deck-config' && attr(tok, 'type') === 'application/json') {
      if (config) fail(text, tok.start, `second script#deck-config (first at line ${config.line})`);
      if (styles.length || slides.length) fail(text, tok.start, 'script#deck-config must come before styles and slides');
      config = { text: text.slice(tok.bodyStart, tok.bodyEnd), line: lineAt(text, tok.bodyStart) };
      cursor = tok.next;
    } else if (tok.name === 'style') {
      if (slides.length) fail(text, tok.start, '<style> must come before the slides');
      styles.push({ text: text.slice(tok.bodyStart, tok.bodyEnd), line: lineAt(text, tok.bodyStart) });
      cursor = tok.next;
    } else if (tok.name === 'section' && /(^|\s)slide(\s|$)/.test(attr(tok, 'class') ?? '')) {
      open = tok;
      cursor = tok.end;
    } else {
      fail(text, tok.start, `unexpected top-level <${tok.name}>: only script#deck-config, <style> and section.slide are allowed`);
    }
  }
  if (open) fail(text, open.start, 'slide <section> is never closed');
  gapCheck(text.length);
  if (!config) fail(text, 0, 'missing <script type="application/json" id="deck-config">');
  if (!slides.length) fail(text, text.length, 'no <section class="slide"> found');
  return { config, styles, slides };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (_, d, h, n) =>
    n ? ENTITIES[n.toLowerCase()] : String.fromCodePoint(d ? +d : parseInt(h, 16)));
// Escape for an attribute value; an entity that stayed undecoded (for example &mdash;) is kept as written.
const escapeAttr = (s) =>
  s.replace(/&(?!#?[A-Za-z0-9]+;)/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function titleOf(html, from) {
  for (const t of walk(html, from)) {
    if (t.type !== 'open' || (t.name !== 'h1' && t.name !== 'h2')) continue;
    const close = new RegExp(`</${t.name}\\s*>`, 'i').exec(html.slice(t.end));
    const inner = html.slice(t.end, close ? t.end + close.index : undefined);
    return decode(inner.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
  }
  return '';
}

// Adds id, data-sec and data-title defaults to every slide (contract 2.2) and touches nothing else.
export function normalizeSlides(slides) {
  const seen = new Map();
  let prevSec = 'main';
  return slides.map((s, k) => {
    const n = k + 1;
    const tag = readTag(s.html, 0);
    const attrs = attrsOf(tag);
    const get = (name) => attrs.find((a) => a.name === name);
    const id = get('id')?.value || `s${n}`;
    const sec = get('data-sec')?.value || prevSec;
    prevSec = sec;
    if (seen.has(id)) throw new BuildError('E_SOURCE', `line ${s.line}: duplicate slide id "${id}" (also slide ${seen.get(id)})`);
    seen.set(id, n);
    const title = get('data-title')?.value || titleOf(s.html, tag.end) || `Slide ${n}`;
    const edits = [];
    for (const [name, value] of [['id', id], ['data-sec', sec], ['data-title', title]]) {
      const a = get(name);
      if (a?.value) continue;
      const text = escapeAttr(value);
      if (!a) edits.push({ at: tag.end - 1, end: tag.end - 1, text: ` ${name}="${text}"` });
      else if (a.vStart != null) edits.push({ at: a.vStart, end: a.vEnd, text });
      else edits.push({ at: a.end, end: a.end, text: `="${text}"` });
    }
    let html = s.html;
    for (const e of edits.map((e, i) => ({ ...e, i })).sort((x, y) => y.at - x.at || y.i - x.i)) html = html.slice(0, e.at) + e.text + html.slice(e.end);
    return { ...s, html, id, sec, title };
  });
}
