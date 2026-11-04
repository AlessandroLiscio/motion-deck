// The license notice (contract 7 item 2): the engine's MIT text, then every embedded font family with its copyright,
// source and the header of its OFL.txt, then each distinct license body once. The result is one HTML comment.
import fs from 'node:fs/promises';
import path from 'node:path';
import { BuildError } from './errors.mjs';
import { normalizeEol } from './source.mjs';

const LEVELS = 3;
const OFL_MARK = /^SIL OPEN FONT LICENSE/m;

async function findEngineLicense(skillRoot) {
  let dir = path.resolve(skillRoot);
  for (let i = 0; i <= LEVELS; i++, dir = path.dirname(dir)) {
    try {
      return normalizeEol(await fs.readFile(path.join(dir, 'LICENSE'), 'utf8')).trim();
    } catch {
      /* try the parent */
    }
  }
  throw new BuildError('E_LICENSE', `no LICENSE file found in ${skillRoot} or its ${LEVELS} parent folders`);
}

export async function buildLicense({ skillRoot, fontsDir, fonts }) {
  const mit = await findEngineLicense(skillRoot);
  const copyright = mit.split('\n').find((l) => /^copyright/i.test(l.trim()));
  if (!copyright || !/Permission is hereby granted/.test(mit)) {
    throw new BuildError('E_LICENSE', 'the LICENSE file is not an MIT license with a copyright line');
  }

  const headers = [];
  const bodies = new Map();
  for (const f of fonts) {
    if (!f.copyright || !f.source || !f.licenseFile) throw new BuildError('E_LICENSE', `fonts.json entry "${f.id}" lacks copyright, source or licenseFile`);
    let ofl;
    try {
      ofl = normalizeEol(await fs.readFile(path.join(fontsDir, f.licenseFile), 'utf8'));
    } catch {
      throw new BuildError('E_LICENSE', `license file ${f.licenseFile} of font "${f.id}" is missing in ${fontsDir}`);
    }
    const at = ofl.search(OFL_MARK);
    if (at < 0) throw new BuildError('E_LICENSE', `${f.licenseFile} has no line starting with "SIL OPEN FONT LICENSE"`);
    const body = ofl.slice(at).trim();
    const users = bodies.get(body) ?? [];
    users.push(f.family);
    bodies.set(body, users);
    headers.push(`${f.family}\n${f.copyright}\nSource: ${f.source}\n${ofl.slice(0, at).trim()}`);
  }

  const parts = [`motion-deck engine\n${mit}`];
  if (headers.length) {
    parts.push(`Embedded fonts\n\n${headers.join('\n\n')}`);
    for (const [body, users] of bodies) parts.push(`License text for ${users.join(', ')}\n\n${body}`);
  }
  const notice = `<!--\n${parts.join('\n\n----------------------------------------\n\n')}\n-->`;
  if (notice.slice(4, -3).includes('-->') || notice.includes('--!>')) {
    throw new BuildError('E_LICENSE', 'a license text contains "-->" and cannot be embedded in an HTML comment');
  }
  return notice;
}
