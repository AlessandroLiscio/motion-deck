#!/usr/bin/env node
// Scaffolds a deck: <dir>/<slug>/deck.src.html from templates/deck.src.html with the config filled in, plus an empty assets/ folder.
// Exit codes: 0 PASS, 1 refused (the deck exists), 2 usage error.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEol } from './lib/source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const FLAGS = ['--theme', '--title', '--dir', '--lang'];

function parseArgs(argv) {
  const opts = { theme: 'space', dir: 'decks', lang: 'en' };
  let slug;
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].startsWith('--') ? argv[i].split(/=(.*)/s) : [argv[i]];
    if (FLAGS.includes(flag)) {
      const value = inline ?? argv[++i];
      if (value === undefined) throw new Error(`${flag} needs a value`);
      opts[flag.slice(2)] = value;
    } else if (flag.startsWith('--') || slug) throw new Error(`unexpected argument ${argv[i]}`);
    else slug = flag;
  }
  if (!slug) throw new Error('usage: node new.mjs <slug> [--theme <name>] [--title "..."] [--dir decks] [--lang en]');
  if (!NAME.test(slug)) throw new Error(`slug "${slug}" must match [a-z0-9][a-z0-9-]*`);
  if (!NAME.test(opts.theme)) throw new Error(`theme "${opts.theme}" must match [a-z0-9][a-z0-9-]*`);
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(opts.lang)) throw new Error(`lang "${opts.lang}" is not a BCP 47 tag`);
  opts.slug = slug;
  opts.title ??= slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return opts;
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
    const folder = path.resolve(o.dir, o.slug);
    const file = path.join(folder, 'deck.src.html');
    const exists = await fs.access(file).then(() => true, () => false);
    if (exists) {
      code = 1;
      say(`FAIL new: ${file} already exists, nothing was written`);
    } else {
      const template = normalizeEol(await fs.readFile(path.join(ROOT, 'templates', 'deck.src.html'), 'utf8'));
      const json = (s) => JSON.stringify(s).slice(1, -1).replace(/</g, '\\u003c');
      const text = template.replace(/\{\{title\}\}/g, () => json(o.title)).replace(/\{\{theme\}\}/g, o.theme).replace(/\{\{lang\}\}/g, o.lang);
      await fs.mkdir(path.join(folder, 'assets'), { recursive: true });
      await fs.writeFile(file, text);
      say(`ok create ${path.relative(process.cwd(), file) || file}`);
      say(`ok create ${path.relative(process.cwd(), path.join(folder, 'assets')) || folder}${path.sep}`);
      say(`PASS new: ${o.slug} (theme ${o.theme}, lang ${o.lang})`);
      say(`node ${shellArg(path.join(ROOT, 'scripts', 'build.mjs'))} ${shellArg(file)}`);
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
