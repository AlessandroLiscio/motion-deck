// node --test scripts/tests/engine.test.mjs
// Engine behaviour that needs a browser and a config the showcase does not have. Skipped when no Chrome or Edge is installed.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';
import { findBrowser } from '../lib/browser.mjs';
import { loadDeck, withBrowser } from '../lib/probe-kit.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const work = mkdtempSync(join(tmpdir(), 'md-engine-test-'));
after(() => rmSync(work, { recursive: true, force: true }));
const browser = ['chrome', 'edge'].find((n) => findBrowser(n));

// The showcase source with extra keys added to its config.
async function buildWith(extra, name) {
  const src = readFileSync(join(skill, 'examples', 'showcase.src.html'), 'utf8');
  const withExtra = src.replace(/("title"\s*:)/, `${JSON.stringify(extra).slice(1, -1)}, $1`);
  assert.notEqual(withExtra, src, 'config key not inserted');
  const file = join(work, `${name}.src.html`);
  (await import('node:fs')).writeFileSync(file, withExtra);
  const out = join(work, `${name}.html`);
  await build({ src: file, out, themeOverride: 'space', log: () => {} });
  return out;
}

describe('engine config', { skip: !browser && 'no browser installed' }, () => {
  test('"ambient": "off" starts with the moving background paused', async () => {
    const file = await buildWith({ ambient: 'off' }, 'ambient-off');
    await withBrowser({ which: browser }, async ({ client }) => {
      const p = await loadDeck(client, file);
      try {
        assert.equal(await p.evaluate('Deck.ambient()'), false);
        assert.equal(await p.evaluate('document.documentElement.classList.contains("still")'), true);
        assert.equal(await p.evaluate('document.getElementById("hud-amb").getAttribute("aria-pressed")'), 'false');
        assert.equal(await p.evaluate('Deck.ambient(true)'), true);
      } finally {
        await p.closeTarget();
      }
    });
  });
});
