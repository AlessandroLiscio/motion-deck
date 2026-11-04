#!/usr/bin/env node
// Builds one offline HTML file from a deck source, the engine, a theme, fonts and images (contract section 7).
// Exit codes: 0 PASS, 1 BuildError, 2 usage or internal error.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BuildError } from './lib/errors.mjs';
import { normalizeEol, parseSource, normalizeSlides, readTag, attrsOf } from './lib/source.mjs';
import { parseConfig } from './lib/config.mjs';
import { createInliner } from './lib/assets.mjs';
import { loadTheme } from './lib/fonts.mjs';
import { buildLicense } from './lib/license.mjs';
import { compose } from './lib/compose.mjs';
import { KB } from './lib/format.mjs';

export { BuildError };

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');
const MAX_BYTES = 6 * 1024 * 1024;

const readText = async (file, what) => {
  try {
    return normalizeEol(await fs.readFile(file, 'utf8'));
  } catch {
    throw new Error(`${what} not found or unreadable: ${file}`);
  }
};

export async function build({ src, out, themeOverride, engineDir, themesDir, fontsDir, skillRoot = DEFAULT_ROOT, log = () => {} }) {
  const warnings = [];
  const warn = (code, message) => {
    warnings.push({ code, message });
    log(`warn ${code} ${message}`);
  };
  const srcPath = path.resolve(src);
  const outPath = path.resolve(out ?? path.join(path.dirname(srcPath), 'index.html'));
  engineDir = path.resolve(engineDir ?? path.join(skillRoot, 'engine'));
  themesDir = path.resolve(themesDir ?? path.join(skillRoot, 'themes'));
  fontsDir = path.resolve(fontsDir ?? path.join(themesDir, '_shared', 'fonts'));

  const parsed = parseSource(await readText(srcPath, 'source'));
  const slides = normalizeSlides(parsed.slides);
  log(`ok parse ${slides.length} slides`);

  const config = parseConfig(parsed.config.text, parsed.config.line, warn);
  if (themeOverride) config.theme = themeOverride;
  log(`ok config "${config.title}"`);

  const theme = await loadTheme({ name: config.theme, themesDir, fontsDir });
  log(`ok theme ${config.theme}`);
  log(`ok fonts ${theme.faceCount} faces`);

  // An unknown transition name falls back silently at run time, so say so here.
  const known = new Set(['slide', 'fade', 'rise', 'zoom', 'none', ...(theme.theme.transitions ?? [])]);
  const unknown = (name, where) => name && !known.has(name) && warn('W_TRANSITION', `${where}: transition "${name}" is not provided by the engine or the ${config.theme} theme (known: ${[...known].join(', ')})`);
  unknown(config.transition, 'config');
  for (const s of slides) unknown(attrsOf(readTag(s.html, 0)).find((a) => a.name === 'data-transition')?.value, `line ${s.line}`);

  const inliner = createInliner({ baseDir: path.dirname(srcPath), warn });
  const slideHtml = [];
  for (const s of slides) slideHtml.push(await inliner.html(s.html, s.line));
  const customCss = [];
  for (const s of parsed.styles) customCss.push(await inliner.css(s.text, s.line));
  log(`ok images ${inliner.count}`);

  const license = await buildLicense({ skillRoot, fontsDir, fonts: theme.fonts });
  log(`ok license ${theme.fonts.length} font families`);

  const [engineCss, engineJs, diagramJs] = [
    await readText(path.join(engineDir, 'deck.css'), 'engine deck.css'),
    await readText(path.join(engineDir, 'deck.js'), 'engine deck.js'),
    await readText(path.join(engineDir, 'diagram.js'), 'engine diagram.js'),
  ];
  const html = compose({
    config, license, fontCss: theme.fontCss, engineCss, themeCss: theme.css, customCss,
    slides: slideHtml, diagramJs, engineJs, themeJs: theme.js,
  });
  const bytes = Buffer.byteLength(html);
  if (bytes > MAX_BYTES) warn('W_SIZE', `output is ${KB(bytes)}, over 6 MB`);

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, html);
  log(`ok write ${path.basename(outPath)} ${KB(bytes)}`);
  return { out: outPath, bytes, slides: slides.length, theme: config.theme, fonts: theme.fonts.map((f) => f.id), warnings };
}

const OPTIONS = { '--out': 'out', '--theme': 'themeOverride', '--engine': 'engineDir', '--themes': 'themesDir', '--fonts': 'fontsDir', '--port': 'port' };
const SWITCHES = { '--watch': 'watch', '--check': 'check' };

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].startsWith('--') ? argv[i].split(/=(.*)/s) : [argv[i]];
    if (SWITCHES[flag] && inline === undefined) opts[SWITCHES[flag]] = true;
    else if (OPTIONS[flag]) {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      opts[OPTIONS[flag]] = value;
    } else if (flag.startsWith('--') || opts.src) throw new Error(`unexpected argument ${argv[i]}`);
    else opts.src = flag;
  }
  if (!opts.src) throw new Error('usage: node build.mjs <deck.src.html> [--out <file>] [--theme <name>] [--engine <dir>] [--themes <dir>] [--fonts <dir>] [--watch [--port <n>] [--check]]');
  if ((opts.check || opts.port !== undefined) && !opts.watch) throw new Error('--check and --port only go with --watch');
  if (opts.port !== undefined && !(/^\d+$/.test(opts.port) && Number(opts.port) <= 65535)) throw new Error('--port must be a number from 0 to 65535');
  return opts;
}

// build.mjs --watch: build, serve on 127.0.0.1 with live reload, rebuild on every save, optionally run the check after each good build. Runs until Ctrl+C.
async function watchMain(opts) {
  const { startWatch } = await import('./lib/watch.mjs');
  const { port, watch, check, ...buildOpts } = opts;
  const out = path.resolve(buildOpts.out || path.join(path.dirname(path.resolve(buildOpts.src)), 'index.html'));
  const say = (line) => console.log(line);
  let checking = false;
  const runChecks = !check ? null : async () => {
    if (checking) return 'ok check skipped, the previous one is still running';
    checking = true;
    try {
      const { runCheck } = await import('./check.mjs');
      const lines = [];
      const code = await runCheck({ file: out, out: path.resolve('tmp', 'reports', 'check'), browser: 'auto', shots: 'final', pdf: false, strict: false, wpm: 0, timeout: 20000, themes: path.join(DEFAULT_ROOT, 'themes') }, (l) => lines.push(l));
      const warn = lines.find((l) => /^warn lint/.test(l));
      return `${lines.at(-1)}${warn ? `; ${warn.replace(/ \(details.*$/, '')}` : ''}${code === 0 ? '' : ' (see tmp/reports/check)'}`;
    } finally {
      checking = false;
    }
  };
  const w = await startWatch({ src: buildOpts.src, out, build: () => build({ ...buildOpts, out, log: () => {} }), check: runChecks, log: say, port: port === undefined ? 0 : Number(port) });
  say(`PASS watch: ${w.url} (Ctrl+C stops; open the address in Chrome or Edge, it reloads on every save${check ? ', the check runs after each build' : ''})`);
  await new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
  await w.close();
  say('ok watch stopped');
}

async function main() {
  const lines = [];
  const log = (line) => {
    lines.push(line);
    console.log(line);
  };
  let code = 0;
  let final;
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.watch) {
      await watchMain(opts);
      process.exit(0);
    }
    const result = await build({ ...opts, log });
    const shown = result.warnings.slice(0, 5).map((w) => `warn ${w.code}`);
    final = `PASS build: ${path.relative(process.cwd(), result.out) || result.out} ${KB(result.bytes)}, ${result.slides} slides, theme ${result.theme}, ${result.warnings.length} warnings${shown.length ? ` (${shown.join(', ')})` : ''}`;
  } catch (e) {
    if (e instanceof BuildError) {
      code = 1;
      final = `FAIL build: ${e.code} ${e.message}`;
    } else {
      code = 2;
      final = `FAIL build: ${e.message}`;
    }
  }
  lines.push(final);
  console.log(final);
  try {
    const dir = path.resolve('tmp', 'reports', 'build');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'build.log'), lines.join('\n') + '\n');
  } catch {
    /* the log is a convenience; the console already has the result */
  }
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
