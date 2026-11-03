// Inlines relative image references as data URIs and refuses remote ones (contract 2.4).
// Handles <img src>, SVG <image href|xlink:href>, url(...) in <style> blocks and style="..." attributes; everything else is left alone.
import fs from 'node:fs/promises';
import path from 'node:path';
import { BuildError } from './errors.mjs';
import { walk, attrsOf } from './source.mjs';

const MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' };
const WARN_BYTES = 300 * 1024;
const MAX_BYTES = 2 * 1024 * 1024;
const KB = (n) => `${Math.round(n / 1024)} KB`;
const REMOTE = /^(?:https?:|\/\/)/i;
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]+:/i;

export function createInliner({ baseDir, warn }) {
  const cache = new Map();
  let count = 0;

  // Returns the data URI for a reference, or null when the reference must stay as written (data:, #fragment, empty).
  async function resolve(ref, line) {
    const r = ref.trim();
    if (!r || r.startsWith('#') || /^data:/i.test(r)) return null;
    if (REMOTE.test(r)) throw new BuildError('E_REMOTE', `line ${line}: remote reference "${r}" (decks must work offline, put the file in assets/)`);
    if (OTHER_SCHEME.test(r)) throw new BuildError('E_REMOTE', `line ${line}: reference "${r}" is not a relative file path`);
    const clean = r.replace(/[?#].*$/, '');
    let rel = clean;
    try { rel = decodeURIComponent(clean); } catch { /* keep the raw text */ }
    const file = path.resolve(baseDir, rel);
    const ext = path.extname(file).slice(1).toLowerCase();
    if (!MIME[ext]) throw new BuildError('E_SOURCE', `line ${line}: "${r}" has a type that cannot be inlined (allowed: ${Object.keys(MIME).join(', ')})`);
    if (!cache.has(file)) {
      const fromBase = path.relative(baseDir, file);
      if (fromBase.startsWith('..') || path.isAbsolute(fromBase)) warn('W_ASSET_OUTSIDE', `line ${line}: "${r}" is outside the deck folder, so its content is copied into the output`);
      let buf;
      try {
        buf = await fs.readFile(file);
      } catch {
        throw new BuildError('E_ASSET_MISSING', `line ${line}: "${r}" not found (looked for ${file})`);
      }
      if (buf.length > MAX_BYTES) throw new BuildError('E_ASSET_SIZE', `line ${line}: "${r}" is ${KB(buf.length)}, over the 2 MB limit`);
      if (buf.length > WARN_BYTES) warn('W_ASSET_SIZE', `line ${line}: "${r}" is ${KB(buf.length)}, over 300 KB`);
      cache.set(file, `data:${MIME[ext]};base64,${buf.toString('base64')}`);
    }
    count++;
    return cache.get(file);
  }

  const lineOf = (text, offset, base) => base + (text.slice(0, offset).match(/\n/g) || []).length;
  const maskComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

  // Edits {start, end, text} (offsets in `css`) that replace url(...) references; throws on @import.
  async function cssEdits(css, baseLine) {
    const masked = maskComments(css);
    const edits = [];
    for (const m of masked.matchAll(/@import\b([^;]*)/gi)) {
      const ref = /url\(\s*['"]?([^)'"\s]+)|['"]([^'"]+)['"]/i.exec(m[1]);
      const target = ref ? (ref[1] ?? ref[2]) : '';
      const line = lineOf(css, m.index, baseLine);
      if (REMOTE.test(target)) throw new BuildError('E_REMOTE', `line ${line}: @import of "${target}" (decks must work offline)`);
      throw new BuildError('E_SOURCE', `line ${line}: @import is not supported, put the rules in the deck <style>`);
    }
    const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/dgi;
    for (let m; (m = re.exec(masked)); ) {
      const g = m.indices[1] || m.indices[2] || m.indices[3];
      const uri = await resolve(m[1] ?? m[2] ?? m[3], lineOf(css, m.index, baseLine));
      if (uri) edits.push({ start: g[0], end: g[1], text: uri });
    }
    return edits;
  }

  const apply = (text, edits) => edits.sort((a, b) => b.start - a.start).reduce((t, e) => t.slice(0, e.start) + e.text + t.slice(e.end), text);

  return {
    get count() { return count; },
    async css(css, baseLine) {
      return apply(css, await cssEdits(css, baseLine));
    },
    async html(html, baseLine) {
      const edits = [];
      const shift = async (value, at, base) => {
        for (const e of await cssEdits(value, base)) edits.push({ ...e, start: e.start + at, end: e.end + at });
      };
      for (const t of walk(html)) {
        if (t.type !== 'open') continue;
        if (t.name === 'style' && t.bodyStart !== undefined) await shift(html.slice(t.bodyStart, t.bodyEnd), t.bodyStart, lineOf(html, t.bodyStart, baseLine));
        for (const a of attrsOf(t)) {
          if (a.value == null) continue;
          const at = t.start + a.vStart;
          const line = lineOf(html, at, baseLine);
          if (a.name === 'style') await shift(a.value, at, line);
          else if (a.name === 'srcset' && !/data:/i.test(a.value)) {
            const parts = a.value.split(',').map((p) => p.trim()).filter(Boolean);
            const mapped = [];
            for (const part of parts) {
              const [ref, ...descriptor] = part.split(/\s+/);
              mapped.push([(await resolve(ref, line)) ?? ref, ...descriptor].join(' '));
            }
            if (mapped.some((m, i) => m !== parts[i])) edits.push({ start: at, end: t.start + a.vEnd, text: mapped.join(', ') });
          } else if (a.name === 'src' || a.name === 'poster' || ((a.name === 'href' || a.name === 'xlink:href') && t.name !== 'a' && t.name !== 'area')) {
            const inline = (a.name === 'src' && t.name === 'img') || a.name === 'poster' || (a.name !== 'src' && t.name === 'image');
            if (inline) {
              const uri = await resolve(a.value, line);
              if (uri) edits.push({ start: at, end: t.start + a.vEnd, text: uri });
            } else if (REMOTE.test(a.value.trim()) || OTHER_SCHEME.test(a.value.trim()) && !/^data:/i.test(a.value.trim())) {
              await resolve(a.value, line);
            }
          }
        }
      }
      return apply(html, edits);
    },
  };
}
