// Theme loading and font embedding (contract 7 item 3 and 8.1): validates theme.json against the fonts registry and
// returns the theme files plus one @font-face per face of every listed font.
import fs from 'node:fs/promises';
import path from 'node:path';
import { BuildError } from './errors.mjs';
import { normalizeEol } from './source.mjs';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const ROLES = new Set(['display', 'body', 'mono']);
const MAX_FONT_FILES = 4;

const readJson = async (file, what) => {
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return { missing: true };
  }
  try {
    return { value: JSON.parse(normalizeEol(text)) };
  } catch (e) {
    throw new BuildError('E_THEME', `${what} is not valid JSON (${e.message})`);
  }
};

const exists = (file) => fs.stat(file).then((s) => s.isFile(), () => false);

// Names of the theme folders (a folder with a theme.json, not starting with `_`), sorted.
export async function listThemes(themesDir) {
  try {
    const entries = await fs.readdir(themesDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
    const withJson = await Promise.all(dirs.map((d) => exists(path.join(themesDir, d, 'theme.json'))));
    return dirs.filter((_, i) => withJson[i]).sort();
  } catch {
    return [];
  }
}

export async function loadTheme({ name, themesDir, fontsDir }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new BuildError('E_THEME', `invalid theme name "${name}" (lowercase letters, digits and dashes)`);
  const dir = path.join(themesDir, name);
  const { value: theme, missing } = await readJson(path.join(dir, 'theme.json'), `themes/${name}/theme.json`);
  if (missing) {
    const list = await listThemes(themesDir);
    throw new BuildError('E_THEME', `unknown theme "${name}": no theme.json in ${dir}; available: ${list.join(', ') || 'none'}`);
  }

  const problems = [];
  const bad = (m) => problems.push(m);
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) bad('theme.json must be a JSON object');
  else {
    if (theme.name !== name) bad(`"name" is ${JSON.stringify(theme.name)} but the folder is "${name}"`);
    for (const k of ['bg', 'text', 'muted']) if (typeof theme[k] !== 'string' || !HEX.test(theme[k])) bad(`"${k}" must be a hex color, got ${JSON.stringify(theme[k])}`);
    if (!Array.isArray(theme.accents) || theme.accents.length !== 6 || !theme.accents.every((c) => typeof c === 'string' && HEX.test(c))) {
      bad('"accents" must be exactly 6 hex colors');
    }
    if (!(await exists(path.join(dir, 'theme.css')))) bad('theme.css is missing');
    if (!(await exists(path.join(dir, 'theme.js')))) bad('theme.js is missing');
  }

  const listed = Array.isArray(theme?.fonts) ? theme.fonts : (bad('"fonts" must be a list'), []);
  const registry = await readJson(path.join(fontsDir, 'fonts.json'), 'fonts.json');
  if (registry.missing) bad(`fonts registry not found: ${path.join(fontsDir, 'fonts.json')}`);
  const byId = new Map((registry.value ?? []).map((f) => [f.id, f]));
  const fonts = [];
  const seen = new Set();
  for (const [i, f] of listed.entries()) {
    const reg = byId.get(f?.id);
    const roles = [].concat(f?.role ?? []);
    if (!reg) bad(`fonts[${i}].id ${JSON.stringify(f?.id)} is not in fonts.json`);
    else if (seen.has(f.id)) bad(`font "${f.id}" is listed twice`);
    else {
      seen.add(f.id);
      fonts.push(reg);
    }
    if (!roles.length || !roles.every((r) => ROLES.has(r))) bad(`fonts[${i}].role must be display, body or mono (or a list of them)`);
  }
  const fileCount = fonts.reduce((n, f) => n + f.faces.length, 0);
  if (fileCount > MAX_FONT_FILES) bad(`${fileCount} font files, at most ${MAX_FONT_FILES} are allowed`);
  if (problems.length) throw new BuildError('E_THEME', `theme "${name}": ${problems.join('; ')}`);

  const faces = [];
  for (const f of fonts) {
    for (const face of f.faces) {
      let buf;
      try {
        buf = await fs.readFile(path.join(fontsDir, face.file));
      } catch {
        throw new BuildError('E_THEME', `theme "${name}": font file ${face.file} is missing in ${fontsDir}`);
      }
      const family = f.family.replace(/["\\]/g, '\\$&');
      faces.push(`@font-face{font-family:"${family}";font-style:${face.style};font-weight:${face.weight};font-display:block;src:url(data:font/woff2;base64,${buf.toString('base64')}) format("woff2")}`);
    }
  }

  return {
    theme,
    css: normalizeEol(await fs.readFile(path.join(dir, 'theme.css'), 'utf8')),
    js: normalizeEol(await fs.readFile(path.join(dir, 'theme.js'), 'utf8')),
    fontCss: faces.join('\n'),
    faceCount: faces.length,
    fonts: fonts.map((f) => ({ id: f.id, family: f.family, copyright: f.copyright, source: f.source, licenseFile: f.licenseFile })),
  };
}
