#!/usr/bin/env node
// Scaffolds a deck: <dir>/<slug>/deck.src.html from templates/deck.src.html (or a starter deck from examples/ with --template) with the config filled in, plus an empty assets/ folder.
// `new.mjs --list-layouts` prints the layouts of the contract. Exit codes: 0 PASS, 1 refused (the deck exists), 2 usage error.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEol } from './lib/source.mjs';
import { TEMPLATE_KINDS } from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const FLAGS = ['--theme', '--title', '--dir', '--lang', '--template'];
const USAGE = `usage: node new.mjs <slug> [--theme <name>] [--title "..."] [--dir decks] [--lang en] [--template ${TEMPLATE_KINDS.join('|')}] | node new.mjs --list-layouts`;

function parseArgs(argv) {
  const opts = { theme: 'space', dir: 'decks', lang: 'en', given: new Set() };
  let slug;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--list-layouts') {
      opts.listLayouts = true;
      continue;
    }
    const [flag, inline] = argv[i].startsWith('--') ? argv[i].split(/=(.*)/s) : [argv[i]];
    if (FLAGS.includes(flag)) {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      opts[flag.slice(2)] = value;
      opts.given.add(flag.slice(2));
    } else if (flag.startsWith('--') || slug) throw new Error(`unexpected argument ${argv[i]}`);
    else slug = flag;
  }
  if (opts.listLayouts) return opts;
  if (!slug) throw new Error(USAGE);
  if (!NAME.test(slug)) throw new Error(`slug "${slug}" must match [a-z0-9][a-z0-9-]*`);
  if (!NAME.test(opts.theme)) throw new Error(`theme "${opts.theme}" must match [a-z0-9][a-z0-9-]*`);
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(opts.lang)) throw new Error(`lang "${opts.lang}" is not a BCP 47 tag`);
  if (opts.template !== undefined && !TEMPLATE_KINDS.includes(opts.template)) throw new Error(`unknown template "${opts.template}"; choose one of ${TEMPLATE_KINDS.join(', ')}`);
  opts.slug = slug;
  opts.title ??= slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return opts;
}

const json = (s) => JSON.stringify(s).slice(1, -1).replace(/</g, '\\u003c');

// The layout table of the contract (section 2.3), one line per layout with its expected children.
async function layoutLines() {
  const text = normalizeEol(await fs.readFile(path.join(ROOT, 'references', 'contract.md'), 'utf8'));
  const start = text.indexOf('### 2.3 Layouts');
  const end = text.indexOf('Shared elements:', start);
  if (start < 0 || end < 0) throw new Error('the layout table was not found in references/contract.md');
  const rows = text.slice(start, end).split('\n').map((l) => /^\| `([a-z]+)`(?: \(default\))? \| (.*) \|$/.exec(l)).filter(Boolean);
  const width = Math.max(...rows.map((r) => r[1].length));
  return rows.map((r) => `${r[1].padEnd(width)}  ${r[2].replace(/`/g, '')}`);
}

// A starter deck keeps its own title, theme and language unless the flag was given.
function fromTemplate(text, o) {
  const set = (key, value) => {
    const re = new RegExp(`^(\\s*"${key}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'm');
    text = text.replace(re, (_, head) => `${head}"${json(value)}"`);
  };
  for (const key of ['title', 'theme', 'lang']) if (o.given.has(key)) set(key, o[key]);
  return text;
}

// Quote only when the shell needs it, so the printed command can be pasted as it is.
const shellArg = (s) => {
  const p = s.split(path.sep).join('/');
  return /^[\w./:~-]+$/.test(p) ? p : `"${p}"`;
};

async function main() {
  const out = [];
  const say = (line) => {
    out.push(line);
    console.log(line);
  };
  let code = 0;
  try {
    const o = parseArgs(process.argv.slice(2));
    if (o.listLayouts) {
      for (const line of await layoutLines()) say(line);
      say('PASS new: layouts');
    } else {
      const folder = path.resolve(o.dir, o.slug);
      const file = path.join(folder, 'deck.src.html');
      const exists = await fs.access(file).then(() => true, () => false);
      if (exists) {
        code = 1;
        say(`FAIL new: ${file} already exists, nothing was written`);
      } else {
        const text = o.template
          ? fromTemplate(normalizeEol(await fs.readFile(path.join(ROOT, 'examples', `${o.template}.src.html`), 'utf8')), o)
          : normalizeEol(await fs.readFile(path.join(ROOT, 'templates', 'deck.src.html'), 'utf8'))
            .replace(/\{\{title\}\}/g, () => json(o.title)).replace(/\{\{theme\}\}/g, o.theme).replace(/\{\{lang\}\}/g, o.lang);
        await fs.mkdir(path.join(folder, 'assets'), { recursive: true });
        await fs.writeFile(file, text);
        say(`ok create ${path.relative(process.cwd(), file) || file}`);
        say(`ok create ${path.relative(process.cwd(), path.join(folder, 'assets')) || folder}${path.sep}`);
        const own = (key) => (o.template && !o.given.has(key) ? 'from the template' : o[key]);
        say(`PASS new: ${o.slug} (${o.template ? `template ${o.template}, ` : ''}theme ${own('theme')}, lang ${own('lang')})`);
        say(`node ${shellArg(path.join(ROOT, 'scripts', 'build.mjs'))} ${shellArg(file)}`);
      }
    }
  } catch (e) {
    code = 2;
    say(`FAIL new: ${e.message}`);
  }
  try {
    const dir = path.resolve('tmp', 'reports', 'new');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'new.log'), out.join('\n') + '\n');
  } catch {
    /* the log is a convenience */
  }
  process.exit(code);
}

main();
