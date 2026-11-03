#!/usr/bin/env node
// Builds the showcase deck once per theme and a gallery page that links the decks. CI builds it on every pull request and GitHub Pages publishes it from the default branch.
// node gallery.mjs [--out <dir>] [--src <deck.src.html>]. Exit codes: 0 PASS, 1 a build failed, 2 usage or internal error.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, BuildError } from './build.mjs';
import { escapeHtml as esc } from './lib/compose.mjs';
import { listThemes } from './lib/fonts.mjs';
import { KB } from './lib/format.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['space', 'editorial', 'neon', 'corporate', 'fantasy', 'pirates'];
const REPO = 'https://github.com/AlessandroLiscio/motion-deck';
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

// The shipped themes first in their showcase order, any other theme after them by name.
async function themeList(themesDir) {
  const rank = (n) => (ORDER.includes(n) ? ORDER.indexOf(n) : ORDER.length);
  return (await listThemes(themesDir)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const card = (t) => `<li class="card">
  <a class="shot" href="${esc(t.name)}/index.html" aria-label="Open the ${esc(t.label)} deck">
    <iframe src="${esc(t.name)}/index.html?capture=1&amp;nohint#1" title="${esc(t.label)} theme, title slide" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
  </a>
  <div class="meta">
    <h2>${esc(t.label)}<span class="pill">${esc(t.mode)}</span></h2>
    <p>${esc(t.description)}</p>
    <p class="sw" aria-hidden="true">${(t.accents || []).map((c) => `<i style="background:${esc(c)}"></i>`).join('')}</p>
    <p class="row"><a class="open" href="${esc(t.name)}/index.html">Open the deck</a><span class="tr">${esc(t.defaultTransition || 'slide')} transition</span></p>
  </div>
</li>`;

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = (n) => NUMBER_WORDS[n] ?? String(n);

const page = (themes, title) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>motion-deck</title>
<meta name="description" content="Animated one-file HTML presentations in ${countWord(themes.length)} themes. Open the showcase deck in each theme.">
<style>
:root { --bg: #f4f3ef; --panel: #ffffff; --line: #dcd9d0; --text: #17191e; --muted: #5a6171; --acc: #1c5fd4; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #0c0d11; --panel: #14161c; --line: #262a34; --text: #eceef4; --muted: #99a1b3; --acc: #7ec3ff; color-scheme: dark; } }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { margin: 0; padding: 0 max(20px, env(safe-area-inset-left, 0px)) 0 max(20px, env(safe-area-inset-right, 0px)); background: var(--bg); color: var(--text); font: 16px/1.55 ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: clamp(36px, 7vw, 88px); }
.eyebrow { margin: 0 0 14px; font: 600 13px/1 ui-monospace, "SF Mono", Consolas, monospace; letter-spacing: .16em; text-transform: uppercase; color: var(--acc); }
h1 { margin: 0; font-size: clamp(40px, 7vw, 76px); line-height: 1; letter-spacing: -.02em; text-wrap: balance; }
.lede { max-width: 46em; margin: 22px 0 0; font-size: clamp(17px, 2vw, 20px); color: var(--muted); text-wrap: pretty; }
.ask { display: inline-block; margin: 22px 0 0; padding: 10px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); font: 15px/1.4 ui-monospace, "SF Mono", Consolas, monospace; }
.links { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 22px 0 0; padding: 0; list-style: none; }
.links a { color: var(--text); text-underline-offset: .22em; text-decoration-thickness: 1px; }
.links a:hover { color: var(--acc); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 28px; margin: clamp(36px, 6vw, 64px) 0 0; padding: 0; list-style: none; }
.card { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.shot { position: relative; display: block; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--line); border-radius: 12px; background: #000; }
.shot:hover, .shot:focus-visible { border-color: var(--acc); }
.shot iframe { position: absolute; left: 0; top: 0; width: 1600px; height: 900px; border: 0; transform-origin: 0 0; transform: scale(var(--k, .22)); pointer-events: none; }
.meta { display: flex; flex: 1; flex-direction: column; }
.meta .row { margin-top: auto; padding-top: 8px; }
.meta h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 22px; line-height: 1.2; }
.pill { padding: 2px 9px; border: 1px solid var(--line); border-radius: 999px; font: 600 11px/1.6 ui-monospace, "SF Mono", Consolas, monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.meta p { margin: 8px 0 0; color: var(--muted); text-wrap: pretty; }
.sw { display: flex; gap: 6px; }
.sw i { width: 22px; height: 8px; border-radius: 4px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.open { color: var(--text); font-weight: 600; text-underline-offset: .22em; }
.open:hover { color: var(--acc); }
.tr { font: 13px/1 ui-monospace, "SF Mono", Consolas, monospace; color: var(--muted); }
footer { margin-top: clamp(48px, 8vw, 96px); padding-top: 24px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
footer p { margin: 0 0 8px; max-width: 60em; }
footer a { color: inherit; }
:focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; }
</style>
</head>
<body>
<div class="wrap">
<header>
  <p class="eyebrow">motion-deck</p>
  <h1>${esc(title)}</h1>
  <p class="lede">Animated presentations that are one HTML file. Entrances, step-by-step builds, diagrams that draw themselves, a living background, a map of the talk and a presenter window. Below, the same showcase deck in each of the ${countWord(themes.length)} themes: changing the theme is one word in the deck's config.</p>
  <p class="ask">Ask Claude Code: “make a 10-slide deck about onboarding in the pirates theme”</p>
  <ul class="links">
    <li><a href="${REPO}">Source on GitHub</a></li>
    <li><a href="${REPO}/blob/main/skills/motion-deck/examples/showcase.src.html">The showcase deck's source</a></li>
    <li><a href="${REPO}/blob/main/CREDITS.md">Credits</a></li>
  </ul>
</header>
<main>
  <ul class="grid">
${themes.map(card).join('\n')}
  </ul>
</main>
<footer>
  <p>Keys in every deck: arrows or Space to move, M for the map, P for the presenter window, F for full screen. Printing a deck to PDF gives one slide per page.</p>
  <p>Code under the MIT license. Fonts under the SIL Open Font License, embedded in each deck with their notices. The technique of the original ship-ai-agents deck by Salvatore Visaggi (CC BY 4.0) inspired this project; see the credits.</p>
</footer>
</div>
<script>
(function () {
  var fit = function () { document.querySelectorAll('.shot').forEach(function (s) { s.style.setProperty('--k', String(s.clientWidth / 1600)); }); };
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(document.body); else addEventListener('resize', fit);
})();
</script>
</body>
</html>
`;

export async function gallery({ out, src, skillRoot = SKILL, log = () => {} }) {
  const outDir = path.resolve(out ?? 'dist');
  const srcPath = path.resolve(src ?? path.join(skillRoot, 'examples', 'showcase.src.html'));
  const themesDir = path.join(skillRoot, 'themes');
  const names = await themeList(themesDir);
  if (!names.length) throw new Error(`no theme found in ${themesDir}`);
  await fs.mkdir(outDir, { recursive: true });
  const themes = [];
  for (const name of names) {
    const json = await readJson(path.join(themesDir, name, 'theme.json'));
    const result = await build({ src: srcPath, out: path.join(outDir, name, 'index.html'), themeOverride: name, skillRoot });
    log(`ok ${name} ${KB(result.bytes)}, ${result.slides} slides`);
    themes.push({ name, label: json.label || name, mode: json.mode || 'dark', description: json.description || '', accents: json.accents || [], defaultTransition: json.defaultTransition });
  }
  const config = JSON.parse(/<script type="application\/json" id="deck-config">([\s\S]*?)<\/script>/.exec(await fs.readFile(srcPath, 'utf8'))?.[1] ?? '{}');
  await fs.writeFile(path.join(outDir, 'index.html'), page(themes, config.title || 'motion-deck'));
  await fs.writeFile(path.join(outDir, '.nojekyll'), '');
  log(`ok write ${path.join(path.basename(outDir), 'index.html')}`);
  return { out: outDir, themes: names };
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
    const opts = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--out' || argv[i] === '--src') {
        if (argv[i + 1] === undefined) throw new Error(`${argv[i]} needs a value`);
        opts[argv[i].slice(2)] = argv[++i];
      } else throw new Error(`unexpected argument ${argv[i]}; usage: node gallery.mjs [--out <dir>] [--src <deck.src.html>]`);
    }
    const result = await gallery({ ...opts, log });
    final = `PASS gallery: ${path.relative(process.cwd(), result.out) || result.out}, ${result.themes.length} themes (${result.themes.join(', ')})`;
  } catch (e) {
    code = e instanceof BuildError ? 1 : 2;
    final = `FAIL gallery: ${e instanceof BuildError ? e.code + ' ' : ''}${e.message}`;
  }
  lines.push(final);
  console.log(final);
  try {
    const dir = path.resolve('tmp', 'reports', 'gallery');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'gallery.log'), lines.join('\n') + '\n');
  } catch {
    /* the log is a convenience; the console already has the result */
  }
  process.exit(code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
