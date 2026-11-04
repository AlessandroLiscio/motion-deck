#!/usr/bin/env node
// Checks that this machine can build and check decks: Node, a browser, the embedded fonts, the theme files, and (with a built deck as argument) that the deck was built by this version.
// usage: doctor.mjs [built.html]. Exit 0 PASS (warnings allowed), 1 a check failed, 2 usage error.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './lib/browser.mjs';
import { GENERATOR_VERSION } from './lib/compose.mjs';
import { listThemes } from './lib/fonts.mjs';

const SKILL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIN_NODE = 24;

// Returns { lines, problems, warnings }. Pure apart from reading files; `env` and `nodeVersion` are injectable for tests.
export async function diagnose({ deck = null, skill = SKILL, nodeVersion = process.versions.node, find = findBrowser } = {}) {
  const lines = [];
  let problems = 0;
  let warnings = 0;
  const ok = (name, detail) => lines.push(`ok ${name} ${detail}`);
  const warn = (name, detail) => { warnings++; lines.push(`warn ${name} ${detail}`); };
  const fail = (name, detail) => { problems++; lines.push(`fail ${name} ${detail}`); };

  const major = Number(nodeVersion.split('.')[0]);
  if (major >= MIN_NODE) ok('node', nodeVersion);
  else fail('node', `${nodeVersion} is too old, scripts need Node ${MIN_NODE} or newer`);

  const found = ['chrome', 'edge'].map((n) => [n, find(n)?.path]).filter(([, p]) => p);
  if (found.length) ok('browser', found.map(([n, p]) => `${n} (${p})`).join(', '));
  else fail('browser', 'no Chrome or Edge found; install one or set CHROME_PATH or EDGE_PATH');

  const themesDir = join(skill, 'themes');
  const themes = await listThemes(themesDir);
  if (!themes.length) fail('themes', `none found under ${themesDir}`);
  else ok('themes', `${themes.length} (${themes.join(', ')})`);

  // fonts: every face of every font a theme lists must exist next to the registry, with its license text
  const fontsDir = join(themesDir, '_shared', 'fonts');
  let registry = null;
  try {
    registry = JSON.parse(readFileSync(join(fontsDir, 'fonts.json'), 'utf8'));
  } catch (e) {
    fail('fonts', `registry ${join(fontsDir, 'fonts.json')} cannot be read (${e.message})`);
  }
  if (registry) {
    const missing = [];
    let faces = 0;
    const ids = new Set();
    for (const t of themes) {
      const json = JSON.parse(readFileSync(join(themesDir, t, 'theme.json'), 'utf8'));
      for (const f of json.fonts || []) ids.add(f.id);
    }
    for (const id of ids) {
      const entry = registry.find((e) => e.id === id);
      if (!entry) { missing.push(`${id} is not in fonts.json`); continue; }
      for (const face of entry.faces || []) {
        faces++;
        if (!existsSync(join(fontsDir, face.file))) missing.push(face.file);
      }
      if (!entry.licenseFile || !existsSync(join(fontsDir, entry.licenseFile))) missing.push(`${id} license file`);
    }
    if (missing.length) fail('fonts', `${missing.length} missing: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', ...' : ''}; run tools/fetch-fonts.mjs`);
    else ok('fonts', `${faces} faces of ${ids.size} families, licenses present`);
  }

  for (const f of ['engine/deck.js', 'engine/deck.css', 'engine/diagram.js', 'references/contract.md']) {
    if (!existsSync(join(skill, f))) fail('files', `${f} is missing`);
  }
  const engine = (() => { try { return /version:\s*(\d+)/.exec(readFileSync(join(skill, 'engine', 'deck.js'), 'utf8'))?.[1]; } catch { return null; } })();
  ok('engine', `runtime version ${engine ?? 'unknown'}, generator ${GENERATOR_VERSION}`);

  if (deck) {
    if (!existsSync(deck)) fail('deck', `${deck} not found`);
    else {
      const head = readFileSync(deck, 'utf8').slice(0, 4000);
      const gen = /<meta name="generator" content="motion-deck ([^"]+)">/.exec(head)?.[1];
      if (!gen) warn('deck', `${deck} has no motion-deck generator stamp; was it built by this skill?`);
      else if (gen !== GENERATOR_VERSION) warn('deck', `built by generator ${gen}, this skill is ${GENERATOR_VERSION}; rebuild the deck`);
      else ok('deck', `built by generator ${gen}, same as this skill`);
    }
  }
  return { lines, problems, warnings };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args[0]?.startsWith('--')) {
    console.log('FAIL doctor: usage: doctor.mjs [built.html]');
    process.exit(2);
  }
  const { lines, problems, warnings } = await diagnose({ deck: args[0] ? resolve(args[0]) : null });
  const final = problems ? `FAIL doctor: ${problems} problem(s), ${warnings} warning(s)` : `PASS doctor: ${warnings} warning(s)`;
  for (const l of lines) console.log(l);
  console.log(final);
  try {
    const dir = resolve('tmp', 'reports', 'doctor');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'doctor.log'), [...lines, final].join('\n') + '\n');
  } catch {
    /* the log is a convenience */
  }
  process.exit(problems ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
