#!/usr/bin/env node
// Downloads the latin WOFF2 subsets the themes embed plus each family's OFL text, and writes fonts.json.
// Run it when a font is added or refreshed: node tools/fetch-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'motion-deck', 'themes', '_shared', 'fonts');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// id is the folder and registry key; query is the css2 family parameter; dir is the folder in github.com/google/fonts/ofl.
const FAMILIES = [
  { id: 'big-shoulders-display', family: 'Big Shoulders Display', query: 'Big+Shoulders+Display:wght@100..900', dir: 'bigshouldersdisplay' },
  { id: 'atkinson-hyperlegible-next', family: 'Atkinson Hyperlegible Next', query: 'Atkinson+Hyperlegible+Next:wght@200..800', dir: 'atkinsonhyperlegiblenext' },
  { id: 'atkinson-hyperlegible-mono', family: 'Atkinson Hyperlegible Mono', query: 'Atkinson+Hyperlegible+Mono:wght@200..800', dir: 'atkinsonhyperlegiblemono' },
  { id: 'fraunces', family: 'Fraunces', query: 'Fraunces:opsz,wght@9..144,100..900', dir: 'fraunces' },
  { id: 'source-serif-4', family: 'Source Serif 4', query: 'Source+Serif+4:ital,wght@0,200..900;1,200..900', dir: 'sourceserif4' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono', query: 'JetBrains+Mono:wght@100..800', dir: 'jetbrainsmono' },
  { id: 'unbounded', family: 'Unbounded', query: 'Unbounded:wght@200..900', dir: 'unbounded' },
  { id: 'chakra-petch', family: 'Chakra Petch', query: 'Chakra+Petch:wght@400;600', dir: 'chakrapetch' },
  { id: 'manrope', family: 'Manrope', query: 'Manrope:wght@200..800', dir: 'manrope' },
  { id: 'cinzel', family: 'Cinzel', query: 'Cinzel:wght@400..900', dir: 'cinzel' },
  { id: 'eb-garamond', family: 'EB Garamond', query: 'EB+Garamond:ital,wght@0,400..800;1,400..800', dir: 'ebgaramond' },
  { id: 'pirata-one', family: 'Pirata One', query: 'Pirata+One', dir: 'pirataone' },
  { id: 'alegreya-sans', family: 'Alegreya Sans', query: 'Alegreya+Sans:wght@400;700', dir: 'alegreyasans' },
];

const get = async (url, binary = false) => {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
};

const latinFaces = (css) => [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)]
  .filter((m) => m[1] === 'latin')
  .map((m) => ({
    style: /font-style:\s*(\w+)/.exec(m[2])[1],
    weight: /font-weight:\s*([\d ]+);/.exec(m[2])[1].trim(),
    url: /url\((https:[^)]+\.woff2)\)/.exec(m[2])[1],
  }));

const registry = [];
let files = 0;
let bytes = 0;
for (const fam of FAMILIES) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${fam.query}&display=swap`;
    const faces = latinFaces(await get(cssUrl));
    if (!faces.length) throw new Error('no latin face in the css');
    const dir = join(OUT, fam.id);
    await mkdir(dir, { recursive: true });
    const entry = { id: fam.id, family: fam.family, faces: [] };
    for (const f of faces) {
      const name = `${fam.id}-${f.style}-${f.weight.replace(' ', '-')}.woff2`;
      const data = await get(f.url, true);
      await writeFile(join(dir, name), data);
      entry.faces.push({ file: `${fam.id}/${name}`, style: f.style, weight: f.weight, bytes: data.length, origin: f.url });
      files += 1;
      bytes += data.length;
    }
    const ofl = await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${fam.dir}/OFL.txt`);
    await writeFile(join(dir, 'OFL.txt'), ofl);
    entry.license = 'OFL-1.1';
    entry.licenseFile = `${fam.id}/OFL.txt`;
    entry.copyright = (ofl.split(/\r?\n/).find((l) => /^Copyright/i.test(l)) || '').trim();
    entry.source = `https://github.com/google/fonts/tree/main/ofl/${fam.dir}`;
    entry.css = cssUrl;
    entry.fetched = new Date().toISOString().slice(0, 10);
    registry.push(entry);
    console.log(`ok   ${fam.id}: ${entry.faces.length} file(s), ${entry.faces.reduce((n, f) => n + f.bytes, 0)} bytes`);
  } catch (err) {
    console.log(`FAIL ${fam.id}: ${err.message}`);
    process.exitCode = 1;
  }
}
await writeFile(join(OUT, 'fonts.json'), JSON.stringify(registry, null, 2) + '\n');
console.log(`${process.exitCode ? 'FAIL' : 'PASS'} fetch-fonts: ${registry.length}/${FAMILIES.length} families, ${files} files, ${bytes} bytes -> ${OUT}`);
