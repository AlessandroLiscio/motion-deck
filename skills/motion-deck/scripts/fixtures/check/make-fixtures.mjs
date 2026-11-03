#!/usr/bin/env node
// Regenerates the check fixtures next to this file: node make-fixtures.mjs
// Each fixture is a complete built-style deck made from the stub engine, the stub theme and one inlined Manrope face. It does not use build.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..', '..', '..');
const read = (...p) => readFileSync(join(skill, ...p), 'utf8');
const engineCss = read('examples', 'fixtures', 'engine-stub', 'deck.css');
const engineJs = read('examples', 'fixtures', 'engine-stub', 'deck.js');
const themeCss = read('examples', 'fixtures', 'themes-stub', 'test', 'theme.css');
const themeJs = read('examples', 'fixtures', 'themes-stub', 'test', 'theme.js');
const manrope = readFileSync(join(skill, 'themes', '_shared', 'fonts', 'manrope', 'manrope-normal-200-800.woff2')).toString('base64');

const goodFace = `@font-face { font-family: "Manrope"; font-style: normal; font-weight: 200 800; font-display: block; src: url(data:font/woff2;base64,${manrope}) format("woff2"); }`;
// Only one face is embedded, so the mono token borrows it; the real themes embed their own mono face.
// The stub engine css prints wrongly: it keeps #viewport clipped (one page for the whole deck), shows the ambient canvas and breaks the page after the last slide; the print rule below corrects that for the fixtures.
const monoFix = ':root { --f-mono: "Manrope", monospace; } @media print { #ambient { display: none; } #viewport { overflow: visible; } .slide:last-child { break-after: auto; } }';

const slideTitle = '<section class="slide" data-layout="title" data-sec="a" data-title="Hello"><h1>Hello</h1><p class="lead">A fixture with three slides.</p><aside class="notes">Opening notes.</aside></section>';
const slideSteps = '<section class="slide" data-sec="a"><h2>Two steps</h2><ul><li data-step="1">One</li><li data-step="2">Two</li></ul></section>';
const slideStats = '<section class="slide" data-layout="stats" data-sec="b"><h2>Numbers</h2><div class="stats"><div class="stat"><span class="num" data-count="1200">1,200</span> <span class="label">things</span></div></div></section>';

function page({ slides = [slideTitle, slideSteps, slideStats], fonts = goodFace, custom = monoFix, after = '', title = 'Check fixture' }) {
  return `<!doctype html>
<html lang="en" data-theme="test"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style id="deck-fonts">${fonts}</style>
<style id="deck-engine">${engineCss}</style>
<style id="deck-theme">${themeCss}</style>
<style id="deck-custom">${custom}</style>
</head><body class="deck"><canvas id="ambient" aria-hidden="true"></canvas><div id="viewport"><div id="stage">${slides.join('\n')}</div></div>
<script id="deck-config" type="application/json">{ "title": "${title}", "theme": "test", "lang": "en" }</script>
<script id="deck-engine-js">${engineJs}</script>
<script id="deck-theme-js">${themeJs}</script>
${after ? `<script>${after}</script>` : ''}
</body></html>
`;
}

const slideOf = (inner, extra = '') => `<section class="slide" data-sec="a" ${extra}>${inner}</section>`;

const fixtures = {
  // Passes. Also exercises the exemptions: a bleed box, an art slot and svg internals that all leave the safe area.
  'ok.html': page({
    slides: [
      slideTitle.replace('</section>', '<div data-art="hero" style="position:absolute;right:20px;top:20px;width:200px;height:200px"></div><div data-bleed style="position:absolute;left:-40px;top:0;width:60px;height:900px;background:#4ea1ff"></div></section>'),
      slideSteps,
      slideStats.replace('</section>', '<svg width="200" height="80" viewBox="0 0 200 80"><circle cx="900" cy="40" r="30" fill="currentColor"/></svg></section>'),
    ],
  }),
  'overflow.html': page({
    slides: [slideOf('<h2>Too wide</h2><p class="wide" style="white-space:nowrap;margin:0">This paragraph refuses to wrap and keeps running far past the right edge of the safe area and even past the stage itself, so the check must flag it.</p>')],
  }),
  'clipped.html': page({
    slides: [
      slideOf('<h2>Clipped</h2><div class="box" style="width:420px;height:60px;overflow:hidden"><p style="margin:0">Line one of a paragraph that is clipped by its box. Line two keeps going and going. Line three is already lost.</p></div>'),
      slideOf('<h2>Tall</h2><div style="height:1000px;background:#1a222b"></div>'),
    ],
  }),
  'missing-font.html': page({
    fonts: `${goodFace}\n@font-face { font-family: "Broken Sans"; src: url(data:font/woff2;base64,AAECAwQFBgcICQoLDA0ODw==) format("woff2"); }`,
    custom: `${monoFix} :root { --f-body: "Ghost Sans", sans-serif; }`,
  }),
  'exception.html': page({ after: 'Deck.ready = Promise.reject(new Error("boot failed in fixture")); throw new Error("boot failed in fixture");' }),
  'never-ready.html': page({ after: 'Deck.ready = new Promise(function () {});' }),
  'console-error.html': page({ after: 'console.error("fixture console error");' }),
  'remote.html': page({ slides: [slideOf('<h2>Remote</h2><img src="https://example.invalid/pixel.png" width="100" height="100" alt="">')] }),
  'bad-contrast.html': page({ custom: `${monoFix} :root { --text: #101418; }` }),
};

for (const [name, html] of Object.entries(fixtures)) writeFileSync(join(here, name), html);
console.log(`PASS make-fixtures: ${Object.keys(fixtures).length} files in ${here}`);
